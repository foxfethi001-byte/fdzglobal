import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookmarkCheck,
  CheckCheck,
  Download,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  AlertRule,
  ApiEndpointDiagnostic,
  IntelEvent,
  KeyRotationSummary,
  SeverityLevel,
  SourceHealthItem,
  SupportedLang,
  TriggeredAlert,
  UserPreferences,
} from '../types/intelligence';
import type { DegradedModuleNotice, EndpointPingResult } from '../lib/diagnostics';
import {
  formatRelativeTime,
  translateCategory,
  translateConfidence,
  translateRegion,
  translateSeverity,
  translateStatus,
  useI18n,
} from '../lib/i18n';
import { PWAInstallButton } from './PWAInstallButton';

/* ---------------- 1. ALERTS & WATCHLISTS VIEW ---------------- */
interface AlertsViewProps {
  rules: AlertRule[];
  triggeredAlerts: TriggeredAlert[];
  savedEvents: IntelEvent[];
  onAddRule: (rule: AlertRule) => void;
  onDeleteRule: (id: string) => void;
  onToggleRule: (rule: AlertRule) => void;
  onAcknowledgeAll: () => void;
  onSelectEvent: (ev: IntelEvent) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
}

export const AlertsWatchlistsView: React.FC<AlertsViewProps> = ({
  rules,
  triggeredAlerts,
  savedEvents,
  onAddRule,
  onDeleteRule,
  onToggleRule,
  onAcknowledgeAll,
  onSelectEvent,
  preferences,
  onUpdatePreferences,
}) => {
  const { lang, t } = useI18n();
  const [name, setName] = useState('');
  const [countriesStr, setCountriesStr] = useState('');
  const [keywordsStr, setKeywordsStr] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('high');
  const [browserNotify, setBrowserNotify] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const [wlName, setWlName] = useState('');
  const [wlCountries, setWlCountries] = useState('');
  const [wlKeywords, setWlKeywords] = useState('');

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === 'granted') setBrowserNotify(true);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddRule({
      id: `rule-${Date.now()}`,
      name: name.trim(),
      enabled: true,
      countries: countriesStr.split(',').map((s) => s.trim()).filter(Boolean),
      regions: [],
      categories: [],
      severities: [severity, 'critical'],
      keywords: keywordsStr.split(',').map((s) => s.trim()).filter(Boolean),
      sources: [],
      timeWindowHours: 24,
      browserNotify,
      createdAt: new Date().toISOString(),
    });
    setName('');
    setCountriesStr('');
    setKeywordsStr('');
  };

  const handleAddWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlName.trim()) return;
    const next = [
      ...preferences.watchlists,
      {
        id: `wl-${Date.now()}`,
        name: wlName.trim(),
        countries: wlCountries.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
        keywords: wlKeywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      },
    ];
    onUpdatePreferences({ watchlists: next });
    setWlName('');
    setWlCountries('');
    setWlKeywords('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.alerts.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.alerts.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {typeof Notification !== 'undefined' && notifPerm !== 'granted' && (
            <button
              type="button"
              onClick={requestNotifPermission}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-cyan-700 dark:text-cyan-300 font-medium"
            >
              <Bell className="w-3.5 h-3.5" />
              {t.alerts.enableNotif}
            </button>
          )}
          <button
            type="button"
            onClick={onAcknowledgeAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t.alerts.ackAll}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Create Alert Rule */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleCreateRule} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3 text-xs">
            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.alerts.createRuleTitle}</div>
            <div>
              <label className="block text-slate-500 mb-1">{t.alerts.ruleName}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.alerts.rulePlaceholder}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">{t.alerts.countriesLabel}</label>
                <input
                  type="text"
                  value={countriesStr}
                  onChange={(e) => setCountriesStr(e.target.value)}
                  placeholder="Algeria, Ukraine, Yemen"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">{t.alerts.minSeverity}</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f1623] px-2.5 py-1.5"
                >
                  <option value="critical">{translateSeverity('critical', lang)}</option>
                  <option value="high">{translateSeverity('high', lang)}+</option>
                  <option value="medium">{translateSeverity('medium', lang)}+</option>
                  <option value="low">{t.overview.allSeverities}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{t.alerts.keywordsLabel}</label>
              <input
                type="text"
                value={keywordsStr}
                onChange={(e) => setKeywordsStr(e.target.value)}
                placeholder="earthquake, ransomware, pipeline, ceasefire"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5"
              />
            </div>
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={browserNotify}
                onChange={(e) => setBrowserNotify(e.target.checked)}
                className="accent-cyan-500"
              />
              {t.alerts.browserNotifCheck} ({notifPerm})
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.alerts.saveRule}
            </button>
          </form>

          {/* Active Rules */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800">
            <div className="px-4 py-2.5 text-xs font-semibold">
              {t.alerts.configuredRules} ({rules.length})
            </div>
            {rules.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">{t.alerts.noRules}</div>
            ) : (
              rules.map((r) => (
                <div key={r.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {[...r.countries, ...r.keywords].join(', ') || translateRegion('Global', lang)} ·{' '}
                      {r.severities.map((s) => translateSeverity(s, lang)).join('/')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleRule({ ...r, enabled: !r.enabled })}
                      className={`px-2 py-1 rounded text-[11px] font-medium ${
                        r.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {r.enabled ? t.alerts.active : t.alerts.paused}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRule(r.id)}
                      aria-label="Delete rule"
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Triggered Alerts + Watchlists + Bookmarks */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
              {t.alerts.triggeredLog} ({triggeredAlerts.length})
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {triggeredAlerts.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">{t.alerts.noTriggered}</div>
              ) : (
                triggeredAlerts.map((a) => (
                  <div key={a.id} className="p-3 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold uppercase ${a.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>
                          {translateSeverity(a.severity, lang)}
                        </span>
                        <span className="text-slate-500">· {a.ruleName}</span>
                        {!a.acknowledged && <span className="text-cyan-400 font-semibold">· {t.alerts.newBadge}</span>}
                      </div>
                      <div className="text-slate-900 dark:text-slate-100 truncate mt-0.5">{a.eventTitle}</div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {formatRelativeTime(a.triggeredAt, lang)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Personal Watchlists */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3 text-xs">
            <div className="font-semibold">
              {t.alerts.watchlistsTitle} ({preferences.watchlists.length})
            </div>
            <div className="space-y-2">
              {preferences.watchlists.map((wl) => (
                <div key={wl.id} className="flex items-center justify-between border border-slate-200 dark:border-slate-800 rounded p-2.5">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{wl.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {wl.countries.join(', ') || '—'} · {wl.keywords.join(', ') || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ watchlists: preferences.watchlists.filter((x) => x.id !== wl.id) })}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    aria-label="Remove watchlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddWatchlist} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={wlName}
                onChange={(e) => setWlName(e.target.value)}
                placeholder={t.alerts.watchlistPlaceholder}
                className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5"
              />
              <input
                type="text"
                value={wlCountries}
                onChange={(e) => setWlCountries(e.target.value)}
                placeholder={t.alerts.isoPlaceholder}
                className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={wlKeywords}
                  onChange={(e) => setWlKeywords(e.target.value)}
                  placeholder={t.alerts.keywordsPlaceholder}
                  className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5"
                />
                <button type="submit" className="rounded bg-cyan-600 text-white px-3 py-1.5 font-medium shrink-0">
                  {t.alerts.addBtn}
                </button>
              </div>
            </form>
          </div>

          {/* Saved / Bookmarked Events */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs font-semibold">
              <BookmarkCheck className="w-3.5 h-3.5 text-cyan-500" />
              {t.alerts.savedEventsTitle} ({savedEvents.length})
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {savedEvents.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">{t.alerts.savedEventsEmpty}</div>
              ) : (
                savedEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onSelectEvent(ev)}
                    className="w-full text-start p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">{ev.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {translateCategory(ev.category, lang)} · {ev.country || translateRegion(ev.region, lang)} ·{' '}
                      {formatRelativeTime(ev.publishedAt, lang)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- 2. HISTORICAL TIMELINE VIEW ---------------- */
export const HistoricalTimelineView: React.FC<{
  range: '24h' | '7d' | '30d';
  onChangeRange: (r: '24h' | '7d' | '30d') => void;
  events: IntelEvent[];
  onSelectEvent: (ev: IntelEvent) => void;
}> = ({ range, onChangeRange, events, onSelectEvent }) => {
  const { lang, t } = useI18n();
  const [catFilter, setCatFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const historicalEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.nature === 'public_reference') return false;
      if (catFilter !== 'all' && e.category !== catFilter) return false;
      if (regionFilter !== 'all' && e.region !== regionFilter) return false;
      const tMs = new Date(e.publishedAt).getTime();
      if (fromDate && tMs < new Date(fromDate).getTime()) return false;
      if (toDate && tMs > new Date(toDate).getTime() + 86_400_000) return false;
      return true;
    });
  }, [events, catFilter, regionFilter, fromDate, toDate]);

  const categoryBars = useMemo(() => {
    const counts = new Map<IntelEvent['category'], number>();
    for (const ev of historicalEvents) {
      counts.set(ev.category, (counts.get(ev.category) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = entries[0]?.[1] || 1;
    return entries.map(([cat, count]) => ({ cat, count, pct: Math.round((count / max) * 100) }));
  }, [historicalEvents]);

  const exportCsv = () => {
    const header = 'id,publishedAt,collectedAt,category,severity,confidence,country,region,lat,lon,independentOrgCount,title,primaryUrl\n';
    const rows = historicalEvents.map((e) =>
      [
        e.id,
        e.publishedAt,
        e.collectedAt,
        e.category,
        e.severity,
        e.confidence,
        `"${(e.country ?? '').replace(/"/g, '""')}"`,
        `"${(e.region ?? '').replace(/"/g, '""')}"`,
        e.lat ?? '',
        e.lon ?? '',
        e.independentOrgCount,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${e.sources[0]?.url ?? ''}"`,
      ].join(',')
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wih-timeline-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  };

  const compared = compareIds.map((id) => historicalEvents.find((e) => e.id === id)).filter(Boolean) as IntelEvent[];

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.timeline.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.timeline.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 p-0.5">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeRange(r)}
                className={`px-2.5 py-1 rounded font-mono ${
                  range === r ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          />
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          />

          <select
            aria-label="Region filter"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2 py-1"
          >
            <option value="all">{t.timeline.allRegions}</option>
            {(['North Africa', 'Sahel', 'Middle East', 'Europe', 'United States', 'Asia-Pacific'] as const).map((reg) => (
              <option key={reg} value={reg}>{translateRegion(reg, lang)}</option>
            ))}
          </select>

          <select
            aria-label="Category filter"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2 py-1"
          >
            <option value="all">{t.timeline.allCategories}</option>
            {Array.from(new Set(events.map((e) => e.category))).map((c) => (
              <option key={c} value={c}>{translateCategory(c, lang)}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            {t.timeline.exportCsv}
          </button>
        </div>
      </div>

      {/* Category Frequency Chart */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2.5">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {t.timeline.distribution} ({historicalEvents.length} · {range.toUpperCase()})
        </div>
        <div className="space-y-2">
          {categoryBars.map((b) => (
            <div key={b.cat} className="grid grid-cols-12 items-center gap-3 text-xs">
              <div className="col-span-4 sm:col-span-3 truncate text-slate-600 dark:text-slate-300">
                {translateCategory(b.cat, lang)}
              </div>
              <div className="col-span-6 sm:col-span-8 h-2.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded" style={{ width: `${b.pct}%` }} />
              </div>
              <div className="col-span-2 sm:col-span-1 text-end font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {b.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-side comparison */}
      {compared.length > 0 && (
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-700 dark:text-cyan-300">
            <span>{t.timeline.comparison} ({compared.length}/2)</span>
            <button type="button" onClick={() => setCompareIds([])} className="hover:underline">
              {t.timeline.clear}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {compared.map((ev) => (
              <div key={ev.id} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{ev.title}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  {ev.publishedAt} · {ev.country || translateRegion(ev.region, lang)} ·{' '}
                  {translateConfidence(ev.confidence, lang)} ({ev.independentOrgCount} {t.overview.orgsCount})
                </div>
                <p className="text-slate-600 dark:text-slate-400">{ev.confidenceExplanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline List */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
        {historicalEvents.slice(0, 120).map((ev) => (
          <div key={ev.id} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <button type="button" onClick={() => onSelectEvent(ev)} className="text-start flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                <span>{new Date(ev.publishedAt).toISOString().replace('T', ' ').slice(0, 16)}Z</span>
                <span>·</span>
                <span className="font-sans text-cyan-600 dark:text-cyan-400">{translateCategory(ev.category, lang)}</span>
                {ev.country && <span>· {ev.country}</span>}
              </div>
              <div className="font-medium text-slate-900 dark:text-slate-100">{ev.title}</div>
            </button>
            <button
              type="button"
              onClick={() => toggleCompare(ev.id)}
              className={`px-2 py-1 rounded border text-[11px] shrink-0 ${
                compareIds.includes(ev.id)
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-500'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500'
              }`}
            >
              {compareIds.includes(ev.id) ? t.timeline.selected : t.timeline.compare}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- 3. DIAGNOSTICS & SOURCE HEALTH VIEW ---------------- */
export const DiagnosticsView: React.FC<{
  sources: SourceHealthItem[];
  endpoints: ApiEndpointDiagnostic[];
  degradedModules?: DegradedModuleNotice[];
  endpointPings?: EndpointPingResult[];
  keyRotation?: KeyRotationSummary | null;
  aiConfigured: boolean;
  probing?: boolean;
  pinging?: boolean;
  refreshingKeys?: boolean;
  onRefresh: () => void;
  onRunProbe?: () => void;
  onRunPing?: () => void;
  onRefreshKeys?: () => void;
}> = ({
  sources,
  endpoints,
  degradedModules = [],
  endpointPings = [],
  keyRotation = null,
  aiConfigured,
  probing = false,
  pinging = false,
  refreshingKeys = false,
  onRefresh,
  onRunProbe,
  onRunPing,
  onRefreshKeys,
}) => {
  const { lang, t, nav } = useI18n();

  const exportDiagnosticReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      aiConfigured,
      keyRotation,
      degradedModules,
      endpointPings,
      sources,
      endpoints,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wih-health-diagnostics-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recentErrorsList = useMemo(() => {
    const items: Array<{ sourceId: string; sourceName: string; timestamp: string; statusCode?: number | null; message: string; endpoint?: string }> = [];
    for (const s of sources) {
      for (const err of s.recentErrors ?? []) {
        items.push({
          sourceId: s.id,
          sourceName: s.name,
          timestamp: err.timestamp,
          statusCode: err.statusCode,
          message: err.message,
          endpoint: err.endpoint,
        });
      }
    }
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 25);
  }, [sources]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.diagnostics.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.diagnostics.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {onRefreshKeys && (
            <button
              type="button"
              disabled={refreshingKeys}
              onClick={onRefreshKeys}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingKeys ? 'animate-spin' : ''}`} />
              {refreshingKeys ? t.diagnostics.refreshingKeys : t.diagnostics.refreshKeysBtn}
            </button>
          )}
          {onRunPing && (
            <button
              type="button"
              disabled={pinging}
              onClick={onRunPing}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-60 text-cyan-700 dark:text-cyan-300 px-3 py-1.5 text-xs font-medium"
            >
              <Activity className={`w-3.5 h-3.5 ${pinging ? 'animate-pulse' : ''}`} />
              {pinging ? t.diagnostics.pinging : t.diagnostics.pingBtn}
            </button>
          )}
          {onRunProbe && (
            <button
              type="button"
              disabled={probing}
              onClick={onRunProbe}
              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white px-3 py-1.5 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
              {probing ? t.diagnostics.probing : t.diagnostics.runProbe}
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.diagnostics.refreshBtn}
          </button>
          <button
            type="button"
            onClick={exportDiagnosticReport}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            {t.diagnostics.exportJson}
          </button>
        </div>
      </div>

      {/* 100% Free-Tier & Continuous Server Key/Mirror Sync Telemetry (Read-Only, Zero Secrets) */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">
            {t.diagnostics.freeTierBadge}
          </div>
          {keyRotation && (
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300" dir="ltr">
              {t.diagnostics.autoSyncEveryLabel}: {keyRotation.autoSyncIntervalSec}s · {t.diagnostics.rotationsLabel}: {keyRotation.rotationCount}
            </div>
          )}
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          {t.diagnostics.zeroPaidGuarantee}
        </p>

        {keyRotation && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
            {/* Key Rotation Pool Status */}
            <div className="lg:col-span-5 rounded-md border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#111827]/90 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <span>{t.diagnostics.keyPoolTitle}</span>
                <span className="font-mono text-[11px] text-emerald-500">
                  {keyRotation.readyCount}/{keyRotation.poolSize} {t.diagnostics.readyState}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div>
                  {t.diagnostics.freeModelsLabel}:{' '}
                  <span className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                    {keyRotation.allowedFreeModels.join(', ')}
                  </span>
                </div>
                <div className="font-mono" dir="ltr">
                  {t.diagnostics.lastReloadLabel}: {keyRotation.lastReloadAt.replace('T', ' ').slice(0, 19)}Z
                </div>
              </div>
              {keyRotation.slots.length === 0 ? (
                <div className="rounded border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-[11px] text-slate-600 dark:text-slate-400">
                  {t.diagnostics.zeroCostFallbackNote}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {keyRotation.slots.map((slot) => (
                    <div
                      key={`${slot.sourceVar}-${slot.slotIndex}`}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-mono text-slate-800 dark:text-slate-200" dir="ltr">
                        {t.diagnostics.slotLabel} #{slot.slotIndex + 1} · {slot.sourceVar}
                      </span>
                      <span
                        className={`font-semibold ${
                          slot.status === 'ready'
                            ? 'text-emerald-500'
                            : slot.status === 'cooldown'
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`}
                      >
                        {slot.status === 'ready'
                          ? t.diagnostics.readyState
                          : slot.status === 'cooldown'
                          ? `${t.diagnostics.cooldownState} (${slot.cooldownRemainingSec}s)`
                          : t.diagnostics.invalidState}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Keyless Free Mirrors Status */}
            <div className="lg:col-span-7 rounded-md border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#111827]/90 p-3 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {t.diagnostics.mirrorsTitle}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {keyRotation.mirrors.map((m) => (
                  <div
                    key={m.id}
                    className="rounded border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</span>
                      <span className="text-[10px] font-mono text-emerald-500">{t.diagnostics.noKeyNeededBadge}</span>
                    </div>
                    <div className="text-slate-500 truncate" dir="ltr">
                      {m.activeEndpoint}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400" dir="ltr">
                      {t.diagnostics.failoversLabel}: {m.failoverCount} · Mirrors: {m.mirrorCount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Degraded Modules Alert Breakdown */}
      {degradedModules.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t.diagnostics.degradedModulesTitle} ({degradedModules.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {degradedModules.map((dm) => (
              <div
                key={dm.module}
                className="rounded-md border border-amber-500/30 bg-white/70 dark:bg-[#0f172a]/80 p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {nav[dm.module] || dm.module}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase font-semibold ${
                      dm.status === 'unavailable' ? 'text-rose-500' : 'text-amber-500'
                    }`}
                  >
                    {translateStatus(dm.status, lang)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 break-words">
                  {dm.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-slate-500">{t.diagnostics.opRefFeeds}</div>
          <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-emerald-500">
            {sources.filter((s) => s.status === 'operational' || s.status === 'reference').length} / {sources.length}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-slate-500">{t.diagnostics.degUnavailFeeds}</div>
          <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-amber-500">
            {sources.filter((s) => s.status === 'degraded' || s.status === 'unavailable').length}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-slate-500">{t.diagnostics.trackedRoutes}</div>
          <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-cyan-500">
            {endpoints.length}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-slate-500">{t.diagnostics.geminiKey}</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-500 shrink-0" />
            <span>{aiConfigured ? t.diagnostics.configured : t.diagnostics.fallbackActive}</span>
          </div>
        </div>
      </div>

      {/* Lightweight Endpoint Ping Results (if run) */}
      {endpointPings.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3">
          <div className="text-xs font-semibold mb-2 text-slate-800 dark:text-slate-200">
            {t.diagnostics.pingBtn} ({endpointPings.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-[11px] font-mono">
            {endpointPings.map((p) => (
              <div
                key={p.id}
                className={`rounded border px-2.5 py-2 ${
                  p.ok
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{p.path}</span>
                  <span className={p.ok ? 'text-emerald-500' : 'text-rose-500'}>
                    {p.statusCode ?? 'ERR'}
                  </span>
                </div>
                <div className="text-slate-500 mt-0.5 flex items-center justify-between">
                  <span className="font-sans truncate">{nav[p.module] || p.module}</span>
                  <span>{p.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upstream OSINT Sources Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          {t.diagnostics.upstreamTitle} ({sources.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500">
              <tr>
                <th className="py-2.5 px-3 font-medium text-start">{t.diagnostics.colSource}</th>
                <th className="py-2.5 px-3 font-medium text-start">{t.diagnostics.colStatus}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.diagnostics.colHttp}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.diagnostics.colRecords}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.diagnostics.colLatency}</th>
                <th className="py-2.5 px-3 font-medium text-start">{t.diagnostics.colCadence}</th>
                <th className="py-2.5 px-3 font-medium text-start">{t.diagnostics.colEndpoint}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sources.map((s) => (
                <tr key={s.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</div>
                    <div className="text-[11px] text-slate-500">{s.category}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono uppercase text-[11px]">
                    <span
                      className={
                        s.status === 'operational'
                          ? 'text-emerald-500 font-semibold'
                          : s.status === 'reference'
                          ? 'text-cyan-500 font-semibold'
                          : s.status === 'degraded'
                          ? 'text-amber-500 font-semibold'
                          : 'text-rose-500 font-semibold'
                      }
                    >
                      {translateStatus(s.status, lang)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {s.lastStatusCode ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono tabular-nums">{s.itemCount}</td>
                  <td className="py-2.5 px-3 text-end font-mono tabular-nums">
                    {s.latencyMs !== null ? `${s.latencyMs} ms` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {s.updateFrequency}
                    {s.cachedAgeSec !== undefined && (
                      <div className="text-[11px] text-slate-500 font-mono">{s.cachedAgeSec}s</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 max-w-md space-y-1">
                    <div className="font-mono text-[11px] text-slate-500 break-all">{s.endpoint}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">{s.limitations}</div>
                    {s.errorMessage && (
                      <div className="text-[11px] text-rose-500">{s.errorMessage}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Express Backend API Endpoints Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          {t.diagnostics.endpointsTitle} ({endpoints.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500">
              <tr>
                <th className="py-2 px-3 font-medium text-start">{t.diagnostics.colEndpointPath}</th>
                <th className="py-2 px-3 font-medium text-end">{t.diagnostics.colLastHttp}</th>
                <th className="py-2 px-3 font-medium text-end">{t.diagnostics.colLastLatency}</th>
                <th className="py-2 px-3 font-medium text-end">{t.diagnostics.colAvgLatency}</th>
                <th className="py-2 px-3 font-medium text-end">{t.diagnostics.colCalls}</th>
                <th className="py-2 px-3 font-medium text-end">{t.diagnostics.colErrors}</th>
                <th className="py-2 px-3 font-medium text-start">{t.diagnostics.colLastCalled}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {endpoints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 px-3 text-slate-500 text-center">
                    {t.diagnostics.noTelemetry}
                  </td>
                </tr>
              ) : (
                endpoints.map((ep) => (
                  <tr key={ep.path} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-mono tabular-nums text-[11px]">
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{ep.path}</td>
                    <td className={`py-2 px-3 text-end ${ep.lastStatusCode && ep.lastStatusCode >= 400 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {ep.lastStatusCode ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-end">{ep.lastLatencyMs !== null ? `${ep.lastLatencyMs} ms` : '—'}</td>
                    <td className="py-2 px-3 text-end">{ep.avgLatencyMs !== null ? `${ep.avgLatencyMs} ms` : '—'}</td>
                    <td className="py-2 px-3 text-end">{ep.requestCount}</td>
                    <td className={`py-2 px-3 text-end ${ep.errorCount > 0 ? 'text-rose-500' : ''}`}>{ep.errorCount}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {ep.lastCalledAt ? ep.lastCalledAt.replace('T', ' ').slice(0, 19) + 'Z' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Upstream Error Logs */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          {t.diagnostics.errorLogsTitle} ({recentErrorsList.length})
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {recentErrorsList.length === 0 ? (
            <div className="p-4 text-xs text-slate-500">{t.diagnostics.noErrors}</div>
          ) : (
            recentErrorsList.map((err, i) => (
              <div key={`${err.sourceId}-${err.timestamp}-${i}`} className="p-3 text-xs space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-500">{err.timestamp.replace('T', ' ').slice(0, 19)}Z</span>
                  <span className="font-sans font-semibold text-slate-900 dark:text-slate-100">{err.sourceName}</span>
                  {err.statusCode && <span className="text-rose-500">HTTP {err.statusCode}</span>}
                </div>
                <div className="text-rose-500">{err.message}</div>
                {err.endpoint && <div className="font-mono text-[10px] text-slate-500 break-all">{err.endpoint}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------- 4. SETTINGS VIEW ---------------- */
export const SettingsView: React.FC<{
  preferences: UserPreferences;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onClearCache: () => void;
}> = ({ preferences, onUpdatePreferences, onClearCache }) => {
  const { t } = useI18n();
  const [cacheCleared, setCacheCleared] = useState(false);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.settings.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.settings.subtitle}
          </p>
        </div>
        <PWAInstallButton />
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800 text-xs">
        <div className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.settings.langTitle}</div>
            <div className="text-slate-500 mt-0.5">{t.settings.langDesc}</div>
          </div>
          <select
            aria-label="Interface language"
            value={preferences.language}
            onChange={(e) => onUpdatePreferences({ language: e.target.value as SupportedLang })}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f1623] px-3 py-1.5"
          >
            <option value="en">English</option>
            <option value="ar">العربية (Arabic)</option>
            <option value="fr">Français (French)</option>
          </select>
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.settings.themeTitle}</div>
            <div className="text-slate-500 mt-0.5">{t.settings.themeDesc}</div>
          </div>
          <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 p-0.5">
            {(['dark', 'light'] as const).map((themeOpt) => (
              <button
                key={themeOpt}
                type="button"
                onClick={() => onUpdatePreferences({ theme: themeOpt })}
                className={`px-3 py-1 rounded ${
                  preferences.theme === themeOpt ? 'bg-cyan-600 text-white' : 'text-slate-500'
                }`}
              >
                {themeOpt === 'dark' ? t.settings.dark : t.settings.light}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.settings.refreshTitle}</div>
            <div className="text-slate-500 mt-0.5">{t.settings.refreshDesc}</div>
          </div>
          <select
            aria-label="Refresh interval"
            value={preferences.refreshIntervalSec}
            onChange={(e) => onUpdatePreferences({ refreshIntervalSec: Number(e.target.value) })}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f1623] px-3 py-1.5"
          >
            <option value={120}>{t.settings.every2m}</option>
            <option value={300}>{t.settings.every5m}</option>
            <option value={600}>{t.settings.every10m}</option>
            <option value={0}>{t.settings.manualOnly}</option>
          </select>
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.settings.aiTitle}</div>
            <div className="text-slate-500 mt-0.5">{t.settings.aiDesc}</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdatePreferences({ aiEnabled: !preferences.aiEnabled })}
            className={`px-3 py-1.5 rounded-md font-medium ${
              preferences.aiEnabled
                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {preferences.aiEnabled ? t.settings.aiOn : t.settings.aiOff}
          </button>
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.settings.cacheTitle}</div>
            <div className="text-slate-500 mt-0.5">{t.settings.cacheDesc}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClearCache();
              setCacheCleared(true);
              setTimeout(() => setCacheCleared(false), 3000);
            }}
            className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {cacheCleared ? t.settings.cacheCleared : t.settings.clearCache}
          </button>
        </div>
      </div>
    </div>
  );
};
