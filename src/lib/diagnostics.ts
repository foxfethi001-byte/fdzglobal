import type {
  ApiEndpointDiagnostic,
  IntelCategory,
  NavSection,
  SourceHealthItem,
} from '../types/intelligence';

export const ALL_INTEL_CATEGORIES: IntelCategory[] = [
  'armed_conflict',
  'military_incident',
  'airstrike_explosion',
  'political_unrest',
  'protest',
  'terrorism',
  'earthquake',
  'wildfire',
  'flood',
  'severe_weather',
  'volcano',
  'cyber_incident',
  'aviation',
  'maritime',
  'strategic_infra',
  'energy_infra',
  'nuclear_facility',
  'military_base',
  'undersea_cable',
  'port_chokepoint',
];

export interface RegisteredEndpointSpec {
  id: string;
  path: string;
  pingPath: string;
  module: NavSection;
  sourceIds: string[];
}

export const REGISTERED_DATA_ENDPOINTS: RegisteredEndpointSpec[] = [
  { id: 'health', path: '/api/health', pingPath: '/api/health', module: 'diagnostics', sourceIds: [] },
  { id: 'layers', path: '/api/layers', pingPath: '/api/layers', module: 'map', sourceIds: [] },
  { id: 'sources', path: '/api/sources', pingPath: '/api/sources', module: 'diagnostics', sourceIds: [] },
  {
    id: 'events',
    path: '/api/events',
    pingPath: '/api/events?range=24h',
    module: 'overview',
    sourceIds: ['usgs', 'eonet', 'firms', 'gdacs', 'news_rss', 'gdelt', 'cisa'],
  },
  { id: 'aviation', path: '/api/aviation', pingPath: '/api/aviation', module: 'aviation', sourceIds: ['aviation'] },
  { id: 'maritime', path: '/api/maritime', pingPath: '/api/maritime', module: 'maritime', sourceIds: ['maritime_ais'] },
  { id: 'economy', path: '/api/economy', pingPath: '/api/economy', module: 'economy', sourceIds: ['economy'] },
  { id: 'countries', path: '/api/countries', pingPath: '/api/countries', module: 'country', sourceIds: [] },
  { id: 'diagnostics', path: '/api/diagnostics', pingPath: '/api/diagnostics', module: 'diagnostics', sourceIds: [] },
];

export interface EndpointPingResult {
  id: string;
  path: string;
  module: NavSection;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error?: string;
}

export interface DegradedModuleNotice {
  module: NavSection;
  status: 'degraded' | 'unavailable';
  reason: string;
  affectedSources: string[];
  failedEndpoints: string[];
}

export interface PingDiagnosticsReport {
  checkedAt: string;
  pings: EndpointPingResult[];
  sources: SourceHealthItem[];
  endpoints: ApiEndpointDiagnostic[];
  degradedModules: DegradedModuleNotice[];
}

const SOURCE_TO_MODULES: Record<string, NavSection[]> = {
  usgs: ['disasters', 'map', 'overview'],
  eonet: ['disasters', 'map', 'overview'],
  firms: ['disasters', 'map', 'overview'],
  gdacs: ['disasters', 'map', 'overview'],
  news_rss: ['conflicts', 'geopolitics', 'overview'],
  gdelt: ['conflicts', 'geopolitics'],
  cisa: ['cyber', 'overview'],
  aviation: ['aviation', 'map'],
  maritime_ais: ['maritime', 'map'],
  economy: ['economy', 'country'],
};

export function computeDegradedModules(
  sources: SourceHealthItem[],
  endpointPings: EndpointPingResult[] = []
): DegradedModuleNotice[] {
  const byModule = new Map<
    NavSection,
    { status: 'degraded' | 'unavailable'; reasons: string[]; affectedSources: Set<string>; failedEndpoints: Set<string> }
  >();

  const upsert = (
    mod: NavSection,
    status: 'degraded' | 'unavailable',
    reason: string,
    srcId?: string,
    epPath?: string
  ) => {
    const existing = byModule.get(mod) ?? {
      status,
      reasons: [],
      affectedSources: new Set<string>(),
      failedEndpoints: new Set<string>(),
    };
    if (status === 'unavailable' && existing.status === 'degraded') {
      existing.status = 'unavailable';
    }
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    if (srcId) existing.affectedSources.add(srcId);
    if (epPath) existing.failedEndpoints.add(epPath);
    byModule.set(mod, existing);
  };

  for (const ping of endpointPings) {
    if (!ping.ok) {
      upsert(
        ping.module,
        'unavailable',
        `${ping.path}: ${ping.error || `HTTP ${ping.statusCode ?? 'ERR'}`}`,
        undefined,
        ping.path
      );
    }
  }

  for (const src of sources) {
    if (src.id === 'maritime_global') continue; // Expected non-free restriction, disclosed in Maritime view
    if (src.status === 'degraded' || src.status === 'unavailable') {
      const mods = SOURCE_TO_MODULES[src.id] ?? ['diagnostics'];
      for (const m of mods) {
        upsert(
          m,
          src.status,
          `${src.name}: ${src.errorMessage || src.status}`,
          src.id
        );
      }
    }
  }

  return Array.from(byModule.entries()).map(([module, data]) => ({
    module,
    status: data.status,
    reason: data.reasons.join(' | '),
    affectedSources: Array.from(data.affectedSources),
    failedEndpoints: Array.from(data.failedEndpoints),
  }));
}

