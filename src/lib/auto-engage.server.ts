/**
 * অটো-এনগেজমেন্ট ইঞ্জিন — কেউ পোস্ট/রিলস দিলে আমাদের আসল ইউজারদের আইডি দিয়ে
 * ধীরে ধীরে (দিনে ১–২ হাজার) লাইক ও টপিক-অনুযায়ী বাংলা কমেন্ট যোগ হয়।
 * ফেক অ্যাকাউন্ট নয় — অ্যাপের রেজিস্টার্ড প্রোফাইল থেকেই আসে।
 */

export type Sentiment = "sad" | "funny" | "love" | "islamic" | "motivational" | "food" | "music" | "general";

const KEYWORDS: Record<Exclude<Sentiment, "general">, string[]> = {
  sad: ["কষ্ট", "দুঃখ", "কান্না", "কাঁদ", "বিরহ", "মন খারাপ", "একা", "হারিয়ে", "মৃত্যু", "মারা", "শোক", "sad", "cry", "pain", "miss"],
  funny: ["মজা", "হাসি", "ফানি", "কমেডি", "মশকরা", "পাগল", "হাস্য", "funny", "comedy", "lol", "haha", "prank", "troll"],
  love: ["ভালোবাসা", "ভালবাসা", "প্রেম", "বউ", "স্বামী", "প্রিয়", "রোমান্টিক", "বিয়ে", "love", "romantic", "couple", "wedding"],
  islamic: ["আল্লাহ", "নামাজ", "ইসলাম", "কুরআন", "হাদিস", "দোয়া", "রাসুল", "নবী", "মসজিদ", "islam", "allah", "quran", "dua"],
  motivational: ["পরিশ্রম", "সফল", "স্বপ্ন", "চেষ্টা", "অনুপ্রেরণা", "জীবন", "শিক্ষা", "motivation", "success", "hard work", "dream"],
  food: ["রান্না", "খাবার", "রেসিপি", "মিষ্টি", "বিরিয়ানি", "নাস্তা", "food", "recipe", "cooking", "tasty"],
  music: ["গান", "সুর", "মিউজিক", "কনসার্ট", "গায়ক", "song", "music", "singing", "cover"],
};

