import { WithdrawClosedBanner } from "@/components/WithdrawClosedBanner";
import { PromoBanner } from "@/components/PromoBanner";
import { withdrawWindowInfo } from "@/lib/withdraw-window";
import { useEffect, useState } from "react";

/**
 * শুক্রবার হলে (বা অ্যাডমিন withdraw বন্ধ রাখলে) জুমা মোবারক ব্যানার,
 * বাকি দিনে সেই একই জায়গায় 2X বোনাস অফারের ব্যানার (আগুনের অ্যানিমেশনসহ)।
 */
export function HeroBanner({
  adminOff,
  adminMessage,
  rates,
}: {
  adminOff?: boolean;
  adminMessage?: string | null;
  rates?: any;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const showJumma = withdrawWindowInfo(now).showJummaBanner || !!adminOff;
  if (showJumma) return <WithdrawClosedBanner adminOff={adminOff} adminMessage={adminMessage} />;
  return <PromoBanner rates={rates ?? null} />;
}
