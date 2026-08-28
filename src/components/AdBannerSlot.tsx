import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { showBottomBanner, hideBottomBanner, isBannerActive } from "@/lib/ads";

/** যেসব স্ক্রিনে ব্যানার দেখানো হবে না (ফুল-স্ক্রিন / বিরক্তিকর হয়) */
const BLOCKED = ["/reels", "/chat", "/call", "/video", "/story", "/messenger"];

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
    if (blocked) {
      void hideBottomBanner();
      document.body.classList.remove("ads-banner-on");
      return;
    }
    void isBannerActive().then((ok) => {
      if (!alive || !ok) return;
      void showBottomBanner();
      document.body.classList.add("ads-banner-on");
    });
    return () => {
      alive = false;
      void hideBottomBanner();
      document.body.classList.remove("ads-banner-on");
    };
  }, [blocked, path]);

  return null;
}