const COMMENTS: Record<Sentiment, string[]> = {
  sad: [
    "মন টা খারাপ হয়ে গেল ভাই 💔",
    "সত্যি অনেক কষ্টের, চোখে পানি এসে গেল 😢",
    "Allah sobar kosto dur korun 🤲",
    "এই ভিডিও দেখে নিজের কথা মনে পড়ে গেল…",
    "কষ্টের কথা গুলো একদম মনের ভেতর লাগে 😞",
    "Ki kosto vai, mon kharap hoye gelo 💔",
    "দুআ রইলো, সব ঠিক হয়ে যাবে ইনশাআল্লাহ 🤲",
    "এত সুন্দর করে কষ্ট বুঝানো যায়… respect ❤️‍🩹",
    "Sob somoy hasi thakena, eta buji 😔",
    "চোখ ভিজে গেল সত্যি 😭",
  ],
  funny: [
    "হাসতে হাসতে শেষ 😂😂",
    "Ki funny vai, barbar dekhtesi 🤣",
    "এইটা তো মারাত্মক মজা হইছে 😆",
    "ভাই আপনি তো কমেডি কিং 👑😂",
    "Hasi thamai rakhte partesina 🤣🤣",
    "এই টাইমিং টা পুরাই জোস 😂🔥",
    "Sokal sokal hasa dilen vai 😄",
    "মন খারাপ ছিল, এখন হাসতেছি 😂❤️",
    "আরেকটা বানান ভাই, waiting 😆",
    "Puro pagol banai dilen 🤣",
  ],
  love: [
    "মাশাআল্লাহ, অনেক সুন্দর জোড়া ❤️",
    "Ki cute vai, Allah sukhe rakhuk 🤲❤️",
    "ভালোবাসা এমনই হওয়া উচিত 💕",
    "Onek sundor, nozor na lage 😍",
    "এই মিষ্টি মুহূর্ত গুলো থেকে যাক ❤️",
    "Duijoner jonno onek dua 🥰",
    "সত্যি মনটা ভরে গেল দেখে 💖",
    "Perfect couple 😍🔥",
    "ভালো থাকুন সবসময় ❤️",
    "Emon valobasa sobar hok 💞",
  ],
  islamic: [
    "মাশাআল্লাহ, খুব সুন্দর কথা 🤲",
    "Allah amader sobaike hedayet dan korun 🤍",
    "সুবহানাল্লাহ ❤️",
    "জাযাকাল্লাহু খাইরান ভাই 🤲",
    "Onek upokari kotha, share korlam 🤍",
    "আলহামদুলিল্লাহ, শুনে মন শান্ত হলো ☘️",
    "Allah apnake uttom protidan din 🤲",
    "এমন ভিডিও আরো দরকার ❤️",
    "Amin 🤲🤍",
    "কথাগুলো একদম হৃদয়ে লাগলো ☘️",
  ],
  motivational: [
    "কথা গুলো একদম সত্যি 🔥",
    "Onek inspire holam vai 💪",
    "এইটা শোনার দরকার ছিল আজ ❤️",
    "Sotti e porishrom er kono alternative nai 💪🔥",
    "ভাই আপনি অনেক ভালো বলেন 👏",
    "Notun kore chesta korar shahos pelam 🔥",
    "প্রতিদিন এমন কিছু দরকার 💯",
    "Save kore rakhlam vai ❤️",
    "সাহস পেয়ে গেলাম 💪",
    "Motivation full pack 🔥👏",
  ],
  food: [
    "দেখেই তো খেতে ইচ্ছে করছে 🤤",
    "Recipe ta try korbo inshallah 😋",
    "মাশাআল্লাহ, দুর্দান্ত হয়েছে 👌",
    "Ki mojar khabar vai 🤤🔥",
    "জিভে জল এসে গেল 😋",
    "Ranna te apnar hat joss 👏",
    "এইটা বানানো শিখতে হবে 😍",
    "Khete mon chaitese ekhoni 🤤",
    "সুন্দর করে দেখিয়েছেন ❤️",
    "Next time misti banan 😋",
  ],
  music: [
    "কী সুন্দর গলা মাশাআল্লাহ 🎶",
    "Gan ta bar bar sunlam ❤️🎵",
    "সুরটা মনে গেঁথে গেল 🎶",
    "Voice ta osadharon 🔥",
    "আরো গান চাই ভাই ❤️",
    "Ei gan er jonno like fixed 🎵",
    "মন ছুঁয়ে গেল 🎶❤️",
    "Talent ache vai, egiye jan 👏",
    "হেডফোনে শুনছি, দারুণ 🎧❤️",
    "Amazing 🔥🎶",
  ],
  general: [
    "মাশাআল্লাহ অনেক সুন্দর ❤️",
    "Onek valo laglo vai 👏",
    "দুর্দান্ত হয়েছে 🔥",
    "Egiye jan vai, sathe achi ❤️",
    "সুন্দর ভিডিও, ভালো লাগলো 😊",
    "Nice vai 🔥👌",
    "এভাবেই চালিয়ে যান 💪",
    "Sundor kaj hoise ❤️",
    "ভালোবাসা রইলো ❤️",
    "Wow, joss hoise 🔥",
    "সাপোর্ট রইলো ভাই 👍",
    "Amader app er best video 😍",
    "সুন্দর হয়েছে",
    "Valo laglo",
    "খুব ভালো কাজ, চালিয়ে যান",
    "Sundor vabe banaisen",
    "ভালো লাগলো ভাই, ধন্যবাদ",
    "Onek din por emon ekta video dekhlam",
  ],
};

