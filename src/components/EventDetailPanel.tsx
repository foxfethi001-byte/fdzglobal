import React from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Download,
  ExternalLink,
  Globe,
  MapPin,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { IntelEvent } from '../types/intelligence';
import {
  formatRelativeTime,
  translateCategory,
  translateConfidence,
  translateNature,
  translateRegion,
  translateSeverity,
  useI18n,
} from '../lib/i18n';

interface EventDetailPanelProps {
  event: IntelEvent | null;
  isSaved: boolean;
  onToggleSave: (ev: IntelEvent) => void;
  onClose?: () => void;
  onOpenCountry?: (countryCodeOrName: string) => void;
}

const CONF_COLORS: Record<IntelEvent['confidence'], string> = {
  high: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-rose-600 dark:text-rose-400',
};

const SEV_COLORS: Record<IntelEvent['severity'], string> = {
  critical: 'text-rose-600 dark:text-rose-400',
  high: 'text-orange-600 dark:text-orange-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-cyan-600 dark:text-cyan-400',
  info: 'text-slate-600 dark:text-slate-400',
};

export const EventDetailPanel: React.FC<EventDetailPanelProps> = ({
  event,
  isSaved,
  onToggleSave,
  onClose,
  onOpenCountry,
}) => {
  const { lang, t } = useI18n();

  if (!event) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400">
        <MapPin className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t.detail.emptyTitle}
        </p>
        <p className="mt-1 text-xs max-w-xs">
          {t.detail.emptySubtitle}
        </p>
      </div>
    );
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wih-event-${event.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const regionText = event.region ? translateRegion(event.region, lang) : '';

  return (
    <div className="flex flex-col h-full overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/80">
      {/* Header */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={`font-semibold uppercase tracking-wide ${SEV_COLORS[event.severity]}`}>
              {translateSeverity(event.severity, lang)}
            </span>
            <span className="text-slate-400" aria-hidden="true">/</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {translateCategory(event.category, lang)}
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {formatRelativeTime(event.publishedAt, lang)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSave(event)}
              title={isSaved ? t.detail.bookmarkRemove : t.detail.bookmarkAdd}
              className="p-1.5 rounded-md text-slate-500 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4 text-cyan-500" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={exportJson}
              title={t.detail.exportJson}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close detail panel"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
          {event.title}
        </h3>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {event.summary}
        </p>

        {event.country && onOpenCountry && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onOpenCountry(event.countryCode || event.country!)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              {t.detail.openCountryProfile}: {event.country}
            </button>
          </div>
        )}
      </div>

      {/* Telemetry & Geolocation */}
      <div className="p-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-slate-500 dark:text-slate-400">{t.detail.location}</div>
          <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
            {[event.country, regionText].filter(Boolean).join(' · ') || t.detail.unmapped}
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400">
            {t.detail.coordinates} ({event.geoPrecision})
          </div>
          <div className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100" dir="ltr">
            {event.lat !== null && event.lon !== null
              ? `${event.lat.toFixed(3)}, ${event.lon.toFixed(3)}`
              : t.detail.noCoords}
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400">{t.detail.publishedTime}</div>
          <div className="mt-0.5 font-mono tabular-nums text-slate-800 dark:text-slate-200" dir="ltr">
            {new Date(event.publishedAt).toISOString().replace('T', ' ').slice(0, 19)}Z
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400">{t.detail.collectedTime}</div>
          <div className="mt-0.5 font-mono tabular-nums text-slate-800 dark:text-slate-200" dir="ltr">
            {new Date(event.collectedAt).toISOString().replace('T', ' ').slice(0, 19)}Z
          </div>
        </div>
        {event.magnitude !== undefined && (
          <div>
            <div className="text-slate-500 dark:text-slate-400">{t.detail.magnitude}</div>
            <div className="mt-0.5 font-mono tabular-nums font-semibold text-cyan-600 dark:text-cyan-400" dir="ltr">
              M {event.magnitude.toFixed(1)}
            </div>
          </div>
        )}
        {event.depthKm !== undefined && (
          <div>
            <div className="text-slate-500 dark:text-slate-400">{t.detail.depth}</div>
            <div className="mt-0.5 font-mono tabular-nums text-slate-800 dark:text-slate-200" dir="ltr">
              {event.depthKm.toFixed(1)} km
            </div>
          </div>
        )}
      </div>

      {/* Provenance & Explainable Confidence */}
      <div className="p-4 space-y-2.5 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            {t.detail.provenanceConfidence}
          </span>
          <span className={`font-semibold ${CONF_COLORS[event.confidence]}`}>
            {translateConfidence(event.confidence, lang)} ({t.detail.confSuffix})
          </span>
        </div>

        <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t.detail.classification}: </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {translateNature(event.nature, lang)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t.detail.independentOrgs}: </span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              {event.independentOrgCount}
            </span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500 dark:text-slate-400">{t.detail.totalReports}: </span>
            <span className="font-mono tabular-nums">{event.sources.length}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
            {event.confidenceExplanation}
          </p>
        </div>

        {event.conflictingReports && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{t.detail.conflictingFlagged}</div>
              <p className="mt-0.5 leading-relaxed">{event.conflictingReports}</p>
            </div>
          </div>
        )}
      </div>

      {/* Original Sources List */}
      <div className="p-4 space-y-2.5">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {t.detail.supportingSources} ({event.sources.length})
        </div>
        <div className="space-y-2">
          {event.sources.map((src) => (
            <div
              key={src.id}
              className="rounded-md border border-slate-200 dark:border-slate-800 p-2.5 text-xs space-y-1 bg-white dark:bg-[#0f1623]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                  {src.organization}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  {formatRelativeTime(src.publishedAt, lang)}
                </span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-medium leading-snug">
                {src.title}
              </div>
              {src.snippet && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {src.snippet}
                </p>
              )}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span dir="ltr">
                  {t.detail.pubLabel}: {new Date(src.publishedAt).toISOString().slice(0, 16).replace('T', ' ')}Z
                </span>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                >
                  {t.detail.originalLink} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
