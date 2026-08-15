# Plan - Fix Social Features and Google Login

The user reported that Social features (Friend List, Suggestions, Search) and Google Login are not working as expected. This plan addresses these issues by auditing and fixing the end-to-end functionality.

## Proposed Changes

### Social Features Overhaul
- **Unified Search/Suggestions Backend**: Update `listUsers` in `src/lib/social-users.functions.ts` to correctly handle searching (by Name, UID, Phone) and suggestion ranking (prioritizing mutual friends).
- **Friend Directory UI**: Fix `src/routes/_authenticated/social/people.tsx` to handle the friendship lifecycle:
    - Display "Add Friend" if no friendship exists.
    - Display "Request Sent" if a pending request was sent by the current user.
    - Display "Accept" button if a pending request is incoming.
    - Display "Friends" badge if accepted.
- **Search Logic Fix**: Ensure `searchUsers` in `src/lib/news-feed.functions.ts` uses the same robust logic as the main directory or is deprecated in favor of a single high-quality search function.
- **Mutual Friends & Stats**: Ensure `getProfileStats` and `getProfileById` correctly return mining stats and verification counts.

### Native Google Login Fix
- **Looping/Account Chooser**: Audit `src/lib/native-google.ts`. Ensure `filterByAuthorizedAccounts: false` is consistently used to show the full account chooser and prevent loops where Capacitor thinks an account is "authorized" but Supabase rejected the session.

### Dashboard Wording
- **Re-verification Badges**: Double-check `src/routes/_authenticated/home.tsx` to ensure "✅ সম্পূর্ণ" shows when re-verification is done, and "পরবর্তী: X দিন পর" only appears when a future date is actually set.

## Technical Details
- **Database Queries**: Use `.or()` filters with proper normalization for phone numbers and numeric casts for UID lookups in PostgreSQL.
- **Friendship State**: Use a 4-state mapping (`none`, `pending_sent`, `pending_received`, `accepted`) derived from the `friendships` table.
- **Capacitor Social Login**: Use `SocialLogin.login` with `forcePrompt: true` to ensure the native Android UI triggers correctly every time the user attempts login.

## Verification Plan
- **Automated Tests**: Run existing social and auth tests to check for regressions.
- **Manual Verification (Physical Device)**:
    - Test Google Login flow (Account Chooser -> Login -> Success).
    - Search for a known user by Name, UID, and Phone.
    - Send a friend request and verify the recipient sees the "Accept" button.
    - Verify "Mutual Friends" count updates after accepting.
    - Check Dashboard slot badges after a re-verification.
