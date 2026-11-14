import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  clearServerCache,
  getAllEndpointDiagnostics,
  getAllSourceHealth,
  recordEndpointMetric,
} from './server/cache.ts';
import { keyManager } from './server/keyManager.ts';
import {
  GAZETTEER_COUNTRIES,
  LAYER_DEFINITIONS,
  REGIONAL_DASHBOARDS,
} from './server/catalog.ts';
import {
  fetchAviationTracks,
  fetchCountryMacro,
  fetchEconomicIndicators,
  fetchMaritimeAisBaltic,
  getAggregatedEvents,
  initSourceRegistry,
  runFullDiagnosticProbe,
} from './server/providers.ts';
import { generateIntelligenceBriefing, isGeminiConfigured } from './server/ai.ts';
import type { IntelEvent, SupportedLang } from './src/types/intelligence.ts';

initSourceRegistry();

const app = express();
app.use(express.json({ limit: '1mb' }));

// Track API endpoint latency & status codes for diagnostics
app.use('/api', (req, res, next) => {
  const started = Date.now();
  const rawPath = req.originalUrl.split('?')[0];
  const normalizedPath = rawPath.startsWith('/api/countries/') && rawPath !== '/api/countries/'
    ? '/api/countries/:code'
    : rawPath;
  res.on('finish', () => {
    recordEndpointMetric(normalizedPath, res.statusCode, Date.now() - started);
  });
  next();
});

// Basic input helpers
function parseRange(val: unknown): '24h' | '7d' | '30d' {
  if (val === '7d' || val === '30d') return val;
  return '24h';
}

function parseLang(val: unknown): SupportedLang {
  if (val === 'ar' || val === 'fr') return val;
  return 'en';
}

// Health & Diagnostics
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    aiConfigured: isGeminiConfigured(),
    keyRotation: keyManager.getSummary(),
    sources: getAllSourceHealth(),
    endpoints: getAllEndpointDiagnostics(),
  });
});

app.get('/api/diagnostics', (_req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    aiConfigured: isGeminiConfigured(),
    keyRotation: keyManager.getSummary(),
    sources: getAllSourceHealth(),
    endpoints: getAllEndpointDiagnostics(),
  });
});

app.post('/api/diagnostics/refresh-keys', async (_req, res) => {
  try {
    const keyRotation = await keyManager.forceRefreshAndRotate();
    clearServerCache();
    res.json({
      ok: true,
      refreshedAt: new Date().toISOString(),
      aiConfigured: isGeminiConfigured(),
      keyRotation,
      sources: getAllSourceHealth(),
      endpoints: getAllEndpointDiagnostics(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Key & mirror benchmark failed',
    });
  }
});

app.post('/api/diagnostics/probe', async (_req, res) => {
  try {
    const result = await runFullDiagnosticProbe();
    res.json({
      ...result,
      aiConfigured: isGeminiConfigured(),
      keyRotation: keyManager.getSummary(),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Diagnostic probe failed',
    });
  }
});

// Layers metadata + live status derived from source health
app.get('/api/layers', (_req, res) => {
  const healthMap = new Map(getAllSourceHealth().map((s) => [s.id, s]));
  const layers = LAYER_DEFINITIONS.map((layer) => {
    const src = healthMap.get(layer.sourceId);
    return {
      ...layer,
      status: src?.status ?? 'operational',
      statusNote: src?.errorMessage ?? src?.limitations ?? layer.limitations,
      itemCount: src?.itemCount ?? 0,
    };
  });
  res.json({ layers });
});

// Source health panel
app.get('/api/sources', (_req, res) => {
  res.json({ sources: getAllSourceHealth() });
});

// Aggregated & correlated events endpoint
app.get('/api/events', async (req, res) => {
  try {
    const range = parseRange(req.query.range);
    const includeRef = req.query.includeReference !== 'false';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const region = typeof req.query.region === 'string' ? req.query.region : undefined;
    const country = typeof req.query.country === 'string' ? req.query.country : undefined;
    const severity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
    const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : undefined;

    let events = await getAggregatedEvents(range, includeRef);

    if (category && category !== 'all') {
      const cats = new Set(category.split(','));
      events = events.filter((e) => cats.has(e.category));
    }
    if (region && region !== 'all') {
      events = events.filter((e) => (e.region ?? '').toLowerCase() === region.toLowerCase());
    }
    if (country && country !== 'all') {
      const cLow = country.toLowerCase();
      events = events.filter(
        (e) =>
          (e.country ?? '').toLowerCase() === cLow ||
          (e.countryCode ?? '').toLowerCase() === cLow ||
          e.title.toLowerCase().includes(cLow)
      );
    }
    if (severity && severity !== 'all') {
      events = events.filter((e) => e.severity === severity);
    }
    if (search) {
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(search) ||
          e.summary.toLowerCase().includes(search) ||
          (e.country ?? '').toLowerCase().includes(search) ||
          e.sources.some((s) => s.organization.toLowerCase().includes(search))
      );
    }

    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.setHeader('Expires', new Date(Date.now() + 120_000).toUTCString());

    res.json({
      count: events.length,
      range,
      generatedAt: new Date().toISOString(),
      events,
      sources: getAllSourceHealth(),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to aggregate intelligence events',
    });
  }
});

