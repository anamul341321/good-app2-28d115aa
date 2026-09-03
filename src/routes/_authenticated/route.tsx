import { createFileRoute, Outlet, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { AdBannerSlot } from "@/components/AdBannerSlot";
import { OverlayUnstick } from "@/components/OverlayUnstick";
import { useCosmetics } from "@/hooks/useCosmetics";
import { supabase } from "@/integrations/supabase/client";
import { Home, Wallet, ArrowDownToLine, ArrowLeft, LogOut, Loader2, RefreshCcw, User, Users, Settings, MoreVertical, PhoneCall, ShoppingBag, FileText, ShieldCheck, ScrollText, LayoutGrid } from "lucide-react";
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
import logo from "@/assets/goodapp-logo.png";
import { GuidedTour } from "@/components/GuidedTour";
import { LanguageToggle } from "@/components/LanguageToggle";
import { RegionBadge } from "@/components/RegionBadge";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";
import { SlotResetApproval } from "@/components/SlotResetApproval";
import { EmailVerifyGate } from "@/components/EmailVerifyGate";
import { ProfileCompleteGate } from "@/components/ProfileCompleteGate";
import { useDeviceGuard } from "@/hooks/useDeviceGuard";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";
import { ChatNotifier } from "@/components/ChatNotifier";
import { NotificationBell } from "@/components/NotificationBell";
import { SlotPausedModal } from "@/components/SlotPausedModal";
import { NewSystemModal } from "@/components/NewSystemModal";
import { CallProvider } from "@/components/CallProvider";
import { DailyFaceVerificationWarning } from "@/components/DailyFaceVerificationWarning";
import { clearCurrentDeviceOtpTrust } from "@/lib/sessions.functions";
import { getDeviceId } from "@/hooks/useDeviceGuard";
import { useServerFn } from "@tanstack/react-start";

import { clearSharedSession, getSharedSession } from "@/lib/auth-session";
import { usePresence } from "@/lib/presence";




export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  // অ্যাপ খোলা + ডেটা অন থাকলেই "active" হার্টবিট যাবে (পুরো অ্যাপজুড়ে)
  usePresence();
  const router = useRouter();
  const clearOtpTrust = useServerFn(clearCurrentDeviceOtpTrust);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isSocialRoute = /^\/(social|chat|feed|friends|videos|reels|watch|studio|channel|user|profile)(\/|$)/.test(pathname);
  const lite = isLiteBuild();
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
    await clearOtpTrust({ data: { deviceId: getDeviceId() } }).catch(() => undefined);
    clearSharedSession();
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.replace("/auth");
  };

  const { t } = useLang();

  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: authState === "authenticated" && !isSocialRoute,
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



  if (!isSocialRoute && appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;

  return (
    <CallProvider>
    <div className={isSocialRoute ? "min-h-screen" : "min-h-screen pb-24"}>
      {!isSocialRoute && (
        appStatus?.faceVerifyEnabled === false ? (
          <SlotPausedModal message={appStatus?.faceVerifyMessage} />
        ) : (
          !lite ? <NewSystemModal /> : null
        )
      )}

      {!isSocialRoute && (
        <header className="sticky top-0 z-30 glass safe-top">
        <div className="max-w-md mx-auto px-3 pt-4 pb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {pathname !== "/home" && (
              <button
                type="button"
                aria-label={t("পিছনে যান", "Go back")}
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
                  else router.navigate({ to: "/home" });
                }}
                className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-foreground active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div data-tour="profile"><ProfileButton /></div>

          <Link to="/home" className="flex items-center gap-2 btn-press">
            <img src={logo} alt="good-app logo" className="w-9 h-9 rounded-xl shadow-lg" />
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-violet-500 via-cyan-500 to-amber-500 bg-clip-text text-transparent">
              good-app
            </span>
          </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <RegionBadge />
            <LanguageToggle />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                aria-label={t("মেনু", "Menu")}
                className="btn-press relative flex h-12 min-w-[52px] items-center justify-center gap-1 rounded-2xl gradient-navy px-3 text-gold border border-gold/50 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)] outline-none active:scale-95">
                <MoreVertical className="w-6 h-6" />
                <span className="text-[10px] font-black leading-none">{t("মেনু", "Menu")}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-3xl glass border-2 border-gold/30 p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
                <DropdownMenuLabel className="px-2 pb-2 pt-1 text-sm font-black text-gold">
                  {t("যাবতীয় কাজ", "Everything else")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gold/20" />

                <div className="grid grid-cols-2 gap-2 py-2">
                  <BigMenuLink to="/settings" icon={<Settings className="h-6 w-6" />} label={t("সেটিংস", "Settings")} tone="text-gold" />
                  <BigMenuLink to="/profile" icon={<User className="h-6 w-6" />} label={t("প্রোফাইল", "Profile")} tone="text-cyan" />
                  <BigMenuLink to="/feed" icon={<ScrollText className="h-6 w-6" />} label={t("নিউজ ফিড", "News Feed")} tone="text-blue-500" />
                  <BigMenuLink to="/chat" icon={<PhoneCall className="h-6 w-6" />} label={t("মেসেজ ও কল", "Chat & calls")} tone="text-emerald-400" />
                  {!lite && <BigMenuLink to="/earnings" icon={<FileText className="h-6 w-6" />} label={t("আয়ের হিসাব", "Earnings")} tone="text-emerald-400" />}
                  <BigMenuLink to="/kyc" icon={<ShieldCheck className="h-6 w-6" />} label={t("কেওয়াইসি", "KYC")} tone="text-violet-400" />
                  <BigMenuLink to="/reverify" search={{ taskId: undefined }} icon={<RefreshCcw className="h-6 w-6" />} label={lite ? t("নিরাপত্তা আপডেট", "Security update") : t("রি-ভেরিফাই", "Re-verify")} tone="text-violet-400" />
                  <BigMenuLink to="/rules" icon={<ScrollText className="h-6 w-6" />} label={t("নিয়মকানুন", "Rules")} tone="text-gold" />
                  <BigMenuLink to="/shop" icon={<ShoppingBag className="h-6 w-6" />} label={t("কয়েন শপ", "Coin shop")} tone="text-amber-400" />
                  <BigMenuLink to="/menu" icon={<LayoutGrid className="h-6 w-6" />} label={t("সব অপশন", "All options")} tone="text-amber-400" />
                </div>


                <DropdownMenuSeparator className="bg-gold/20" />
                <DropdownMenuItem
                  onSelect={() => logout()}
                  className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-rose-500/15 px-3 py-3.5 text-sm font-black text-rose focus:bg-rose-500/25">
                  <LogOut className="h-5 w-5" /> {t("লগআউট", "Log out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>
      )}

      {!isSocialRoute && <DailyFaceVerificationWarning />}

      <AdBannerSlot />

      <main className={isSocialRoute ? "" : "max-w-md mx-auto px-4 pt-4"}>
        <Outlet />
      </main>

      {!isSocialRoute && (
      <nav className="fixed bottom-0 inset-x-0 z-30 glass border-t border-violet/20">
        <div className={`max-w-md mx-auto px-1.5 py-2 grid gap-0.5 ${lite ? "grid-cols-4" : "grid-cols-6"}`}>
          <NavItem to="/home" icon={<Home className="w-5 h-5" />} label={t("হোম", "Home")} tint="cyan" voice="home.welcome" />
          <div data-tour="nav-reverify"><NavItem to="/reverify" search={{ taskId: undefined }} icon={<RefreshCcw className="w-5 h-5" />} label={lite ? t("আপডেট", "Update") : t("রি-ভেরিফাই", "Re-verify")} tint="violet" voice="reverify.intro" /></div>
          <NavItem to="/referral" icon={<Users className="w-5 h-5" />} label={t("রেফার", "Refer")} tint="violet" />
          <NavItem to="/menu" icon={<LayoutGrid className="w-5 h-5" />} label={t("মেনু", "Menu")} tint="emerald" />
          {!lite && <div data-tour="nav-wallet"><NavItem to="/wallet" icon={<Wallet className="w-5 h-5" />} label={t("ওয়ালেট", "Wallet")} tint="amber" voice="wallet.intro" /></div>}
          {!lite && <div data-tour="nav-withdraw"><NavItem to="/withdraw" icon={<ArrowDownToLine className="w-5 h-5" />} label={t("উইথড্র", "Withdraw")} tint="rose" voice="withdraw.intro" /></div>}

        </div>
      </nav>
      )}

      {!isSocialRoute && <GuidedTour />}

      {!isSocialRoute && <LanguagePicker />}
      {!isSocialRoute && <SlotResetApproval />}

      {!isSocialRoute && <ProfileCompleteGate />}
      {!isSocialRoute && <EmailVerifyGate />}
      <ChatNotifier />


    </div>
    </CallProvider>
  );
}

/** মেনুর বড় বড় সুন্দর টাইল — সহজে ট্যাপ করা যায় */
function BigMenuLink({ to, icon, label, tone, search }: { to: string; icon: React.ReactNode; label: string; tone: string; search?: any }) {
  return (
    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
      <Link
        to={to as any}
        search={search}

        className="btn-press flex h-[5.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2/80 border border-white/10 px-2 text-center active:scale-95">
        <span className={`grid h-11 w-11 place-items-center rounded-xl bg-white/10 ${tone}`}>{icon}</span>
        <span className="text-[12px] font-black leading-tight">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}




function ProfileButton() {
  const { data } = useQuery({ queryKey: ["profile-history"], queryFn: () => getProfileHistory(), staleTime: 60_000 });
  const uid = (data as any)?.profile?.uid_seq ?? null;
  return (
    <Link to="/profile" data-voice="profile.intro" className="btn-press flex flex-col items-center gap-0.5 active:scale-95">
      <span className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-gold/60 glow-gold bg-surface-2 flex items-center justify-center">
        {data?.avatar_signed
          ? <img src={data.avatar_signed} className="w-full h-full object-cover" alt="me" />
          : <User className="w-5 h-5 text-gold" />}
      </span>
      {/* প্রোফাইলে না ঢুকেই UID দেখা যাবে */}
      <span className="text-[9px] font-black leading-none text-gold mono-num" translate="no">
        UID {uid ?? "—"}
      </span>
    </Link>
  );
}

function NavItem({ to, icon, label, tint, voice, search }: { to: string; icon: React.ReactNode; label: string; tint: "cyan"|"violet"|"emerald"|"amber"|"rose"; voice?: string; search?: any }) {
  return (
    <Link to={to as any} data-voice={voice} search={search}
      activeProps={{ className: `nav-item-active nav-tint-${tint}` }}
      inactiveProps={{ className: `nav-tint-${tint} opacity-70` }}
      className="nav-item relative flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-black">
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
