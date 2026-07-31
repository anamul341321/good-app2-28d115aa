// Weekly withdraw pause (Asia/Dhaka, UTC+6):
// Every Friday 1:00 PM  →  Saturday 10:00 AM withdraw requests are OFF.
// Outside that range withdraw is open (unless admin turns it off manually).

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function dhakaNow(now: number) {
  const d = new Date(now + DHAKA_OFFSET_MS);
  return {
    dow: d.getUTCDay(), // 0=Sun ... 5=Fri, 6=Sat
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
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

  // Friday of the current Dhaka week that governs "now"
  // Closed span: Fri 13:00 → Sat 10:00
  const daysSinceFriday = (dow - 5 + 7) % 7; // 0 on Fri, 1 on Sat, ...
  const fridayDay = day - daysSinceFriday;
  const closeAt = dhakaUtc(y, m, fridayDay, 13);
  const openAt = closeAt + 21 * 60 * 60 * 1000; // Sat 10:00

  const isClosed = now >= closeAt && now < openAt;

  // Next Friday 13:00 (for countdown when currently open)
  let nextClose = closeAt;
  if (now >= closeAt) nextClose = closeAt + 7 * 24 * 60 * 60 * 1000;

  const reopensAt = isClosed ? openAt : null;

  return {
    isClosed,
    reopensAt,
    nextCloseAt: nextClose,
    msUntilReopen: isClosed ? Math.max(0, openAt - now) : 0,
    msUntilClose: Math.max(0, nextClose - now),
    isFriday: dow === 5,
    hour,
  };
}

export const WITHDRAW_OFF_TITLE_BN = "জুমা মোবারক 🌙";
export const WITHDRAW_OFF_BN =
  "প্রতি শুক্রবার দুপুর ১:০০টা থেকে শনিবার সকাল ১০:০০টা পর্যন্ত উইথড্র রিকোয়েস্ট বন্ধ থাকে। শনিবার সকাল ১০টার পর আবার চালু হবে — ইনশাআল্লাহ।";

export function withdrawOffMessageBn(now: number = Date.now()) {
  const info = withdrawWindowInfo(now);
  if (!info.isClosed) return null;
  const mins = Math.ceil(info.msUntilReopen / 60000);
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${WITHDRAW_OFF_TITLE_BN} ${WITHDRAW_OFF_BN} (আর ${h} ঘণ্টা ${mm} মিনিট বাকি)`;
}
