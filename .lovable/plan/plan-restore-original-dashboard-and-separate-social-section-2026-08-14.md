---
title: Restore Original Dashboard and Separate Social Section
description: Restores the primary Good-App dashboard as the home screen and moves all social/messenger features to a dedicated section accessible via a new button.
---

# Plan - Restore Original Dashboard and Separate Social Section

## User Request
The user wants to revert the recent change where the News Feed replaced the main dashboard. They want the original dashboard (Slots, Mining, Wallet, etc.) back as the home page. The social features (News Feed, Messenger, Stories, etc.) should be moved to a separate "Good-App Social" or "Good-App Messenger" section accessible via a button on the dashboard. This section should have its own navigation and a "Home" button to return to the main dashboard. Additionally, user profiles should display monthly mining amounts.

## Proposed Changes

### 1. Restore Home Dashboard
- Retrieve the original dashboard code for `src/routes/_authenticated/home.tsx` from git history.
- Ensure all dashboard components (Slots, Mining, Wallet, etc.) are restored and functional.
- Add a prominent "Good-App Social" (or "Messenger") button to the restored dashboard.

### 2. Move Social Features to a Dedicated Route
- Create a new route structure for social features, e.g., `src/routes/_authenticated/social/`.
- Move `NewsFeedPage` to this new section.
- Implement navigation within the social section (News Feed, Messenger, People, Notifications).
- Add a "Home" button in the social section header to navigate back to `/_authenticated/home`.

### 3. Update User Profiles
- Modify the profile component/page to display the user's monthly mining amount (e.g., "৳500 / Month").
- Ensure this information is fetched from the existing mining configuration.

### 4. Navigation & Layout
- Revert any global layout changes in `src/routes/_authenticated/route.tsx` that were specifically for the integrated News Feed if they conflict with the restored dashboard.
- Ensure the "Social" button on the dashboard is visually distinct and easy to find.

## Technical Details
- **Route Restoration**: Use `git show <commit-hash>:src/routes/_authenticated/home.tsx` to get the original code. I will search deeper in history (e.g., 20+ commits back) to find the version before the News Feed integration.
- **New Social Routes**:
  - `src/routes/_authenticated/social/index.tsx` (News Feed)
  - `src/routes/_authenticated/social/messenger.tsx`
  - `src/routes/_authenticated/social/people.tsx`
- **Profile Data**: Use `monthlyRate` helper from `src/lib/mining.ts` to calculate and display the mining amount on profile pages.
- **Button Addition**: Insert the "Good-App Social" button into the dashboard layout, likely near the top or as a new card in the `DashSection`.

## Verification Plan
- **Dashboard**: Verify the home page shows slots, mining counter, and all previous dashboard elements.
- **Navigation**: Click the "Social" button and verify it opens the News Feed. Click "Home" in the social section and verify it returns to the dashboard.
- **Social Features**: Ensure Messenger, Stories, and calling still work within the new social section.
- **Profile**: Check a user's profile to see if the correct monthly mining amount is displayed.
