import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Filter,
  Globe2,
  ShieldAlert,
} from 'lucide-react';
import type {
  AircraftTrack,
  IntelCategory,
  IntelEvent,
  SeverityLevel,
  VesselTrack,
} from '../types/intelligence';
import { GlobalIntelMap, type MapLayerStatus } from './GlobalIntelMap';
import { EventDetailPanel } from './EventDetailPanel';
import {
  formatRelativeTime,
  translateCategory,
  translateConfidence,
  translateNature,
  translateRegion,
  translateSeverity,
  useI18n,
} from '../lib/i18n';

interface OverviewProps {
  events: IntelEvent[];
  layers: MapLayerStatus[];
  visibleLayers: IntelCategory[];
  onToggleLayer: (id: IntelCategory) => void;
  mapStyle: 'dark' | 'osm' | 'topo';
  onChangeMapStyle: (style: 'dark' | 'osm' | 'topo') => void;
  selectedEvent: IntelEvent | null;
  onSelectEvent: (ev: IntelEvent) => void;
  savedIds: Set<string>;
  onToggleSave: (ev: IntelEvent) => void;
  onOpenCountry: (codeOrName: string) => void;
  aircraft: AircraftTrack[];
  vessels: VesselTrack[];
}

const PRIORITY_REGIONS = [
  'North Africa',
  'Sahel',
  'Middle East',
  'Europe',
  'United States',
  'Asia-Pacific',
];

