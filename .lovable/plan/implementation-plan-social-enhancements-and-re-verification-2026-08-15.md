# Implementation Plan - Social Enhancements and Re-verification UI

Improve the Social section with intelligent friend suggestions, robust user search, and clarify the re-verification status wording on the dashboard.

## User Review Required

> [!IMPORTANT]
> The mutual friends calculation requires scanning friendship tables. For a large number of users, we'll use a simplified mutual friends check or optimize it to ensure the app remains fast.

## Proposed Changes

### Social Features (Friend Suggestions & Search)

#### [Backend] Enhance `social-users.functions.ts`
- **Search Logic**: Update `listUsers` to support hybrid search:
    - Case-insensitive partial name matches (`ilike`).
    - Exact UID sequence match (casting as numeric).
    - Normalized phone number search (removing `+880`, `880`, `0` prefixes).
- **Friendship Status**: Add detailed status detection:
    - `isFriend` (Accepted)
    - `requestSent` (Current user sent)
    - `requestReceived` (Current user received - needs "Accept" button)
- **Mutual Friends**: Add a calculation for mutual friends between the current user and suggested users.
- **Sorting**: Order suggestions primarily by mutual friend count, then by registration order.

#### [Frontend] Update `social/people.tsx`
- **User Cards**:
    - Display "Mutual Friends" count if > 0.
    - Update action buttons:
        - `Add Friend` (blue/cyan)
        - `Request Sent` (amber/timer icon)
        - `Accept` (green/check for incoming requests)
        - `Friends` (badge for already friends)
- **Search UI**: Ensure real-time search results are clearly labeled and correctly paginated.
- **Infinite Scroll**: Maintain existing infinite scroll for performance.

### Dashboard UI (Re-verification Status)

#### [Frontend] Update `home.tsx`
- **Label Logic**: Update `TaskCell` and `MainIdentityCell` wording:
    - If a task's re-verification is recently completed (whitelist status OK):
        - Show "✅ সম্পূর্ণ" (Complete) or "✅ Re-verification Complete".
    - Remove the "3-4 days" reminder unless the system explicitly flags that a new re-verify check is due in the future.
    - If a re-verify is required:
        - Show "পরবর্তী Re-verify: X দিন পর" (Next Re-verify: X days later).

## Technical Details

- **Database Queries**: Use Supabase `.or()` for searching multiple fields and `.rpc()` if complex mutual friends logic is needed, otherwise perform in-memory filter for the current batch.
- **Friendship Status**: Map statuses correctly in the `listUsers` handler:
    - `status: 'pending'` + `user_id == currentUser`: "Sent"
    - `status: 'pending'` + `friend_id == currentUser`: "Received"
    - `status: 'accepted'`: "Friends"
- **Task Logic**: Inspect `whitelist_ok`, `initial_verify_at`, and `reverify_required` (if exists) properties on tasks to determine the correct label.

## Verification Plan

### Automated Tests
- Run `vitest` on modified server functions to verify search normalization and friendship status logic.

### Manual Verification
- **Social**:
    1. Search by partial name (e.g., "Anam").
    2. Search by UID.
    3. Verify mutual friend count shows for known shared connections.
    4. Check "Accept" button for incoming requests.
- **Dashboard**:
    1. Complete a re-verification.
    2. Check if the slot label changes to "✅ সম্পূর্ণ".
    3. Verify the "3-4 days" message is replaced.
