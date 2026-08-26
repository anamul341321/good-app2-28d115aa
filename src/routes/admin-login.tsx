import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminLogin } from "@/lib/admin-auth.functions";
import { Shield, Loader2 } from "lucide-react";
import logo from "@/assets/goodapp-logo.png";

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const router = useRouter();
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await login({ data: { password } });
      if (res.ok) {
        await router.navigate({ to: "/admin" });
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="glass rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber/15 flex items-center justify-center glow-gold">
            <img src={logo} alt="good-app logo" className="w-12 h-12 rounded-xl" />
          </div>
          <h1 className="text-lg font-black">অ্যাডমিন প্যানেল</h1>
          <p className="text-[11px] text-muted-foreground">
            শুধু অ্যাডমিন পাসওয়ার্ড দিয়ে প্রবেশ করুন। ইউজার একাউন্টের সাথে এই প্যানেলের কোনো সম্পর্ক নেই।
          </p>
        </div>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="অ্যাডমিন পাসওয়ার্ড"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border focus:border-cyan outline-none text-sm mono-num"
        />
        {error && <p className="text-rose text-[11px] text-center">ভুল পাসওয়ার্ড</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "প্রবেশ করুন"}
        </button>
      </form>
    </div>
  );
}
