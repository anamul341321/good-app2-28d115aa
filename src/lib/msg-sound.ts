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

/** নতুন মেসেজ — মেসেঞ্জারের মতো একটাই ছোট টোন */
export function playMessageTone() {
  const ac = audio();
  if (!ac) return;
  blip(ac.currentTime, 1046.5, 0.1, 0.14);
  try {
    navigator.vibrate?.(30);
  } catch {
    /* ignore */
  }
}

/** নিজে মেসেজ পাঠানোর হালকা শব্দ */
export function playSentTone() {
  const ac = audio();
  if (!ac) return;
  blip(ac.currentTime, 1174.66, 0.07, 0.08);
}

/** সাধারণ নোটিফিকেশন — একবারই ছোট নরম টোন (ভয় লাগার মতো নয়) */
export function playNotifyTone() {
  const ac = audio();
  if (!ac) return;
  blip(ac.currentTime, 783.99, 0.1, 0.1);
  try {
    navigator.vibrate?.(25);
  } catch {
    /* ignore */
  }
}