async function pingSingleEndpoint(spec: RegisteredEndpointSpec, timeoutMs: number): Promise<{
  ping: EndpointPingResult;
  payload?: unknown;
}> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(spec.pingPath, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    let payload: unknown;
    if (res.ok && (spec.id === 'diagnostics' || spec.id === 'sources' || spec.id === 'health')) {
      try {
        payload = await res.json();
      } catch {
        // ignore JSON parse issues on auxiliary check
      }
    }
    if (!res.ok) {
      console.warn(`[WIH ping] ${spec.path} degraded/failed with HTTP ${res.status} (${latencyMs} ms)`);
    }
    return {
      ping: {
        id: spec.id,
        path: spec.path,
        module: spec.module,
        ok: res.ok,
        statusCode: res.status,
        latencyMs,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      },
      payload,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const msg = err instanceof Error ? err.message : 'Network error';
    console.error(`[WIH ping] ${spec.path} failed after ${latencyMs} ms:`, msg);
    return {
      ping: {
        id: spec.id,
        path: spec.path,
        module: spec.module,
        ok: false,
        statusCode: null,
        latencyMs,
        error: msg,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingRegisteredEndpoints(timeoutMs = 8000): Promise<PingDiagnosticsReport> {
  console.info(`[WIH ping] Pinging ${REGISTERED_DATA_ENDPOINTS.length} registered data endpoints...`);
  const results = await Promise.all(
    REGISTERED_DATA_ENDPOINTS.map((spec) => pingSingleEndpoint(spec, timeoutMs))
  );

  const pings = results.map((r) => r.ping);
  let sources: SourceHealthItem[] = [];
  let endpoints: ApiEndpointDiagnostic[] = [];

  const diagPayload = results.find((r) => r.ping.id === 'diagnostics')?.payload as
    | { sources?: SourceHealthItem[]; endpoints?: ApiEndpointDiagnostic[] }
    | undefined;
  const sourcesPayload = results.find((r) => r.ping.id === 'sources')?.payload as
    | { sources?: SourceHealthItem[] }
    | undefined;
  const healthPayload = results.find((r) => r.ping.id === 'health')?.payload as
    | { sources?: SourceHealthItem[]; endpoints?: ApiEndpointDiagnostic[] }
    | undefined;

  sources = diagPayload?.sources ?? sourcesPayload?.sources ?? healthPayload?.sources ?? [];
  endpoints = diagPayload?.endpoints ?? healthPayload?.endpoints ?? [];

  // Reflect failed endpoint pings back onto linked sources if not already marked degraded/unavailable
  const failedEndpointSources = new Set<string>();
  for (const ping of pings) {
    if (!ping.ok) {
      const spec = REGISTERED_DATA_ENDPOINTS.find((s) => s.id === ping.id);
      spec?.sourceIds.forEach((id) => failedEndpointSources.add(id));
    }
  }

  if (failedEndpointSources.size > 0) {
    sources = sources.map((s) =>
      failedEndpointSources.has(s.id) && s.status === 'operational'
        ? {
            ...s,
            status: 'degraded',
            errorMessage: s.errorMessage || 'Endpoint ping failed or timed out',
          }
        : s
    );
  }

  const degradedModules = computeDegradedModules(sources, pings);
  if (degradedModules.length > 0) {
    console.warn('[WIH ping] Degraded modules detected:', degradedModules);
  } else {
    console.info('[WIH ping] All registered endpoints and modules operational.');
  }

  return {
    checkedAt: new Date().toISOString(),
    pings,
    sources,
    endpoints,
    degradedModules,
  };
}
