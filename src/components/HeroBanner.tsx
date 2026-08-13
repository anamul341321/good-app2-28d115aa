import { WithdrawClosedBanner } from "@/components/WithdrawClosedBanner";
import { PromoBanner } from "@/components/PromoBanner";
import { RatesBanner } from "@/components/RatesBanner";
import { withdrawWindowInfo } from "@/lib/withdraw-window";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * ব্যানার ক্যারোসেল — অটো একটার পর একটা সাইডে যাবে, হাত দিয়েও swipe করা যাবে।
 *  • শুক্রবার (বা অ্যাডমিন withdraw বন্ধ রাখলে) → জুমা মোবারক ব্যানার
 *  • 2X বোনাস অফার চালু থাকলে → প্রমো ব্যানার (এক্সপায়ার হলে অটো চলে যাবে)
 *  • সবসময় → মাসিক রেট ব্যানার
 */
export function HeroBanner({
  adminOff,
  adminMessage,
  rates,
  bonus,
}: {
  adminOff?: boolean;
  adminMessage?: string | null;
  rates?: any;
  bonus?: any;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const showJumma = withdrawWindowInfo(now).showJummaBanner || !!adminOff;
  const promoActive =
    !!rates?.promo_active && !!rates?.promo_end_at && new Date(rates.promo_end_at).getTime() > now;

  const slides: ReactNode[] = [];
  if (showJumma) slides.push(<WithdrawClosedBanner adminOff={adminOff} adminMessage={adminMessage} />);
  // ইউজার যে বোনাস ইতিমধ্যে নিয়েছে সেটি "সম্পন্ন" দেখাবে; সব নেওয়া হলে ব্যানারই আসবে না।
  const claimed = {
    first: !!bonus?.selfFirstPaid,
    reverify: !!bonus?.userReverifyPaid,
    referrer: !!bonus?.referrerPaid,
  };
  const allBonusDone = claimed.first && claimed.reverify && claimed.referrer;
  if (promoActive && !allBonusDone) slides.push(<PromoBanner rates={rates} claimed={claimed} />);
  slides.push(<RatesBanner />);

  return <BannerCarousel slides={slides} />;
}

function BannerCarousel({ slides }: { slides: ReactNode[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      const el = scroller.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-0.5">
            {s}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === index ? "w-5 bg-amber" : "w-1.5 bg-muted-foreground/40")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
