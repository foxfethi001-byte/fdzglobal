import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Clock,
  Crosshair,
  Flame,
  Globe,
  History,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Newspaper,
  Plane,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Ship,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AircraftTrack,
  AlertRule,
  ApiEndpointDiagnostic,
  IntelCategory,
  IntelEvent,
  KeyRotationSummary,
  NavSection,
  SourceHealthItem,
  TriggeredAlert,
  UserPreferences,
  VesselTrack,
} from './types/intelligence';
import {
  acknowledgeAllAlerts,
  cacheEventsOffline,
  clearAllLocalCache,
  DEFAULT_PREFERENCES,
  deleteAlertRule,
  getAlertRules,
  getSavedEvents,
  getTriggeredAlerts,
  loadCachedEventsOffline,
  loadPreferences,
  saveAlertRule,
  savePreferences,
  saveTriggeredAlert,
  toggleSavedEvent,
} from './lib/storage';
import {
  formatUtcAndLocal,
  FULL_UI_COPY,
  I18nProvider,
  UI_STRINGS,
} from './lib/i18n';
import {
  ALL_INTEL_CATEGORIES,
  computeDegradedModules,
  pingRegisteredEndpoints,
  type DegradedModuleNotice,
  type EndpointPingResult,
} from './lib/diagnostics';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { PWAInstallButton } from './components/PWAInstallButton';
import { GlobalIntelMap, type MapLayerStatus } from './components/GlobalIntelMap';
import { EventDetailPanel } from './components/EventDetailPanel';
import { DomainFeedView, GlobalOverviewView } from './components/OverviewAndFeeds';
import { AviationView, MaritimeView } from './components/AviationMaritimeViews';
import { EconomyView } from './components/EconomyView';
import { CountryRegionView } from './components/CountryRegionView';
import { AIAnalystView } from './components/AIAnalystView';
import {
  AlertsWatchlistsView,
  DiagnosticsView,
  HistoricalTimelineView,
  SettingsView,
} from './components/AlertsTimelineDiagnosticsSettings';

interface CategoryTraceStat {
  category: IntelCategory;
  total: number;
  geolocated: number;
  ungeolocated: number;
  invalidCoordsFixed: number;
  duplicatesSkipped: number;
}

function normalizeAndTraceEvents(rawEvents: IntelEvent[]): IntelEvent[] {
  const seenIds = new Set<string>();
  const normalized: IntelEvent[] = [];
  const statsMap = new Map<IntelCategory, CategoryTraceStat>();
  for (const cat of ALL_INTEL_CATEGORIES) {
    statsMap.set(cat, {
      category: cat,
      total: 0,
      geolocated: 0,
      ungeolocated: 0,
      invalidCoordsFixed: 0,
      duplicatesSkipped: 0,
    });
  }

  for (const ev of rawEvents) {
    const stat = statsMap.get(ev.category) ?? {
      category: ev.category,
      total: 0,
      geolocated: 0,
      ungeolocated: 0,
      invalidCoordsFixed: 0,
      duplicatesSkipped: 0,
    };
    statsMap.set(ev.category, stat);

    if (seenIds.has(ev.id)) {
      stat.duplicatesSkipped++;
      continue;
    }
    seenIds.add(ev.id);

    let nextEv = ev;
    if (ev.lat !== null || ev.lon !== null) {
      const latNum = typeof ev.lat === 'number' ? ev.lat : Number(ev.lat);
      const lonNum = typeof ev.lon === 'number' ? ev.lon : Number(ev.lon);
      const valid =
        Number.isFinite(latNum) &&
        Number.isFinite(lonNum) &&
        latNum >= -90 &&
        latNum <= 90 &&
        lonNum >= -180 &&
        lonNum <= 180 &&
        !(latNum === 0 && lonNum === 0);

      if (!valid) {
        stat.invalidCoordsFixed++;
        console.warn('[WIH coord-normalize] Invalid coordinates nulled:', { id: ev.id, category: ev.category, lat: ev.lat, lon: ev.lon });
        nextEv = { ...ev, lat: null, lon: null, geoPrecision: 'ungeolocated' };
      } else {
        const roundedLat = Number(latNum.toFixed(4));
        const roundedLon = Number(lonNum.toFixed(4));
        if (roundedLat !== ev.lat || roundedLon !== ev.lon) {
          nextEv = { ...ev, lat: roundedLat, lon: roundedLon };
        }
      }
    }

    stat.total++;
    if (nextEv.lat !== null && nextEv.lon !== null) stat.geolocated++;
    else stat.ungeolocated++;

    normalized.push(nextEv);
  }

  console.groupCollapsed(`[WIH syncFeeds] Normalized & deduplicated ${normalized.length} events across 20 categories`);
  console.table(Array.from(statsMap.values()));
  console.groupEnd();

  return normalized;
}

