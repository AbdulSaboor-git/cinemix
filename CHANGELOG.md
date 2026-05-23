### current version: 2.0.0

# CineMix — Changelog

## [2.0.0] — 2026-05-23

### New Features

#### Profile & User Identity
- Added `/profile` page with avatar (name initial), editable display name, and session info panel (session ID, device, browser, location)
- Name is used across the app — list pages show personalized titles like *"John's Watch History"*
- Stat cards on profile link directly to each list (Favorites · Watch Later · Watched count)
- Recent History and Recent Favorites previews on profile (last 5 entries each)
- Data management section on profile: clear History / Favorites / Watch Later independently

#### Favorites & Watch Later
- Added **❤️ Add to Favorites** and **🕐 Watch Later** buttons on every film page, below the info rows
- Buttons show active state (filled heart / blue clock) when the film is already in the list
- Toggle behavior: clicking again removes the film
- Fully deduped — adding the same film twice is a no-op

#### Watch History
- Films are automatically added to history after **10 seconds** of active player time
- History is ordered most-recently-watched first; re-watching bumps a film to the top
- Capped at 200 entries (oldest drop off)
- Can be **paused** (toggle in Preferences → Watch History) or **cleared** (button in Preferences or Profile)

#### List Pages
- `/profile/favorites` — John's Favorites (or just "Favorites")
- `/profile/watchlater` — Watch Later list
- `/profile/history` — Full watch history
- Each page shows poster, title, year, rating, date added, and a per-row remove button
- Empty states with browse CTA

#### Toast Notification System
- Replaced all manual per-component toast arrays with a global `ToastProvider` + `useToast()` hook
- Three types: `success` (green), `error` (red), `info` (blue)
- Used across the entire app: fav/watchlater toggles, history add, preferences save, clear actions
- Toasts auto-dismiss after 3.5 seconds

#### Anonymous Session System
- Every visitor gets a persistent 16-character alphanumeric session ID (stored in `cinemix_session` localStorage key)
- Session schema is **SQL-ready** — every field maps 1:1 to the target DB tables:
  - `sessions` — id, name, ip, country, city, device, browser, user_agent, created_at, updated_at
  - `user_lists` — session_id, list_type, film_id, film_name, poster_url, year, rating, added_at
  - `api_keys` — sync_code (null until DB), keys, saved_at
- IP and geo (country, city) are fetched on first load from `ip-api.com` (free, no key, non-EU safe) and cached in session
- All previous preferences (`cinemix_preferences`) now live inside `cinemix_session` — single source of truth
- `lib/preferences.ts` preserved as a shim so all existing imports work unchanged

#### Separate Save Keys Button
- API keys now have their own **Save Keys** button (distinct from Save Preferences)
- Keys are stored in `session.api_keys.keys` — separate from the preferences blob
- Teaser note in the UI explains the planned 8-char sync code restore flow for future DB sync

---

### Improvements

#### Preferences Page
- Added **Watch History** card with enable/disable toggle and a Clear History button
- Replaced manual toast state + `pushToast` calls with `useToast()` hook
- Reset to defaults now uses `toast.info()` instead of `toast.success()`

#### Navbar
- Added **Profile icon** (person silhouette) in desktop icon row and mobile icon row, next to the settings gear
- Profile link added to mobile full-screen menu with matching active-state styling

#### Premieres Page (Mobile Fix)
- Month navigator refactored from a single overflowing flex row into two rows:
  - Row 1: prev arrow · scrollable month pills · next arrow (pills are narrower on mobile: `px-[10px]` vs `px-3`)
  - Row 2: year stepper · "This month" button
- No more horizontal overflow on 375px screens

#### Player Section
- Integrated watch-history timer directly into `PlayerSection`
- Uses `useRef` for the interval and a `addedRef` guard so history is written exactly once per session
- Timer clears itself immediately after the threshold is hit (no wasted ticks)

---

### Architecture

#### New Files
| File | Purpose |
|------|---------|
| `lib/session.ts` | Session schema, read/write, geo-init, all accessor helpers |
| `lib/userLists.ts` | Favorites, watchlater, history CRUD with deduplication |
| `lib/toast.tsx` | Global ToastProvider, useToast hook, ToastStack UI |
| `components/SessionInit.tsx` | Silent client component — fires `initSession()` on mount |
| `components/ProfileClient.tsx` | Full profile page UI |
| `components/UserListPage.tsx` | Reusable list page (favorites / watchlater / history) |
| `app/profile/page.tsx` | Profile route |
| `app/profile/favorites/page.tsx` | Favorites route |
| `app/profile/watchlater/page.tsx` | Watch Later route |
| `app/profile/history/page.tsx` | History route |

#### Modified Files
| File | What changed |
|------|-------------|
| `lib/preferences.ts` | Thin shim over `session.ts`; all existing call sites unchanged |
| `app/layout.tsx` | Added `<ToastProvider>` wrapper and `<SessionInit>` |
| `components/PlayerSection.tsx` | Watch-history timer (10s threshold) |
| `components/FilmPageClient.tsx` | Fav + Watch Later buttons; `useToast` import |
| `components/PreferencesClient.tsx` | History card, Save Keys button, `useToast` replaces manual toasts |
| `components/Navbar.tsx` | Profile icon (desktop + mobile + mobile menu) |
| `components/PremieresClient.tsx` | Two-row month navigator for mobile |

---

### Future Work (Planned, Not Yet Implemented)
- **DB Sync**: user clicks Save Keys → keys stored in `api_key_store` SQL table → server returns 8-char alphanumeric+symbol restore code
- **Restore flow**: user enters 8-char code on new device → keys and session data restored
- **Revoke / Regenerate**: invalidate old code and issue a new one
- **Key encryption**: keys stored as-is locally for now; will be encrypted at rest before DB storage
- **Anonymous session sync**: full `sessions` + `user_lists` sync via session ID, no login required
