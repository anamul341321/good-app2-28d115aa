# Plan: Full-Screen Social Section & Dashboard Restore

Restore the original Good-App Dashboard and move all social features to a dedicated, full-screen section at `/social`.

## 1. Architectural Changes
- **Layout Control**: Update `src/routes/_authenticated/route.tsx` to hide the main app header and bottom navigation when the current path is under `/social`. This ensures a truly full-screen experience for social features.
- **Social Layout**: Refine `src/routes/_authenticated/social.tsx` to handle layouting for all social sub-routes (Feed, Messenger, Profile).

## 2. Dashboard Restoration (`src/routes/_authenticated/home.tsx`)
- Remove all embedded social UI elements (News Feed boxes, social cards, etc.).
- Ensure a prominent, premium-styled "Good-App Social" entry button is present to lead users to the new section.
- Verify all original dashboard features (Mining, Wallet, Tasks, etc.) are correctly positioned and styled.

## 3. Social Section UI Overhaul
- **Full-Screen Header**: Implement a new header for the social section in `src/components/social/NewsFeedPage.tsx` including:
    - "← Dashboard" back button.
    - Good-App Social logo/text.
    - Search, Messenger icon, Notifications bell, and User Profile icon.
- **Messenger Integration**: Ensure the Messenger interface (`/social/messenger`) occupies the full screen and provides back navigation to the social home.
- **Profile Integration**: Update the social profile page (`/social/profile`) to display user information, monthly mining rates, and social activity in a full-screen layout.

## 4. Navigation & UX
- Ensure "Browser Back" behavior correctly navigates from Social back to Dashboard.
- Verify that clicking on profiles, posts, or messages within the social section keeps the user within the `/social` route tree.
- Style the social section with a modern, mobile-first aesthetic inspired by Facebook Messenger but branded as "Good-App Social".

## Technical Details
- Use `useLocation()` in `_authenticated/route.tsx` to conditionally render global navigation components.
- Update `MessengerNav.tsx` to align with the new navigation structure.
- Ensure all social routes (`/social`, `/social/messenger`, `/social/profile`) are optimized for full-screen mobile usage.
