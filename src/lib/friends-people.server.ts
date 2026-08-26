export type PublicPerson = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  uid_seq: number | null;
  is_verified_badge: boolean | null;
  status: "none" | "pending_sent" | "pending_received" | "accepted";
  linkId: string | null;
};

export const PUBLIC_COLS = "id, display_name, avatar_url, uid_seq, is_verified_badge";

export async function attachLinkStatus(
  supabase: any,
  me: string,
  rows: Array<Record<string, any>>,
): Promise<PublicPerson[]> {
  if (!rows.length) return [];
  const { data: links } = await supabase
    .from("friend_links")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  const byUser = new Map<string, any>();
  for (const l of (links ?? []) as any[]) {
    const other = l.requester_id === me ? l.addressee_id : l.requester_id;
    byUser.set(other, l);
  }
  return rows.map((p) => {
    const l = byUser.get(p.id);
    let status: PublicPerson["status"] = "none";
    if (l) {
      if (l.status === "accepted") status = "accepted";
      else if (l.status === "pending")
        status = l.requester_id === me ? "pending_sent" : "pending_received";
    }
    return {
      id: p.id,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      uid_seq: p.uid_seq ?? null,
      is_verified_badge: p.is_verified_badge ?? null,
      status,
      linkId: l?.id ?? null,
    };
  });
}

