// Withdraw opens on the 1st of every month (Asia/Dhaka). Before that a
// countdown is shown. Admin can still pause withdraw manually.
//
// The "জুমা মোবারক 🌙" banner is purely visual: it shows every Friday
// (Asia/Dhaka) and disappears automatically at Friday midnight (12:00 AM).

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function dhakaNow(now: number) {
  const d = new Date(now + DHAKA_OFFSET_MS);
  return {
    dow: d.getUTCDay(), // 0=Sun ... 5=Fri, 6=Sat
    hour: d.getUTCHours(),
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}

function dhakaUtc(y: number, m: number, d: number, h: number) {
  return Date.UTC(y, m, d, h) - DHAKA_OFFSET_MS;
}

export function withdrawWindowInfo(now: number = Date.now()) {
  const { dow, hour, y, m, day } = dhakaNow(now);
  const isFriday = dow === 5;
  // Friday ends at midnight (start of Saturday, Dhaka time)
  const midnight = dhakaUtc(y, m, day + 1, 0);
  // Next Friday 00:00 Dhaka
  const daysUntilFriday = (5 - dow + 7) % 7;
  const nextFriday = dhakaUtc(y, m, day + (daysUntilFriday === 0 ? 7 : daysUntilFriday), 0);

  return {
    // Withdraw is never auto-closed anymore (admin manual pause still works)
    isClosed: false,
    isFriday,
    showJummaBanner: isFriday,
    msUntilBannerEnd: isFriday ? Math.max(0, midnight - now) : 0,
    nextFridayAt: nextFriday,
    hour,
  };
}

/** Returns the next 1st-of-month 00:00 Dhaka and whether today is that day. */
export function withdrawCountdownInfo(now: number = Date.now()) {
  const { y, m, day } = dhakaNow(now);
  const isOpen = day === 1;

  let targetY = y;
  let targetM = m;
  if (day > 1) {
    targetM += 1;
    if (targetM > 11) {
      targetM = 0;
      targetY += 1;
    }
  }

  const nextFirstAt = dhakaUtc(targetY, targetM, 1, 0);
  return {
    isOpen,
    nextFirstAt,
    msUntilOpen: Math.max(0, nextFirstAt - now),
  };
}

export const WITHDRAW_OFF_TITLE_BN = "জুমা মোবারক 🌙";
export const WITHDRAW_OFF_BN =
  "শুক্রবার জুমার দিন — আপনার ইবাদত কবুল হোক। উইথড্র চালু আছে, শুধু অ্যাডমিন চাইলে সাময়িকভাবে বন্ধ রাখতে পারেন।";

// Kept for compatibility: no automatic withdraw pause anymore.
export function withdrawOffMessageBn(_now: number = Date.now()): string | null {
  return null;
}