// Aviation tracking (OpenSky + community fallback)
app.get('/api/aviation', async (req, res) => {
  try {
    const lamin = Number(req.query.lamin);
    const lomin = Number(req.query.lomin);
    const lamax = Number(req.query.lamax);
    const lomax = Number(req.query.lomax);
    const hasBbox =
      Number.isFinite(lamin) &&
      Number.isFinite(lomin) &&
      Number.isFinite(lamax) &&
      Number.isFinite(lomax);
    const result = await fetchAviationTracks(
      hasBbox ? { lamin, lomin, lamax, lomax } : undefined
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({
      tracks: [],
      status: 'unavailable',
      sourceNote: err instanceof Error ? err.message : 'Aviation service error',
    });
  }
});

// Maritime AIS (Baltic regional live + honest global status)
app.get('/api/maritime', async (_req, res) => {
  try {
    const ais = await fetchMaritimeAisBaltic();
    const allEvents = await getAggregatedEvents('7d', true);
    const maritimeEvents = allEvents.filter((e) => e.category === 'maritime' || e.category === 'port_chokepoint');
    res.json({
      ...ais,
      globalAisStatus: 'unavailable',
      globalAisNote: '100% Free-Tier Policy: Commercial paid AIS feeds are excluded. Showing free CC-BY-4.0 Digitraffic Baltic AIS + verified chokepoints + maritime incident reports.',
      maritimeEvents,
    });
  } catch (err) {
    res.status(500).json({
      vessels: [],
      status: 'unavailable',
      sourceNote: err instanceof Error ? err.message : 'Maritime error',
    });
  }
});

// Economic & market indicators
app.get('/api/economy', async (_req, res) => {
  try {
    const indicators = await fetchEconomicIndicators();
    res.json({
      indicators,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      indicators: [],
      error: err instanceof Error ? err.message : 'Economy fetch error',
    });
  }
});

// Countries & regional dashboards
app.get('/api/countries', (_req, res) => {
  res.json({
    countries: GAZETTEER_COUNTRIES,
    regions: REGIONAL_DASHBOARDS,
  });
});

app.get('/api/countries/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const profile = GAZETTEER_COUNTRIES.find(
    (c) => c.cca3 === code || c.cca2 === code || c.name.toUpperCase() === code
  );
  if (!profile) {
    res.status(404).json({ error: `Country profile not found for code "${code}".` });
    return;
  }

  const [events, macro] = await Promise.all([
    getAggregatedEvents('7d', true),
    fetchCountryMacro(profile.cca3),
  ]);

  const related = events.filter(
    (e) =>
      e.countryCode === profile.cca3 ||
      (e.country ?? '').toLowerCase() === profile.name.toLowerCase() ||
      e.title.toLowerCase().includes(profile.name.toLowerCase()) ||
      e.summary.toLowerCase().includes(profile.name.toLowerCase())
  );

  res.json({
    profile,
    macro,
    events: related,
  });
});

