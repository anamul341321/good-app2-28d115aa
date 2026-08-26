import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Home, Users, Film, MessageCircle } from "lucide-react";
import VideoTab from "@/components/social/VideoTab";

export const Route = createFileRoute("/_authenticated/videos")({
  component: VideosPage,
  head: () => ({
    meta: [
      { title: "ভিডিও — Good-App" },
      { name: "description", content: "ভিডিও, গান ও চ্যানেল আলাদাভাবে দেখুন এবং খুঁজুন।" },
      { property: "og:title", content: "ভিডিও — Good-App" },
      { property: "og:description", content: "ভিডিও, গান ও চ্যানেল আলাদাভাবে দেখুন এবং খুঁজুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function VideosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-3">
          <Link to="/feed" aria-label="ফিডে ফিরুন" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-lg font-black text-foreground">ভিডিও</h1>
          <Link to="/home" className="gradient-amber btn-press rounded-full px-3 py-2 text-xs font-black">Dashboard</Link>
        </div>
        <nav className="mx-auto grid h-11 max-w-lg grid-cols-4 border-t border-border/30">
          <Link to="/feed" className="grid place-items-center text-muted-foreground" aria-label="ফিড"><Home className="h-5 w-5" /></Link>
          <Link to="/friends" className="grid place-items-center text-muted-foreground" aria-label="বন্ধু"><Users className="h-5 w-5" /></Link>
          <Link to="/reels" className="grid place-items-center text-muted-foreground" aria-label="Short"><Film className="h-5 w-5" /></Link>
          <Link to="/chat" className="grid place-items-center text-muted-foreground" aria-label="মেসেঞ্জার"><MessageCircle className="h-5 w-5" /></Link>
        </nav>
      </header>
      <VideoTab />
    </div>
  );
}