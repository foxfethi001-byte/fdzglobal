# World Intelligence Hub (WIH)

Free, open-source, local-first global OSINT & geospatial intelligence platform.

## Architecture Overview
- **Frontend**: React 19, TypeScript (`strict: true`), Tailwind CSS v4, MapLibre GL JS, IndexedDB (`idb`), Vite PWA (`vite-plugin-pwa`).
- **Backend**: Express + TypeScript (`server.ts`) providing server-side API proxying, TTL caching, domain rate-limiting, multilingual RSS parsing (`rss-parser`), event correlation & deduplication, and optional Gemini AI synthesis (`@google/genai`).
- **Local-First Persistence**: User preferences, watchlists, alert rules, bookmarked events, and offline cached snapshots are stored locally in browser IndexedDB without mandatory user accounts.

## Environment Variables
Configure via environment variables or AI Studio Secrets (never in frontend code):
- `GEMINI_API_KEY` *(Optional)*: Server-side API key for optional Gemini 4 Hydrogen (`gemini-4-hydrogen`) intelligence briefings. If omitted or disabled in Settings, WIH automatically runs its deterministic rule-based analytical engine.
- `PORT` *(Optional, default `3000`)*: Server listening port.
- `APP_URL` *(Optional)*: Application hosting URL.

## Integrated Open Data Sources & Quotas

| Source | Endpoint | Update Cadence / Cache | Limitations / Free-Tier Notes |
| --- | --- | --- | --- |
| **USGS Earthquake Hazards** | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/` | 2 min | Global seismic sensor feed; micro-quakes (`<M2.5`) filtered in 24h view. |
| **NASA EONET v3** | `https://eonet.gsfc.nasa.gov/api/v3/events` | 10 min | Curated Earth observatory hazards (wildfires, storms, volcanoes, floods). |
| **NASA FIRMS (MODIS C6.1)** | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv` | 15 min | High-confidence (`>=85%`) thermal anomalies; includes wildfires and industrial flares. |
| **UN/EU GDACS** | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH` | 10 min | Green/Orange/Red humanitarian hazard alerts. |
| **Multilingual RSS** | BBC World, Al Jazeera EN, France 24 (EN/FR/AR), DW World | 5 min | Headline-level geocoding from place lexicon; excludes paywalled wires. |
| **GDELT Project v2** | `https://api.gdeltproject.org/api/v2/doc/doc` | 10 min (6.5s throttle) | Enforces strict 1 req / 5s public rate limit. |
| **CISA & Threat Feeds** | `https://www.cisa.gov/cybersecurity-advisories/all.xml` + The Hacker News | 10 min | Defensive advisories and public cyber incident reporting. |
| **OpenSky Network / adsb.lol** | `https://opensky-network.org/api/states/all` | 35 sec | Anonymous rate limits & cloud IP filtering may degrade/block OpenSky; falls back transparently or marks unavailable. |
| **Digitraffic Finland AIS** | `https://meri.digitraffic.fi/api/ais/v1/locations` | 60 sec | CC-BY-4.0 live AIS strictly for Baltic Sea / Northern Europe. |
| **Global Commercial AIS** | *Not integrated* | Unavailable | Commercial license required; platform never fabricates vessel positions. |
| **Yahoo Finance / Open-ER-API / World Bank** | Public chart, FX, and macro endpoints | 5 min – 60 min | Delayed market quotes & daily FX/macro series. |
| **Public Infrastructure Reference** | Curated static coordinates (EIA, IAEA PRIS, TeleGeography, OSM) | Static | Verified reference locations only, clearly labeled as static reference. |

## Installation & Running Locally
```bash
npm install
npm run dev
```

## Production Build & Deployment
```bash
npm run build
npm start
```
