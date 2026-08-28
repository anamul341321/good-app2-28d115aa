import { useEffect, useState } from "react";
import { showBottomBanner, hideBottomBanner, isBannerActive } from "@/lib/ads";

/**
 * নিচে AdMob banner দেখায় (শুধু অ্যাপে + অ্যাডমিন সুইচ ON হলে)।
 * ব্যানার নেটিভ ওভারলে, তাই কনটেন্ট যেন না ঢাকে সেজন্য সমান উচ্চতার
 * একটি ফাঁকা জায়গা রেখে দেয়। সুইচ OFF থাকলে কিছুই রেন্ডার হয় না।
 */
export function AdBannerSlot() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let alive = true;
    void isBannerActive().then((ok) => {
      if (!alive || !ok) return;
      setActive(true);
      void showBottomBanner();
    });
    return () => {
      alive = false;
      void hideBottomBanner();
    };
  }, []);

  if (!active) return null;
  return <div aria-hidden className="h-[60px] w-full shrink-0" />;
}
