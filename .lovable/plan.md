# Welcome Bonus + Camera/Gallery UX

## 1. Bonus system (new users only, max 200৳)

- **Bonus 1 — First Verify (100৳):** user er 10 ta slot e first face verify complete hole claim button ujjol hobe. Claim korle 100৳ bonus balance a jog hobe.
- **Bonus 2 — Re-verify (100৳):** oi 10 ta slot re-verify complete hole 2nd claim ujjol hobe. Claim = 100৳ + mining shuru (jodi na age hoye thake).
- **Mining rule change:** First verify shudhu bonus dey, mining shuru hoy NA. Mining shuru hobe re-verify complete holei (existing `settle_mining` logic already re-verify (done) count kore — kintu ekhon requirement holo re-verify hote hobe, first verify holei nai). Actually current logic verified+done duitai count kore. Amar `settle_mining` update korte hobe jate shudhu `done` (re-verified) slot mining count e jai — noile "first verify korlei mining" hoye jabe.
- **Withdraw rule:** Registration er sathe sathe 100৳ signup bonus dewa hobe NA — user ke first 10 verify complete korte hobe tar por bonus claim. (User er kotha: "registration korlei 100tk bonus … withdraw korte gele 10 ta slot complete korte hobe first verification korlei hobe" — mane bonus withdraw korar age 10 first-verify lagbe. Sohoj implementation: bonus grant hoy ONLY after 10 first verifies, tai withdraw rule automatic.)

### Schema
`profiles` table e notun columns:
- `bonus_first_verify_claimed boolean default false`
- `bonus_reverify_claimed boolean default false`
- `bonus_balance numeric default 0` (withdrawable, mining balance er sathe add hobe)

Or alternative: `mining_state.accrued_amount` e direct add kora — cleaner, existing withdraw flow (which reads accrued − withdrawn) automatically supported. **Chose this approach** — just add 2 boolean flags on profiles, credit accrued_amount on claim.

### Server functions (`src/lib/bonus.functions.ts`)
- `getBonusStatus()` → returns `{ firstVerifyCount, reverifyCount, firstClaimable, reverifyClaimable, firstClaimed, reverifyClaimed }`.
- `claimFirstVerifyBonus()` → gate: 10 first-verifies done AND !claimed → add 100 to accrued, set flag.
- `claimReverifyBonus()` → gate: 10 re-verifies done AND !claimed → add 100 to accrued, set flag.

`dashboard.functions.ts` e bonus status include korbo jate home page instantly dekhate pare.

### Mining rule fix
`settle_mining` SQL function e `status IN ('verified','done')` → `status = 'done'` change korte hobe (3 jaigay). Migration lagbe.

## 2. UI — Welcome banner + claim cards

**Home page (`src/routes/_authenticated/home.tsx`):**
- Jodi kono ekta bonus unclaimed → top e boro premium animated banner: "🎁 ২০০৳ Welcome Bonus" gradient + shimmer, ki korle koto pabe bujhiye.
- Niche 2 ta claim card side-by-side:
  1. "First Verify Bonus" — progress `X/10`, disabled/gray jotokkhon X<10, ujjol pulsing gradient jokhon 10/10, claim button.
  2. "Re-verify Bonus" — same shape.
- Claim hole card "✅ পাওয়া গেছে" state e chole jabe.
- Sob kichu claim hole banner hide.

CSS: `welcome-banner` shimmer + pulse animations `src/styles.css` e add.

## 3. FaceCapture — camera/gallery choice up-front

Currently gallery button camera error time e ba video er niche dekhay — user er onek somoy camera permission jhamela hoy.

Fix: `FaceCapture.tsx` re-organize:
- Component mount hole ekta **choice screen** dekhabe first: 2 ta boro button
  - 📸 "ক্যামেরা দিয়ে তুলুন"
  - 🖼️ "গ্যালারি থেকে আপলোড করুন"
- Camera choose korle tokhonei `getUserMedia` call hobe (immediate camera prompt jate browser ke chorche allow chai).
- Gallery choose korle file picker khulbe.
- Camera fail korle inline error + "গ্যালারি ব্যবহার করুন" fallback button.
- Retry button same choice screen e firiye anbe.

Ei change reverify + task both flow e apply hobe (same component).

## Files to touch
- **New:** `src/lib/bonus.functions.ts`
- **Migration:** add 2 columns to `profiles`, update `settle_mining` (verified→done for mining count)
- **Edit:** `src/components/FaceCapture.tsx` (choice-first UX)
- **Edit:** `src/routes/_authenticated/home.tsx` (banner + claim cards)
- **Edit:** `src/lib/dashboard.functions.ts` (include bonus status)
- **Edit:** `src/styles.css` (banner/claim animations)

## Notes for user (plain Bangla)
- Registration er sathe sathe 100৳ dile spam account ashbe; ei design e 10 first-verify complete korlei bonus unlock — safer. Withdraw automatic block kaj korbe karon balance thakbei na.
- Mining shudhu re-verify korle shuru hobe — first verify shudhu bonus er jonno.
- Camera permission fail hole gallery upload option agei dekhabe.

Confirm korle implement kori.
