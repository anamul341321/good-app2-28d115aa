# Play Store Lite Version Plan

## Goal
Create a Play Store-compliant "Lite" app build that removes financial features (withdraw, send money, mobile recharge, card purchase) so it can be published on a personal Google Play developer account. The full financial app continues to run on the website (`goodapp2.live` / custom domain).

## What stays in Lite (Play Store safe)
- Messenger / chat
- Reels / video feed
- Stories
- Good Coin wallet + watch-to-earn / ads-for-coins
- Profile, settings, face login, referral link sharing
- Friend requests / search
- Region / language selection

## What gets removed from Lite
- Withdraw (mining/main balance withdrawal)
- Send Money
- Mobile Recharge
- Card purchase / card codes
- Any balance-to-cash conversion flow
- Any mention of "টাকা তুলুন", "সেন্ড মানি", "রিচার্জ" inside the app

## Technical approach
1. Introduce a build-time flag `VITE_LITE_BUILD=true`.
2. Create a runtime helper `isLiteBuild()` that hides financial routes and UI when the flag is active.
3. Guard financial route files and navigation items with the flag so they do not render in Lite.
4. Replace financial home cards with informational cards that say these features are available on the website, with an "Open in Browser" button.
5. Update `AllOptionsGrid.tsx` and `home.tsx` to hide financial action buttons in Lite.
6. Add a Lite-only banner/notice explaining this is the social + rewards version.
7. Ensure the APK build command uses the Lite flag.
8. Keep the website build unchanged (full financial features).

## Files to change
- `src/lib/lite-build.ts` (new helper)
- `src/routes/_authenticated/withdraw.tsx`
- `src/routes/_authenticated/send-money.tsx`
- `src/routes/_authenticated/recharge.tsx`
- `src/routes/_authenticated/buy-card.tsx`
- `src/routes/index.tsx` (home)
- `src/components/AllOptionsGrid.tsx`
- `src/components/AdsBoostBanner.tsx` (keep, but remove cash-promise copy)
- `src/router.tsx` or route config (hide financial routes in Lite)
- `package.json` / build scripts (add `build:lite`)

## Out of scope
- New backend tables or RLS changes
- Removing financial server functions (still needed for website)
- Changing the published website

## Success criteria
- `bun run build:lite` succeeds.
- Lite build has no visible withdraw/send/recharge/card UI.
- Lite build still shows messenger, reels, coins, profile, referral.
- Full website build remains unchanged.
