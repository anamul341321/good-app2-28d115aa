// Mining withdraw window: 1st–3rd of every month (Asia/Dhaka, UTC+6).
// Users can withdraw mining balance ONLY during these 3 days.
// Outside the window mining balance is locked until next month's 1st.
// Bonus balance is unaffected — always withdrawable.

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function dhakaParts(now: number) {
  const d = new Date(now + DHAKA_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

// UTC ms of a given Dhaka-local Y/M/D at 00:00 Dhaka
function dhakaMidnightUtc(y: number, m: number, d: number) {
  return Date.UTC(y, m, d) - DHAKA_OFFSET_MS;
}

export function miningWindowInfo(now: number = Date.now()) {
  const { y, m, day } = dhakaParts(now);
  const monthStart = dhakaMidnightUtc(y, m, 1);
  const windowEnd = monthStart + 3 * DAY_MS; // exclusive: end of day 3
  const nextMonthStart = dhakaMidnightUtc(y, m + 1, 1);

  const isOpen = now >= monthStart && now < windowEnd;
  const nextOpenAt = isOpen ? nextMonthStart : (now < monthStart ? monthStart : nextMonthStart);
  const closesAt = windowEnd;

  return {
    isOpen,
    dhakaDay: day,
    monthStart,
    windowEnd,
    nextOpenAt,
    closesAt,
    // Human helpers
    msUntilOpen: Math.max(0, nextOpenAt - now),
    msUntilClose: Math.max(0, closesAt - now),
    daysUntilOpen: Math.ceil(Math.max(0, nextOpenAt - now) / DAY_MS),
  };
}

// Bangla month names for messaging
const BN_MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
export function nextOpenLabelBn(now: number = Date.now()) {
  const info = miningWindowInfo(now);
  const d = new Date(info.nextOpenAt + DHAKA_OFFSET_MS);
  return `${BN_MONTHS[d.getUTCMonth()]} ১ তারিখ`;
}
