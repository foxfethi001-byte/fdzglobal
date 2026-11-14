import type {
  ApiEndpointDiagnostic,
  SourceErrorLog,
  SourceHealthItem,
} from '../src/types/intelligence.ts';

interface CacheEntry<T> {
  data: T;
  storedAt: number;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const lastCallPerDomain = new Map<string, number>();

export const sourceHealthRegistry = new Map<string, SourceHealthItem>();
const endpointMetrics = new Map<string, {
  path: string;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  totalLatencyMs: number;
  requestCount: number;
  errorCount: number;
  lastCalledAt: string | null;
  lastError?: string;
}>();

export function registerSourceMetadata(
  item: Omit<SourceHealthItem, 'lastAttemptAt' | 'lastSuccessAt' | 'itemCount' | 'latencyMs'>
) {
  if (!sourceHealthRegistry.has(item.id)) {
    sourceHealthRegistry.set(item.id, {
      ...item,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastStatusCode: null,
      itemCount: 0,
      latencyMs: null,
      recentErrors: [],
    });
  }
}

export function updateSourceHealth(
  id: string,
  patch: Partial<SourceHealthItem>
) {
  const existing = sourceHealthRegistry.get(id);
  if (!existing) return;
  sourceHealthRegistry.set(id, { ...existing, ...patch });
}

export function recordSourceError(
  id: string,
  message: string,
  statusCode?: number | null,
  endpoint?: string
) {
  const existing = sourceHealthRegistry.get(id);
  if (!existing) return;
  const entry: SourceErrorLog = {
    timestamp: new Date().toISOString(),
    statusCode: statusCode ?? null,
    message: message.slice(0, 300),
    endpoint,
  };
  const nextErrors = [entry, ...(existing.recentErrors ?? [])].slice(0, 10);
  sourceHealthRegistry.set(id, {
    ...existing,
    lastStatusCode: statusCode ?? existing.lastStatusCode ?? null,
    errorMessage: message,
    recentErrors: nextErrors,
  });
}

export function recordEndpointMetric(
  path: string,
  statusCode: number,
  latencyMs: number,
  errorMsg?: string
) {
  const prev = endpointMetrics.get(path) ?? {
    path,
    lastStatusCode: null,
    lastLatencyMs: null,
    totalLatencyMs: 0,
    requestCount: 0,
    errorCount: 0,
    lastCalledAt: null,
  };
  endpointMetrics.set(path, {
    path,
    lastStatusCode: statusCode,
    lastLatencyMs: latencyMs,
    totalLatencyMs: prev.totalLatencyMs + latencyMs,
    requestCount: prev.requestCount + 1,
    errorCount: prev.errorCount + (statusCode >= 400 ? 1 : 0),
    lastCalledAt: new Date().toISOString(),
    lastError: statusCode >= 400 ? (errorMsg || `HTTP ${statusCode}`) : prev.lastError,
  });
}

export function getAllEndpointDiagnostics(): ApiEndpointDiagnostic[] {
  return Array.from(endpointMetrics.values()).map((m) => ({
    path: m.path,
    lastStatusCode: m.lastStatusCode,
    lastLatencyMs: m.lastLatencyMs,
    avgLatencyMs: m.requestCount > 0 ? Math.round(m.totalLatencyMs / m.requestCount) : null,
    requestCount: m.requestCount,
    errorCount: m.errorCount,
    lastCalledAt: m.lastCalledAt,
    lastError: m.lastError,
  }));
}

export function getAllSourceHealth(): SourceHealthItem[] {
  const now = Date.now();
  return Array.from(sourceHealthRegistry.values()).map((s) => ({
    ...s,
    cachedAgeSec: s.lastSuccessAt ? Math.round((now - new Date(s.lastSuccessAt).getTime()) / 1000) : undefined,
  }));
}

export function clearServerCache() {
  store.clear();
}

export async function throttledFetch(
  domainKey: string,
  minIntervalMs: number,
  url: string,
  timeoutMs = 9000,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const last = lastCallPerDomain.get(domainKey) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < minIntervalMs) {
    await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
  }
  lastCallPerDomain.set(domainKey, Date.now());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WorldIntelligenceHub/1.0 (+https://github.com/wih-osint; contact@wih.local)',
        Accept: 'application/json, application/xml, text/xml, text/csv, */*',
        ...(extraHeaders ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function cachedFetch<T>(
  cacheKey: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  staleFallback?: T
): Promise<{ data: T; fromCache: boolean }> {
  const now = Date.now();
  const hit = store.get(cacheKey) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return { data: hit.data, fromCache: true };
  }

  const existingFlight = inFlight.get(cacheKey) as Promise<T> | undefined;
  if (existingFlight) {
    const data = await existingFlight;
    return { data, fromCache: true };
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      store.set(cacheKey, {
        data,
        storedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      });
      return data;
    } catch (err) {
      if (hit) {
        return hit.data;
      }
      if (staleFallback !== undefined) {
        return staleFallback;
      }
      throw err;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  const result = await promise;
  return { data: result, fromCache: false };
}
