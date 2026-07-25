# Discipline AI (Version 1)

Cross-platform discipline coaching app (Android, iOS, Web) built with **Expo (React Native + React Native Web)**, **TypeScript**, **Material Design 3**, **Firebase Authentication**, and **Cloud Firestore**.

## Architecture

- **Clean architecture** folders: `app`, `components`, `features`, `navigation`, `screens`, `hooks`, `services`, `firebase`, `database`, `providers`, `notifications`, `AI`, `utils`, `constants`, `types`, `assets`
- **State**: Zustand feature stores (`features/auth`, `features/data`, `features/settings`)
- **Data**: Repository pattern over Firestore (`database/*`)
- **Behaviour engine**: Every reminder action writes to `behaviour_events`; BDI computed in `services/bdiService.ts`
- **AI V1**: Non-conversational, rule-based insights in `AI/insightsEngine.ts` (Cloud Functions mirror for scheduled reports)
- **Local storage**: AsyncStorage cache only (`services/cacheService.ts`)
- **Firebase Storage**: Disabled in Version 1; there are no file or profile-image uploads

## Firestore model (multi-tenant, sharded under user)

| Path | Purpose |
|------|---------|
| `users/{uid}` | Profile, BDI summary, streaks, admin flag |
| `users/{uid}/habits` | Habits |
| `users/{uid}/goals` | Goals (daily/weekly/monthly/yearly, recurring/one-time) |
| `users/{uid}/tasks` | Scheduled tasks |
| `users/{uid}/reminders` | Reminder instances |
| `users/{uid}/behaviour_events` | All interactions (complete/skip/snooze) |
| `users/{uid}/weekly_reports` | Weekly behaviour analysis |
| `users/{uid}/monthly_reports` | Monthly trends |
| `users/{uid}/milestone_reports` | Milestone comparisons |
| `settings/{uid}` | Theme, notifications, push token |
| `premium/{uid}` | Subscription flags (disabled in V1) |
| `analytics/{id}` | Client analytics events |
| `admin_*` | Admin panel data |

## Setup

1. Copy `.env.example` to `.env` and fill Firebase + Google OAuth client IDs.
2. Enable **Email**, **Google**, and **Apple** auth in Firebase Console.
3. Deploy Firestore rules and indexes: `firebase deploy --only firestore`
4. Install functions: `cd functions && npm install && npm run build`
5. Run app: `npm start` then `w` / `a` / `i`

## Version 1 scope

Implemented: auth, profile, dashboard, habits, goals, reminders (complete/skip/snooze), BDI, reports (daily summary / weekly / monthly / milestones), settings, push registration, admin panel shell, Cloud Functions for weekly reports & admin analytics.

Architected but **disabled**: Firebase Storage/file uploads, premium billing, PDF export, wearables, conversational AI.

## Scripts

- `npm start` — Expo dev server
- `npm run web` — Web
- `npm run android` / `npm run ios` — Native targets
