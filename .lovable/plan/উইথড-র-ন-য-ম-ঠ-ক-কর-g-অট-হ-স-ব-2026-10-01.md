# উইথড্র নিয়ম ঠিক করা + G$ অটো হিসাব

## ১. পেন্ডিং → মেইন (১ তারিখে)
- প্রতি মাসের ১ তারিখে (ঢাকা সময়) নিজে থেকে চলবে: যে স্লট এখন ভেরিফাই আছে, শুধু সেই স্লটের পেন্ডিং টাকা মেইনে যাবে। ভেরিফাই না থাকা স্লটের টাকা পেন্ডিংয়েই থাকবে।
- আজকের (১ তারিখ) কাজটা এখনই একবার চালানো হবে।

## ২. উইথড্র শুধু মেইন থেকে
- পেন্ডিং থেকে সরাসরি উইথড্র পুরোপুরি বন্ধ। মেইনে টাকা না থাকলে উইথড্র হবে না।
- উইথড্র পেজে পেন্ডিং কার্ডে লেখা থাকবে: "ভেরিফাই স্লটের টাকা ১ তারিখে মেইনে যাবে, তারপর তুলতে পারবেন"।

## ৩. ৩ তারিখ রাত ১০টার পর
- ১ তারিখে মাইনিং থেকে মেইনে আসা যে টাকা তোলা হয়নি, তা আবার পেন্ডিংয়ে ফিরে যাবে; পরের মাসের ১ তারিখে আবার নিয়ম মেনে মেইনে আসবে।
- বোনাসের টাকা মেইনেই থাকবে (বোনাস যেকোনো দিন তোলা যায়)।

## ৪. ভুল উইথড্র বাতিল (আজকের pending ৭২টি, মোট ২৫,৯৩৭৳)
- প্রতিটি pending আবেদন পরীক্ষা: যে টাকা তুলেছে তা কি ভেরিফাই স্লটের মেইন/বোনাস টাকা থেকে?
- না হলে (পেন্ডিং থেকে তুলেছে, বা স্লট ভেরিফাই নেই) আবেদন বাতিল, পুরো টাকা ফেরত, আর ইউজারকে বাংলায় নোটিশ: "স্লট রি-ভেরিফাই করে আবার আবেদন করুন"।
- ঠিক থাকা আবেদন যেমন আছে তেমন থাকবে। শেষে কয়টা বাতিল হলো তার হিসাব জানাব।

## ৫. G$ হিসাব অটো চলবে
- প্রতি কয়েক মিনিটে সার্ভার নিজে Celo ও XDC দুই নেটওয়ার্ক স্ক্যান করে ফল সেভ রাখবে — অ্যাডমিন পেজ খোলা না থাকলেও।
- অ্যাডমিন পেজ খুললেই সেভ করা হিসাব সাথে সাথে দেখাবে (লোডিং আটকে থাকবে না), যেকোনো তারিখ বেছে দেখা যাবে।
- XDC কেন আসছে না তা খুঁজে ঠিক করা হবে।

## Technical details
- New table `gd_transfer_daily` (date, network, total, count, receivers jsonb, last_block, updated_at), admin-only RLS + grants; incremental scan from last_block via pg_cron → `/api/public/gd-transfers/run` (secret-protected).
- Debug XDC RPC/contract/topic in `gd-transfers.functions.ts`.
- SQL functions: `release_pending_verified_slots()` (cron 1st 00:05 Dhaka), `revert_unwithdrawn_mining_main()` (cron 3rd 22:00 Dhaka), tracked via ledger types so bonus is excluded.
- `create_withdrawal_request_atomic` + `withdraw.functions.ts`: available = main/bonus only.
- One-off reject+refund script over today's pending rows using ledger source check and `tasks.whitelist_ok`.
