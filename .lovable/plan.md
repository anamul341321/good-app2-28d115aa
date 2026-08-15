# Plan: Admin Card Management, Background Telegram Broadcast, and Messenger Enhancements

Fixing the "Not Found" error in Admin Panel, implementing server-side background Telegram broadcasting, adding native screen share support, and enhancing Messenger user suggestions.

## User Review Required

> [!IMPORTANT]
> The Telegram background broadcast requires a new `broadcast_campaigns` table in the database to track progress. I will include the migration script. Screen sharing on Android will use the `display-media` API which triggers the native permission dialog.

- **Telegram Broadcast**: Moving from synchronous sending to a background queue system. You can start a broadcast and close the admin panel; it will keep running.
- **Card Management**: Restoring the missing `/admin/cards` page for managing Minute/MB products.
- **Messenger Suggestions**: Prioritizing users with mutual friends in the search/suggestion list.

## Proposed Changes

### Database & Background Logic
#### [NEW] `supabase/migrations/20260427_telegram_broadcast.sql`
- Create `broadcast_campaigns` table to store status (pending, sending, completed, paused), total users, sent count, and failed count.
- Add `broadcast_logs` for detailed delivery tracking.
- Enable RLS and grants.

#### `src/lib/telegram-broadcast.functions.ts` & `src/lib/telegram-broadcast.server.ts`
- Implement `startBroadcast` server function to initialize a campaign.
- Create a background worker pattern (using `setInterval` or repeated server function calls) to process the queue without blocking the admin UI.
- Add functions to pause, resume, and cancel campaigns.

### Admin UI
#### `src/routes/admin/cards.tsx`
- **Recreate missing file**: Full UI for listing, creating, and updating Minute/MB cards.
- **Bulk Stock**: Add a text area for pasting multiple codes/codes at once.
- **Operator Logos**: Support for GP, Robi, Airtel, Banglalink, etc.

#### `src/routes/admin/telegram.tsx`
- Replace the current sync broadcast UI with a "Campaign Manager".
- Add a live progress bar showing Sent/Failed/Pending counts.
- Add a "Broadcast History" section to see previous campaigns.

### Messenger & Social
#### `src/lib/social-users.functions.ts`
- Update `listUsers` and `searchUsers` to calculate mutual friend counts more efficiently.
- Ensure the result is sorted by `mutualCount` descending by default.

#### `src/components/messenger/MessengerSearchOverlay.tsx` & `src/routes/_authenticated/social/people.tsx`
- Update UI cards to display "X Mutual Friends".
- Add explicit action buttons: 👤 Profile, ➕ Add Friend, 💬 Message, 📞 Call.

### Calling & Native Bridge
#### `src/components/CallProvider.tsx`
- Integrate `navigator.mediaDevices.getDisplayMedia` for screen sharing.
- Ensure proper track handling and signaling to the peer.

## Technical Details
- **Broadcast Worker**: Since we are in a serverless-like environment (Edge), the worker will be triggered by the admin client polling or a "ping" server function to ensure progress continues as long as the admin is active, or use a persistent Supabase trigger-based queue if necessary for true backgrounding.
- **Mutual Friends**: Using a Supabase join query to count common `friend_links` between the viewer and the target user.
- **Card Management**: Uses the existing `card_products` and `card_codes` tables which were found to be present in the schema.
