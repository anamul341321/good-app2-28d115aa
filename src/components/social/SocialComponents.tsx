import React, { useState, useRef } from "react";
import { X, Image as ImageIcon, Video, Send, Plus, ChevronLeft, ChevronRight, Heart, Smile, MessageSquare, Share2, MoreHorizontal, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPost, createStory, addComment, reactToPost, deletePost } from "@/lib/news-feed.functions";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { format } from "date-fns";

// --- Helpers ---
export async function uploadMedia(file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('social_media')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('social_media')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// --- Post Composer ---
export function PostComposer({ onClose, author }: { onClose: () => void, author: any }) {
  const { t } = useLang();
  const [body, setBody] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { body: string, mediaUrls: string[] }) => createPost({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("পোস্ট করা হয়েছে", "Posted successfully"));
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const urls = [];
      for (const file of Array.from(files)) {
        const url = await uploadMedia(file);
        urls.push(url);
      }
      setMediaUrls(prev => [...prev, ...urls]);
    } catch (err: any) {
      toast.error(t("আপলোড ব্যর্থ হয়েছে", "Upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between p-4 border-b">
        <button onClick={onClose} className="btn-press"><X className="w-6 h-6" /></button>
        <h2 className="text-lg font-black text-navy">{t("পোস্ট তৈরি করুন", "Create Post")}</h2>
        <button 
          onClick={() => mutation.mutate({ body, mediaUrls })}
          disabled={(!body.trim() && mediaUrls.length === 0) || isUploading || mutation.isPending}
          className="bg-[#1877F2] text-white px-4 py-1.5 rounded-md font-bold text-sm disabled:opacity-50"
        >
          {mutation.isPending ? t("পোস্ট হচ্ছে...", "Posting...") : t("পোস্ট", "Post")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <MessengerAvatar src={author?.avatar_url} name={author?.display_name || "User"} size="md" />
          <div>
            <p className="font-bold text-navy">{author?.display_name || "User"}</p>
            <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full w-fit">
              <Plus className="w-3 h-3" /> {t("পাবলিক", "Public")}
            </div>
          </div>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("আপনার মনে কি চলছে?", "What's on your mind?")}
          className="w-full text-lg border-none focus:ring-0 resize-none min-h-[150px]"
        />

        {mediaUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {mediaUrls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isUploading && <div className="text-center py-4 text-sm text-gray-500">{t("আপলোড হচ্ছে...", "Uploading...")}</div>}
      </div>

      <footer className="p-4 border-t flex items-center justify-between">
        <p className="text-sm font-bold text-gray-600">{t("পোস্টে যোগ করুন", "Add to your post")}</p>
        <div className="flex gap-4">
          <button onClick={() => fileInputRef.current?.click()} className="text-green-500 btn-press"><ImageIcon className="w-6 h-6" /></button>
          <button className="text-[#1877F2] btn-press"><Video className="w-6 h-6" /></button>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
      </footer>
    </div>
  );
}

// --- Story Creator ---
export function StoryCreator({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (mediaUrl: string) => createStory({ data: { mediaUrl, mediaType: "image" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success(t("স্টোরি যোগ করা হয়েছে", "Story added successfully"));
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadMedia(file);
      mutation.mutate(url);
    } catch (err: any) {
      toast.error(t("আপলোড ব্যর্থ হয়েছে", "Upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between p-4">
        <button onClick={onClose} className="text-white btn-press"><X className="w-6 h-6" /></button>
        <h2 className="text-lg font-black text-white">{t("স্টোরি তৈরি করুন", "Create Story")}</h2>
        <div className="w-6" />
      </header>
      
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-xs aspect-[9/16] bg-gradient-to-br from-[#1877F2] to-[#3B82F6] rounded-2xl flex flex-col items-center justify-center text-white space-y-4 btn-press cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <ImageIcon className="w-8 h-8" />
          </div>
          <p className="font-black text-lg">{t("ছবি নির্বাচন করুন", "Select Photo")}</p>
        </div>
        
        {isUploading && <div className="text-white font-bold animate-pulse">{t("আপলোড হচ্ছে...", "Uploading...")}</div>}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
    </div>
  );
}

// --- Story Viewer ---
export function StoryViewer({ stories, initialIndex, onClose }: { stories: any[], initialIndex: number, onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const story = stories[index];
  const total = stories.length;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (index < total - 1) setIndex(index + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [index, total, onClose]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 inset-x-0 p-4 z-10 pt-[env(safe-area-inset-top)]">
        <div className="flex gap-1 mb-4">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-white transition-all duration-[5000ms] ease-linear ${i === index ? "w-full" : i < index ? "w-full" : "w-0"}`}
              />
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessengerAvatar src={story.author?.avatar_url} name={story.author?.display_name || "User"} size="sm" />
            <span className="text-white font-bold text-sm shadow-sm">{story.author?.display_name || "User"}</span>
            <span className="text-white/70 text-xs">{format(new Date(story.created_at), "h:mm a")}</span>
          </div>
          <button onClick={onClose} className="text-white btn-press"><X className="w-6 h-6" /></button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        <img src={story.media_url} alt="" className="w-full h-full object-contain" />
        
        <div className="absolute inset-y-0 left-0 w-1/3" onClick={() => index > 0 && setIndex(index - 1)} />
        <div className="absolute inset-y-0 right-0 w-1/3" onClick={() => index < total - 1 ? setIndex(index + 1) : onClose()} />
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 pb-[env(safe-area-inset-bottom)] flex items-center gap-2">
        <input 
          placeholder="Reply to story..." 
          className="flex-1 bg-transparent border border-white/30 rounded-full px-4 py-2 text-white text-sm focus:ring-0 focus:border-white"
        />
        <Heart className="text-white w-6 h-6 btn-press" />
      </div>
    </div>
  );
}

// --- Reaction Selector ---
export function ReactionSelector({ onSelect }: { onSelect: (type: string) => void }) {
  const reactions = [
    { type: "like", icon: Heart, color: "text-[#1877F2]", bg: "bg-[#1877F2]" },
    { type: "love", icon: Heart, color: "text-rose-500", bg: "bg-rose-500", fill: true },
    { type: "haha", icon: Smile, color: "text-amber-500", bg: "bg-amber-500" },
    { type: "wow", icon: Sparkles, color: "text-amber-500", bg: "bg-amber-500" },
    { type: "sad", icon: Clock, color: "text-amber-500", bg: "bg-amber-500" },
    { type: "angry", icon: Trash2, color: "text-rose-600", bg: "bg-rose-600" },
  ];

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white shadow-xl rounded-full p-1.5 flex gap-2 border animate-in slide-in-from-bottom-2">
      {reactions.map((r) => (
        <button 
          key={r.type} 
          onClick={() => onSelect(r.type)}
          className={`h-8 w-8 rounded-full flex items-center justify-center hover:scale-125 transition-transform btn-press ${r.bg} text-white`}
        >
          <r.icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/>
  </svg>
);

// --- Comment System ---
export function CommentSection({ post, onPostComment }: { post: any, onPostComment: (body: string) => void }) {
  const { t } = useLang();
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: string) => addComment({ data: { postId: post.id, body } }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <div className="border-t bg-gray-50/50">
      <div className="p-3 space-y-4">
        {post.comments?.map((c: any) => (
          <div key={c.id} className="flex gap-2">
            <MessengerAvatar src={c.author?.avatar_url} name={c.author?.display_name || "User"} size="sm" />
            <div className="flex-1">
              <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block">
                <p className="text-[12px] font-bold text-navy">{c.author?.display_name || "User"}</p>
                <p className="text-[13px] text-gray-800 leading-tight">{c.body}</p>
              </div>
              <div className="flex gap-4 ml-3 mt-1">
                <button className="text-[11px] font-bold text-gray-500">{t("লাইক", "Like")}</button>
                <button className="text-[11px] font-bold text-gray-500">{t("রিপ্লাই", "Reply")}</button>
                <span className="text-[11px] text-gray-400">{format(new Date(c.created_at), "h:mm a")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t bg-white flex items-center gap-2">
        <MessengerAvatar size="sm" name="Me" />
        <div className="flex-1 relative">
          <input 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("একটি মন্তব্য লিখুন...", "Write a comment...")}
            className="w-full bg-gray-100 border-none rounded-full px-4 py-2 text-[13px] focus:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && comment.trim()) mutation.mutate(comment);
            }}
          />
          <button 
            onClick={() => mutation.mutate(comment)}
            disabled={!comment.trim() || mutation.isPending}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1877F2] disabled:text-gray-300"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
