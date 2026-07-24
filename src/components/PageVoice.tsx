import type { NarrationKey } from "@/lib/narrations";

export interface PageVoiceProps {
  pageId?: string;
  steps?: NarrationKey[];
  autoStart?: boolean;
  compact?: boolean;
}

// Voice guide fully disabled per user request — component renders nothing
// and the click-driven narration listener is never attached.
export function PageVoice(_props: PageVoiceProps = {}) {
  return null;
}

export function SpeakChip(_props: { narrationKey: NarrationKey; label?: string }) {
  return null;
}
