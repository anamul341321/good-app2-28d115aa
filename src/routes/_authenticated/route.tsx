import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Wallet, ArrowDownToLine, LogOut, Loader2, RefreshCcw, Gift, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getProfileHistory } from "@/lib/profile.functions";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { GuidedTour } from "@/components/GuidedTour";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useLang } from "@/lib/i18n";
import { SlotResetApproval } from "@/components/SlotResetApproval";
import { StartGate } from "@/components/StartGate";



export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        setAuthState("unauthenticated");
        return;
      }
      setAuthState("authenticated");
    });

    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setAuthState("unauthenticated");
    });
    return () => {
      active = false;
      sub.data.subscription.unsubscribe();
    };
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  const { t } = useLang();

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan" />
          <p className="text-sm font-bold">{t("একাউন্ট যাচাই করা হচ্ছে…", "Checking your account…")}</p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
          <h1 className="text-lg font-black text-cyan">{t("লগইন করতে হবে", "Login required")}</h1>
          <p className="mt-2 text-xs text-muted-foreground">{t("টাস্ক করতে হলে আগে মোবাইল নম্বর দিয়ে লগইন করুন।", "Please sign in with your mobile number to continue.")}</p>
          <Link to="/auth" className="gradient-cta mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-black">
            {t("লগইন পেজ", "Go to login")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StartGate>
    <div className="min-h-screen pb-24">

      <header className="sticky top-0 z-30 glass">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div data-tour="profile"><ProfileButton /></div>
          <Link to="/home" className="flex items-center gap-2 btn-press">
            <img src={logo} alt="good-app logo" className="w-8 h-8 rounded-lg shadow-lg" />
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-violet-500 via-cyan-500 to-amber-500 bg-clip-text text-transparent">
              good-app
            </span>
          </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <button onClick={logout} data-voice="common.logout"
              className="btn-press p-2 rounded-lg bg-surface-2 border border-border text-muted-foreground hover:text-rose">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 glass border-t border-violet/20">
        <div className="max-w-md mx-auto px-2 py-2 grid grid-cols-5 gap-1">
          <NavItem to="/home" icon={<Home className="w-5 h-5" />} label={t("হোম", "Home")} tint="cyan" voice="home.welcome" />
          <div data-tour="nav-reverify"><NavItem to="/reverify" icon={<RefreshCcw className="w-5 h-5" />} label={t("রি-ভেরিফাই", "Re-verify")} tint="violet" voice="reverify.intro" /></div>
          <div data-tour="nav-referral"><NavItem to="/referral" icon={<Gift className="w-5 h-5" />} label={t("রেফার", "Refer")} tint="emerald" voice="referral.intro" /></div>
          <div data-tour="nav-wallet"><NavItem to="/wallet" icon={<Wallet className="w-5 h-5" />} label={t("ওয়ালেট", "Wallet")} tint="amber" voice="wallet.intro" /></div>
          <div data-tour="nav-withdraw"><NavItem to="/withdraw" icon={<ArrowDownToLine className="w-5 h-5" />} label={t("উইথড্র", "Withdraw")} tint="rose" voice="withdraw.intro" /></div>
        </div>
      </nav>

      <GuidedTour />
      <InstallPrompt />
      <LanguagePicker />
      <SlotResetApproval />

    </div>
    </StartGate>
  );
}


function ProfileButton() {
  const { data } = useQuery({ queryKey: ["profile-history"], queryFn: () => getProfileHistory(), staleTime: 60_000 });
  return (
    <Link to="/profile" data-voice="profile.intro" className="btn-press w-9 h-9 rounded-full overflow-hidden border-2 border-gold/60 glow-gold bg-surface-2 flex items-center justify-center">
      {data?.avatar_signed
        ? <img src={data.avatar_signed} className="w-full h-full object-cover" alt="me" />
        : <User className="w-4 h-4 text-gold" />}
    </Link>
  );
}

function NavItem({ to, icon, label, tint, voice }: { to: string; icon: React.ReactNode; label: string; tint: "cyan"|"violet"|"emerald"|"amber"|"rose"; voice?: string }) {
  return (
    <Link to={to as any} data-voice={voice}
      activeProps={{ className: `nav-item-active nav-tint-${tint}` }}
      inactiveProps={{ className: `nav-tint-${tint} opacity-70` }}
      className="nav-item relative flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-black">
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
