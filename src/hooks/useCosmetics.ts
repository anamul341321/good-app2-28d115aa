import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyTheme, restoreCosmeticsFromCache, setActiveEmojiKey } from "@/lib/cosmetics";
import { getCosmetics, type CosmeticState } from "@/lib/cosmetics.functions";

/**
 * Applies the user's equipped theme / emoji pack.
 * Cached values apply instantly, then the server value wins.
 */
export function useCosmetics() {
  useEffect(() => {
    restoreCosmeticsFromCache();
  }, []);

  const { data } = useQuery({
    queryKey: ["cosmetics"],
    queryFn: () => getCosmetics() as Promise<CosmeticState>,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    applyTheme(data.theme_key);
    setActiveEmojiKey(data.emoji_key);
  }, [data?.theme_key, data?.emoji_key]);
}
