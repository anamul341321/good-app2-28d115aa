/**
 * "কত সময় আগে active ছিল" — মেসেঞ্জারের মতো ছোট লেখা।
 * ডেটা অন থাকলে (অ্যাপ খোলা) presence থেকেই "Active now" আসে,
 * নাহলে profiles.last_active_at দেখে সময় হিসাব হয়।
 */

/** ২ মিনিটের মধ্যে হার্টবিট থাকলে এখনো অনলাইন ধরা হবে */
export const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export function isRecentlyActive(lastActiveAt?: string | null) {
  if (!lastActiveAt) return false;
  const t = new Date(lastActiveAt).getTime();
  return Number.isFinite(t) && Date.now() - t < ACTIVE_WINDOW_MS;
}

/** "৫ মিনিট আগে active" / "২ ঘণ্টা আগে active" */
export function formatLastActive(lastActiveAt?: string | null): string | null {
  if (!lastActiveAt) return null;
  const t = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "এইমাত্র active ছিল";
  if (min < 60) return `${min} মিনিট আগে active`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ঘণ্টা আগে active`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} দিন আগে active`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} সপ্তাহ আগে active`;
  return "অনেকদিন আগে active";
}

/** চ্যাট রো-র জন্য খুব ছোট রূপ: "৫ মি" / "২ ঘ" */
export function shortLastActive(lastActiveAt?: string | null): string | null {
  if (!lastActiveAt) return null;
  const t = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(t)) return null;
  const min = Math.floor(Math.max(0, Date.now() - t) / 60_000);
  if (min < 1) return "এখন";
  if (min < 60) return `${min} মি`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ঘ`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} দি`;
  return `${Math.floor(day / 7)} সপ্তা`;
}
