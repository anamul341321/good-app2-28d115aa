# 2X Bonus Promo + Fixes

## 1. 2X Bonus Promo (22/07/2026 → 11/08/2026)

- **bonus_settings** e notun columns:
  - `promo_active boolean default false`
  - `promo_start_at timestamptz`
  - `promo_end_at timestamptz`
  - `promo_first_verify_bonus`, `promo_reverify_bonus`, `promo_referrer_bonus` (2X rates)
- Migration e values set kori: promo_active=true, start=2026-07-22, end=2026-08-11, 100/400/150.
- `bonus.functions.ts` — jokhon `now()` between promo window ebong `promo_active=true`, tokhon promo rates use kore credit. Otherwise regular rates (50/200/100).
- Admin Bonus Settings page e promo toggle + date + 2X amount input.

## 2. Home Banner (premium, red/gold, countdown)

- Notun component `PromoBanner.tsx` — dashboard load hole promo active thakle top e dekhabe.
- Design: red gradient + gold shimmer, "🎊 ৫০,০০০+ User পূর্তি 2X বোনাস অফার" title.
- Live countdown timer (days:hours:min:sec) until `promo_end_at`.
- 3 ta row: প্রথম ১০ Slot / Re-verify / প্রতি Referral — pratita te `~~আগে: X৳~~ → এখন: Y৳` strike-through style.
- Promo shesh hole banner auto hide, regular 350৳ banner firbe.

## 3. Referral unlock: 10 → 5

- `src/lib/constants.ts` e `REFERRAL_UNLOCK_THRESHOLD = 5`.
- `auth.functions.ts`, `referral.functions.ts`, `referral.tsx` — 10 → constant.
- Bengali text update: "৫টা প্রথম verify complete korun".

## 4. Referral count fix

- Currently `firstVerifies` count kore `initial_verify_at || status=verified/done` — attempt na, successful first-verify hisebe theek ache. Kintu user report korche 7-এর জায়gay 5. Investigate: `initial_verify_at` shob task e set hocche kina check kore, `slotFaces` er bodole `firstVerifies` show kori referral card e — "কতটা face verify করেছে" = successful first verifies only.
- Referral page + admin leaderboard duitai `firstVerifies` value dekhabe, `slotFaces`/`backupFaces`/`faceTotal` remove (attempt count).

## 5. UID sequential fix (1, 2, 3…)

- Problem: current `uid` derive hocche by ordering profiles by created_at + rank. Kintu client side/search e mismatch. Fix:
  - Migration: `profiles.uid_seq bigint unique` column, backfill by created_at ASC.
  - Trigger on new profile insert: `uid_seq = coalesce(max, 0)+1`.
- Admin search e `uid_seq` diye numeric match.
- User dashboard/profile e UID dekhabe.

## 6. Admin: "10 ta slot complete" alada box

- `users.tsx` e ekta notun tab / accordion "🏆 ১০ Slot Complete (N)" — list users with ≥10 done+whitelisted tasks. Click → user detail.

## 7. Wallet: Bkash + Nagad both

- `wallets` table e already `bkash_number`, `nagad_number` type flag ache? Check. If not, notun columns `bkash_number text`, `nagad_number text` add kori.
- Wallet page e 2 ta input (Bkash + Nagad) — user duitai set korte pare.
- Withdraw page e user choose korbe kon method e.
- Admin er `bonus_settings` e `bkash_enabled boolean`, `nagad_enabled boolean` toggle. Ekta off thakle withdraw page e oi option disabled + Bengali message "বর্তমানে বিকাশ বন্ধ, নগদে withdraw দিন"।

## 8. Withdraw rejection message

- `withdrawals` table e `admin_note text` column (jodi na thake).
- Admin reject korar somoy ekta textarea diye reason likhbe.
- User er withdraw history / dashboard e rejected withdraw e notice box e Bengali reason dekhabe.

## Files

- Migration: bonus_settings promo columns + values, profiles.uid_seq + trigger + backfill, wallets bkash/nagad columns, withdrawals.admin_note, bonus_settings.bkash_enabled/nagad_enabled
- Edit: `src/lib/bonus.functions.ts`, `src/lib/constants.ts`, `src/lib/auth.functions.ts`, `src/lib/referral.functions.ts`, `src/lib/admin.functions.ts`, `src/lib/wallet.functions.ts`, `src/lib/withdraw.functions.ts`
- Edit: `src/routes/_authenticated/home.tsx` (add PromoBanner), `referral.tsx`, `wallet.tsx`, `withdraw.tsx`, `profile.tsx`
- Edit: `src/routes/admin/bonus-settings.tsx` (promo + method toggles), `admin/users.tsx` (10+ box + uid search), `admin/withdrawals.tsx` (reject with note), `admin/user.$userId.tsx`
- New: `src/components/PromoBanner.tsx`
- Edit: `src/styles.css` (promo animations)

Confirm korle sob ekshathe implement kori.
