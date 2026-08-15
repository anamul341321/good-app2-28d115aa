---
title: Full Functionality for Good-App Social
description: Implementing database schema, backend functions, and frontend interactive components for a complete Facebook-like social experience.
---

# Plan - Good-App Social Full Functionality

Implement all requested social features, ensuring every UI element is connected to the backend.

## 1. Database Schema
Create the missing `stories` table and ensure RLS policies are set for all social tables.

- Create `public.stories` table: `id`, `user_id`, `media_url`, `media_type`, `expires_at`, `created_at`.
- Enable RLS on `posts`, `post_reactions`, `post_comments`, `stories`, `user_notices`.
- Add `GRANT` statements for `authenticated` and `service_role`.

## 2. Backend Functions (`src/lib/news-feed.functions.ts`)
Add missing server functions and enhance existing ones.

- `listStories`: Fetch active stories (expires_at > now).
- `createStory`: Insert new story.
- `getPostDetails`: Fetch a single post with nested comments and reactions.
- `deletePost` / `deleteComment`: Allow users to remove their content.
- `searchUsers`: Search profiles by name or UID.
- `listNotifications`: Fetch user notifications.
- `markNotificationRead`: Update `read_at`.

## 3. Media Upload Integration
Use Supabase Storage for post photos, stories, and profile pictures.

- Ensure a `social_media` bucket exists.
- Implement client-side upload helpers.

## 4. UI/UX Components
Transform static UI into interactive components.

- **Post Composer**: Add a modal with textarea and file picker.
- **Story System**: 
  - `StoryRow`: Update to show real stories.
  - `StoryViewer`: Full-screen overlay with progress bars and next/prev logic.
  - `StoryCreator`: Modal for uploading new stories.
- **Reactions & Comments**:
  - `ReactionButton`: Add long-press/hover for specific reactions (Love, Haha, etc.).
  - `CommentList`: Recursive component for nested replies.
  - `CommentInput`: Inline input with submit logic.
- **Navigation & Routing**:
  - `SocialSearchPage`: New route at `/social/search`.
  - `SocialNotificationsPage`: New route at `/social/notifications`.
  - Profile Taps: Ensure `MessengerAvatar` and names link to `/social/profile/$uid`.
- **Profile Page**:
  - Add profile picture upload.
  - Show user's own posts correctly.
- **Messenger**:
  - Ensure the chat icon in the social header links correctly and shows unread count.

## 5. Verification
- Test post creation with images.
- Test story viewing flow.
- Test nested comments and replies.
- Verify notifications appear when someone reacts/comments.
- Confirm "Dashboard" button returns to the main app state.
