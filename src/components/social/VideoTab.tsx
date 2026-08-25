import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Play, Search, X } from "lucide-react";
import {
  getBangladeshExternalVideos,
  getUploadedLongVideos,
  type ExternalReelVideo,
} from "@/lib/feed-api";
import { useFeedMedia } from "@/lib/feed-media";

/**
 * "ভিডিও দেখুন" tab — YouTube (external) + good-app uploaded long videos.
 */
export default function VideoTab() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<ExternalReelVideo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["feed-videos", search],
    queryFn: async () => {
      const [local, external] = await Promise.all([
        getUploadedLongVideos(1, 12),
        getBangladeshExternalVideos(1, 24, undefined, search || undefined, "long"),
      ]);
      return [...local.videos, ...external.videos];
    },
  });

  const videos = data || [];

  return (
    <div className="max-w-lg mx-auto pb-6">
      <div className="bg-white dark:bg-card mt-2 mx-1 rounded-lg p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ইউটিউব ভিডিও খুঁজুন (গান, নাটক, খবর...)"
            className="w-full bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground rounded-full pl-10 pr-4 py-2 text-sm border-none outline-none placeholder:text-gray-400"
          />
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : videos.length === 0 ? (
        <p className="py-16 text-center text-sm font-bold text-gray-500">কোনো ভিডিও পাওয়া যায়নি</p>
      ) : (
        <div className="mt-2 space-y-2">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} onPlay={() => setPlaying(v)} />
          ))}
        </div>
      )}

      {playing && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-3">
            <p className="line-clamp-1 flex-1 text-sm font-bold text-white">{playing.title}</p>
            <button onClick={() => setPlaying(null)} className="ml-2 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full aspect-video bg-black">
              <iframe
                src={`${playing.video_url}${playing.video_url.includes("?") ? "&" : "?"}autoplay=1`}
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
          {playing.watch_url && (
            <a
              href={playing.watch_url}
              target="_blank"
              rel="noreferrer"
              className="m-3 rounded-xl bg-white/15 py-2.5 text-center text-sm font-black text-white"
            >
              ইউটিউবে খুলুন
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: ExternalReelVideo; onPlay: () => void }) {
  const thumb = useFeedMedia(video.thumbnail_url || undefined);
  const isLocal = video.source === "good-app" && video.local_post_id;

  const body = (
    <div className="flex gap-3 bg-white dark:bg-card mx-1 rounded-lg p-2 active:scale-[0.99] transition">
      <div className="relative h-[72px] w-[124px] shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-secondary">
        {thumb ? <img src={thumb} alt={video.title} className="h-full w-full object-cover" /> : null}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55">
            <Play className="h-4 w-4 text-white" />
          </span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] font-bold text-gray-900 dark:text-foreground">{video.title}</p>
        <p className="mt-1 text-[12px] text-gray-500 dark:text-muted-foreground truncate">
          {video.creator || "Unknown"} · {isLocal ? "good-app" : "YouTube"}
        </p>
      </div>
    </div>
  );

  if (isLocal) {
    return (
      <Link to="/watch/$postId" params={{ postId: video.local_post_id as string }} className="block">
        {body}
      </Link>
    );
  }

  return (
    <button onClick={onPlay} className="block w-full text-left">
      {body}
    </button>
  );
}