const REACTIONS: Record<Sentiment, string[]> = {
  sad: ["sad", "sad", "sad", "love", "like"],
  funny: ["haha", "haha", "haha", "like", "love"],
  love: ["love", "love", "love", "like", "wow"],
  islamic: ["love", "like", "like", "love", "wow"],
  motivational: ["like", "like", "love", "wow", "haha"],
  food: ["love", "wow", "like", "like", "haha"],
  music: ["love", "wow", "like", "like", "haha"],
  general: ["like", "like", "like", "love", "wow", "haha"],
};

export function detectSentiment(text: string | null | undefined): Sentiment {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return "general";
  let best: Sentiment = "general";
  let bestScore = 0;
  for (const key of Object.keys(KEYWORDS) as Exclude<Sentiment, "general">[]) {
    const score = KEYWORDS[key].reduce((acc, k) => (t.includes(k.toLowerCase()) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}

function jitter(value: number, spread = 0.45) {
  const factor = 1 + (Math.random() * 2 - 1) * spread;
  return Math.max(0, Math.round(value * factor));
}

/** পোস্টের বয়স অনুযায়ী দৈনিক লাইকের গতি (প্রথম ২ দিনে সবচেয়ে বেশি) */
function dailyRate(ageHours: number) {
  if (ageHours < 48) return 1800;
  if (ageHours < 24 * 7) return 750;
  if (ageHours < 24 * 20) return 260;
  return 90;
}

const RUNS_PER_DAY = 96; // প্রতি ১৫ মিনিটে একবার

export type EngageSummary = {
  postId: string;
  likes: number;
  comments: number;
  sentiment: Sentiment;
  finished: boolean;
};

export async function runAutoEngagement(maxJobs = 12): Promise<{ processed: EngageSummary[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  const { data: jobs } = await sb
    .from("auto_engage_jobs")
    .select("*")
    .eq("finished", false)
    .order("created_at", { ascending: false })
    .limit(maxJobs);

  const processed: EngageSummary[] = [];

  for (const job of (jobs ?? []) as any[]) {
    const { data: post } = await sb
      .from("posts")
      .select("id, user_id, body, content, likes_count, comments_count, views_count, created_at, media_type, video_url")
      .eq("id", job.post_id)
      .maybeSingle();

    if (!post) {
      await sb.from("auto_engage_jobs").update({ finished: true }).eq("post_id", job.post_id);
      continue;
    }

    const sentiment: Sentiment =
      job.sentiment && job.sentiment !== "general"
        ? (job.sentiment as Sentiment)
        : detectSentiment(`${post.body ?? ""} ${post.content ?? ""}`);

    const ageHours = (Date.now() - new Date(post.created_at as string).getTime()) / 36e5;
    if (ageHours > 24 * 45) {
      await sb.from("auto_engage_jobs").update({ finished: true, sentiment }).eq("post_id", job.post_id);
      continue;
    }

    // আসল (অটো নয়) এনগেজমেন্ট থেকে ভিডিওর কোয়ালিটি — ভালো ভিডিওতে লাইক বেশি
    const [{ count: totalReactions }, { count: autoLikes }, { count: realComments }] = await Promise.all([
      sb.from("post_reactions").select("id", { count: "exact", head: true }).eq("post_id", post.id),
      sb
        .from("auto_engage_actions")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id)
        .eq("action", "like"),
      sb.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
    ]);

    const realLikes = Math.max(0, (totalReactions ?? 0) - (autoLikes ?? 0));
    const views = Number(post.views_count ?? 0);
    const quality = Math.min(2.6, Math.max(0.55, 0.8 + realLikes / 8 + (realComments ?? 0) / 6 + views / 120));

    const { count: poolSize } = await sb.from("profiles").select("id", { count: "exact", head: true });
    const cap = Math.max(0, (poolSize ?? 0) - 1);
    const targetLikes = Math.min(cap, Math.round(2200 * quality));

    const likesDone = autoLikes ?? 0;
    if (likesDone >= targetLikes) {
      await sb
        .from("auto_engage_jobs")
        .update({ sentiment, quality, target_likes: targetLikes, likes_done: likesDone, last_run_at: new Date().toISOString() })
        .eq("post_id", job.post_id);
      continue;
    }

    const perRun = Math.min(
      targetLikes - likesDone,
      Math.max(1, jitter((dailyRate(ageHours) * quality) / RUNS_PER_DAY)),
    );

    const { data: likeUsers } = await sb.rpc("auto_engage_pick_users", {
      p_post_id: post.id,
      p_limit: perRun,
      p_action: "like",
    });

    const userIds: string[] = ((likeUsers ?? []) as any[]).map((r) => r.user_id).filter(Boolean);
    let addedLikes = 0;

    if (userIds.length) {
      const reactionRows = userIds.map((uid) => ({
        post_id: post.id,
        user_id: uid,
        reaction_type: pick(REACTIONS[sentiment]),
      }));
      const { error: reactErr } = await sb.from("post_reactions").insert(reactionRows);
      if (!reactErr) {
        addedLikes = userIds.length;
        await sb
          .from("auto_engage_actions")
          .insert(userIds.map((uid) => ({ post_id: post.id, user_id: uid, action: "like" })));
      }
    }

    // ১০ হাজার লাইকে ~২০০ কমেন্ট (৫০ লাইকে ১টা), প্রতি রানে সর্বোচ্চ ৩টি
    const totalLikesNow = likesDone + addedLikes;
    const commentTarget = Math.floor(totalLikesNow / 50);
    const commentsDone = Number(job.comments_done ?? 0);
    let addedComments = 0;

    if (commentTarget > commentsDone) {
      const need = Math.min(3, commentTarget - commentsDone);
      const { data: commentUsers } = await sb.rpc("auto_engage_pick_users", {
        p_post_id: post.id,
        p_limit: need,
        p_action: "comment",
      });
      const cIds: string[] = ((commentUsers ?? []) as any[]).map((r) => r.user_id).filter(Boolean);
      if (cIds.length) {
        // UI `content` কলাম দেখায় — তাই দুই কলামেই একই লেখা রাখি, নাহলে খালি কমেন্ট দেখায়
        const used = new Set<string>();
        const rows = cIds.map((uid) => {
          let text = pick(COMMENTS[sentiment]);
          for (let i = 0; i < 6 && used.has(text); i += 1) text = pick(COMMENTS[sentiment]);
          used.add(text);
          return { post_id: post.id, user_id: uid, body: text, content: text };
        });
        const { error: cErr } = await sb.from("post_comments").insert(rows);
        if (!cErr) {
          addedComments = cIds.length;
          await sb
            .from("auto_engage_actions")
            .insert(cIds.map((uid) => ({ post_id: post.id, user_id: uid, action: "comment" })));
        }
      }
    }

    // কাউন্টার সিঙ্ক (ভিউ লাইকের চেয়ে বেশি হওয়া স্বাভাবিক)
    const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
      sb.from("post_reactions").select("id", { count: "exact", head: true }).eq("post_id", post.id),
      sb.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
    ]);
    const newViews = Math.max(views, Math.round((likeCount ?? 0) * (2.5 + Math.random())) + jitter(30, 0.8));

    await sb
      .from("posts")
      .update({
        likes_count: likeCount ?? 0,
        comments_count: commentCount ?? 0,
        views_count: newViews,
      })
      .eq("id", post.id);

    const finished = likesDone + addedLikes >= targetLikes;
    await sb
      .from("auto_engage_jobs")
      .update({
        sentiment,
        quality,
        target_likes: targetLikes,
        likes_done: likesDone + addedLikes,
        comments_done: commentsDone + addedComments,
        finished,
        last_run_at: new Date().toISOString(),
      })
      .eq("post_id", job.post_id);

    processed.push({ postId: post.id, likes: addedLikes, comments: addedComments, sentiment, finished });
  }

  return { processed };
}
