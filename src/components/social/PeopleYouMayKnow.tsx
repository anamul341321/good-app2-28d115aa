import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { getSuggestedPeople, sendFriendRequest } from "@/lib/friends.functions";
import { useFeedMedia } from "@/lib/feed-media";

function CardAvatar({ path, name }: { path?: string | null; name: string }) {
  const url = useFeedMedia(path);
  if (url) return <img src={url} alt={name} className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-3xl font-black text-blue-600">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/** ফেসবুক-স্টাইল "আপনি চিনতে পারেন" — ফিডের ভিতরে হরাইজন্টাল কার্ড রো */
export function PeopleYouMayKnow() {
  const queryClient = useQueryClient();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const suggested = useQuery({
    queryKey: ["suggested-people", 0],
    queryFn: () => getSuggestedPeople({ data: { limit: 12, offset: 0 } }),
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: (userId: string) => sendFriendRequest({ data: { userId } }),
    onSuccess: (_r, userId) => {
      setSent((s) => ({ ...s, [userId]: true }));
      toast.success("ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: () => toast.error("রিকোয়েস্ট পাঠানো যায়নি"),
  });

  const people = (((suggested.data as any)?.people ?? []) as any[]).filter((p) => !hidden[p.id]);
  if (suggested.isLoading || people.length === 0) return null;

  return (
    <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-border/30">
      <div className="max-w-lg mx-auto px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-foreground">আপনি চিনতে পারেন</h3>
          <Link to="/friends" className="text-[13px] font-bold text-blue-600">সব দেখুন</Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {people.map((p: any) => {
            const name = p.display_name ?? "User";
            const isSent = sent[p.id] || p.status === "pending_sent";
            return (
              <div
                key={p.id}
                className="min-w-[150px] max-w-[150px] shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-secondary">
                <Link to="/user/$userId" params={{ userId: p.id }} className="block h-[150px] w-full">
                  <CardAvatar path={p.avatar_url} name={name} />
                </Link>
                <div className="p-2">
                  <p className="truncate text-[13px] font-bold text-gray-900 dark:text-foreground">{name}</p>
                  <p className="mb-2 truncate text-[11px] text-gray-500 dark:text-muted-foreground">
                    {p.mutualCount ? `${p.mutualCount} জন কমন বন্ধু` : `UID ${p.uid_seq ?? "-"}`}
                  </p>
                  <button
                    onClick={() => !isSent && add.mutate(p.id)}
                    disabled={isSent || add.isPending}
                    className={`btn-press flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-bold ${
                      isSent ? "bg-gray-200 dark:bg-muted text-gray-600 dark:text-muted-foreground" : "bg-blue-600 text-white"
                    }`}>
                    {isSent ? <><Check className="h-4 w-4" /> পাঠানো</> : <><UserPlus className="h-4 w-4" /> বন্ধু যোগ</>}
                  </button>
                  <button
                    onClick={() => setHidden((h) => ({ ...h, [p.id]: true }))}
                    className="btn-press mt-1.5 w-full rounded-md bg-gray-100 dark:bg-muted/40 py-2 text-[13px] font-bold text-gray-700 dark:text-muted-foreground">
                    সরান
                  </button>
                </div>
              </div>
            );
          })}
          {suggested.isFetching && (
            <div className="flex min-w-[60px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
