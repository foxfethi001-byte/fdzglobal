import { createHash } from 'node:crypto';
import Parser from 'rss-parser';
import {
  cachedFetch,
  clearServerCache,
  getAllEndpointDiagnostics,
  getAllSourceHealth,
  recordSourceError,
  registerSourceMetadata,
  throttledFetch,
  updateSourceHealth,
} from './cache.ts';
import {
  classifyHeadline,
  correlateAndDeduplicateEvents,
  evaluateConfidence,
  extractGeoFromText,
  extractPointOrCentroid,
  inferRegionFromCoords,
  normalizeCoordinates,
} from './correlator.ts';
import { STATIC_INFRASTRUCTURE_EVENTS } from './catalog.ts';
import { keyManager } from './keyManager.ts';
import type {
  AircraftTrack,
  EconomicIndicator,
  IntelEvent,
  SeverityLevel,
  VesselTrack,
} from '../src/types/intelligence.ts';

const rssParser = new Parser({
  timeout: 9000,
  headers: {
    'User-Agent': 'WorldIntelligenceHub/1.0',
  },
});

function hashId(prefix: string, raw: string): string {
  return `${prefix}-${createHash('sha1').update(raw).digest('hex').slice(0, 16)}`;
}

export function initSourceRegistry() {
  registerSourceMetadata({
    id: 'usgs',
    name: 'USGS Earthquake Hazards Program',
    category: 'Natural Disasters',
    endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    updateFrequency: '2 min cache',
    limitations: 'Global seismic sensor network; micro-quakes (<M2.5) may be sparse in remote oceans.',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'eonet',
    name: 'NASA EONET v3',
    category: 'Natural Disasters',
    endpoint: 'https://eonet.gsfc.nasa.gov/api/v3/events',
    updateFrequency: '10 min cache',
    limitations: 'Curated Earth observatory events (wildfires, storms, volcanoes, floods).',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'firms',
    name: 'NASA FIRMS MODIS Active Fire 24h',
    category: 'Natural Disasters',
    endpoint: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv',
    updateFrequency: '15 min cache',
    limitations: 'Thermal anomalies include wildfires, agricultural burning, and gas flares; grid-sampled (conf >= 80%).',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'gdacs',
    name: 'UN/EU GDACS Disaster Alerts',
    category: 'Natural Disasters',
    endpoint: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
    updateFrequency: '10 min cache',
    limitations: 'Major Green/Orange/Red humanitarian hazard alerts.',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'news_rss',
    name: 'Multilingual International RSS (BBC / AJ / France 24 EN-FR-AR / DW)',
    category: 'News & Conflict Intelligence',
    endpoint: 'BBC World, Al Jazeera EN, France 24 EN/FR/AR, DW World',
    updateFrequency: '5 min cache',
    limitations: 'Headline-level geocoding from place mentions; excludes paywalled wires.',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'gdelt',
    name: 'GDELT Project v2 Geo/Doc API',
    category: 'Conflict & Political Unrest',
    endpoint: 'https://api.gdeltproject.org/api/v2/doc/doc',
    updateFrequency: '10 min cache (6s rate-limit)',
    limitations: 'Strict 1 req / 5s public rate limit; automated tone/location extraction.',
    status: 'degraded',
  });
  registerSourceMetadata({
    id: 'cisa',
    name: 'CISA Advisories & The Hacker News RSS',
    category: 'Cyber Intelligence',
    endpoint: 'https://www.cisa.gov/cybersecurity-advisories/all.xml + THN',
    updateFrequency: '10 min cache',
    limitations: 'Defensive advisories and public reporting; many cyber events lack physical coordinates.',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'aviation',
    name: 'OpenSky Network & ADS-B Community',
    category: 'Aviation',
    endpoint: 'https://opensky-network.org/api/states/all',
    updateFrequency: '30 sec cache',
    limitations: 'Anonymous requests subject to rate limits and cloud IP filtering; receiver coverage gaps exist.',
    status: 'degraded',
  });
  registerSourceMetadata({
    id: 'maritime_ais',
    name: 'Digitraffic Finland AIS (Baltic Regional)',
    category: 'Maritime',
    endpoint: 'https://meri.digitraffic.fi/api/ais/v1/locations',
    updateFrequency: '60 sec cache',
    limitations: 'Free CC-BY-4.0 AIS covering Baltic/Finnish waters only. Global live AIS requires commercial subscription (unavailable).',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'maritime_global',
    name: 'Global Commercial AIS (Excluded — 100% Free Policy)',
    category: 'Maritime',
    endpoint: 'Excluded to keep platform 100% free (zero paid APIs)',
    updateFrequency: 'Free Regional AIS Active',
    limitations: 'Platform strictly excludes paid commercial AIS subscriptions. Live Baltic AIS (CC-BY-4.0), global chokepoints, and maritime incident reporting remain 100% free.',
    status: 'reference',
  });
  registerSourceMetadata({
    id: 'economy',
    name: 'Yahoo Finance Public Chart / Frankfurter ECB / Open-ER-API / World Bank',
    category: 'Economic Intelligence',
    endpoint: 'query1.finance.yahoo.com + api.frankfurter.dev + open.er-api.com + api.worldbank.org',
    updateFrequency: '5 min cache',
    limitations: 'Delayed market quotes and daily FX/macro series; subject to exchange trading hours.',
    status: 'operational',
  });
  registerSourceMetadata({
    id: 'ref_infra',
    name: 'Public Geospatial Reference Datasets',
    category: 'Infrastructure',
    endpoint: 'Static verified public coordinates (EIA, IAEA PRIS, TeleGeography, OSM)',
    updateFrequency: 'Static reference',
    limitations: 'Reference coordinates only; does not represent live operational telemetry.',
    status: 'reference',
  });
}

function nowIso() {
  return new Date().toISOString();
}

