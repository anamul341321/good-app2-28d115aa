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
  { key: "default", name: "ক্লাসিক", desc: "ডিফল্ট লাইট লুক — সবার জন্য ফ্রি", cost: 0, swatch: ["#7c3aed", "#22d3ee", "#f59e0b"] },
  { key: "ocean", name: "ওশান ব্লু", desc: "ঠান্ডা নীল টোন + সফট সমুদ্র গ্লো", cost: 3000, swatch: ["#0369a1", "#0ea5e9", "#7dd3fc"] },
  { key: "sunset", name: "সানসেট গ্লো", desc: "কমলা-গোলাপি সন্ধ্যার উষ্ণ আলো", cost: 6000, swatch: ["#ea580c", "#f43f5e", "#fbbf24"] },
  { key: "emerald", name: "এমারেল্ড লাক্স", desc: "গভীর সবুজ প্রিমিয়াম ফিনিশ", cost: 9000, swatch: ["#047857", "#10b981", "#a7f3d0"] },
  { key: "neon", name: "নিয়ন নাইট (প্রিমিয়াম)", desc: "ডার্ক গ্লাস UI + নিয়ন গ্লো কার্ড", cost: 15000, swatch: ["#a855f7", "#22d3ee", "#0b0b16"] },
  { key: "royal", name: "রয়েল গোল্ড (এলিট)", desc: "সবচেয়ে দামি — ডার্ক নেভি + গোল্ড গ্লো", cost: 25000, swatch: ["#f5c451", "#b8860b", "#101426"] },
];

export const EMOJI_PACKS: EmojiItem[] = [
  { key: "classic", name: "ক্লাসিক ইমোজি", desc: "ডিফল্ট রিঅ্যাকশন সেট", cost: 0, emojis: ["👍", "❤️", "😂", "😮", "😢", "🔥", "🙏"] },
  { key: "love", name: "লাভ প্যাক", desc: "রোমান্টিক ও মিষ্টি রিঅ্যাকশন", cost: 2500, emojis: ["❤️‍🔥", "💖", "😍", "🥰", "💘", "😘", "🌹"] },
  { key: "party", name: "পার্টি প্যাক", desc: "উৎসব ও মজার রিঅ্যাকশন", cost: 5000, emojis: ["🎉", "🥳", "🎊", "🪩", "💃", "🍾", "✨"] },
  { key: "animal", name: "অ্যানিমেল প্যাক", desc: "কিউট প্রাণীর রিঅ্যাকশন", cost: 7500, emojis: ["🐶", "🐱", "🦁", "🐼", "🦊", "🐧", "🦄"] },
  { key: "cool", name: "কুল প্যাক (প্রিমিয়াম)", desc: "স্টাইলিশ, অ্যাটিটিউড রিঅ্যাকশন", cost: 12000, emojis: ["😎", "🤩", "🫡", "🤙", "💯", "⚡", "🚀"] },
  { key: "legend", name: "লেজেন্ড প্যাক (এলিট)", desc: "সবচেয়ে দামি — রেয়ার প্রিমিয়াম সেট", cost: 20000, emojis: ["👑", "🏆", "💎", "🐉", "🌠", "🔱", "🪄"] },
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
