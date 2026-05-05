# CineMix 🎬

A premium film discovery and streaming app built with Next.js 16, React 19, and the Kinopoisk API.

## Features

- 🎬 **Browse** movies, series, shows, mini-series with full filtering
- 🏆 **Top 250** — all-time greatest films with proper pagination
- 🔍 **Search** with paginated results
- 🎭 **Actor pages** — click any cast member to see their full filmography
- 🎞️ **Film pages** — player, cast, ratings, related films, sequels/prequels
- 🔧 **Filters** — genre, year range, minimum rating, sort order
- 📱 **Fully mobile responsive** — hamburger menu, mobile search, touch scroll
- ✨ **Premium UI** — skeleton loading, hover animations, shimmer effects

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your Kinopoisk API key

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_KINOPOISK_API_KEY` | Your API key from kinopoiskapiunofficial.tech |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL (default: https://kinopoiskapiunofficial.tech/api) |
| `NEXT_PUBLIC_PLAYER_BASE_URL` | Player embed base URL |

## Project Structure

```
app/
  page.tsx              → Home (hero + carousels)
  browse/page.tsx       → Browse with filters + pagination
  top250/page.tsx       → Top 250 list with pagination  
  search/page.tsx       → Search results
  film/[id]/page.tsx    → Film detail + player + cast
  person/[id]/page.tsx  → Actor/director filmography

components/
  Navbar.tsx            → Responsive nav with mobile menu
  FilmCard.tsx          → Film card (grid + scroll variants)
  FilmRow.tsx           → Horizontal scroll carousel
  HeroBanner.tsx        → Full-width hero with gradient
  PlayerSection.tsx     → Embedded video player
  BrowseClient.tsx      → Browse page with all filters
  Top250Client.tsx      → Top 250 with pagination
  SearchClient.tsx      → Search UI
  FilmPageClient.tsx    → Film detail page
  PersonClient.tsx      → Actor/director page
  ActorCard.tsx         → Cast card linking to person page
  Pagination.tsx        → Smart pagination component
  Footer.tsx            → Site footer
  BackToTop.tsx         → Scroll-to-top button

lib/
  kinopoisk.ts          → All API calls
  translate.ts          → Russian→English translation helpers

hooks/
  useTranslate.ts       → Auto-translate Russian text hook
```

## API Reference

Powered by [kinopoiskapiunofficial.tech](https://kinopoiskapiunofficial.tech/documentation/api/)

Get your free API key at: https://kinopoiskapiunofficial.tech