export async function fetchUsgsEarthquakes(range: '24h' | '7d' | '30d' = '24h'): Promise<IntelEvent[]> {
  const feedName = range === '30d' ? 'significant_month.geojson' : range === '7d' ? '4.5_week.geojson' : 'all_day.geojson';
  const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feedName}`;
  const { data } = await cachedFetch(`usgs-${range}`, 120_000, async () => {
    const started = Date.now();
    updateSourceHealth('usgs', { lastAttemptAt: nowIso() });
    try {
      const res = await throttledFetch('usgs', 500, url, 9000);
      if (!res.ok) {
        recordSourceError('usgs', `HTTP ${res.status}`, res.status, url);
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        features?: Array<{
          id: string;
          properties: { mag: number | null; place: string; time: number; updated: number; url: string; tsunami: number; alert: string | null; title: string };
          geometry: { coordinates: [number, number, number] };
        }>;
      };
      const collectedAt = nowIso();
      const events: IntelEvent[] = [];
      for (const f of json.features ?? []) {
        const [lon, lat, depth] = f.geometry?.coordinates ?? [];
        const coords = normalizeCoordinates(lat, lon);
        if (!coords) continue;
        const mag = f.properties.mag ?? 0;
        if (range === '24h' && mag < 2.5) continue; // Keep M2.5+ for clarity and performance
        let severity: SeverityLevel = 'low';
        if (mag >= 6.5 || f.properties.alert === 'red') severity = 'critical';
        else if (mag >= 5.5 || f.properties.alert === 'orange') severity = 'high';
        else if (mag >= 4.5) severity = 'medium';

        const pub = new Date(f.properties.time).toISOString();
        const upd = new Date(f.properties.updated || f.properties.time).toISOString();
        const geo = extractGeoFromText(f.properties.place ?? '');
        const sources = [
          {
            id: `usgs-${f.id}`,
            organization: 'USGS Earthquake Hazards Program',
            title: f.properties.title || `M${mag.toFixed(1)} Earthquake - ${f.properties.place}`,
            url: f.properties.url || 'https://earthquake.usgs.gov/',
            publishedAt: pub,
            collectedAt,
            language: 'en' as const,
            nature: 'real_observation' as const,
            snippet: `Magnitude ${mag.toFixed(1)}, Depth ${(depth ?? 0).toFixed(1)} km${f.properties.tsunami ? ', Tsunami advisory issued' : ''}.`,
          },
        ];
        const conf = evaluateConfidence('real_observation', sources, 'exact', false);
        events.push({
          id: `usgs-${f.id}`,
          title: f.properties.title || `M${mag.toFixed(1)} Earthquake — ${f.properties.place}`,
          summary: `Seismic observation recorded by USGS at ${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)} (depth ${(depth ?? 0).toFixed(1)} km).`,
          category: 'earthquake',
          severity,
          nature: 'real_observation',
          lat: coords.lat,
          lon: coords.lon,
          geoPrecision: 'exact',
          country: geo?.country,
          countryCode: geo?.countryCode,
          region: geo?.region ?? inferRegionFromCoords(coords.lat, coords.lon),
          publishedAt: pub,
          collectedAt,
          updatedAt: upd,
          magnitude: Number(mag.toFixed(1)),
          depthKm: Number((depth ?? 0).toFixed(1)),
          metrics: { magnitude: Number(mag.toFixed(1)), depthKm: Number((depth ?? 0).toFixed(1)), tsunamiFlag: f.properties.tsunami },
          sources,
          ...conf,
          tags: ['seismic', 'usgs', f.properties.tsunami ? 'tsunami-flag' : 'earthquake'],
        });
      }
      updateSourceHealth('usgs', {
        status: 'operational',
        lastSuccessAt: collectedAt,
        lastStatusCode: res.status,
        itemCount: events.length,
        latencyMs: Date.now() - started,
        errorMessage: undefined,
      });
      return events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'USGS fetch error';
      recordSourceError('usgs', msg, null, url);
      updateSourceHealth('usgs', {
        status: 'unavailable',
        latencyMs: Date.now() - started,
        errorMessage: msg,
      });
      throw err;
    }
  }, []);
  return data;
}

export async function fetchNasaEonet(): Promise<IntelEvent[]> {
  const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80';
  const { data } = await cachedFetch('eonet-open', 600_000, async () => {
    const started = Date.now();
    updateSourceHealth('eonet', { lastAttemptAt: nowIso() });
    try {
      const res = await throttledFetch('eonet', 500, url, 9000);
      if (!res.ok) {
        recordSourceError('eonet', `HTTP ${res.status}`, res.status, url);
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        events?: Array<{
          id: string;
          title: string;
          link: string;
          categories: Array<{ id: string; title: string }>;
          sources: Array<{ id: string; url: string }>;
          geometry: Array<{ date: string; type: string; coordinates: unknown }>;
        }>;
      };
      const collectedAt = nowIso();
      const events: IntelEvent[] = [];
      for (const item of json.events ?? []) {
        const latestGeo = item.geometry?.[item.geometry.length - 1];
        if (!latestGeo) continue;
        const coords = extractPointOrCentroid(latestGeo);
        if (!coords) continue;

        const catId = item.categories?.[0]?.id ?? '';
        let category: IntelEvent['category'] = 'severe_weather';
        if (catId === 'wildfires') category = 'wildfire';
        else if (catId === 'volcanoes') category = 'volcano';
        else if (catId === 'floods' || catId === 'landslides') category = 'flood';
        else if (catId === 'severeStorms') category = 'severe_weather';
        else if (catId === 'earthquakes') category = 'earthquake';
        else continue;

        const pub = new Date(latestGeo.date).toISOString();
        const geo = extractGeoFromText(item.title);
        const sources = [
          {
            id: `eonet-${item.id}`,
            organization: 'NASA EONET',
            title: item.title,
            url: item.sources?.[0]?.url || item.link || 'https://eonet.gsfc.nasa.gov/',
            publishedAt: pub,
            collectedAt,
            language: 'en' as const,
            nature: 'real_observation' as const,
            snippet: `NASA Earth Observatory Natural Event Tracker category: ${item.categories?.[0]?.title ?? catId}.`,
          },
        ];
        const conf = evaluateConfidence('real_observation', sources, 'exact', false);
        events.push({
          id: `eonet-${item.id}`,
          title: item.title,
          summary: `Active natural hazard tracked by NASA EONET (${item.categories?.[0]?.title ?? catId}).`,
          category,
          severity: category === 'volcano' || category === 'severe_weather' ? 'high' : 'medium',
          nature: 'real_observation',
          lat: coords.lat,
          lon: coords.lon,
          geoPrecision: 'exact',
          country: geo?.country,
          countryCode: geo?.countryCode,
          region: geo?.region ?? inferRegionFromCoords(coords.lat, coords.lon),
          publishedAt: pub,
          collectedAt,
          updatedAt: pub,
          sources,
          ...conf,
          tags: ['nasa-eonet', catId],
        });
      }
      updateSourceHealth('eonet', {
        status: 'operational',
        lastSuccessAt: collectedAt,
        lastStatusCode: res.status,
        itemCount: events.length,
        latencyMs: Date.now() - started,
        errorMessage: undefined,
      });
      return events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'EONET fetch error';
      recordSourceError('eonet', msg, null, url);
      updateSourceHealth('eonet', {
        status: 'unavailable',
        latencyMs: Date.now() - started,
        errorMessage: msg,
      });
      throw err;
    }
  }, []);
  return data;
}

export async function fetchNasaFirmsWildfires(): Promise<IntelEvent[]> {
  const optionalKey = keyManager.getOptionalFirmsKey();
  const publicCsvUrl = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';
  const keyedCsvUrl = optionalKey
    ? `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(optionalKey)}/VIIRS_SNPP_NRT/world/1`
    : null;
  const cacheKey = optionalKey ? 'firms-keyed-24h' : 'firms-modis-24h';

  const { data } = await cachedFetch(cacheKey, 900_000, async () => {
    const started = Date.now();
    updateSourceHealth('firms', { lastAttemptAt: nowIso() });
    let activeUrl = keyedCsvUrl ?? publicCsvUrl;
    try {
      let res = await throttledFetch('firms', 2000, activeUrl, 11_000);
      if (!res.ok && keyedCsvUrl) {
        recordSourceError('firms', `FIRMS keyed endpoint HTTP ${res.status}; falling back to public CSV`, res.status, keyedCsvUrl);
        activeUrl = publicCsvUrl;
        res = await throttledFetch('firms', 2000, publicCsvUrl, 11_000);
        keyManager.recordMirrorUpdate('firms', 'NASA FIRMS MODIS Public CSV (Failover)', true);
      } else {
        keyManager.recordMirrorUpdate(
          'firms',
          activeUrl === keyedCsvUrl ? 'NASA FIRMS Keyed API' : 'NASA FIRMS MODIS C6.1 Public 24h CSV',
          false
        );
      }
      if (!res.ok) {
        recordSourceError('firms', `HTTP ${res.status}`, res.status, activeUrl);
        throw new Error(`HTTP ${res.status}`);
      }
      const csv = await res.text();
      const lines = csv.split('\n');
      const collectedAt = nowIso();
      const cellBest = new Map<string, {
        cellKey: string;
        coords: { lat: number; lon: number };
        brightness: number;
        acqDate: string;
        acqTime: string;
        sat: string;
        confidence: number;
        frp: number;
      }>();

      // Scan entire CSV so global high-FRP hotspots are represented fairly rather than file-order first 140
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 12) continue;
        const coords = normalizeCoordinates(cols[0], cols[1]);
        if (!coords) continue;
        const brightness = Number(cols[2]);
        const acqDate = cols[5];
        const acqTime = cols[6].padStart(4, '0');
        const sat = cols[7];
        const confidence = Number(cols[8]);
        const frp = Number(cols[11]);

        if (!Number.isFinite(confidence) || !Number.isFinite(frp) || confidence < 85 || frp < 25) continue;

        const cellKey = `${Math.round(coords.lat)}_${Math.round(coords.lon)}`;
        const prev = cellBest.get(cellKey);
        if (!prev || frp > prev.frp) {
          cellBest.set(cellKey, {
            cellKey,
            coords,
            brightness,
            acqDate,
            acqTime,
            sat,
            confidence,
            frp,
          });
        }
      }

      const topCells = Array.from(cellBest.values())
        .sort((a, b) => b.frp - a.frp)
        .slice(0, 140);

      const events: IntelEvent[] = topCells.map((cell) => {
        const isoDate = `${cell.acqDate}T${cell.acqTime.slice(0, 2)}:${cell.acqTime.slice(2, 4)}:00.000Z`;
        const validPub = Number.isNaN(Date.parse(isoDate)) ? collectedAt : isoDate;
        const sources = [
          {
            id: `firms-${cell.cellKey}-${cell.acqDate}`,
            organization: 'NASA FIRMS (MODIS C6.1)',
            title: `Satellite Thermal Anomaly (${cell.frp.toFixed(1)} MW FRP)`,
            url: 'https://firms.modaps.eosdis.nasa.gov/map/',
            publishedAt: validPub,
            collectedAt,
            language: 'en' as const,
            nature: 'real_observation' as const,
            snippet: `MODIS Satellite ${cell.sat}, confidence ${cell.confidence}%, brightness ${cell.brightness.toFixed(1)} K, radiative power ${cell.frp.toFixed(1)} MW.`,
          },
        ];
        const conf = evaluateConfidence('real_observation', sources, 'exact', false);
        return {
          id: `firms-${cell.cellKey}-${cell.acqDate}`,
          title: `High-Confidence Thermal / Fire Anomaly (${cell.frp.toFixed(0)} MW)`,
          summary: `NASA MODIS satellite detected high-radiative-power thermal anomaly (${cell.confidence}% sensor confidence, ${cell.frp.toFixed(1)} MW FRP). Note: may reflect wildfire or industrial flaring.`,
          category: 'wildfire',
          severity: cell.frp >= 120 ? 'high' : 'medium',
          nature: 'real_observation',
          lat: cell.coords.lat,
          lon: cell.coords.lon,
          geoPrecision: 'exact',
          region: inferRegionFromCoords(cell.coords.lat, cell.coords.lon),
          publishedAt: validPub,
          collectedAt,
          updatedAt: validPub,
          metrics: { frpMw: cell.frp, brightnessK: cell.brightness, sensorConfidencePct: cell.confidence },
          sources,
          ...conf,
          tags: ['nasa-firms', 'modis', 'thermal-anomaly'],
        };
      });

      updateSourceHealth('firms', {
        status: 'operational',
        lastSuccessAt: collectedAt,
        lastStatusCode: res.status,
        itemCount: events.length,
        latencyMs: Date.now() - started,
        errorMessage: undefined,
      });
      return events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FIRMS fetch error';
      recordSourceError('firms', msg, null, activeUrl);
      updateSourceHealth('firms', {
        status: 'unavailable',
        latencyMs: Date.now() - started,
        errorMessage: msg,
      });
      throw err;
    }
  }, []);
  return data;
}

export async function fetchGdacsAlerts(): Promise<IntelEvent[]> {
  const url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Green;Orange;Red';
  const { data } = await cachedFetch('gdacs-alerts', 600_000, async () => {
    const started = Date.now();
    updateSourceHealth('gdacs', { lastAttemptAt: nowIso() });
    try {
      const res = await throttledFetch('gdacs', 1000, url, 9000);
      if (!res.ok) {
        recordSourceError('gdacs', `HTTP ${res.status}`, res.status, url);
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        features?: Array<{
          properties: {
            eventid: number;
            eventtype: string;
            name: string;
            description: string;
            alertlevel: string;
            country: string;
            fromdate: string;
            todate: string;
            url?: { report?: string };
            severitydata?: { severity?: number; severityunit?: string };
          };
          geometry: { type: string; coordinates: unknown };
        }>;
      };
      const collectedAt = nowIso();
      const events: IntelEvent[] = [];
      for (const f of (json.features ?? []).slice(0, 60)) {
        const p = f.properties;
        const coords = extractPointOrCentroid(f.geometry);
        if (!coords) continue;

        let category: IntelEvent['category'] = 'severe_weather';
        if (p.eventtype === 'EQ') category = 'earthquake';
        else if (p.eventtype === 'FL') category = 'flood';
        else if (p.eventtype === 'VO') category = 'volcano';
        else if (p.eventtype === 'WF') category = 'wildfire';
        else if (p.eventtype === 'TC') category = 'severe_weather';

        let severity: SeverityLevel = 'low';
        if (p.alertlevel === 'Red') severity = 'critical';
        else if (p.alertlevel === 'Orange') severity = 'high';
        else if (p.alertlevel === 'Green') severity = 'medium';

        const pub = p.fromdate ? new Date(p.fromdate).toISOString() : collectedAt;
        const upd = p.todate ? new Date(p.todate).toISOString() : pub;
        const sources = [
          {
            id: `gdacs-${p.eventtype}-${p.eventid}`,
            organization: 'UN/EU GDACS',
            title: `${p.alertlevel} Alert: ${p.name || p.description}`,
            url: p.url?.report || `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}`,
            publishedAt: pub,
            collectedAt,
            language: 'en' as const,
            nature: 'real_observation' as const,
            snippet: p.description || `${p.eventtype} disaster alert in ${p.country}.`,
          },
        ];
        const conf = evaluateConfidence('real_observation', sources, 'exact', false);
        events.push({
          id: `gdacs-${p.eventtype}-${p.eventid}`,
          title: `GDACS ${p.alertlevel}: ${p.name || p.description}`,
          summary: `${p.description || p.name} (${p.country || 'International'}). Alert level: ${p.alertlevel}.`,
          category,
          severity,
          nature: 'real_observation',
          lat: coords.lat,
          lon: coords.lon,
          geoPrecision: 'exact',
          country: p.country || undefined,
          region: inferRegionFromCoords(coords.lat, coords.lon),
          publishedAt: pub,
          collectedAt,
          updatedAt: upd,
          metrics: p.severitydata?.severity ? { intensity: `${p.severitydata.severity} ${p.severitydata.severityunit ?? ''}` } : undefined,
          sources,
          ...conf,
          tags: ['gdacs', p.alertlevel.toLowerCase(), p.eventtype.toLowerCase()],
        });
      }
      updateSourceHealth('gdacs', {
        status: 'operational',
        lastSuccessAt: collectedAt,
        lastStatusCode: res.status,
        itemCount: events.length,
        latencyMs: Date.now() - started,
        errorMessage: undefined,
      });
      return events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GDACS fetch error';
      recordSourceError('gdacs', msg, null, url);
      updateSourceHealth('gdacs', {
        status: 'unavailable',
        latencyMs: Date.now() - started,
        errorMessage: msg,
      });
      throw err;
    }
  }, []);
  return data;
}

const NEWS_FEEDS: Array<{ org: string; url: string; lang: 'en' | 'fr' | 'ar' }> = [
  { org: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', lang: 'en' },
  { org: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en' },
  { org: 'France 24 EN', url: 'https://www.france24.com/en/rss', lang: 'en' },
  { org: 'France 24 FR', url: 'https://www.france24.com/fr/rss', lang: 'fr' },
  { org: 'France 24 AR', url: 'https://www.france24.com/ar/rss', lang: 'ar' },
  { org: 'DW World', url: 'https://rss.dw.com/xml/rss-en-world', lang: 'en' },
];

export async function fetchMultilingualRssNews(): Promise<IntelEvent[]> {
  const { data } = await cachedFetch('rss-news-multi', 300_000, async () => {
    const started = Date.now();
    updateSourceHealth('news_rss', { lastAttemptAt: nowIso() });
    const collectedAt = nowIso();
    const rawEvents: IntelEvent[] = [];
    const errors: string[] = [];

    const results = await Promise.allSettled(
      NEWS_FEEDS.map(async (feed) => {
        const parsed = await rssParser.parseURL(feed.url);
        return { feed, items: parsed.items ?? [] };
      })
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const feed = NEWS_FEEDS[i];
      if (r.status === 'rejected') {
        const msg = r.reason instanceof Error ? r.reason.message : 'RSS error';
        errors.push(`${feed.org}: ${msg}`);
        recordSourceError('news_rss', `${feed.org}: ${msg}`, null, feed.url);
        continue;
      }
      const { items } = r.value;
      for (const item of items.slice(0, 22)) {
        const title = (item.title ?? '').trim();
        const link = (item.link ?? '').trim();
        if (!title || !link) continue;
        const snippet = (item.contentSnippet ?? item.content ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 280);
        const fullText = `${title} ${snippet}`;
        const geo = extractGeoFromText(fullText);
        const { category, severity } = classifyHeadline(fullText, 'political_unrest');
        const pub = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : collectedAt);
        const safePub = Number.isNaN(Date.parse(pub)) ? collectedAt : new Date(pub).toISOString();

        const sources = [
          {
            id: hashId('src', link),
            organization: feed.org,
            title,
            url: link,
            publishedAt: safePub,
            collectedAt,
            language: feed.lang,
            nature: 'media_report' as const,
            snippet,
          },
        ];
        const geoPrecision = geo ? geo.precision : 'ungeolocated';
        const conf = evaluateConfidence('media_report', sources, geoPrecision, false);
        rawEvents.push({
          id: hashId('rss', link),
          title,
          summary: snippet || title,
          category,
          severity,
          nature: 'media_report',
          lat: geo?.lat ?? null,
          lon: geo?.lon ?? null,
          geoPrecision,
          country: geo?.country,
          countryCode: geo?.countryCode,
          region: geo?.region ?? 'Global',
          publishedAt: safePub,
          collectedAt,
          updatedAt: safePub,
          sources,
          ...conf,
          tags: [feed.lang, category, ...(geo?.countryCode ? [geo.countryCode] : [])],
        });
      }
    }

    const correlated = correlateAndDeduplicateEvents(rawEvents);
    updateSourceHealth('news_rss', {
      status: correlated.length > 0 ? (errors.length > 0 ? 'degraded' : 'operational') : 'unavailable',
      lastSuccessAt: correlated.length > 0 ? collectedAt : null,
      lastStatusCode: correlated.length > 0 ? 200 : 502,
      itemCount: correlated.length,
      latencyMs: Date.now() - started,
      errorMessage: errors.length > 0 ? `${errors.length} feed(s) failed: ${errors[0]}` : undefined,
    });
    return correlated;
  }, []);
  return data;
}

export async function fetchGdeltEvents(): Promise<IntelEvent[]> {
  // GDELT enforces strict 1 req / 5s rate limit; use 6500ms domain throttle and 10 min cache
  const query = encodeURIComponent('(conflict OR airstrike OR protest OR explosion OR military) sourcelang:english');
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&maxrecords=30&format=json&timespan=24h`;
  const { data } = await cachedFetch('gdelt-doc-24h', 600_000, async () => {
    const started = Date.now();
    updateSourceHealth('gdelt', { lastAttemptAt: nowIso() });
    try {
      const res = await throttledFetch('gdelt', 6500, url, 10_000);
      if (!res.ok) {
        const msg = `HTTP ${res.status} (GDELT rate-limit or upstream error)`;
        recordSourceError('gdelt', msg, res.status, url);
        updateSourceHealth('gdelt', {
          status: 'degraded',
          lastStatusCode: res.status,
          latencyMs: Date.now() - started,
          errorMessage: msg,
        });
        return [] as IntelEvent[];
      }
      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        const msg = text.slice(0, 140) || 'Non-JSON response from GDELT';
        recordSourceError('gdelt', msg, res.status, url);
        updateSourceHealth('gdelt', {
          status: 'degraded',
          lastStatusCode: res.status,
          latencyMs: Date.now() - started,
          errorMessage: msg,
        });
        return [] as IntelEvent[];
      }
      const json = JSON.parse(text) as {
        articles?: Array<{
          url: string;
          title: string;
          seendate: string;
          domain: string;
          sourcecountry: string;
        }>;
      };
      const collectedAt = nowIso();
      const events: IntelEvent[] = [];
      for (const art of (json.articles ?? []).slice(0, 25)) {
        if (!art.title || !art.url) continue;
        const geo = extractGeoFromText(art.title + ' ' + (art.sourcecountry ?? ''));
        const { category, severity } = classifyHeadline(art.title, 'armed_conflict');
        const m = art.seendate?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
        const pub = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : collectedAt;
        const sources = [
          {
            id: hashId('gdelt-src', art.url),
            organization: art.domain || 'GDELT Source',
            title: art.title,
            url: art.url,
            publishedAt: pub,
            collectedAt,
            language: 'en' as const,
            nature: 'media_report' as const,
            snippet: `Indexed via GDELT Project v2 (${art.sourcecountry || 'International'}).`,
          },
        ];
        const geoPrecision = geo ? geo.precision : 'ungeolocated';
        const conf = evaluateConfidence('media_report', sources, geoPrecision, false);
        events.push({
          id: hashId('gdelt', art.url),
          title: art.title,
          summary: `GDELT indexed report from ${art.domain}. Geographic reference: ${geo?.country ?? 'Unmapped'}.`,
          category,
          severity,
          nature: 'media_report',
          lat: geo?.lat ?? null,
          lon: geo?.lon ?? null,
          geoPrecision,
          country: geo?.country,
          countryCode: geo?.countryCode,
          region: geo?.region ?? 'Global',
          publishedAt: pub,
          collectedAt,
          updatedAt: pub,
          sources,
          ...conf,
          tags: ['gdelt', category],
        });
      }
      updateSourceHealth('gdelt', {
        status: 'operational',
        lastSuccessAt: collectedAt,
        lastStatusCode: res.status,
        itemCount: events.length,
        latencyMs: Date.now() - started,
        errorMessage: undefined,
      });
      return events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GDELT unavailable';
      recordSourceError('gdelt', msg, null, url);
      updateSourceHealth('gdelt', {
        status: 'degraded',
        latencyMs: Date.now() - started,
        errorMessage: msg,
      });
      return [] as IntelEvent[];
    }
  }, []);
  return data;
}

