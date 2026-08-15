# Social Features Enhancement Plan

We will upgrade the Good-App Social section to a fully functional social network with real-time interactions, searchable directories, and detailed user profiles.

## User-facing changes
- **People Directory**: A searchable list of all registered users with the ability to send friend requests.
- **Enhanced Search**: Find users by UID, Name, or Phone Number.
- **Premium User Profiles**: Beautifully redesigned profiles showing user activity, posts, and mining stats (Verified accounts & Monthly rate).
- **Profile Photo System**: Fully functional photo upload and update system that reflects across all social components.
- **Friend Request System**: Real-time friendship management (Send, Accept, Reject, Cancel).
- **Interactive Notifications**: Real-time alerts for social actions (Likes, Comments, Friend Requests) that link directly to content.
- **Infinite Scrolling**: Optimized performance for feed and user lists using pagination.

## Technical details
- **Database Schema**:
  - `friendships` table: Tracks user connections and status.
  - Supabase Storage: Use the `social_media` bucket for profile and post images.
- **Server Functions**:
  - `listUsers`: Infinite loading support for the people directory.
  - `sendFriendRequest`, `acceptFriendRequest`: Friendship logic.
  - `updateProfile`: Handling avatar and display name updates.
  - `getProfileStats`: Aggregating mining and verification data for profiles.
- **Frontend Components**:
  - `UserCard`: Standardized user display for lists and search results.
  - `ProfileHeader`: Redesigned with cover photos and stats.
  - `InfiniteScroll`: Integration of `react-intersection-observer` with `useInfiniteQuery`.
  - `NotificationBadge`: Real-time unread counts in the navigation.
