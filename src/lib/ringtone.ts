/**
 * ইনকামিং/আউটগোয়িং কলের রিংটোন — WebAudio oscillator ব্যবহার করে।
 * এটি ফোনের সাইলেন্ট মোড বা ব্রাউজার অটো-প্লে পলিসি মানতে পারে।
 */
type Ring = { stop: () => void };

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  return new AC();
}

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/** ইনকামিং কল: উজ্জ্বল দুই-নোটের মিষ্টি রিং + ভাইব্রেশন (লুপ) */
export function playIncomingRing(): Ring {
  const ac = ctx();
  let stopped = false;
  let timer: number | undefined;

  const chime = (t0: number) => {
    if (!ac) return;
    try {
      [
        { f: 1046.5, at: 0, dur: 0.26 },
        { f: 783.99, at: 0.24, dur: 0.26 },
        { f: 1318.5, at: 0.52, dur: 0.42 },
      ].forEach(({ f, at, dur }) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, t0 + at);
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + at + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + dur + 0.05);
      });
    } catch {}
  };

  const loop = () => {
    if (stopped) return;
    if (ac) {
      void ac.resume?.().then(() => {
        if (!stopped) chime(ac.currentTime + 0.02);
      }).catch(() => {});
    }
    vibrate([0, 400, 200, 400]);
    timer = window.setTimeout(loop, 2200);
  };
  loop();

  return {
    stop: () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      vibrate([0]);
      try {
        void ac?.close();
      } catch {}
    },
  };
}

/** কল দেওয়ার সময় নিজের পাশে হালকা রিং-ব্যাক টোন — ভিডিও কলে আলাদা দুই-নোট */
export function playRingback(video = false): Ring {
  const ac = ctx();
  let stopped = false;
  let timer: number | undefined;

  const beep = (t0: number) => {
    if (!ac) return;
    try {
      const notes = video
        ? [
            { f: 659.25, at: 0, dur: 0.16, gain: 0.14 },
            { f: 880, at: 0.19, dur: 0.22, gain: 0.13 },
          ]
        : [{ f: 440, at: 0, dur: 1.0, gain: 0.12 }];
      notes.forEach(({ f, at, dur, gain: level }) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = video ? "triangle" : "sine";
        osc.frequency.setValueAtTime(f, t0 + at);
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(level, t0 + at + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + dur + 0.05);
      });
    } catch {}
  };

  const loop = () => {
    if (stopped) return;
    if (ac) {
      void ac.resume?.().then(() => {
        if (!stopped) beep(ac.currentTime + 0.02);
      }).catch(() => {});
    }
    timer = window.setTimeout(loop, video ? 1800 : 3000);
  };
  loop();

  return {
    stop: () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      try {
        void ac?.close();
      } catch {}
    },
  };
}
