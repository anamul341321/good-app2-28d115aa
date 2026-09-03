/**
 * In-app cosmetic catalog — themes and emoji packs unlocked with Good Coin.
 *
 * Cosmetics are pure decoration inside the app. Coins are earned by using the
 * app (posts, reels, stories, messages, check-in) and can only be spent here.
 * Nothing here can be bought with money, sold, gifted or cashed out.
 */

export type ThemeItem = {
  key: string;
  name: string;
  desc: string;
  cost: number;
  swatch: [string, string, string];
};

export type EmojiItem = {
  key: string;
  name: string;
  desc: string;
  cost: number;
  emojis: string[];
};

export const THEMES: ThemeItem[] = [
  { key: "default", name: "ক্লাসিক", desc: "ডিফল্ট লুক — সবার জন্য ফ্রি", cost: 0, swatch: ["#7c3aed", "#22d3ee", "#f59e0b"] },
  { key: "ocean", name: "ওশান ব্লু", desc: "ঠান্ডা নীল সমুদ্র টোন", cost: 3000, swatch: ["#0ea5e9", "#06b6d4", "#38bdf8"] },
  { key: "sunset", name: "সানসেট", desc: "কমলা-গোলাপি সন্ধ্যার আলো", cost: 6000, swatch: ["#f97316", "#ec4899", "#fbbf24"] },
  { key: "emerald", name: "এমারেল্ড", desc: "সবুজ প্রিমিয়াম ফিনিশ", cost: 9000, swatch: ["#10b981", "#34d399", "#a7f3d0"] },
  { key: "neon", name: "নিয়ন নাইট", desc: "উজ্জ্বল নিয়ন গ্লো", cost: 15000, swatch: ["#a855f7", "#22d3ee", "#f0abfc"] },
  { key: "royal", name: "রয়েল গোল্ড", desc: "সবচেয়ে দামি — গোল্ড রয়েল লুক", cost: 25000, swatch: ["#b45309", "#f59e0b", "#fde68a"] },
];

export const EMOJI_PACKS: EmojiItem[] = [
  { key: "classic", name: "ক্লাসিক ইমোজি", desc: "ডিফল্ট রিঅ্যাকশন সেট", cost: 0, emojis: ["👍", "❤️", "😂", "😮", "😢", "🔥", "🙏"] },
  { key: "love", name: "লাভ প্যাক", desc: "ভালোবাসার ইমোজি", cost: 2500, emojis: ["❤️", "💖", "😍", "🥰", "💘", "😘", "🌹"] },
  { key: "party", name: "পার্টি প্যাক", desc: "মজার ও উৎসবের ইমোজি", cost: 5000, emojis: ["🎉", "🥳", "🎊", "🕺", "💃", "🍰", "✨"] },
  { key: "animal", name: "অ্যানিমেল প্যাক", desc: "কিউট প্রাণীর ইমোজি", cost: 7500, emojis: ["🐶", "🐱", "🦁", "🐼", "🦊", "🐧", "🐨"] },
  { key: "cool", name: "কুল প্যাক", desc: "স্টাইলিশ রিঅ্যাকশন", cost: 12000, emojis: ["😎", "🤩", "🫡", "🤙", "💯", "⚡", "🚀"] },
  { key: "legend", name: "লেজেন্ড প্যাক", desc: "সবচেয়ে দামি প্রিমিয়াম সেট", cost: 20000, emojis: ["👑", "🏆", "💎", "🦅", "🌟", "🔱", "🪄"] },
];

export const FREE_THEME = "default";
export const FREE_EMOJI = "classic";

export const findTheme = (key?: string | null) =>
  THEMES.find((t) => t.key === key) ?? THEMES[0]!;
export const findEmojiPack = (key?: string | null) =>
  EMOJI_PACKS.find((e) => e.key === key) ?? EMOJI_PACKS[0]!;

/* ---------------- live application ---------------- */

const THEME_LS = "gc_theme";
const EMOJI_LS = "gc_emoji";

let activeEmojiKey: string = FREE_EMOJI;

/** Reaction / quick emoji set currently equipped (safe on the server too). */
export function activeEmojis(): string[] {
  return findEmojiPack(activeEmojiKey).emojis;
}

export function setActiveEmojiKey(key: string) {
  activeEmojiKey = findEmojiPack(key).key;
  try {
    localStorage.setItem(EMOJI_LS, activeEmojiKey);
  } catch {
    /* storage blocked */
  }
}

export function applyTheme(key: string) {
  const theme = findTheme(key);
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.key}`));
  if (theme.key !== FREE_THEME) root.classList.add(`theme-${theme.key}`);
  try {
    localStorage.setItem(THEME_LS, theme.key);
  } catch {
    /* storage blocked */
  }
}

/** Restore the last known cosmetics instantly (before the server responds). */
export function restoreCosmeticsFromCache() {
  if (typeof window === "undefined") return;
  try {
    applyTheme(localStorage.getItem(THEME_LS) ?? FREE_THEME);
    activeEmojiKey = findEmojiPack(localStorage.getItem(EMOJI_LS)).key;
  } catch {
    /* storage blocked */
  }
}
