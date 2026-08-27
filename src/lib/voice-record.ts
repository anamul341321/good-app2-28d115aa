// ভয়েস মেসেজ রেকর্ডার — Web Audio দিয়ে PCM ধরে সম্পূর্ণ WAV ফাইল বানায়।
// MediaRecorder-এর webm-এ duration metadata থাকে না, তাই প্লেব্যাক মাঝপথে কেটে
// যেত ও ওয়েভফর্ম মিলত না। WAV-এ সঠিক duration + আসল amplitude peaks পাওয়া যায়।

export type VoiceRecording = {
  blob: Blob;
  duration: number; // সেকেন্ড (দশমিকসহ)
  peaks: number[]; // 0..1, ওয়েভফর্মের বার
};

const TARGET_RATE = 16000;
export const VOICE_PEAK_COUNT = 40;

function downsample(input: Float32Array, from: number, to: number) {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function computePeaks(samples: Float32Array, count = VOICE_PEAK_COUNT) {
  const peaks: number[] = [];
  const bucket = Math.max(1, Math.floor(samples.length / count));
  let max = 0.0001;
  for (let i = 0; i < count; i += 1) {
    const start = i * bucket;
    const end = Math.min(samples.length, start + bucket);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += samples[j] * samples[j];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    peaks.push(rms);
    if (rms > max) max = rms;
  }
  // সবচেয়ে জোরালো অংশকে ১ ধরে normalize — জোরে বললে বার বড়, আস্তে বললে ছোট।
  return peaks.map((v) => Math.min(1, Math.max(0.06, v / max)));
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export class VoiceRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private frames = 0;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    await this.ctx.resume().catch(() => {});
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.frames = 0;
    this.node.onaudioprocess = (event) => {
      const data = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(data));
      this.frames += data.length;
    };
    this.source.connect(this.node);
    // Chrome-এ ScriptProcessor চালু রাখতে destination দরকার; gain 0 রেখে ইকো এড়ানো।
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute);
    mute.connect(this.ctx.destination);
  }

  get elapsed() {
    return this.ctx ? this.frames / this.ctx.sampleRate : 0;
  }

  async stop(): Promise<VoiceRecording | null> {
    const ctx = this.ctx;
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.node = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
    if (!ctx) return null;
    const rate = ctx.sampleRate;
    const total = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    await ctx.close().catch(() => {});
    if (total < rate * 0.25) return null; // খুব ছোট/খালি রেকর্ডিং
    const samples = downsample(merged, rate, TARGET_RATE);
    return {
      blob: encodeWav(samples, TARGET_RATE),
      duration: total / rate,
      peaks: computePeaks(samples),
    };
  }
}
