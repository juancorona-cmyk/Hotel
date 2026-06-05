# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # netlify dev on :8888 — starts Vite (:5173) + all Netlify Functions together
npm run dev:vite      # Vite only (no functions)
npm run build         # Production build to dist/
npm run preview       # Preview production build
npm run build:apk     # Full pipeline: set-cap-prod → vite build → cap sync → gradle assembleDebug → copy APK to root
npm run deploy:apk    # build:apk then adb install -r to connected device
npm run live:android  # Hot-reload dev on connected Android via adb reverse (scripts/live-android.sh)
```

`build:apk` requires `JAVA_HOME` at `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` (JDK 21). `scripts/set-cap-prod.js` patches `capacitor.config.ts` for production before building.

There are no tests and no linter configured in this project.

## Architecture

This is a **dual-purpose React app**: hotel marketing website + native Android staff app (Capacitor). The same codebase serves both.

### Entry point and routing

- `src/main.jsx` mounts `<App />` inside `<BrowserRouter>`.
- `src/App.jsx` is the router — three routes: `/evento/:slug`, `/checkin`, and `/*` (the hotel homepage).
- **Native app detection**: `window.Capacitor` is truthy only inside the Capacitor WebView. When true, `App.jsx` renders `<StaffApp />` instead of the hotel website.
- **Deep links**: `CapApp.addListener('appUrlOpen', ...)` catches Android App Links (e.g., QR scan of `https://hotelpuntagaleria.mx/checkin?rid=X`) and navigates via React Router.

### Key components

| Component | Purpose |
|---|---|
| `HomeApp` (in App.jsx) | Hotel landing page composing all sections (Hero, Rooms, Restaurant, etc.) |
| `StaffApp` | Native-only staff panel: event list → attendee list with check-in status |
| `CheckInPage` | Staff login + QR ticket validation. Dual-mode: **native app** gets staff login/checkin flow; **browser** gets a public "ticket confirmed" preview with no sensitive data |
| `AdminDashboard` | Analytics dashboard opened via `Ctrl+K` — bot stats, events, charts |
| `EventoPage` | Public event registration page (`/evento/:slug`) — 2-step form (details + payment method) |
| `HotelBot` | Floating AI chat widget using OpenAI `gpt-4o-mini` |

### Database (Turso via Netlify proxy)

**`src/lib/turso.js`** is the single client-side data layer. All DB calls go through `pipeline()` → `fetch()` to `/.netlify/functions/turso-proxy`, which forwards them to the Turso HTTP API. The SDK is never used directly from the browser.

- **`API_BASE` auto-detection**: empty string (relative) in local dev and during live Android reload. In the Capacitor WebView or when the hostname isn't `hotelpuntagaleria.mx`, it falls back to `https://hotelpuntagaleria.mx` so the APK always hits production.
- **Typed args**: `txt(v)`, `int(v)`, `flt(v)` create Turso argument objects.
- **Phone normalization**: `normalizePhone()` strips formatting and keeps the last 10 digits.
- **Safe migrations**: all `ALTER TABLE` calls in `setupDB()` are wrapped in try-catch to ignore already-existing columns.
- **Key functions**: `setupDB()`, `adminLogin()`, `checkInRegistration()`, `undoCheckInRegistration()`, `getActivityRegistrationsByEvent()`, `trackEvent()`, `getStats()`, `saveTransferProof()`.

### Database tables

| Table | Purpose |
|---|---|
| `admin_users` | Staff/admin accounts — username, PBKDF2 hash+salt, role, permissions (JSON) |
| `activities` | Hotel activity catalog (name, schedule, active flag) |
| `hotel_events` | Events tied to an activity — slug, price, capacity, date |
| `activity_registrations` | Active guest registrations — links activity + event, has `checked_in`, `paid`, `payment_method`, `transfer_proof_url` |
| `event_registrations` | Legacy registration table (still counted toward capacity) |
| `bot_events` | Analytics tracking — event_type, session_id, metadata |
| `whatsapp_members` | Phone numbers in the WhatsApp group (dedup check on registration) |
| `push_subscriptions` | Web Push subscriptions (endpoint, p256dh, auth) |
| `fcm_tokens` | Firebase Cloud Messaging device tokens |

### Netlify functions

All in `netlify/functions/`. All support CORS (`*`) and respond to OPTIONS with 204.

| Function | Purpose |
|---|---|
| `turso-proxy.js` | DB proxy — GET for diagnostics, POST to forward SQL pipelines to Turso |
| `auth.js` | Staff login with PBKDF2 (100k iterations, SHA-256); setup key fallback when `admin_users` is empty |
| `chat.js` | HotelBot AI (gpt-4o-mini) with per-IP rate limiting (20 req/min) |
| `ai-description.js` | Generates event descriptions via OpenAI with hotel-specific prompt |
| `export-pdf.js` | HTML→PDF via Puppeteer (local Chrome or sparticuz chromium); 26s timeout |
| `push-notify.js` | Sends FCM + Web Push notifications; cleans stale tokens; uses `nft` bundler |
| `push-subscribe.js` | Registers FCM token or Web Push subscription; uses `nft` bundler |
| `upload-proof.js` | Uploads payment proof images to Cloudinary |
| `upload-ticket-pdf.js` | Uploads ticket PDFs to Cloudinary |
| `gsc.js` | Google Search Console API (totals, byDay, byQuery) via OAuth refresh token |

Functions are **self-contained** — each duplicates Turso helpers inline rather than importing a shared library.

### Capacitor / Android

- App ID: `com.hotelpuntagaleria.app`
- `capacitor.config.ts` sets `server.androidScheme: 'http'` (allows loading local assets without SSL errors) and `server.hostname: 'hotelpuntagaleria.mx'`.
- `android/app/src/main/AndroidManifest.xml` has intent filters for `https://hotelpuntagaleria.mx/checkin` with `autoVerify="true"` (Android App Links).
- `public/.well-known/assetlinks.json` must be deployed for App Link verification. The current fingerprint is from the debug keystore — update for release builds.

### Push notifications

Two channels run in parallel: **FCM** (Firebase Cloud Messaging, via `google-auth-library` service account OAuth) and **Web Push** (VAPID keys via `web-push` library). Both are handled in `push-notify.js`. Subscriptions are stored in separate tables (`fcm_tokens`, `push_subscriptions`). Stale tokens are cleaned up on send failure.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `TURSO_URL` | functions, turso.js fallback | Turso database HTTP URL |
| `TURSO_TOKEN` | functions, turso.js fallback | Turso auth token |
| `OPENAI_API_KEY` | chat.js, ai-description.js | |
| `ADMIN_PASSWORD` | auth.js | Hashed admin password (legacy) |
| `VITE_ADMIN_SETUP_KEY` | CheckInPage, AdminDashboard | First-run setup key |
| `FIREBASE_PROJECT_ID` | push-notify.js | |
| `FIREBASE_PRIVATE_KEY` | push-notify.js | PEM key (newlines as `\n`) |
| `FIREBASE_CLIENT_EMAIL` | push-notify.js | |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push-notify.js | Web Push VAPID |
| `VITE_VAPID_PUBLIC_KEY` | pushNotifications.js (client) | Set in netlify.toml |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | upload functions | Server-side |
| `VITE_CLOUDINARY_CLOUD_NAME` | cdn.js (client) | Set in netlify.toml |
| `GSC_CLIENT_ID` / `GSC_CLIENT_SECRET` / `GSC_REFRESH_TOKEN` | gsc.js | Google Search Console OAuth |
| `GOOGLE_SITE_URL` | gsc.js | Set in netlify.toml |

## Design constraints

- **Font family**: Always use `'Montserrat', sans-serif`. Never substitute other fonts even when applying external design systems. Adapt sizes and weights from Montserrat instead.
- **Primary brand color**: `#5a6c1e` (olive green) — used for buttons, accents, focus rings throughout the site and staff app.
- The project has design system references in `DESIGN.md` (Apple-style), `scroll.md`, and `sequel.md` — these are for reference/inspiration, not strict enforcement.

## Auth model

- **Staff auth**: `CheckInPage` login calls `netlify/functions/auth.js` (PBKDF2). Session persisted in `localStorage` keys: `ci_authed`, `ci_role`, `ci_perms`.
- **Admin dashboard**: Separate password (`VITE_ADMIN_PASSWORD`) stored in `sessionStorage` key `adm_auth`.
- **Setup mode**: If `admin_users` is empty, the first login accepts `VITE_ADMIN_SETUP_KEY` as password to create the initial admin.
- Permissions are granular: `checkin`, `eventos`, `inscripciones` — `admin` role bypasses all checks.

## i18n

`react-i18next` with `src/i18n.js` — Spanish (default) and English. Translations in `src/locales/`. Detects browser language; user preference stored in `localStorage` key `hotel_lang`.