const NAV_ITEMS: Array<{ id: NavSection; icon: React.FC<{ className?: string }> }> = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'map', icon: MapIcon },
  { id: 'conflicts', icon: Crosshair },
  { id: 'aviation', icon: Plane },
  { id: 'maritime', icon: Ship },
  { id: 'disasters', icon: Flame },
  { id: 'cyber', icon: Shield },
  { id: 'geopolitics', icon: Newspaper },
  { id: 'economy', icon: TrendingUp },
  { id: 'country', icon: Globe },
  { id: 'ai_reports', icon: Bot },
  { id: 'alerts', icon: Bell },
  { id: 'timeline', icon: History },
  { id: 'diagnostics', icon: Activity },
  { id: 'settings', icon: Settings },
];

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [searchQuery, setSearchQuery] = useState('');

  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [layers, setLayers] = useState<MapLayerStatus[]>([]);
  const [sources, setSources] = useState<SourceHealthItem[]>([]);
  const [endpointDiagnostics, setEndpointDiagnostics] = useState<ApiEndpointDiagnostic[]>([]);
  const [endpointPings, setEndpointPings] = useState<EndpointPingResult[]>([]);
  const [degradedModules, setDegradedModules] = useState<DegradedModuleNotice[]>([]);
  const [probingDiagnostics, setProbingDiagnostics] = useState(false);
  const [pingingEndpoints, setPingingEndpoints] = useState(false);
  const [refreshingKeys, setRefreshingKeys] = useState(false);
  const [keyRotation, setKeyRotation] = useState<KeyRotationSummary | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aircraft, setAircraft] = useState<AircraftTrack[]>([]);
  const [vessels, setVessels] = useState<VesselTrack[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<IntelEvent | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('DZA');
  const [aiScopePreset, setAiScopePreset] = useState<{ countryCode?: string; scopeLabel?: string } | null>(null);

  const [savedEvents, setSavedEvents] = useState<IntelEvent[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState(false);

  const [clock, setClock] = useState(() => formatUtcAndLocal(new Date()));

  // Live UTC + Local Clock
  useEffect(() => {
    const id = setInterval(() => setClock(formatUtcAndLocal(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // Load IndexedDB local state
  useEffect(() => {
    Promise.all([
      loadPreferences(),
      getSavedEvents(),
      getAlertRules(),
      getTriggeredAlerts(),
    ]).then(([p, saved, rules, alerts]) => {
      setPrefs(p);
      setSavedEvents(saved);
      setAlertRules(rules);
      setTriggeredAlerts(alerts);
      setPrefsLoaded(true);
    });
  }, []);

  // Sync theme, document lang, and RTL direction on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.lang = prefs.language;
    root.dir = prefs.language === 'ar' ? 'rtl' : 'ltr';
  }, [prefs.theme, prefs.language]);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePreferences(next).catch(() => {});
      return next;
    });
  }, []);

  // Evaluate incoming events against local Alert Rules with duplicate suppression
  const evaluateAlerts = useCallback(
    async (incoming: IntelEvent[], rules: AlertRule[], existing: TriggeredAlert[]) => {
      const activeRules = rules.filter((r) => r.enabled);
      if (activeRules.length === 0) return;

      const seen = new Set(existing.map((a) => `${a.ruleId}::${a.eventId}`));
      const newlyTriggered: TriggeredAlert[] = [];

      for (const ev of incoming) {
        if (ev.nature === 'public_reference') continue;
        for (const rule of activeRules) {
          const key = `${rule.id}::${ev.id}`;
          if (seen.has(key)) continue;

          if (rule.severities.length > 0 && !rule.severities.includes(ev.severity)) continue;

          const hay = `${ev.title} ${ev.summary} ${ev.country ?? ''} ${ev.region ?? ''}`.toLowerCase();
          if (
            rule.countries.length > 0 &&
            !rule.countries.some((c) => hay.includes(c.toLowerCase()) || (ev.countryCode ?? '').toLowerCase() === c.toLowerCase())
          ) {
            continue;
          }
          if (
            rule.keywords.length > 0 &&
            !rule.keywords.some((kw) => hay.includes(kw.toLowerCase()))
          ) {
            continue;
          }

          const alert: TriggeredAlert = {
            id: `trig-${rule.id}-${ev.id}`,
            ruleId: rule.id,
            ruleName: rule.name,
            eventId: ev.id,
            eventTitle: ev.title,
            severity: ev.severity,
            triggeredAt: new Date().toISOString(),
            acknowledged: false,
          };
          seen.add(key);
          newlyTriggered.push(alert);
          await saveTriggeredAlert(alert);

          if (rule.browserNotify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`WIH Alert: ${rule.name}`, { body: ev.title });
            } catch {
              // ignore browser notification restrictions
            }
          }
        }
      }

      if (newlyTriggered.length > 0) {
        setTriggeredAlerts((prev) => [...newlyTriggered, ...prev]);
      }
    },
    []
  );

  // Sync OSINT feeds from backend with error logging, 20-category coordinate tracing, and module-level diagnostics
  const syncFeeds = useCallback(async (targetRange = range) => {
    setSyncing(true);
    setSyncError(null);
    const started = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[WIH syncFeeds] Request timed out after 12000ms (range=${targetRange}); aborting and attempting offline cache fallback.`);
      controller.abort();
    }, 12_000);

    try {
      const requests: Array<Promise<Response>> = [
        fetch(`/api/events?range=${targetRange}`, { signal: controller.signal }),
        fetch('/api/layers', { signal: controller.signal }),
        fetch('/api/health', { signal: controller.signal }),
      ];
      const fetchAviation = prefs.visibleLayers.includes('aviation');
      const fetchMaritime = prefs.visibleLayers.includes('maritime');
      if (fetchAviation) requests.push(fetch('/api/aviation', { signal: controller.signal }));
      if (fetchMaritime) requests.push(fetch('/api/maritime', { signal: controller.signal }));

      const responses = await Promise.all(requests);
      const [evRes, layerRes, healthRes] = responses;
      let nextIdx = 3;
      const avRes = fetchAviation ? responses[nextIdx++] : null;
      const marRes = fetchMaritime ? responses[nextIdx++] : null;

      if (!evRes.ok) {
        console.error(`[WIH syncFeeds] /api/events failed with HTTP ${evRes.status} (${evRes.statusText})`);
        throw new Error(`Events API returned HTTP ${evRes.status}`);
      }
      if (!layerRes.ok) {
        console.warn(`[WIH syncFeeds] /api/layers returned HTTP ${layerRes.status}`);
      }
      if (!healthRes.ok) {
        console.warn(`[WIH syncFeeds] /api/health returned HTTP ${healthRes.status}`);
      }

      const evData = (await evRes.json()) as {
        events: IntelEvent[];
        sources: SourceHealthItem[];
        generatedAt: string;
      };
      const layerData = layerRes.ok
        ? ((await layerRes.json()) as { layers: MapLayerStatus[] })
        : { layers: [] };
      const healthData = healthRes.ok
        ? ((await healthRes.json()) as {
            aiConfigured?: boolean;
            keyRotation?: KeyRotationSummary;
            endpoints?: ApiEndpointDiagnostic[];
          })
        : {};

      if (avRes) {
        if (avRes.ok) {
          const avData = (await avRes.json()) as { tracks?: AircraftTrack[] };
          if (avData.tracks) setAircraft(avData.tracks);
        } else {
          console.error(`[WIH syncFeeds] /api/aviation failed with HTTP ${avRes.status}`);
        }
      }
      if (marRes) {
        if (marRes.ok) {
          const marData = (await marRes.json()) as { vessels?: VesselTrack[] };
          if (marData.vessels) setVessels(marData.vessels);
        } else {
          console.error(`[WIH syncFeeds] /api/maritime failed with HTTP ${marRes.status}`);
        }
      }

      const normalizedEvents = normalizeAndTraceEvents(evData.events ?? []);
      const nextSources = evData.sources ?? [];
      setEvents(normalizedEvents);
      setSources(nextSources);
      setLayers(layerData.layers ?? []);
      setAiConfigured(Boolean(healthData.aiConfigured));
      if (healthData.keyRotation) setKeyRotation(healthData.keyRotation);
      if (healthData.endpoints) setEndpointDiagnostics(healthData.endpoints);
      setDegradedModules(computeDegradedModules(nextSources));
      setLastSyncAt(evData.generatedAt || new Date().toISOString());
      setUsingOfflineCache(false);

      console.info(
        `[WIH syncFeeds] Completed range=${targetRange} in ${Math.round(performance.now() - started)}ms (${normalizedEvents.length} events)`
      );

      await cacheEventsOffline(targetRange, normalizedEvents);
      await evaluateAlerts(normalizedEvents, alertRules, triggeredAlerts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach OSINT aggregation backend';
      console.error(`[WIH syncFeeds] Synchronization error after ${Math.round(performance.now() - started)}ms:`, err);

      // Run lightweight endpoint ping to identify exactly which module(s) degraded
      pingRegisteredEndpoints(4500)
        .then((report) => {
          setEndpointPings(report.pings);
          if (report.sources.length > 0) setSources(report.sources);
          if (report.endpoints.length > 0) setEndpointDiagnostics(report.endpoints);
          setDegradedModules(report.degradedModules);
        })
        .catch((pingErr) => {
          console.error('[WIH syncFeeds] Lightweight endpoint ping also failed:', pingErr);
        });

      const cached = await loadCachedEventsOffline(targetRange);
      if (cached && cached.events.length > 0) {
        const normalizedCached = normalizeAndTraceEvents(cached.events);
        setEvents(normalizedCached);
        setLastSyncAt(cached.savedAt);
        setUsingOfflineCache(true);
        console.warn(`[WIH syncFeeds] Serving ${normalizedCached.length} cached offline records from IndexedDB (savedAt=${cached.savedAt}).`);
      } else {
        setSyncError(msg);
      }
    } finally {
      clearTimeout(timeoutId);
      setSyncing(false);
    }
  }, [range, prefs.visibleLayers, alertRules, triggeredAlerts, evaluateAlerts]);

  const runPingDiagnostics = useCallback(async () => {
    setPingingEndpoints(true);
    try {
      const report = await pingRegisteredEndpoints(6000);
      setEndpointPings(report.pings);
      if (report.sources.length > 0) setSources(report.sources);
      if (report.endpoints.length > 0) setEndpointDiagnostics(report.endpoints);
      setDegradedModules(report.degradedModules);
    } finally {
      setPingingEndpoints(false);
    }
  }, []);

  const runDiagnosticProbe = useCallback(async () => {
    setProbingDiagnostics(true);
    try {
      const res = await fetch('/api/diagnostics/probe', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as {
          sources?: SourceHealthItem[];
          endpoints?: ApiEndpointDiagnostic[];
          keyRotation?: KeyRotationSummary;
          aiConfigured?: boolean;
        };
        if (data.sources) {
          setSources(data.sources);
          setDegradedModules(computeDegradedModules(data.sources, endpointPings));
        }
        if (data.endpoints) setEndpointDiagnostics(data.endpoints);
        if (data.keyRotation) setKeyRotation(data.keyRotation);
        if (typeof data.aiConfigured === 'boolean') setAiConfigured(data.aiConfigured);
      }
    } catch (err) {
      console.error('[WIH diagnostics] Full probe failed:', err);
    } finally {
      setProbingDiagnostics(false);
    }
  }, [endpointPings]);

  const runKeyAndMirrorRefresh = useCallback(async () => {
    setRefreshingKeys(true);
    try {
      const res = await fetch('/api/diagnostics/refresh-keys', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as {
          keyRotation?: KeyRotationSummary;
          sources?: SourceHealthItem[];
          endpoints?: ApiEndpointDiagnostic[];
          aiConfigured?: boolean;
        };
        if (data.keyRotation) setKeyRotation(data.keyRotation);
        if (data.sources) setSources(data.sources);
        if (data.endpoints) setEndpointDiagnostics(data.endpoints);
        if (typeof data.aiConfigured === 'boolean') setAiConfigured(data.aiConfigured);
      }
    } catch (err) {
      console.error('[WIH diagnostics] Key & mirror refresh failed:', err);
    } finally {
      setRefreshingKeys(false);
    }
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    syncFeeds(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, range]);

  // Periodic background refresh respecting user interval
  useEffect(() => {
    if (!prefs.refreshIntervalSec || prefs.refreshIntervalSec <= 0) return;
    const ms = Math.max(60, prefs.refreshIntervalSec) * 1000;
    const id = setInterval(() => {
      if (navigator.onLine) syncFeeds(range);
    }, ms);
    return () => clearInterval(id);
  }, [prefs.refreshIntervalSec, range, syncFeeds]);

  // Automatic background server & key health check + seamless auto-switch sync
  useEffect(() => {
    if (!prefsLoaded) return;
    let cancelled = false;

    const runAutoHealthCheck = async () => {
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      try {
        const [pingReport, healthRes] = await Promise.all([
          pingRegisteredEndpoints(5000),
          fetch('/api/health').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (cancelled) return;
        setEndpointPings(pingReport.pings);
        if (pingReport.sources.length > 0) setSources(pingReport.sources);
        if (pingReport.endpoints.length > 0) setEndpointDiagnostics(pingReport.endpoints);
        setDegradedModules(pingReport.degradedModules);

        if (healthRes && typeof healthRes === 'object') {
          const h = healthRes as { keyRotation?: KeyRotationSummary; aiConfigured?: boolean };
          if (h.keyRotation) setKeyRotation(h.keyRotation);
          if (typeof h.aiConfigured === 'boolean') setAiConfigured(h.aiConfigured);
        }
      } catch {
        // Silent degradation on transient network error
      }
    };

    const bootTimer = setTimeout(runAutoHealthCheck, 3500);
    const intervalMs = Math.max(90, prefs.refreshIntervalSec || 120) * 1000;
    const periodicTimer = setInterval(runAutoHealthCheck, intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(bootTimer);
      clearInterval(periodicTimer);
    };
  }, [prefsLoaded, prefs.refreshIntervalSec]);

  // Fetch Aviation or Maritime live overlays if those layers are toggled visible on the map
  useEffect(() => {
    if (prefs.visibleLayers.includes('aviation') && aircraft.length === 0) {
      fetch('/api/aviation')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { tracks?: AircraftTrack[] } | null) => {
          if (d?.tracks) setAircraft(d.tracks);
        })
        .catch(() => {});
    }
    if (prefs.visibleLayers.includes('maritime') && vessels.length === 0) {
      fetch('/api/maritime')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { vessels?: VesselTrack[] } | null) => {
          if (d?.vessels) setVessels(d.vessels);
        })
        .catch(() => {});
    }
  }, [prefs.visibleLayers, aircraft.length, vessels.length]);

  const handleToggleLayer = (layerId: IntelCategory) => {
    const exists = prefs.visibleLayers.includes(layerId);
    const next = exists
      ? prefs.visibleLayers.filter((l) => l !== layerId)
      : [...prefs.visibleLayers, layerId];
    updatePreferences({ visibleLayers: next });
  };

  const handleToggleSaveEvent = async (ev: IntelEvent) => {
    await toggleSavedEvent(ev);
    const updated = await getSavedEvents();
    setSavedEvents(updated);
  };

  const handleOpenCountry = (codeOrName: string) => {
    setSelectedCountryCode(codeOrName);
    setActiveNav('country');
  };

  const searchedEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        (e.country ?? '').toLowerCase().includes(q) ||
        (e.region ?? '').toLowerCase().includes(q) ||
        e.sources.some((s) => s.organization.toLowerCase().includes(q))
    );
  }, [events, searchQuery]);

  const savedIdSet = useMemo(() => new Set(savedEvents.map((e) => e.id)), [savedEvents]);
  const unreadAlertsCount = useMemo(
    () => triggeredAlerts.filter((a) => !a.acknowledged).length,
    [triggeredAlerts]
  );

  const strings = UI_STRINGS[prefs.language];
  const copy = FULL_UI_COPY[prefs.language];

  return (
    <I18nProvider lang={prefs.language}>
      <div
        dir={prefs.language === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen flex bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100"
      >
        {/* Desktop Left/Start Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-60 shrink-0 border-e border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0e141f]">
          <div className="h-14 px-4 flex items-center border-b border-slate-200 dark:border-slate-800/90">
            <button
              type="button"
              onClick={() => setActiveNav('overview')}
              className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap"
            >
              {strings.appName}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
            {NAV_ITEMS.map(({ id, icon: Icon }) => {
              const active = activeNav === id;
              const isDegraded = degradedModules.some((d) => d.module === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveNav(id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{strings.nav[id]}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {isDegraded && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Module degraded" />
                    )}
                    {id === 'alerts' && unreadAlertsCount > 0 && (
                      <span className="font-mono text-[11px] text-rose-500 font-semibold">
                        {unreadAlertsCount}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800/90 text-[11px] text-slate-500 space-y-1">
            <div>{copy.freeOsint}</div>
            <div className="font-mono tabular-nums">
              {sources.filter((s) => s.status === 'operational').length}/{sources.length || 12} {copy.liveFeedsActive}
            </div>
          </div>
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative w-68 max-w-[82vw] bg-white dark:bg-[#0e141f] border-e border-slate-200 dark:border-slate-800 flex flex-col h-full z-10">
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <span className="text-sm font-bold">{strings.appName}</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
                {NAV_ITEMS.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveNav(id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium ${
                      activeNav === id
                        ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{strings.nav[id]}</span>
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 h-14 border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur px-3 lg:px-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xl">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={strings.searchPlaceholder}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] ps-8 pe-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* UTC & Local Clocks (Desktop) */}
              <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-cyan-500" />
                <span>{clock.utc}</span>
                <span aria-hidden="true">·</span>
                <span>{clock.local}</span>
              </div>

              {/* Time Range */}
              <div className="hidden sm:inline-flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 text-[11px] font-mono">
                {(['24h', '7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2 py-1 rounded transition-colors ${
                      range === r
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Alerts Shortcut */}
              <button
                type="button"
                onClick={() => setActiveNav('alerts')}
                aria-label={strings.nav.alerts}
                className="relative p-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -end-1 px-1 rounded bg-rose-600 text-[10px] font-mono text-white">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Sync Button */}
              <button
                type="button"
                onClick={() => syncFeeds(range)}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-500' : ''}`} />
                <span className="hidden md:inline">{syncing ? strings.syncing : strings.refresh}</span>
              </button>

              <div className="hidden sm:block">
                <PWAInstallButton />
              </div>
            </div>
          </header>

          {/* Connectivity / Offline Cache / Sync Error / Module Degradation Banner */}
          {(!isOnline || usingOfflineCache || syncError || degradedModules.length > 0) && (
            <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {!isOnline || usingOfflineCache ? <WifiOff className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span className="truncate">
                  {!isOnline || usingOfflineCache
                    ? `${strings.offlineBanner} (${copy.localSnapshot}: ${lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Local'})`
                    : syncError
                    ? syncError
                    : `${copy.degradedModulesPrefix}: ${degradedModules.map((d) => strings.nav[d.module]).join(' · ')}`}
                </span>
              </div>
              {degradedModules.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveNav('diagnostics')}
                  className="text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:underline shrink-0"
                >
                  {copy.inspectDiagnostics}
                </button>
              )}
            </div>
          )}

          {/* Workspace Content */}
          <main className="flex-1 p-3 lg:p-5 pb-20 lg:pb-6 max-w-[1600px] w-full mx-auto">
            {activeNav === 'overview' && (
              <GlobalOverviewView
                events={searchedEvents}
                layers={layers}
                visibleLayers={prefs.visibleLayers}
                onToggleLayer={handleToggleLayer}
                mapStyle={prefs.mapStyle}
                onChangeMapStyle={(mapStyle) => updatePreferences({ mapStyle })}
                selectedEvent={selectedEvent}
                onSelectEvent={(ev) => setSelectedEvent(ev)}
                savedIds={savedIdSet}
                onToggleSave={handleToggleSaveEvent}
                onOpenCountry={handleOpenCountry}
                aircraft={aircraft}
                vessels={vessels}
              />
            )}

            {activeNav === 'map' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
                <div className="xl:col-span-8">
                  <GlobalIntelMap
                    events={searchedEvents}
                    layers={layers}
                    visibleLayers={prefs.visibleLayers}
                    onToggleLayer={handleToggleLayer}
                    mapStyle={prefs.mapStyle}
                    onChangeMapStyle={(mapStyle) => updatePreferences({ mapStyle })}
                    selectedEventId={selectedEvent?.id}
                    onSelectEvent={setSelectedEvent}
                    onSelectCountryName={handleOpenCountry}
                    aircraft={aircraft}
                    vessels={vessels}
                    heightClass="h-[calc(100vh-148px)] min-h-[500px]"
                  />
                </div>
                <div className="xl:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] h-[calc(100vh-148px)] min-h-[500px] overflow-hidden">
                  <EventDetailPanel
                    event={selectedEvent}
                    isSaved={selectedEvent ? savedIdSet.has(selectedEvent.id) : false}
                    onToggleSave={handleToggleSaveEvent}
                    onOpenCountry={handleOpenCountry}
                  />
                </div>
              </div>
            )}

            {activeNav === 'conflicts' && (
              <DomainFeedView
                title={copy.feeds.conflictsTitle}
                subtitle={copy.feeds.conflictsSubtitle}
                categories={['armed_conflict', 'military_incident', 'airstrike_explosion', 'terrorism', 'military_base']}
                events={searchedEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedIds={savedIdSet}
                onToggleSave={handleToggleSaveEvent}
                onOpenCountry={handleOpenCountry}
                disclaimer={copy.feeds.conflictsDisclaimer}
              />
            )}

            {activeNav === 'disasters' && (
              <DomainFeedView
                title={copy.feeds.disastersTitle}
                subtitle={copy.feeds.disastersSubtitle}
                categories={['earthquake', 'wildfire', 'flood', 'severe_weather', 'volcano']}
                events={searchedEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedIds={savedIdSet}
                onToggleSave={handleToggleSaveEvent}
                onOpenCountry={handleOpenCountry}
              />
            )}

            {activeNav === 'cyber' && (
              <DomainFeedView
                title={copy.feeds.cyberTitle}
                subtitle={copy.feeds.cyberSubtitle}
                categories={['cyber_incident', 'strategic_infra', 'undersea_cable']}
                events={searchedEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedIds={savedIdSet}
                onToggleSave={handleToggleSaveEvent}
                onOpenCountry={handleOpenCountry}
                disclaimer={copy.feeds.cyberDisclaimer}
              />
            )}

            {activeNav === 'geopolitics' && (
              <DomainFeedView
                title={copy.feeds.geopoliticsTitle}
                subtitle={copy.feeds.geopoliticsSubtitle}
                categories={['political_unrest', 'protest', 'armed_conflict', 'maritime', 'energy_infra', 'nuclear_facility']}
                events={searchedEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedIds={savedIdSet}
                onToggleSave={handleToggleSaveEvent}
                onOpenCountry={handleOpenCountry}
              />
            )}

            {activeNav === 'aviation' && (
              <AviationView onTracksLoaded={setAircraft} />
            )}

            {activeNav === 'maritime' && (
              <MaritimeView
                events={searchedEvents}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setActiveNav('map');
                }}
                onVesselsLoaded={setVessels}
              />
            )}

            {activeNav === 'economy' && <EconomyView />}

            {activeNav === 'country' && (
              <CountryRegionView
                initialCode={selectedCountryCode}
                events={searchedEvents}
                favoriteCountries={prefs.favoriteCountries}
                onToggleFavoriteCountry={(cca3) => {
                  const exists = prefs.favoriteCountries.includes(cca3);
                  updatePreferences({
                    favoriteCountries: exists
                      ? prefs.favoriteCountries.filter((c) => c !== cca3)
                      : [...prefs.favoriteCountries, cca3],
                  });
                }}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setActiveNav('map');
                }}
                onGenerateCountryReport={(countryCode, countryName) => {
                  setAiScopePreset({ countryCode, scopeLabel: countryName });
                  setActiveNav('ai_reports');
                }}
              />
            )}

            {activeNav === 'ai_reports' && (
              <AIAnalystView
                aiEnabled={prefs.aiEnabled}
                defaultLanguage={prefs.language}
                preselectedScope={aiScopePreset}
              />
            )}

            {activeNav === 'alerts' && (
              <AlertsWatchlistsView
                rules={alertRules}
                triggeredAlerts={triggeredAlerts}
                savedEvents={savedEvents}
                onAddRule={async (rule) => {
                  await saveAlertRule(rule);
                  setAlertRules(await getAlertRules());
                }}
                onDeleteRule={async (id) => {
                  await deleteAlertRule(id);
                  setAlertRules(await getAlertRules());
                }}
                onToggleRule={async (rule) => {
                  await saveAlertRule(rule);
                  setAlertRules(await getAlertRules());
                }}
                onAcknowledgeAll={async () => {
                  await acknowledgeAllAlerts();
                  setTriggeredAlerts(await getTriggeredAlerts());
                }}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setActiveNav('map');
                }}
                preferences={prefs}
                onUpdatePreferences={updatePreferences}
              />
            )}

            {activeNav === 'timeline' && (
              <HistoricalTimelineView
                range={range}
                onChangeRange={setRange}
                events={searchedEvents}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setActiveNav('map');
                }}
              />
            )}

            {activeNav === 'diagnostics' && (
              <DiagnosticsView
                sources={sources}
                endpoints={endpointDiagnostics}
                degradedModules={degradedModules}
                endpointPings={endpointPings}
                keyRotation={keyRotation}
                aiConfigured={aiConfigured}
                probing={probingDiagnostics}
                pinging={pingingEndpoints}
                refreshingKeys={refreshingKeys}
                onRefresh={() => syncFeeds(range)}
                onRunProbe={runDiagnosticProbe}
                onRunPing={runPingDiagnostics}
                onRefreshKeys={runKeyAndMirrorRefresh}
              />
            )}

            {activeNav === 'settings' && (
              <SettingsView
                preferences={prefs}
                onUpdatePreferences={updatePreferences}
                onClearCache={async () => {
                  await clearAllLocalCache();
                }}
              />
            )}
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar (Compact <= 15% viewport height) */}
        <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0e141f]/95 backdrop-blur grid grid-cols-5">
          {([
            { id: 'overview', label: copy.mobileNav.overview, icon: LayoutDashboard },
            { id: 'map', label: copy.mobileNav.map, icon: MapIcon },
            { id: 'conflicts', label: copy.mobileNav.conflicts, icon: Crosshair },
            { id: 'alerts', label: copy.mobileNav.alerts, icon: Bell },
          ] as const).map(({ id, label, icon: Icon }) => {
            const active = activeNav === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveNav(id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  active ? 'text-cyan-500' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <Menu className="w-4 h-4" />
            <span>{copy.mobileNav.modules}</span>
          </button>
        </nav>
      </div>
    </I18nProvider>
  );
}
