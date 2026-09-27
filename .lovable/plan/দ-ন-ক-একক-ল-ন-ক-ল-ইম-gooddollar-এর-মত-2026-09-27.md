# দৈনিক এককালীন ক্লেইম (GoodDollar-এর মতো)

## যা বদলাবে
1. **চলমান মাইনিং কাউন্টার থাকবে না।** প্রতিদিন একবার পুরো দিনের টাকা একসাথে ক্লেইম হবে।
2. **দিনের হিসাব:** সন্ধ্যা ৬টা (ঢাকা) থেকে পরের দিন সন্ধ্যা ৬টা পর্যন্ত এক দিন। এই সময়ের মধ্যে যেকোনো সময় একবার ক্লেইম করা যাবে। ক্লেইম না করলে ওই দিনের টাকা বাতিল হবে। আগে ক্লেইম করা টাকা সবসময় নিরাপদ থাকবে।
3. **দৈনিক টাকা:** যে ঘরগুলো Re-verify করা এবং এখন whitelist-এ আছে, প্রতি ঘর মাসে ৫০৳ ÷ ৩০ = প্রতিদিন ১.৬৭৳।  
   উদাহরণ: ১০টি ঘর = প্রতিদিন ১৬.৬৭৳। রেফারেল কমিশনের দৈনিক অংশও যোগ হবে।
4. **হোমে সুন্দর ক্লেইম কার্ড:** "আজ ক্লেইম করতে পারবেন: ১৬.৬৭৳ (১০টি ঘর)" লেখা এবং বড় সুন্দর "ক্লেইম করুন" বাটন। ক্লেইম হয়ে গেলে লেখা থাকবে "আজকের ক্লেইম শেষ — পরের ক্লেইম সন্ধ্যা ৬টায়"।
5. **ক্লেইম করা টাকা পেন্ডিং ব্যালেন্সে যাবে**, কোন ঘর থেকে কত এসেছে তা আলাদা করে মনে রাখা হবে।
6. **প্রতি মাসের ১ তারিখে স্বয়ংক্রিয়ভাবে:**
   - যে ঘর তখনো whitelist-এ আছে, সেই ঘরের পেন্ডিং টাকা মেইন ব্যালেন্সে চলে যাবে।
   - যে ঘর whitelist-এ নেই, সেই ঘরের টাকা পেন্ডিং-এ থেকে যাবে। সঙ্গে লেখা থাকবে: "এই ঘরটি Re-verify করলে টাকা মেইন ব্যালেন্সে যাবে।"
   - পরে Re-verify করে ঘরটি আবার whitelist হলে, সেই টাকা মেইন ব্যালেন্সে চলে যাবে।
7. টেলিগ্রাম বটের নিয়ম ও প্রতিদিনের সতর্কবার্তা নতুন নিয়ম অনুযায়ী বদলানো হবে ("সন্ধ্যা ৬টার আগে ক্লেইম করুন")।

## Technical details
- New RPC `claim_daily_mining(_user_id)`: window key = Dhaka date of (now − 18h); rejects duplicate per window; amount = whitelisted re-verified slots × 50/30 + referral units × 50/30; writes per-task rows into `slot_claims`/ledger as pending tagged with task_id.
- `settle_mining` continuous accrual disabled for display; `mining_day` switched to 18:00 boundary.
- pg_cron job at 00:05 Dhaka on day 1: move pending per task where `whitelist_ok=true` to main; trigger on `tasks.whitelist_ok` → true also releases that task's pending once the month has turned.
- `MiningCounter.tsx` ticker replaced by a claim card; withdraw window logic unchanged (main any day).
- Update bot knowledge + `daily-claim-warning` text, and memory.
