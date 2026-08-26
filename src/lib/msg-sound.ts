/**
 * মেসেজ এলে ছোট্ট সুন্দর "টিং" শব্দ — কোনো অডিও ফাইল লাগে না, তাই
 * অ্যাপের সাইজ বাড়ে না এবং সাথে সাথেই বাজে (imo/WhatsApp-এর মতো)।
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(at: number, freq: number, dur = 0.14, gain = 0.16) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** নতুন মেসেজ পাওয়ার শব্দ */
export function playMessageTone() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  blip(t, 987.77);
  blip(t + 0.13, 1318.51, 0.18);
  try {
    navigator.vibrate?.([0, 40, 60, 40]);
  } catch {
    /* ignore */
  }
}

/** নিজে মেসেজ পাঠানোর হালকা শব্দ */
export function playSentTone() {
  const ac = audio();
  if (!ac) return;
  blip(ac.currentTime, 1174.66, 0.1, 0.1);
}

/**
 * সাধারণ নোটিফিকেশনের শব্দ (কমেন্ট, রিঅ্যাকশন, মেনশন ইত্যাদি) —
 * মেসেজের "টিং" থেকে সম্পূর্ণ আলাদা, নিচের দিকে নামা দুই স্তরের ঘণ্টা।
 */
export function playNotifyTone() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  blip(t, 659.25, 0.2, 0.13);
  blip(t + 0.18, 523.25, 0.3, 0.11);
  try {
    navigator.vibrate?.(70);
  } catch {
    /* ignore */
  }
}

