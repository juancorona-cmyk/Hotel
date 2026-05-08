# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Vite dev server (proxies /.netlify/functions to :8888)
npm run build         # Production build to dist/
npm run preview       # Preview production build
npm run build:apk     # Full pipeline: vite build → cap sync → gradle assembleDebug → copy APK to root
```

`build:apk` requires `JAVA_HOME` pointing to JDK 21 at `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

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

**`src/lib/turso.js`** is the single data layer. It talks to a **Netlify function proxy** (`netlify/functions/turso-proxy.js`) rather than using the Turso SDK directly. Every DB call goes through `pipeline()` → `fetch()` to `/.netlify/functions/turso-proxy`.

- The `API_BASE` constant auto-detects: if running in Capacitor (`window.Capacitor`) or not on the production domain, it uses the production URL (`https://hotelpuntagaleria.mx`) as the API origin. Otherwise uses relative paths (local dev).
- Helper constructors: `txt(v)`, `int(v)`, `flt(v)` create typed Turso argument objects.
- Important DB functions: `setupDB()` (auto-migrates), `adminLogin()`, `checkInRegistration()`, `getRegistrationById()`, `getActivityRegistrationsByEvent()`, `trackEvent()`, `getStats()`.

### Netlify functions

All in `netlify/functions/`:
- `turso-proxy.js` — main DB proxy (receives SQL pipelines, executes against Turso HTTP API)
- `chat.js` — HotelBot AI endpoint
- `ai-description.js` — AI-generated content
- `export-pdf.js` — PDF export via Puppeteer
- `gsc.js` — Google Search Console integration

### Capacitor / Android

- App ID: `com.hotelpuntagaleria.app`
- `android/app/src/main/AndroidManifest.xml` has intent filters for `https://hotelpuntagaleria.mx/checkin` with `autoVerify="true"` (Android App Links).
- `public/.well-known/assetlinks.json` must be deployed for App Link verification (current fingerprint is from the debug keystore; update for release builds).
- `capacitor.config.ts` sets `server.androidScheme: 'https'` and `server.hostname: 'hotelpuntagaleria.mx'`.

## Design constraints

- **Font family**: Always use `'Montserrat', sans-serif`. Never substitute other fonts even when applying external design systems. Adapt sizes and weights from Montserrat instead.
- **Primary brand color**: `#5a6c1e` (olive green) — used for buttons, accents, focus rings throughout the site and staff app.
- The project has design system references in `DESIGN.md` (Apple-style), `scroll.md`, and `sequel.md` — these are for reference/inspiration, not strict enforcement.

## Auth model

- **Staff auth**: `CheckInPage` login validates against `admin_users` table. Session persisted in `localStorage` keys: `ci_authed`, `ci_role`, `ci_perms`.
- **Admin dashboard**: Separate password (`VITE_ADMIN_PASSWORD` in `.env`) stored in `sessionStorage` key `adm_auth`.
- **Setup mode**: If `admin_users` table is empty, the first login accepts `VITE_ADMIN_SETUP_KEY` as the password.
- Permissions are granular: `checkin`, `eventos`, `inscripciones` — admin role bypasses all checks.

## Events and registrations

- `hotel_events`: event metadata (name, slug, price, capacity, date, activity_id).
- `activity_registrations`: guest registrations — links to both `activity_id` and `event_id`. Has `checked_in`, `paid`, `payment_method` columns.
- `event_registrations`: legacy registration table (still counted in capacity).

## i18n

`react-i18next` with `src/i18n.js` — Spanish (default) and English. Translations in `src/locales/`. Detects browser language; user preference stored in `localStorage` key `hotel_lang`.
