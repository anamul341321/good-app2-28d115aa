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