export async function fetchCyberFeeds(): Promise<IntelEvent[]> {
  const { data } = await cachedFetch('cyber-feeds', 600_000, async () => {
    const started = Date.now();
    updateSourceHealth('cisa', { lastAttemptAt: nowIso() });
    const collectedAt = nowIso();
    const events: IntelEvent[] = [];
    const errors: string[] = [];

    const feeds = [
      { org: 'CISA (US Cybersecurity & Infrastructure Security Agency)', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', nature: 'official_statement' as const, lat: 38.90, lon: -77.04, country: 'United States', countryCode: 'USA', region: 'United States' },
      { org: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', nature: 'media_report' as const, lat: null, lon: null, country: undefined, countryCode: undefined, region: 'Global' },
    ];

    const settled = await Promise.allSettled(feeds.map((f) => rssParser.parseURL(f.url)));
    settled.forEach((res, idx) => {
      const f = feeds[idx];
      if (res.status === 'rejected') {
        const msg = `${f.org}: ${res.reason instanceof Error ? res.reason.message : 'failed'}`;
        errors.push(msg);
        recordSourceError('cisa', msg, null, f.url);
        return;
      }
      for (const item of (res.value.items ?? []).slice(0, 18)) {
        const title = (item.title ?? '').trim();
        const link = (item.link ?? '').trim();
        if (!title || !link) continue;
        const snippet = (item.contentSnippet ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 260);
        const pub = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : collectedAt);
        const safePub = Number.isNaN(Date.parse(pub)) ? collectedAt : new Date(pub).toISOString();
        const geo = extractGeoFromText(`${title} ${snippet}`);
        const isCritical = /(zero-day|0-day|kev|actively exploited|ransomware|critical|emergency|cvss 9|cvss 10)/i.test(`${title} ${snippet}`);
        const sources = [
          {
            id: hashId('cyb-src', link),
            organization: f.org,
            title,
            url: link,
            publishedAt: safePub,
            collectedAt,
            language: 'en' as const,
            nature: f.nature,
            snippet,
          },
        ];
        const lat = geo?.lat ?? f.lat;
        const lon = geo?.lon ?? f.lon;
        const geoPrecision = geo ? geo.precision : (f.lat ? 'country' : 'ungeolocated');
        const conf = evaluateConfidence(f.nature, sources, geoPrecision, false);
        events.push({
          id: hashId('cyb', link),
          title,
          summary: snippet || title,
          category: 'cyber_incident',
          severity: isCritical ? 'high' : 'medium',
          nature: f.nature,
          lat,
          lon,
          geoPrecision,
          country: geo?.country ?? f.country,
          countryCode: geo?.countryCode ?? f.countryCode,
          region: geo?.region ?? f.region,
          publishedAt: safePub,
          collectedAt,
          updatedAt: safePub,
          sources,
          ...conf,
          tags: ['cybersecurity', f.nature === 'official_statement' ? 'official-advisory' : 'threat-intel'],
        });
      }
    });

    updateSourceHealth('cisa', {
      status: events.length > 0 ? (errors.length > 0 ? 'degraded' : 'operational') : 'unavailable',
      lastSuccessAt: events.length > 0 ? collectedAt : null,
      lastStatusCode: events.length > 0 ? 200 : 502,
      itemCount: events.length,
      latencyMs: Date.now() - started,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    });
    return events;
  }, []);
  return data;
}

export async function fetchAviationTracks(bbox?: { lamin: number; lomin: number; lamax: number; lomax: number }): Promise<{
  tracks: AircraftTrack[];
  status: 'operational' | 'degraded' | 'unavailable';
  sourceNote: string;
}> {
  const b = bbox ?? { lamin: 22, lomin: -12, lamax: 56, lomax: 46 }; // Default Mediterranean/Europe/North Africa corridor
  const cacheKey = `aviation-${b.lamin}-${b.lomin}-${b.lamax}-${b.lomax}`;
  const { data } = await cachedFetch(cacheKey, 35_000, async () => {
    const started = Date.now();
    updateSourceHealth('aviation', { lastAttemptAt: nowIso() });

    const openSkyUrl = `https://opensky-network.org/api/states/all?lamin=${b.lamin}&lomin=${b.lomin}&lamax=${b.lamax}&lomax=${b.lomax}`;
    const openSkyAuth = keyManager.getOptionalOpenSkyAuthHeader();
    try {
      const res = await throttledFetch(
        'opensky',
        10_000,
        openSkyUrl,
        7500,
        openSkyAuth ? { Authorization: openSkyAuth } : undefined
      );
      if (res.ok) {
        const json = (await res.json()) as { time: number; states: Array<Array<string | number | boolean | null>> | null };
        const tracks: AircraftTrack[] = [];
        for (const s of (json.states ?? []).slice(0, 120)) {
          const coords = normalizeCoordinates(s[6], s[5]);
          if (!coords) continue;
          tracks.push({
            icao24: String(s[0] ?? ''),
            callsign: String(s[1] ?? '').trim() || 'N/A',
            originCountry: String(s[2] ?? 'Unknown'),
            lon: coords.lon,
            lat: coords.lat,
            altitudeM: typeof s[7] === 'number' ? Math.round(s[7]) : null,
            velocityMs: typeof s[9] === 'number' ? Math.round(s[9]) : null,
            headingDeg: typeof s[10] === 'number' ? Math.round(s[10]) : null,
            onGround: Boolean(s[8]),
            lastContact: new Date(((typeof s[4] === 'number' ? s[4] : json.time) || Date.now() / 1000) * 1000).toISOString(),
            source: 'OpenSky Network',
          });
        }
        keyManager.recordMirrorUpdate('aviation', openSkyAuth ? 'OpenSky Network (Free Account)' : 'OpenSky Network Public', false);
        updateSourceHealth('aviation', {
          status: 'operational',
          lastSuccessAt: nowIso(),
          lastStatusCode: res.status,
          itemCount: tracks.length,
          latencyMs: Date.now() - started,
          errorMessage: undefined,
        });
        return { tracks, status: 'operational' as const, sourceNote: 'Live OpenSky Network REST API (100% free public feed).' };
      }
      recordSourceError('aviation', `OpenSky HTTP ${res.status}`, res.status, openSkyUrl);
      throw new Error(`OpenSky HTTP ${res.status}`);
    } catch (openSkyErr) {
      const openSkyMsg = openSkyErr instanceof Error ? openSkyErr.message : 'timeout';
      recordSourceError('aviation', `OpenSky: ${openSkyMsg}`, null, openSkyUrl);
      const centerLat = Number(((b.lamin + b.lamax) / 2).toFixed(2));
      const centerLon = Number(((b.lomin + b.lomax) / 2).toFixed(2));
      const adsbMirrors = [
        {
          label: 'adsb.lol Community Regional ADS-B (Free Keyless)',
          url: `https://api.adsb.lol/v2/lat/${centerLat}/lon/${centerLon}/dist/250`,
        },
        {
          label: 'adsb.lol Community Global Feed (Free Keyless)',
          url: 'https://api.adsb.lol/v2/mil',
        },
      ];

      for (const mirror of adsbMirrors) {
        try {
          const res2 = await throttledFetch('adsblol', 4000, mirror.url, 7500);
          if (res2.ok) {
            const json2 = (await res2.json()) as {
              ac?: Array<{ hex: string; flight?: string; lat?: number; lon?: number; alt_baro?: number | string; gs?: number; track?: number; r?: string }>;
            };
            const tracks: AircraftTrack[] = [];
            for (const a of (json2.ac ?? []).slice(0, 120)) {
              const coords = normalizeCoordinates(a.lat, a.lon);
              if (!coords) continue;
              tracks.push({
                icao24: a.hex,
                callsign: (a.flight ?? a.r ?? a.hex).trim(),
                originCountry: 'ADS-B Community',
                lon: coords.lon,
                lat: coords.lat,
                altitudeM: typeof a.alt_baro === 'number' ? Math.round(a.alt_baro * 0.3048) : null,
                velocityMs: typeof a.gs === 'number' ? Math.round(a.gs * 0.514444) : null,
                headingDeg: typeof a.track === 'number' ? Math.round(a.track) : null,
                onGround: a.alt_baro === 'ground',
                lastContact: nowIso(),
                source: mirror.label,
              });
            }
            if (tracks.length === 0 && mirror !== adsbMirrors[adsbMirrors.length - 1]) {
              continue;
            }
            keyManager.recordMirrorUpdate('aviation', mirror.label, true);
            updateSourceHealth('aviation', {
              status: 'degraded',
              lastSuccessAt: nowIso(),
              lastStatusCode: res2.status,
              itemCount: tracks.length,
              latencyMs: Date.now() - started,
              errorMessage: `OpenSky unreachable (${openSkyMsg}); automatically switched to free keyless ${mirror.label}.`,
            });
            return {
              tracks,
              status: 'degraded' as const,
              sourceNote: `OpenSky rate-limited/unreachable (${openSkyMsg}); switched automatically to free keyless ${mirror.label}.`,
            };
          }
          recordSourceError('aviation', `${mirror.label} HTTP ${res2.status}`, res2.status, mirror.url);
        } catch (fbErr) {
          recordSourceError('aviation', `${mirror.label}: ${fbErr instanceof Error ? fbErr.message : 'error'}`, null, mirror.url);
        }
      }

      updateSourceHealth('aviation', {
        status: 'unavailable',
        latencyMs: Date.now() - started,
        errorMessage: `OpenSky & adsb.lol community feeds unreachable (${openSkyMsg}).`,
      });
      return {
        tracks: [],
        status: 'unavailable' as const,
        sourceNote: `Aviation tracking unavailable: ${openSkyMsg}. Platform does not fabricate aircraft positions.`,
      };
    }
  });
  return data;
}

export async function fetchMaritimeAisBaltic(): Promise<{
  vessels: VesselTrack[];
  status: 'operational' | 'unavailable';
  sourceNote: string;
}> {
  const { data } = await cachedFetch('maritime-digitraffic', 60_000, async () => {
    const started = Date.now();
    updateSourceHealth('maritime_ais', { lastAttemptAt: nowIso() });
    const fromTs = Date.now() - 30 * 60 * 1000;
    const url = `https://meri.digitraffic.fi/api/ais/v1/locations?from=${fromTs}`;
    try {
      const res = await throttledFetch('digitraffic', 5000, url, 9000);
      if (!res.ok) {
        recordSourceError('maritime_ais', `HTTP ${res.status}`, res.status, url);
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        features?: Array<{
          mmsi: number;
          geometry: { coordinates: [number, number] };
          properties: { sog: number; cog: number; heading: number; timestampExternal: number };
        }>;
      };
      const vessels: VesselTrack[] = [];
      for (const f of (json.features ?? []).slice(0, 90)) {
        const coords = normalizeCoordinates(f.geometry?.coordinates?.[1], f.geometry?.coordinates?.[0]);
        if (!coords) continue;
        vessels.push({
          mmsi: String(f.mmsi),
          name: `MMSI ${f.mmsi}`,
          lat: coords.lat,
          lon: coords.lon,
          sogKnots: typeof f.properties?.sog === 'number' ? Number(f.properties.sog.toFixed(1)) : null,
          cogDeg: typeof f.properties?.cog === 'number' ? Math.round(f.properties.cog) : null,
          headingDeg: typeof f.properties?.heading === 'number' && f.properties.heading <= 360 ? Math.round(f.properties.heading) : null,
          timestamp: f.properties?.timestampExternal ? new Date(f.properties.timestampExternal).toISOString() : nowIso(),
          region: 'Baltic Sea / Northern Europe',
          source: 'Digitraffic Finland (CC-BY-4.0)',
        });
      }
      updateSourceHealth('maritime_ais', {
        status: 'operational',
        lastSuccessAt: nowIso(),
        lastStatusCode: res.status,
        itemCount: vessels.length,
        latencyMs: Date.now() - started,
        errorMessage: undefined,
      });
      return {
        vessels,
        status: 'operational' as const,
        sourceNote: 'Live regional AIS telemetry from Digitraffic Finland (CC-BY-4.0). Coverage is strictly Baltic Sea / Northern Europe.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Digitraffic AIS error';
      recordSourceError('maritime_ais', msg, null, url);
      updateSourceHealth('maritime_ais', {
        status: 'unavailable',
        latencyMs: Date.now() - started,
        errorMessage: msg,
      });
      return {
        vessels: [],
        status: 'unavailable' as const,
        sourceNote: 'Baltic AIS feed temporarily unavailable.',
      };
    }
  });
  return data;
}

export async function fetchEconomicIndicators(): Promise<EconomicIndicator[]> {
  const { data } = await cachedFetch('economic-indicators', 300_000, async () => {
    const started = Date.now();
    updateSourceHealth('economy', { lastAttemptAt: nowIso() });
    const collectedAt = nowIso();
    const indicators: EconomicIndicator[] = [];

    const yahooSymbols: Array<{ id: string; symbol: string; name: string; category: EconomicIndicator['category']; unit: string }> = [
      { id: 'wti', symbol: 'CL=F', name: 'WTI Crude Oil (Futures)', category: 'energy', unit: 'USD/bbl' },
      { id: 'brent', symbol: 'BZ=F', name: 'Brent Crude Oil (Futures)', category: 'energy', unit: 'USD/bbl' },
      { id: 'natgas', symbol: 'NG=F', name: 'Henry Hub Natural Gas', category: 'energy', unit: 'USD/MMBtu' },
      { id: 'gold', symbol: 'GC=F', name: 'Gold (COMEX Futures)', category: 'metals', unit: 'USD/oz' },
      { id: 'sp500', symbol: '^GSPC', name: 'S&P 500 Index', category: 'index', unit: 'pts' },
      { id: 'nasdaq', symbol: '^IXIC', name: 'NASDAQ Composite', category: 'index', unit: 'pts' },
      { id: 'stoxx50', symbol: '^STOXX50E', name: 'EURO STOXX 50', category: 'index', unit: 'pts' },
      { id: 'nikkei', symbol: '^N225', name: 'Nikkei 225', category: 'index', unit: 'pts' },
    ];

    const quoteResults = await Promise.allSettled(
      yahooSymbols.map(async (q) => {
        const mirrors = [
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(q.symbol)}?interval=1d&range=5d`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(q.symbol)}?interval=1d&range=5d`,
        ];
        let lastErr: Error | null = null;
        for (let mIdx = 0; mIdx < mirrors.length; mIdx++) {
          try {
            const res = await throttledFetch('yahoo', 200, mirrors[mIdx], 7000);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as {
              chart?: {
                result?: Array<{
                  meta: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketTime?: number; currency?: string };
                }>;
              };
            };
            const meta = json.chart?.result?.[0]?.meta;
            if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('No market price');
            const prev = meta.chartPreviousClose ?? meta.regularMarketPrice;
            const changePct = prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
            if (mIdx > 0) {
              keyManager.recordMirrorUpdate('economy', 'Yahoo query2 + Open-ER-API/Frankfurter', true);
            }
            return {
              ...q,
              value: Number(meta.regularMarketPrice.toFixed(2)),
              previousValue: Number(prev.toFixed(2)),
              changePct: Number(changePct.toFixed(2)),
              currency: meta.currency || 'USD',
              source: 'Yahoo Finance Public Chart Feed',
              sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}`,
              observedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : collectedAt,
              collectedAt,
              updateFrequency: 'Delayed market quote (5m cache)',
              status: 'operational' as const,
            };
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error('Quote unavailable');
          }
        }
        throw lastErr ?? new Error('Quote unavailable');
      })
    );

    quoteResults.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        indicators.push(res.value);
      } else {
        const q = yahooSymbols[idx];
        const msg = res.reason instanceof Error ? res.reason.message : 'Quote unavailable';
        recordSourceError('economy', `Yahoo (${q.symbol}): ${msg}`, null, `https://query1.finance.yahoo.com/v8/finance/chart/${q.symbol}`);
        indicators.push({
          ...q,
          value: null,
          currency: 'USD',
          source: 'Yahoo Finance Public Chart Feed',
          sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}`,
          observedAt: collectedAt,
          collectedAt,
          updateFrequency: 'Unavailable',
          status: 'unavailable',
          note: msg,
        });
      }
    });

    // FX Rates from Open-ER-API with automatic free Frankfurter ECB mirror fallback
    const fxUrl = 'https://open.er-api.com/v6/latest/USD';
    const frankfurterUrl = 'https://api.frankfurter.dev/v1/latest?base=USD';
    const fxPairs = [
      { code: 'EUR', name: 'USD / EUR' },
      { code: 'GBP', name: 'USD / GBP' },
      { code: 'JPY', name: 'USD / JPY' },
      { code: 'CNY', name: 'USD / CNY' },
      { code: 'DZD', name: 'USD / DZD (Algerian Dinar)' },
      { code: 'MAD', name: 'USD / MAD (Moroccan Dirham)' },
      { code: 'EGP', name: 'USD / EGP (Egyptian Pound)' },
      { code: 'SAR', name: 'USD / SAR (Saudi Riyal)' },
    ];
    let fxLoaded = false;
    try {
      const fxRes = await throttledFetch('openerapi', 500, fxUrl, 7000);
      if (fxRes.ok) {
        const fx = (await fxRes.json()) as { time_last_update_unix?: number; rates?: Record<string, number> };
        const obs = fx.time_last_update_unix ? new Date(fx.time_last_update_unix * 1000).toISOString() : collectedAt;
        for (const p of fxPairs) {
          const rate = fx.rates?.[p.code];
          if (typeof rate === 'number') {
            indicators.push({
              id: `fx-${p.code.toLowerCase()}`,
              symbol: `USD/${p.code}`,
              name: p.name,
              category: 'currency',
              value: Number(rate.toFixed(4)),
              unit: p.code,
              currency: p.code,
              source: 'ExchangeRate-API Open Access',
              sourceUrl: 'https://www.exchangerate-api.com/',
              observedAt: obs,
              collectedAt,
              updateFrequency: 'Daily reference rate',
              status: 'operational',
            });
          }
        }
        fxLoaded = true;
        keyManager.recordMirrorUpdate('economy', 'Yahoo Finance + Open-ER-API', false);
      } else {
        recordSourceError('economy', `Open-ER-API HTTP ${fxRes.status}`, fxRes.status, fxUrl);
      }
    } catch (fxErr) {
      recordSourceError('economy', `Open-ER-API: ${fxErr instanceof Error ? fxErr.message : 'failed'}`, null, fxUrl);
    }

    if (!fxLoaded) {
      try {
        const ffRes = await throttledFetch('frankfurter', 500, frankfurterUrl, 7000);
        if (ffRes.ok) {
          const ff = (await ffRes.json()) as { date?: string; rates?: Record<string, number> };
          const obs = ff.date ? new Date(ff.date).toISOString() : collectedAt;
          for (const p of fxPairs) {
            const rate = ff.rates?.[p.code];
            if (typeof rate === 'number') {
              indicators.push({
                id: `fx-${p.code.toLowerCase()}`,
                symbol: `USD/${p.code}`,
                name: p.name,
                category: 'currency',
                value: Number(rate.toFixed(4)),
                unit: p.code,
                currency: p.code,
                source: 'Frankfurter ECB Open Feed (Failover)',
                sourceUrl: 'https://www.frankfurter.dev/',
                observedAt: obs,
                collectedAt,
                updateFrequency: 'ECB Daily Reference',
                status: 'operational',
              });
            }
          }
          keyManager.recordMirrorUpdate('economy', 'Yahoo Finance + Frankfurter ECB (Failover)', true);
        }
      } catch (ffErr) {
        recordSourceError('economy', `Frankfurter: ${ffErr instanceof Error ? ffErr.message : 'failed'}`, null, frankfurterUrl);
      }
    }

    const operationalCount = indicators.filter((i) => i.status === 'operational').length;
    const failedCount = indicators.filter((i) => i.status === 'unavailable').length;
    updateSourceHealth('economy', {
      status: operationalCount > 0 ? (failedCount > 0 ? 'degraded' : 'operational') : 'unavailable',
      lastSuccessAt: operationalCount > 0 ? collectedAt : null,
      lastStatusCode: operationalCount > 0 ? 200 : 502,
      itemCount: operationalCount,
      latencyMs: Date.now() - started,
      errorMessage: failedCount > 0 && operationalCount > 0 ? `${failedCount} quote(s) failed` : undefined,
    });
    return indicators;
  }, []);
  return data;
}

export async function fetchCountryMacro(cca3: string): Promise<{
  gdpUsd?: { value: number; year: string };
  inflationPct?: { value: number; year: string };
  source: string;
}> {
  const { data } = await cachedFetch(`wb-${cca3}`, 3600_000, async () => {
    const gdpUrl = `https://api.worldbank.org/v2/country/${cca3}/indicator/NY.GDP.MKTP.CD?format=json&per_page=10`;
    const infUrl = `https://api.worldbank.org/v2/country/${cca3}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=10`;
    try {
      const [gdpRes, infRes] = await Promise.all([
        throttledFetch('worldbank', 200, gdpUrl, 8000),
        throttledFetch('worldbank', 200, infUrl, 8000),
      ]);
      if (!gdpRes.ok) recordSourceError('economy', `WorldBank GDP HTTP ${gdpRes.status}`, gdpRes.status, gdpUrl);
      if (!infRes.ok) recordSourceError('economy', `WorldBank CPI HTTP ${infRes.status}`, infRes.status, infUrl);
      const gdpJson = gdpRes.ok ? ((await gdpRes.json()) as [unknown, Array<{ value: number | null; date: string }>]) : null;
      const infJson = infRes.ok ? ((await infRes.json()) as [unknown, Array<{ value: number | null; date: string }>]) : null;
      const latestGdp = gdpJson?.[1]?.find((x) => typeof x.value === 'number');
      const latestInf = infJson?.[1]?.find((x) => typeof x.value === 'number');
      return {
        gdpUsd: latestGdp && typeof latestGdp.value === 'number' ? { value: latestGdp.value, year: latestGdp.date } : undefined,
        inflationPct: latestInf && typeof latestInf.value === 'number' ? { value: Number(latestInf.value.toFixed(2)), year: latestInf.date } : undefined,
        source: 'World Bank Open Data API',
      };
    } catch (err) {
      recordSourceError('economy', `WorldBank: ${err instanceof Error ? err.message : 'unavailable'}`, null, gdpUrl);
      return { source: 'World Bank Open Data API (Unavailable)' };
    }
  });
  return data;
}

export async function getAggregatedEvents(range: '24h' | '7d' | '30d' = '24h', includeReference = true): Promise<IntelEvent[]> {
  const results = await Promise.allSettled([
    fetchUsgsEarthquakes(range),
    fetchNasaEonet(),
    fetchGdacsAlerts(),
    fetchMultilingualRssNews(),
    fetchCyberFeeds(),
    fetchGdeltEvents(),
    range === '24h' ? fetchNasaFirmsWildfires() : Promise.resolve([] as IntelEvent[]),
  ]);

  const combined: IntelEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      combined.push(...r.value);
    }
  }

  // Keep rolling 24h satellite/open hazards (NASA EONET open, FIRMS 24h, GDACS active) plus window-filtered news/seismic
  const windowHours = range === '30d' ? 720 : range === '7d' ? 168 : 36;
  const cutoffMs = Date.now() - windowHours * 3600 * 1000;
  const inWindow = combined.filter((ev) => {
    if (ev.id.startsWith('eonet-') || ev.id.startsWith('firms-') || ev.id.startsWith('gdacs-')) {
      return true;
    }
    const t = new Date(ev.publishedAt).getTime();
    return Number.isNaN(t) ? true : t >= cutoffMs;
  });

  if (includeReference) {
    return correlateAndDeduplicateEvents([...inWindow, ...STATIC_INFRASTRUCTURE_EVENTS]);
  }
  return correlateAndDeduplicateEvents(inWindow);
}

export async function runFullDiagnosticProbe() {
  const startedAt = Date.now();
  clearServerCache();
  await Promise.allSettled([
    fetchUsgsEarthquakes('24h'),
    fetchNasaEonet(),
    fetchGdacsAlerts(),
    fetchMultilingualRssNews(),
    fetchCyberFeeds(),
    fetchGdeltEvents(),
    fetchNasaFirmsWildfires(),
    fetchAviationTracks(),
    fetchMaritimeAisBaltic(),
    fetchEconomicIndicators(),
    fetchCountryMacro('DZA'),
  ]);
  updateSourceHealth('ref_infra', {
    lastAttemptAt: nowIso(),
    lastSuccessAt: nowIso(),
    lastStatusCode: 200,
    itemCount: STATIC_INFRASTRUCTURE_EVENTS.length,
    latencyMs: 0,
  });
  return {
    probedAt: nowIso(),
    durationMs: Date.now() - startedAt,
    sources: getAllSourceHealth(),
    endpoints: getAllEndpointDiagnostics(),
  };
}
