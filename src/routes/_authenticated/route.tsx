import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Wallet, ArrowDownToLine, LogOut, Loader2, RefreshCcw, User, Settings, MoreVertical, FileText, ShieldCheck, Lock, ScrollText, LayoutGrid } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
import { EmailVerifyGate } from "@/components/EmailVerifyGate";
import { ProfileCompleteGate } from "@/components/ProfileCompleteGate";
import { useDeviceGuard } from "@/hooks/useDeviceGuard";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";
import { UserNoticeBanner } from "@/components/UserNoticeBanner";
import { SlotPausedModal } from "@/components/SlotPausedModal";
import { ServerBackModal } from "@/components/ServerBackModal";

import { clearSharedSession, getSharedSession } from "@/lib/auth-session";




export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">(() => {
    if (typeof window === "undefined") return "checking";
    // Quick synchronous check of localStorage to avoid splash screen flash
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.access_token && (!parsed.expires_at || parsed.expires_at * 1000 > Date.now())) {
              return "authenticated";
            }
          }
        }
      }
    } catch (e) {}
    return "checking";
  });
  const [authError, setAuthError] = useState(false);
  const [authAttempt, setAuthAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (authState !== "authenticated" || authAttempt > 0) setAuthState("checking");
    setAuthError(false);

    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setAuthError(true);
    }, 4_000);

    // নেটওয়ার্ক সমস্যা হলে যেন লগআউট না হয়ে যায়:
    // লোকাল সেশন থাকলে সেটাকেই বিশ্বাস করি, শুধু আসল sign-out হলে বের করে দিই।
    getSharedSession({ fresh: authAttempt > 0 }).then(({ data }) => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      if (!data.session) {
        setAuthState("unauthenticated");
        return;
      }
      setAuthState("authenticated");
    }).catch(() => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      setAuthError(true);
    });

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearSharedSession();
        setAuthState("unauthenticated");
        return;
      }
      if (session) setAuthState("authenticated");
    });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      sub.data.subscription.unsubscribe();
    };
  }, [authAttempt]);


  useDeviceGuard(authState === "authenticated");


  const logout = async () => {
    await supabase.auth.signOut();
    clearSharedSession();
    router.navigate({ to: "/auth" });
  };

  const { t } = useLang();

  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: authState === "authenticated",
  });

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
          {authError ? (
            <>
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 text-amber" />
              <p className="text-sm font-black">{t("নেটওয়ার্ক থেকে উত্তর পাওয়া যায়নি", "No response from the network")}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("ইন্টারনেট চালু আছে কি না দেখে আবার চেষ্টা করুন।", "Check your connection and try again.")}</p>
              <button
                type="button"
                onClick={() => setAuthAttempt((value) => value + 1)}
                className="gradient-cta mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black"
              >
                <RefreshCcw className="h-4 w-4" /> {t("আবার চেষ্টা করুন", "Try again")}
              </button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan" />
              <p className="text-sm font-bold">{t("একাউন্ট যাচাই করা হচ্ছে…", "Checking your account…")}</p>
            </>
          )}
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



  if (appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;

  return (
    <div className="min-h-screen pb-24">
      {appStatus?.faceVerifyEnabled === false ? (
        <SlotPausedModal message={appStatus?.faceVerifyMessage} />
      ) : (
        <ServerBackModal />
      )}


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
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("মেনু", "Menu")}
                className="btn-press flex items-center gap-1.5 rounded-xl gradient-navy px-3 py-2 text-gold border border-gold/40 shadow-lg outline-none">
                <MoreVertical className="w-5 h-5" />
                <span className="text-[11px] font-black">{t("মেনু", "Menu")}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 glass border-violet/30">
                <DropdownMenuLabel className="text-[11px] font-black text-muted-foreground">
                  {t("যাবতীয় কাজ", "Everything else")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 text-xs font-bold">
                    <Settings className="w-4 h-4 text-gold" /> {t("সেটিংস", "Settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 text-xs font-bold">
                    <User className="w-4 h-4 text-cyan" /> {t("প্রোফাইল", "Profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/earnings" className="flex items-center gap-2 text-xs font-bold">
                    <FileText className="w-4 h-4 text-emerald-400" /> {t("আয়ের হিসাব", "Earnings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/kyc" className="flex items-center gap-2 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-violet-400" /> {t("কেওয়াইসি", "KYC")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/privacy" className="flex items-center gap-2 text-xs font-bold">
                    <Lock className="w-4 h-4 text-cyan" /> {t("প্রাইভেসি পলিসি", "Privacy policy")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/terms" className="flex items-center gap-2 text-xs font-bold">
                    <ScrollText className="w-4 h-4 text-amber" /> {t("শর্তাবলি", "Terms")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout()} className="flex items-center gap-2 text-xs font-black text-rose">
                  <LogOut className="w-4 h-4" /> {t("লগআউট", "Log out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 glass border-t border-violet/20">
        <div className="max-w-md mx-auto px-1.5 py-2 grid grid-cols-6 gap-0.5">
          <NavItem to="/home" icon={<Home className="w-5 h-5" />} label={t("হোম", "Home")} tint="cyan" voice="home.welcome" />
          <div data-tour="nav-reverify"><NavItem to="/reverify" icon={<RefreshCcw className="w-5 h-5" />} label={t("রি-ভেরিফাই", "Re-verify")} tint="violet" voice="reverify.intro" /></div>
          <NavItem to="/referral" icon={<Users className="w-5 h-5" />} label={t("রেফার", "Refer")} tint="violet" />
          <NavItem to="/menu" icon={<LayoutGrid className="w-5 h-5" />} label={t("মেনু", "Menu")} tint="emerald" />
          <div data-tour="nav-wallet"><NavItem to="/wallet" icon={<Wallet className="w-5 h-5" />} label={t("ওয়ালেট", "Wallet")} tint="amber" voice="wallet.intro" /></div>
          <div data-tour="nav-withdraw"><NavItem to="/withdraw" icon={<ArrowDownToLine className="w-5 h-5" />} label={t("উইথড্র", "Withdraw")} tint="rose" voice="withdraw.intro" /></div>

        </div>
      </nav>

      <GuidedTour />
      <InstallPrompt />
      <LanguagePicker />
      <SlotResetApproval />

      <ProfileCompleteGate />
      <EmailVerifyGate />
      <UserNoticeBanner />


    </div>
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
