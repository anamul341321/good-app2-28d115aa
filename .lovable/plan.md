---
title: Complete Play Store Lite Safety Cleanup
---

## Goal
Make the separately built Android Lite app a genuinely social/communication app with no financial, cash-like, mining, income, commission, payout, or paid-bonus presentation. Keep the full website unchanged.

## Lite experience
- Keep Messenger, calls, News Feed, Reels, Stories, profiles, friends, settings, language/region, reporting, support, and identity/security verification.
- Keep re-verification only as an account-security action; remove every Lite reference to money, monthly rates, mining activation, commission, rewards, claimable amounts, or earning.
- Change Good Coin presentation to a clearly non-cash, non-purchasable, non-convertible in-app engagement points area; remove “Earn More/আরও আয় করুন” and any ad-for-income implication.
- Keep referrals as a plain friend-invite and referral-list feature with no bonus, lifetime percentage, currency amount, mining, or income copy.
- Hide Offers, earnings, wallet, withdrawal, transfer, recharge, transaction history, rate pages, voucher claims, payment leaderboards/history, financial banners, and APK/download/update links in Lite.

## Implementation
- Split shared Home, Menu, Referral, Re-verify, verification cards/modals, notices, notifications, onboarding/auth copy, and route fallbacks into explicit Full and Lite render paths.
- In Lite Home, show only social shortcuts, a neutral support card, readable safe notices, and security-verification progress. Remove bonus popups, vouchers, claim buttons, monetary badges, mining text, and amount-bearing progress descriptions.
- Make Lite financial/reward routes render a neutral unavailable screen whose title and body contain no financial terms; remove their navigation entry points.
- Sanitize dynamic admin notices and notification text in Lite so a Full-site financial announcement cannot leak into the Play app.
- Update Lite-only metadata/policy/listing copy where shared content still exposes financial terms. Full-mode content and backend financial behavior remain intact.

## Verification
- Build with `VITE_LITE_BUILD=true` and scan generated client output for prohibited Bengali/English financial terms and currency symbols.
- Test the Lite marker in a mobile browser simulation, inspect Home, Menu, Referral, Re-verify, notifications, policies, and guarded direct routes.
- Confirm a normal Full build still shows the existing website financial features.
