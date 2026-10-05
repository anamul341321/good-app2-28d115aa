<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Withdrawal availability is source-aware: bonus/main funds are withdrawable any day, while claimed mining/pending funds are withdrawable only from Dhaka-local day 1 through day 3 at 10 PM, because the two balances follow different business rules.
- Call relay credentials stay in the runtime secrets CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN, read only inside the server function that mints them, because embedding them in the app would expose account keys.
- Direct UID calling resolves the target server-side and reuses the authenticated call-session flow, so callers cannot spoof another identity.
- Ordinary authenticated pages use the shared `app-shell` width and responsive navigation so controls remain consistent across phone sizes.
- Mining balances are attributed per task slot: monthly release, re-verification release, and reset deductions may only affect that slot's recorded amounts.
- The separate "GoodApp Call" APK is the same Capacitor project built with build_mode/ANDROID_BUILD_MODE/CAP_BUILD_MODE=calls (own applicationId, opens /calls?app=calls, no splash), because one codebase keeps calls and accounts identical across both apps.