export const GlobalOverviewView: React.FC<OverviewProps> = ({
  events,
  layers,
  visibleLayers,
  onToggleLayer,
  mapStyle,
  onChangeMapStyle,
  selectedEvent,
  onSelectEvent,
  savedIds,
  onToggleSave,
  onOpenCountry,
  aircraft,
  vessels,
}) => {
  const { lang, t } = useI18n();
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const liveEvents = useMemo(
    () => events.filter((e) => e.nature !== 'public_reference'),
    [events]
  );

  const filteredFeed = useMemo(() => {
    return liveEvents.filter((e) => {
      if (regionFilter !== 'all' && e.region !== regionFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      return true;
    });
  }, [liveEvents, regionFilter, severityFilter]);

  const metrics = useMemo(() => {
    const highConf = liveEvents.filter((e) => e.confidence === 'high').length;
    const hazards = liveEvents.filter((e) =>
      ['earthquake', 'wildfire', 'flood', 'severe_weather', 'volcano'].includes(e.category)
    ).length;
    const security = liveEvents.filter((e) =>
      ['armed_conflict', 'military_incident', 'airstrike_explosion', 'terrorism', 'political_unrest'].includes(e.category)
    ).length;
    const cyber = liveEvents.filter((e) => e.category === 'cyber_incident').length;
    return { total: liveEvents.length, highConf, hazards, security, cyber };
  }, [liveEvents]);

  const regionStats = useMemo(() => {
    return PRIORITY_REGIONS.map((reg) => {
      const subset = liveEvents.filter((e) => e.region === reg);
      const high = subset.filter((e) => e.severity === 'critical' || e.severity === 'high').length;
      return { region: reg, total: subset.length, high };
    });
  }, [liveEvents]);

  return (
    <div className="space-y-4">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.overview.liveEvents}</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.total}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {metrics.highConf} {t.overview.highConfRecords}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.overview.conflictReports}</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {metrics.security}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {t.overview.multiSourceGdelt}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.overview.naturalHazards}</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {metrics.hazards}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            USGS · NASA EONET · FIRMS · GDACS
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.overview.cyberAdvisories}</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {metrics.cyber}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {t.overview.cisaReporting}
          </div>
        </div>
      </div>

      {/* Regional Activity Summary */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {t.overview.regionalBreakdown}
          </span>
          <span className="text-[11px] text-slate-500">
            {t.overview.clickRegionFilter}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {regionStats.map((rs) => {
            const active = regionFilter === rs.region;
            return (
              <button
                key={rs.region}
                type="button"
                onClick={() => setRegionFilter(active ? 'all' : rs.region)}
                className={`text-start rounded-md border p-2.5 transition-colors ${
                  active
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {translateRegion(rs.region, lang)}
                </div>
                <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{rs.total}</span>
                  <span className={rs.high > 0 ? 'text-rose-500 text-[11px]' : 'text-slate-500 text-[11px]'}>
                    {rs.high} {t.overview.highCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + Live Feed & Provenance Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-7">
          <GlobalIntelMap
            events={events}
            layers={layers}
            visibleLayers={visibleLayers}
            onToggleLayer={onToggleLayer}
            mapStyle={mapStyle}
            onChangeMapStyle={onChangeMapStyle}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={onSelectEvent}
            onSelectCountryName={onOpenCountry}
            aircraft={aircraft}
            vessels={vessels}
            heightClass="h-[540px]"
          />
        </div>

        <div className="xl:col-span-5 flex flex-col rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] h-[540px] overflow-hidden">
          {selectedEvent ? (
            <EventDetailPanel
              event={selectedEvent}
              isSaved={savedIds.has(selectedEvent.id)}
              onToggleSave={onToggleSave}
              onClose={() => onSelectEvent(null as unknown as IntelEvent)}
              onOpenCountry={onOpenCountry}
            />
          ) : (
            <>
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t.overview.liveFeedTitle} ({filteredFeed.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Filter severity"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f1623] px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">{t.overview.allSeverities}</option>
                    <option value="critical">{translateSeverity('critical', lang)}</option>
                    <option value="high">{translateSeverity('high', lang)}</option>
                    <option value="medium">{translateSeverity('medium', lang)}</option>
                    <option value="low">{translateSeverity('low', lang)}</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredFeed.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {t.overview.noFilterMatch}
                  </div>
                ) : (
                  filteredFeed.slice(0, 60).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelectEvent(ev)}
                      className="w-full text-start p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`font-semibold uppercase ${
                              ev.severity === 'critical'
                                ? 'text-rose-500'
                                : ev.severity === 'high'
                                ? 'text-orange-500'
                                : ev.severity === 'medium'
                                ? 'text-amber-500'
                                : 'text-cyan-500'
                            }`}
                          >
                            {translateSeverity(ev.severity, lang)}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {translateCategory(ev.category, lang)}
                          </span>
                          {ev.country && (
                            <>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 dark:text-slate-400 truncate">{ev.country}</span>
                            </>
                          )}
                        </div>
                        <span className="font-mono tabular-nums text-slate-500 shrink-0">
                          {formatRelativeTime(ev.publishedAt, lang)}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                        {ev.title}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{ev.sources[0]?.organization}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {ev.independentOrgCount} {t.overview.orgsCount}
                        </span>
                        <span>·</span>
                        <span>
                          {translateConfidence(ev.confidence, lang)} ({t.overview.confSuffix})
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface DomainFeedProps {
  title: string;
  subtitle: string;
  categories: IntelCategory[];
  events: IntelEvent[];
  selectedEvent: IntelEvent | null;
  onSelectEvent: (ev: IntelEvent) => void;
  savedIds: Set<string>;
  onToggleSave: (ev: IntelEvent) => void;
  onOpenCountry: (codeOrName: string) => void;
  disclaimer?: string;
}

export const DomainFeedView: React.FC<DomainFeedProps> = ({
  title,
  subtitle,
  categories,
  events,
  selectedEvent,
  onSelectEvent,
  savedIds,
  onToggleSave,
  onOpenCountry,
  disclaimer,
}) => {
  const { lang, t } = useI18n();
  const [catFilter, setCatFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [langFilter, setLangFilter] = useState<string>('all');
  const [natureFilter, setNatureFilter] = useState<string>('all');

  const domainEvents = useMemo(() => {
    const catSet = new Set(categories);
    return events.filter((e) => {
      if (!catSet.has(e.category)) return false;
      if (catFilter !== 'all' && e.category !== catFilter) return false;
      if (sevFilter !== 'all' && e.severity !== sevFilter) return false;
      if (natureFilter !== 'all' && e.nature !== natureFilter) return false;
      if (langFilter !== 'all' && !e.sources.some((s) => s.language === langFilter)) return false;
      return true;
    });
  }, [events, categories, catFilter, sevFilter, langFilter, natureFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            aria-label="Category filter"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            <option value="all">{t.feeds.allCategories} ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {translateCategory(c, lang)}
              </option>
            ))}
          </select>

          <select
            aria-label="Severity filter"
            value={sevFilter}
            onChange={(e) => setSevFilter(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            <option value="all">{t.feeds.allSeverities}</option>
            {(['critical', 'high', 'medium', 'low', 'info'] as SeverityLevel[]).map((s) => (
              <option key={s} value={s}>{translateSeverity(s, lang)}</option>
            ))}
          </select>

          <select
            aria-label="Classification filter"
            value={natureFilter}
            onChange={(e) => setNatureFilter(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            <option value="all">{t.feeds.allNatures}</option>
            <option value="real_observation">{translateNature('real_observation', lang)}</option>
            <option value="official_statement">{translateNature('official_statement', lang)}</option>
            <option value="media_report">{translateNature('media_report', lang)}</option>
            <option value="public_reference">{translateNature('public_reference', lang)}</option>
          </select>

          <select
            aria-label="Language filter"
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            <option value="all">{t.feeds.allLanguages}</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </div>

      {disclaimer && (
        <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-500 shrink-0" />
          <span>{disclaimer}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800/80 max-h-[640px] overflow-y-auto">
          {domainEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Globe2 className="w-7 h-7 mx-auto mb-2 opacity-40" />
              {t.feeds.noRecords}
            </div>
          ) : (
            domainEvents.map((ev) => {
              const active = selectedEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className={`p-3.5 cursor-pointer transition-colors space-y-1.5 ${
                    active
                      ? 'bg-cyan-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`font-semibold uppercase ${
                          ev.severity === 'critical'
                            ? 'text-rose-500'
                            : ev.severity === 'high'
                            ? 'text-orange-500'
                            : ev.severity === 'medium'
                            ? 'text-amber-500'
                            : 'text-cyan-500'
                        }`}
                      >
                        {translateSeverity(ev.severity, lang)}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {translateCategory(ev.category, lang)}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">
                        {translateNature(ev.nature, lang)}
                      </span>
                      {ev.country && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{ev.country}</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono tabular-nums text-slate-500 shrink-0">
                      {formatRelativeTime(ev.publishedAt, lang)}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                    {ev.title}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {ev.summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>{ev.sources.map((s) => s.organization).slice(0, 3).join(', ')}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {ev.independentOrgCount} {t.overview.orgsCount} / {ev.sources.length} {t.feeds.reportsCount}
                      </span>
                      {ev.conflictingReports && (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                          <AlertTriangle className="w-3 h-3" /> {t.feeds.conflictingClaims}
                        </span>
                      )}
                    </div>
                    {ev.sources[0]?.url && (
                      <a
                        href={ev.sources[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        {t.feeds.sourceLink} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="xl:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] h-[640px] overflow-hidden">
          <EventDetailPanel
            event={selectedEvent}
            isSaved={selectedEvent ? savedIds.has(selectedEvent.id) : false}
            onToggleSave={onToggleSave}
            onOpenCountry={onOpenCountry}
          />
        </div>
      </div>
    </div>
  );
};
