/**
 * ছবি না থাকলে লিঙ্গ অনুযায়ী ডিফল্ট অবতার — ছেলে হলে ছেলের, মেয়ে হলে মেয়ের।
 * ফাইলগুলো public/ থেকে সার্ভ হয়, তাই native push/bubble-এও একই URL ব্যবহার করা যায়।
 */
export type Gender = "male" | "female" | null | undefined;

export function defaultAvatarPath(gender: Gender): string | null {
  if (gender === "male") return "/avatar-male.png";
  if (gender === "female") return "/avatar-female.png";
  return null;
}

export function defaultAvatarUrl(gender: Gender, origin: string): string | null {
  const path = defaultAvatarPath(gender);
  return path ? `${origin.replace(/\/+$/, "")}${path}` : null;
}
