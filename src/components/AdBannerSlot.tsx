import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { showBottomBanner, hideBottomBanner, isBannerActive } from "@/lib/ads";

/** Active call-এ native controls ঢেকে যেতে পারে; বাকি সব authenticated screen-এ banner থাকে। */
const BLOCKED = ["/call"];

/**
 * নিচে ছোট AdMob banner (শুধু অ্যাপে + অ্যাডমিন সুইচ ON হলে)।
 * ব্যানার নেটিভ ওভারলে, তাই কনটেন্ট না ঢাকতে body-তে সমান padding দেয়।
 * সুইচ OFF থাকলে কোনো কিছুই হয় না — অ্যাপ আগের মতোই থাকে।
 */
export function AdBannerSlot() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const blocked = BLOCKED.some((p) => path.includes(p));

  useEffect(() => {
    let alive = true;
    let retry: number | undefined;
    const display = async () => {
      const ok = await isBannerActive();
      if (!alive || !ok) return;
      // showBanner() request accepted হওয়া নয়, native Loaded event পাওয়ার পরই
      // সফল ধরা হয়। ব্যর্থ হলে নতুন settings/নেটওয়ার্ক নিয়ে আবার চেষ্টা করবে।
      const shown = await showBottomBanner();
      if (!alive) return;
      if (shown) {
        document.body.classList.add("ads-banner-on");
      } else {
        document.body.classList.remove("ads-banner-on");
        retry = window.setTimeout(() => void display(), 20_000);
      }
    };
    if (blocked) {
      void hideBottomBanner();
      document.body.classList.remove("ads-banner-on");
      return;
    }
    void display();
    return () => {
      alive = false;
      if (retry !== undefined) window.clearTimeout(retry);
      void hideBottomBanner();
      document.body.classList.remove("ads-banner-on");
    };
  }, [blocked, path]);

  return null;
}
