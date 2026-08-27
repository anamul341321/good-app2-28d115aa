import { useState, useRef, useEffect, useCallback } from "react";
import { X, Type, Music, Check, Search, Loader2, Palette, AlignCenter, Pause, Play, Sticker, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { STORY_MUSIC_LIBRARY, StoryMusicTrack, buildStoredMusicValue, isBanglaOrIslamicQuery, searchLocalStoryMusic } from "@/lib/story-music";
import { searchStoryMusic } from "@/lib/story-music.functions";
import { attachBackgroundAudio } from "@/lib/background-audio";

const TEXT_COLORS = [
  "#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#FF69B4", "#00FFFF", "#FF6600", "#9900FF",
];

const FONT_SIZES = [20, 28, 36, 48, 60];

const STICKERS = ["❤️", "😂", "🔥", "😍", "👍", "🎉", "💯", "✨", "🥰", "😎", "🙏", "💖", "🌹", "☕", "🎵", "🌙", "⭐", "💔", "🤲", "🕌"];

const FILTERS = [
  { name: "Normal", value: "none" },
  { name: "Bright", value: "brightness(1.15) contrast(1.1)" },
  { name: "Warm", value: "sepia(0.35) saturate(1.3)" },
  { name: "Cool", value: "hue-rotate(180deg) saturate(0.9)" },
  { name: "B&W", value: "grayscale(1)" },
  { name: "Vintage", value: "sepia(0.6) contrast(1.2) brightness(0.95)" },
  { name: "Dramatic", value: "contrast(1.4) saturate(1.2)" },
  { name: "Fade", value: "brightness(1.05) saturate(0.7) opacity(0.92)" },
];

type StickerItem = { id: number; emoji: string; x: number; y: number; scale: number };
type TextItem = { id: number; text: string; color: string; fontSize: number; x: number; y: number };

type Props = {
  imageFile: File;
  onClose: () => void;
  onPublish: (editedFile: File, musicName?: string) => void;
  isPending: boolean;
};

export default function StoryEditor({ imageFile, onClose, onPublish, isPending }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [filter, setFilter] = useState("none");
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [activeTextId, setActiveTextId] = useState<number | null>(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [selectedMusic, setSelectedMusic] = useState<StoryMusicTrack | null>(null);
  const [remoteTracks, setRemoteTracks] = useState<StoryMusicTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [dragType, setDragType] = useState<"text" | "sticker" | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const backgroundAudioCleanupRef = useRef<(() => void) | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    const img = new Image();
    img.src = url;
    img.onload = () => { imgRef.current = img; };
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      backgroundAudioCleanupRef.current?.();
      backgroundAudioCleanupRef.current = null;
    };
  }, []);

  // অনলাইন সার্চ — বাংলা/গজল কুয়েরির ক্ষেত্রে লোকাল লাইব্রেরি আগে দেখাবে
  useEffect(() => {
    const q = musicQuery.trim();
    if (q.length < 2) { setRemoteTracks([]); setSearching(false); return; }
    if (isBanglaOrIslamicQuery(q)) { setRemoteTracks([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchStoryMusic({ data: { query: q } });
        setRemoteTracks((res?.tracks ?? []) as StoryMusicTrack[]);
      } catch {
        setRemoteTracks([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [musicQuery]);

  const localMatches = isBanglaOrIslamicQuery(musicQuery)
    ? searchLocalStoryMusic(musicQuery)
    : STORY_MUSIC_LIBRARY.filter((m) =>
        m.title.toLowerCase().includes(musicQuery.toLowerCase()) ||
        m.artist.toLowerCase().includes(musicQuery.toLowerCase()) ||
        m.genre.toLowerCase().includes(musicQuery.toLowerCase())
      );

  const filteredMusic = musicQuery.trim().length >= 2
    ? (isBanglaOrIslamicQuery(musicQuery)
        ? localMatches
        : [...remoteTracks, ...localMatches.filter((l) => !remoteTracks.some((r) => r.title.toLowerCase() === l.title.toLowerCase()))])
    : localMatches.slice(0, 20);

  const playPreview = (song: StoryMusicTrack) => {
    backgroundAudioCleanupRef.current?.();
    backgroundAudioCleanupRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(song.audioUrl);
    audio.volume = 0.55;
    audioRef.current = audio;
    backgroundAudioCleanupRef.current = attachBackgroundAudio(audio as HTMLAudioElement, song.audioUrl, {
      title: song.title,
      artist: song.artist,
    });
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    audio.onended = () => setIsPlaying(false);
  };

  const stopPreview = () => {
    backgroundAudioCleanupRef.current?.();
    backgroundAudioCleanupRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const selectMusic = (song: StoryMusicTrack) => {
    setSelectedMusic(song);
    playPreview(song);
    setShowMusicPicker(false);
  };

  const addText = () => {
    const id = nextId.current++;
    setTexts((prev) => [...prev, { id, text: "", color: "#FFFFFF", fontSize: 36, x: 0.5, y: 0.5 }]);
    setActiveTextId(id);
    setShowTextEditor(true);
    setShowStickerPicker(false);
    setShowFilterPicker(false);
  };

  const updateText = (id: number, patch: Partial<TextItem>) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addSticker = (emoji: string) => {
    const id = nextId.current++;
    setStickers((prev) => [...prev, { id, emoji, x: 0.5, y: 0.5, scale: 1 }]);
    setShowStickerPicker(false);
  };

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (isDragging === null || !containerRef.current || !dragType) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height));
    if (dragType === "text") {
      updateText(isDragging, { x, y });
    } else {
      setStickers((prev) => prev.map((s) => (s.id === isDragging ? { ...s, x, y } : s)));
    }
  }, [isDragging, dragType]);

  const endDrag = () => {
    setIsDragging(null);
    setDragType(null);
  };

  const activeText = texts.find((t) => t.id === activeTextId) ?? null;

  const publishStory = async () => {
    if (!imgRef.current) return;
    stopPreview();

    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;

    // Apply filter by drawing with CSS filter via temporary canvas trick
    if (filter !== "none") {
      ctx.filter = filter;
    }
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";

    // Draw stickers
    const scale = img.naturalWidth / 400;
    stickers.forEach((s) => {
      const size = 48 * scale * s.scale;
      ctx.font = `${size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.emoji, s.x * canvas.width, s.y * canvas.height);
    });

    // Draw texts
    texts.forEach((t) => {
      if (!t.text.trim()) return;
      const drawFontSize = t.fontSize * scale;
      ctx.font = `bold ${drawFontSize}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = drawFontSize * 0.15;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const x = t.x * canvas.width;
      const y = t.y * canvas.height;
      const maxWidth = canvas.width * 0.85;
      const words = t.text.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = drawFontSize * 1.3;
      const startY = y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, x, startY + i * lineHeight);
      });
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "story.jpg", { type: "image/jpeg" });
      const musicValue = selectedMusic ? buildStoredMusicValue(selectedMusic) : undefined;
      onPublish(file, musicValue);
    }, "image/jpeg", 0.9);
  };

  const bottomBar = (
    <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-3">
      <button
        onClick={() => { setShowTextEditor(!showTextEditor); setShowMusicPicker(false); setShowStickerPicker(false); setShowFilterPicker(false); }}
        className={`grid h-12 w-12 place-items-center rounded-full shadow-lg backdrop-blur-md transition-transform active:scale-90 ${showTextEditor ? "bg-white text-black" : "bg-black/40 text-white"}`}
      >
        <Type className="w-5 h-5" />
      </button>
      <button
        onClick={() => { setShowStickerPicker(!showStickerPicker); setShowTextEditor(false); setShowMusicPicker(false); setShowFilterPicker(false); }}
        className={`grid h-12 w-12 place-items-center rounded-full shadow-lg backdrop-blur-md transition-transform active:scale-90 ${showStickerPicker ? "bg-white text-black" : "bg-black/40 text-white"}`}
      >
        <Sticker className="w-5 h-5" />
      </button>
      <button
        onClick={() => { setShowFilterPicker(!showFilterPicker); setShowTextEditor(false); setShowMusicPicker(false); setShowStickerPicker(false); }}
        className={`grid h-12 w-12 place-items-center rounded-full shadow-lg backdrop-blur-md transition-transform active:scale-90 ${showFilterPicker ? "bg-white text-black" : "bg-black/40 text-white"}`}
      >
        <Sparkles className="w-5 h-5" />
      </button>
      <button
        onClick={() => { setShowMusicPicker(!showMusicPicker); setShowTextEditor(false); setShowStickerPicker(false); setShowFilterPicker(false); }}
        className={`grid h-12 w-12 place-items-center rounded-full shadow-lg backdrop-blur-md transition-transform active:scale-90 ${showMusicPicker ? "bg-white text-black" : "bg-black/40 text-white"}`}
      >
        <Music className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 z-30">
        <button onClick={() => { stopPreview(); onClose(); }} className="p-2 text-white">
          <X className="w-6 h-6" />
        </button>

        <button
          onClick={publishStory}
          disabled={isPending}
          className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-bold disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "শেয়ার করুন"}
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        ref={containerRef}
        onMouseMove={handleDragMove}
        onTouchMove={handleDragMove}
        onMouseUp={endDrag}
        onTouchEnd={endDrag}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={{ filter }}
          />
        )}

        {texts.map((t) => (
          <div
            key={t.id}
            className="absolute cursor-move select-none"
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            onMouseDown={() => { setIsDragging(t.id); setDragType("text"); setActiveTextId(t.id); }}
            onTouchStart={() => { setIsDragging(t.id); setDragType("text"); setActiveTextId(t.id); }}
          >
            <p
              style={{
                color: t.color,
                fontSize: `${t.fontSize}px`,
                fontWeight: "bold",
                textShadow: "2px 2px 8px rgba(0,0,0,0.7)",
                textAlign: "center",
                maxWidth: "80vw",
                wordBreak: "break-word",
                lineHeight: 1.3,
              }}
            >
              {t.text || "ট্যাপ করে লিখুন"}
            </p>
          </div>
        ))}

        {stickers.map((s) => (
          <div
            key={s.id}
            className="absolute cursor-move select-none text-5xl"
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            onMouseDown={() => { setIsDragging(s.id); setDragType("sticker"); }}
            onTouchStart={() => { setIsDragging(s.id); setDragType("sticker"); }}
          >
            {s.emoji}
          </div>
        ))}

        {selectedMusic && (
          <div className="absolute top-16 left-4 right-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-2 z-10">
            <Music className="w-4 h-4 text-white shrink-0" />
            <p className="text-white text-xs truncate flex-1">🎵 {selectedMusic.title} - {selectedMusic.artist}</p>
            <button
              onClick={() => (isPlaying ? stopPreview() : playPreview(selectedMusic))}
              className="text-white/80 hover:text-white p-1"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => { stopPreview(); setSelectedMusic(null); }} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {bottomBar}
      </div>

      <AnimatePresence>
        {showTextEditor && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="bg-gray-900 px-4 py-3 space-y-3 z-30">
            <div className="flex items-center gap-2">
              <input
                value={activeText?.text ?? ""}
                onChange={(e) => activeTextId && updateText(activeTextId, { text: e.target.value })}
                placeholder="টেক্সট লিখুন..."
                className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 text-sm border-none outline-none placeholder:text-gray-500"
                autoFocus
              />
              <button
                onClick={addText}
                className="px-3 py-3 rounded-lg bg-blue-600 text-white text-sm font-black"
              >
                + নতুন
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex gap-2 overflow-x-auto">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => activeTextId && updateText(activeTextId, { color })}
                    className={`w-7 h-7 rounded-full shrink-0 border-2 ${activeText?.color === color ? "border-white scale-110" : "border-gray-600"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AlignCenter className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex gap-2">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => activeTextId && updateText(activeTextId, { fontSize: size })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${activeText?.fontSize === size ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {activeTextId && (
              <button
                onClick={() => {
                  setTexts((prev) => prev.filter((t) => t.id !== activeTextId));
                  setActiveTextId(null);
                }}
                className="w-full py-2 rounded-lg bg-rose-500/10 text-rose-500 text-sm font-black"
              >
                এই টেক্সট মুছুন
              </button>
            )}

            <p className="text-gray-500 text-xs text-center">💡 টেক্সট ড্র্যাগ করে সরানো যাবে</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStickerPicker && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="bg-gray-900 px-4 py-3 z-30">
            <p className="text-gray-400 text-xs mb-2">স্টিকার ট্যাপ করুন — তারপর ছবিতে সরানো যাবে</p>
            <div className="flex flex-wrap gap-2">
              {STICKERS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addSticker(emoji)}
                  className="text-3xl p-2 rounded-full hover:bg-white/10 transition-transform active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFilterPicker && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="bg-gray-900 px-4 py-3 z-30">
            <p className="text-gray-400 text-xs mb-2">ফিল্টার সিলেক্ট করুন</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-colors ${filter === f.value ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMusicPicker && (
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="bg-gray-900 max-h-[50vh] flex flex-col z-30">
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={musicQuery}
                  onChange={(e) => setMusicQuery(e.target.value)}
                  placeholder="গান খুঁজুন (বাংলা/গজল লিখলে সঠিক গান আসবে)..."
                  className="w-full bg-gray-800 text-white rounded-full pl-10 pr-4 py-2.5 text-sm border-none outline-none placeholder:text-gray-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-2 py-2 space-y-0.5">
              {filteredMusic.map((song) => (
                <button
                  key={song.id}
                  onClick={() => selectMusic(song)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    selectedMusic?.id === song.id ? "bg-blue-600/20" : "hover:bg-gray-800"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{song.title}</p>
                    <p className="text-gray-400 text-xs truncate">{song.artist} · {song.genre}</p>
                  </div>
                  {selectedMusic?.id === song.id && <Check className="w-5 h-5 text-blue-500 shrink-0" />}
                </button>
              ))}

              {searching && (
                <p className="text-gray-400 text-sm text-center py-4 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> গান খোঁজা হচ্ছে...
                </p>
              )}

              {!searching && filteredMusic.length === 0 && <p className="text-gray-500 text-sm text-center py-6">কোনো গান পাওয়া যায়নি</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
