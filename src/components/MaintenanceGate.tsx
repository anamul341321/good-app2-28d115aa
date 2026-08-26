import { useQuery } from "@tanstack/react-query";
import { Wrench, Loader2 } from "lucide-react";
import { getAppStatus } from "@/lib/app-status.functions";
import logo from "@/assets/goodapp-logo.png";

/** Admin switch ON করলে পুরো অ্যাপ বন্ধ — শুধু এই সুন্দর বাংলা মেসেজ দেখাবে। */
export function MaintenanceScreen({ message }: { message?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="premium-panel w-full max-w-sm rounded-3xl p-6 text-center space-y-4">
        <img src={logo} alt="good-app" className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
        <div className="w-14 h-14 mx-auto rounded-2xl gradient-navy flex items-center justify-center animate-pulse">
          <Wrench className="w-7 h-7 text-gold" />
        </div>
        <h1 className="text-xl font-black text-navy">🛠️ অ্যাপে কাজ চলছে</h1>
        <p className="text-[13px] font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {message?.trim() ||
            "প্রিয় ইউজার, আপনাদের সেবা আরও ভালো করার জন্য এখন অ্যাপে আপডেটের কাজ চলছে। এই সময় কোনো কাজ (ভেরিফাই, উইথড্র, রিচার্জ) করা যাবে না। কিছুক্ষণ পর আবার চেষ্টা করুন — আপনার টাকা ও একাউন্ট সম্পূর্ণ নিরাপদ আছে ইনশাআল্লাহ। ধন্যবাদ। 🌸"}
        </p>
        <div className="flex items-center justify-center gap-2 text-[11px] font-black text-cyan">
          <Loader2 className="w-4 h-4 animate-spin" /> কাজ চলছে…
        </div>
      </div>
    </div>
  );
}

/** maintenance ON হলে children বদলে maintenance screen দেখায়। */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (data?.maintenance) return <MaintenanceScreen message={data.message} />;
  return <>{children}</>;
}
