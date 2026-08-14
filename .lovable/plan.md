# Messenger UI/UX Overhaul Plan

Redesign the Chat/Messenger section of Good-App to match Facebook Messenger's premium and modern experience while maintaining existing backend functionality.

## Proposed Changes

### 1. Chat List Redesign (`src/routes/_authenticated/chat.index.tsx`)
- **Header Overhaul**: Clean top bar with Branding, Search bar ("Search messages"), Compose button, and Profile menu.
- **Stories Row**: Horizontal list of user avatars with "Create Story" option and story rings.
- **Conversation List**: Vertically scrollable rows with:
    - Large circular profile pictures (fetched from current profiles).
    - Green online indicators for active users.
    - Information hierarchy: Name (bold if unread), Message preview ("You sent a voice message", etc.), Timestamp on the right.
    - Clean spacing and typography, removing bulky card styles.

### 2. Messenger Bottom Navigation
- Implement a modern bottom navigation bar with three primary tabs: **Chats**, **People**, and **Menu**.
- This will be scoped to the chat-related sections to avoid breaking app-wide navigation while providing a native Messenger feel.

### 3. People / Friends Page Redesign (`src/routes/_authenticated/friends.tsx`)
- Sections for **All Users**, **Friend Requests**, and **Online Users**.
- Integrated action buttons (Add Friend, Message, Call) within circular avatar rows.

### 4. Story System
- Implement a basic Story system allowing users to post and view full-screen stories (using existing storage infrastructure).

### 5. Chat Screen Enhancement (`src/routes/_authenticated/chat.$peerId.tsx`)
- **Pinned Header**: Avatar, Name, Online Status, Audio/Video call buttons.
- **Messenger Bubbles**: Refined message bubble design with tail logic and grouped message spacing.
- **Integrated Composer**: Cleaner layout for text, emojis, voice messages, and media uploads.
- **Read Status**: "Seen" indicators below messages.

### Technical Details
- **Existing Logic**: All calls to `listChats`, `getThread`, `sendMessage`, and calling functions will be preserved.
- **Styling**: Using Tailwind CSS v4 variables; avoiding hardcoded colors to maintain theme compatibility.
- **Performance**: Maintaining existing pagination and refetch intervals for real-time responsiveness.
- **Mobile-First**: Fully responsive layouts optimized for mobile screens.

## User Review Required
- Which existing bottom navigation items (Home, Wallet, etc.) should remain visible, or should the Messenger-style navigation completely take over when in the Chat section?
- Do you have a preferred accent color for Messenger-style elements (e.g., the classic Messenger Blue vs the current branding colors)?
