# Plan: Complete Good-App Messenger Reorganization & Dashboard Cleanup

Remove all legacy Facebook-style social features (News Feed, People List, Friend Requests, Post system) and consolidate the app into a clean, professional Dashboard with a dedicated, full-featured Messenger.

## Changes

### 1. Social Feature Removal
- Delete all social-related routes: `src/routes/_authenticated/social/index.tsx`, `notifications.tsx`, `people.tsx`, `search.tsx`, `profile.tsx`.
- Remove `MessengerNav` (the social bottom bar) from `src/routes/_authenticated/social.tsx`.
- Delete social components: `src/components/social/NewsFeedPage.tsx`, `SocialComponents.tsx`.

### 2. Messenger UI & Logic
- **Full-Screen Messenger**: Update `/social/messenger` (via `chat.index.tsx`) to be a standalone, immersive experience.
- **Modern Search**: Implement a unified "Search Messenger" overlay in `chat.index.tsx` that searches by Name, UID, or Phone.
- **Dashboard Integration**: Add a prominent "Messenger" button on the Home Dashboard that opens the full-screen Messenger.
- **Back Navigation**: Messenger will feature a clear "← Dashboard" button to return to the main app interface.
- **Real-Time Features**: Ensure typing indicators, seen status, and online presence are integrated into the chat list and view.

### 3. Dashboard Reorganization
- **Clean Layout**: Reorganize `src/routes/_authenticated/home.tsx` to remove cluttered social previews and feed entries.
- **Priority Features**: Focus the dashboard on:
    - Wallet/Balance and Mining status.
    - Dedicated "Good-App Messenger" entry point.
    - Witness/Verification Progress.
    - Main Menu access.
- **Visual Polish**: Use a consistent, high-end "premium panel" design for all dashboard cards.

### 4. Advanced Calling (WebRTC)
- Maintain and stabilize the existing WebRTC system in `chat.$peerId.tsx`.
- Ensure Screen Share triggers the Android official `MediaProjection` permission flow.
- Optimize background calling and lock-screen notifications.

## Technical Details
- **Search**: Utilize `searchPeople` from `friends.functions.ts` for Messenger user discovery.
- **State**: Use TanStack Query for real-time messenger data (conversations, messages).
- **Navigation**: Use `@tanstack/react-router` for all internal links and back navigation.
- **Styling**: Tailwind CSS v4 with semantic tokens for the dark, minimal Apple-like aesthetic.