// AI Intelligence Analyst & Q&A
app.post('/api/ai/briefing', async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      scope?: string;
      region?: string;
      countryCode?: string;
      range?: string;
      language?: string;
      aiEnabled?: boolean;
      question?: string;
    };

    const range = parseRange(body.range);
    const language = parseLang(body.language);
    const aiEnabled = body.aiEnabled !== false;
    const scope = (body.scope || body.countryCode || body.region || 'Global Overview').slice(0, 120);

    let events: IntelEvent[] = await getAggregatedEvents(range, false);
    if (body.countryCode) {
      const cc = body.countryCode.toUpperCase();
      const country = GAZETTEER_COUNTRIES.find((c) => c.cca3 === cc || c.cca2 === cc);
      events = events.filter(
        (e) =>
          e.countryCode === cc ||
          (country && (e.country === country.name || e.title.toLowerCase().includes(country.name.toLowerCase())))
      );
    } else if (body.region && body.region !== 'Global') {
      const regDef = REGIONAL_DASHBOARDS.find((r) => r.id === body.region || r.name === body.region);
      if (regDef) {
        const codes = new Set(regDef.countryCodes);
        events = events.filter(
          (e) =>
            (e.countryCode && codes.has(e.countryCode)) ||
            e.region === regDef.name ||
            regDef.keywords.some((kw) => e.title.toLowerCase().includes(kw))
        );
      }
    }

    const report = await generateIntelligenceBriefing({
      scope,
      events,
      language,
      aiEnabled,
      question: typeof body.question === 'string' ? body.question.slice(0, 400) : undefined,
    });

    res.json({ report, aiConfigured: isGeminiConfigured() });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate briefing',
    });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // HMR is disabled in AI Studio; serve a clean zero-WebSocket @vite/client module
    // so CSS injection (updateStyle/removeStyle) and import.meta.hot stubs work without WS failures.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
let lastInsertedStyle;
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {
  constructor(err) {
    super();
    this.err = err;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('vite-error-overlay')) {
  customElements.define('vite-error-overlay', ErrorOverlay);
}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`World Intelligence Hub listening on http://0.0.0.0:${PORT}`);

    // Continuous API key / .env hot-reload & cooldown recovery scheduler
    const summaryInit = keyManager.getSummary();
    const keySyncMs = summaryInit.autoSyncIntervalSec * 1000;
    const keyTimer = setInterval(() => {
      const changed = keyManager.syncFromEnvironment(false);
      if (changed) {
        console.info('[WIH keyManager] Hot-reloaded server API keys / environment pool.');
      }
    }, keySyncMs);
    keyTimer.unref?.();

    // Automatic non-blocking server mirror & key benchmark (boot check + periodic best-first auto-switch)
    const bootBenchmarkTimer = setTimeout(() => {
      keyManager.runAutomaticServerAndKeyCheck().catch(() => {});
    }, 1500);
    bootBenchmarkTimer.unref?.();

    const benchmarkMs = summaryInit.autoBenchmarkIntervalSec * 1000;
    const benchmarkTimer = setInterval(() => {
      keyManager.runAutomaticServerAndKeyCheck().catch(() => {});
    }, benchmarkMs);
    benchmarkTimer.unref?.();

    // Background free-tier feed warm-up & continuous cache refresh every 5 minutes
    const bgFeedTimer = setInterval(() => {
      getAggregatedEvents('24h', true).catch(() => {});
    }, 300_000);
    bgFeedTimer.unref?.();
  });
}

startServer();
