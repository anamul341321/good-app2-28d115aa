import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UploadCloud, Image as ImageIcon, Video } from "lucide-react";
import { createLongVideoUploadWithThumbnail, uploadPostMedia } from "@/lib/feed-api";
import { awardCoins } from "@/lib/coins";
import { playUiSound } from "@/lib/ui-sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageBackHeader } from "@/components/PageBackHeader";

export const Route = createFileRoute("/_authenticated/studio")({
  component: StudioPage,
  head: () => ({
    meta: [
      { title: "স্টুডিও — ভিডিও আপলোড — good-app" },
      {
        name: "description",
        content: "নতুন লম্বা ভিডিও আপলোড করুন — good-app স্টুডিও।",
      },
      { property: "og:title", content: "স্টুডিও — ভিডিও আপলোড — good-app" },
      {
        property: "og:description",
        content: "নতুন লম্বা ভিডিও আপলোড করুন — good-app স্টুডিও।",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

function getVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Number.isFinite(video.duration) ? video.duration : undefined);
      };
      video.onerror = () => resolve(undefined);
      video.src = URL.createObjectURL(file);
    } catch {
      resolve(undefined);
    }
  });
}

function StudioPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!videoFile) throw new Error("no video");
      const duration = await getVideoDuration(videoFile);
      const videoPath = await uploadPostMedia(videoFile, videoFile.name, user.id);
      let thumbnailPath: string | undefined;
      if (thumbFile) {
        thumbnailPath = await uploadPostMedia(thumbFile, thumbFile.name, user.id);
      }
      const fullTitle = description.trim() ? `${title.trim()} — ${description.trim()}` : title.trim();
      const post = await createLongVideoUploadWithThumbnail(user.id, videoPath, fullTitle || "Untitled", duration, thumbnailPath);
      return post;
    },
    onSuccess: (post) => {
      toast.success("ভিডিও আপলোড হয়েছে");
      void awardCoins("reel", post?.id).then((c) => {
        if (c > 0) {
          playUiSound("coin");
          toast.success(`+${c} কয়েন পেয়েছেন 🪙`);
        }
      });
      navigate({ to: "/watch/$postId", params: { postId: post.id } });
    },
    onError: () => toast.error("আপলোড ব্যর্থ হয়েছে"),
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm font-bold text-muted-foreground">লগইন প্রয়োজন</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-xl px-4 py-6">
        <PageBackHeader title="নতুন ভিডিও আপলোড করুন" fallbackTo="/videos" />


        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-black text-muted-foreground">শিরোনাম</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ভিডিওর শিরোনাম লিখুন" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-muted-foreground">বিবরণ (ঐচ্ছিক)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ভিডিও সম্পর্কে লিখুন"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-muted-foreground">ভিডিও ফাইল</label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              className="btn-press flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-sm font-bold text-foreground"
            >
              <Video className="h-6 w-6 text-primary" />
              {videoFile ? videoFile.name : "ভিডিও নির্বাচন করুন"}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-muted-foreground">থাম্বনেইল (ঐচ্ছিক)</label>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => thumbInputRef.current?.click()}
              className="btn-press flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-sm font-bold text-foreground"
            >
              <ImageIcon className="h-6 w-6 text-primary" />
              {thumbFile ? thumbFile.name : "থাম্বনেইল নির্বাচন করুন"}
            </button>
          </div>

          <Button
            className="w-full gap-2"
            disabled={!title.trim() || !videoFile || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            আপলোড করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
