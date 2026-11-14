import React, { useEffect, useState } from 'react';
import {
  FileText,
  Globe,
  Star,
} from 'lucide-react';
import type { CountryProfile, IntelEvent } from '../types/intelligence';
import {
  formatRelativeTime,
  translateCategory,
  translateNature,
  translateRegion,
  useI18n,
} from '../lib/i18n';

interface RegionDef {
  id: string;
  name: string;
  description: string;
  center: [number, number];
  zoom: number;
  countryCodes: string[];
  keywords: string[];
}

const REGION_AR_NAMES: Record<string, string> = {
  algeria: 'الجزائر',
  north_africa: 'شمال أفريقيا',
  sahel: 'الساحل',
  middle_east: 'الشرق الأوسط',
  europe: 'أوروبا',
  usa: 'الولايات المتحدة',
  asia_pacific: 'آسيا والمحيط الهادئ',
};

interface CountryRegionViewProps {
  initialCode?: string;
  events: IntelEvent[];
  favoriteCountries: string[];
  onToggleFavoriteCountry: (cca3: string) => void;
  onSelectEvent: (ev: IntelEvent) => void;
  onGenerateCountryReport: (countryCode: string, countryName: string) => void;
}

export const CountryRegionView: React.FC<CountryRegionViewProps> = ({
  initialCode = 'DZA',
  events,
  favoriteCountries,
  onToggleFavoriteCountry,
  onSelectEvent,
  onGenerateCountryReport,
}) => {
  const { lang, t } = useI18n();
  const [countries, setCountries] = useState<CountryProfile[]>([]);
  const [regions, setRegions] = useState<RegionDef[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>(initialCode);
  const [activeRegionId, setActiveRegionId] = useState<string>('algeria');
  const [profileData, setProfileData] = useState<{
    profile: CountryProfile;
    macro: {
      gdpUsd?: { value: number; year: string };
      inflationPct?: { value: number; year: string };
      source: string;
    };
    events: IntelEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/countries')
      .then((r) => r.json())
      .then((d: { countries: CountryProfile[]; regions: RegionDef[] }) => {
        setCountries(d.countries ?? []);
        setRegions(d.regions ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialCode) setSelectedCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (!selectedCode) return;
    setLoading(true);
    fetch(`/api/countries/${encodeURIComponent(selectedCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setProfileData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCode]);

  const activeRegion = regions.find((r) => r.id === activeRegionId) ?? regions[0];
  const regionEvents = activeRegion
    ? events.filter((e) => {
        const codes = new Set(activeRegion.countryCodes);
        return (
          (e.countryCode && codes.has(e.countryCode)) ||
          e.region === activeRegion.name ||
          activeRegion.keywords.some((kw) => e.title.toLowerCase().includes(kw))
        );
      })
    : [];

  return (
    <div className="space-y-5">
      {/* Priority Regional Dashboards */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.country.regionalTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.country.regionalSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActiveRegionId(r.id);
                  if (r.countryCodes[0]) setSelectedCode(r.countryCodes[0]);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  activeRegionId === r.id
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40'
                    : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {lang === 'ar'
                  ? REGION_AR_NAMES[r.id] ?? translateRegion(r.name, lang)
                  : translateRegion(r.name, lang)}
              </button>
            ))}
          </div>
        </div>

        {activeRegion && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300">{activeRegion.description}</span>
            <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400 shrink-0">
              {regionEvents.length} {t.country.correlatedInTheater}
            </span>
          </div>
        )}
      </div>

      {/* Country Selector & Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.country.profileLabel}:
          </span>
          <select
            aria-label="Select country"
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs font-medium"
          >
            {countries.map((c) => (
              <option key={c.cca3} value={c.cca3}>
                {c.name} ({c.cca3}) — {translateRegion(c.region, lang)}
              </option>
            ))}
          </select>
        </div>

        {profileData && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavoriteCountry(profileData.profile.cca3)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  favoriteCountries.includes(profileData.profile.cca3)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-400'
                }`}
              />
              {favoriteCountries.includes(profileData.profile.cca3)
                ? t.country.savedCountry
                : t.country.saveCountry}
            </button>
            <button
              type="button"
              onClick={() => onGenerateCountryReport(profileData.profile.cca3, profileData.profile.name)}
              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {t.country.situationReport}
            </button>
          </div>
        )}
      </div>

      {loading && !profileData ? (
        <div className="p-8 text-center text-xs text-slate-500">{t.country.loading}</div>
      ) : profileData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Country Overview & Macro */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3 text-xs">
              <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {profileData.profile.name}
                </h3>
                <span className="font-mono text-slate-500" dir="ltr">
                  {profileData.profile.cca3} / {profileData.profile.cca2}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="text-slate-500">{t.country.capital}</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{profileData.profile.capital}</div>
                </div>
                <div>
                  <div className="text-slate-500">{t.country.region}</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {translateRegion(profileData.profile.region, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{t.country.population}</div>
                  <div className="font-mono tabular-nums font-medium">{profileData.profile.population.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-500">{t.country.area}</div>
                  <div className="font-mono tabular-nums font-medium" dir="ltr">
                    {profileData.profile.areaKm2.toLocaleString()} km²
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{t.country.languages}</div>
                  <div className="font-medium">{profileData.profile.languages.join(', ')}</div>
                </div>
                <div>
                  <div className="text-slate-500">{t.country.currencies}</div>
                  <div className="font-mono">{profileData.profile.currencies.join(', ')}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-slate-500">{t.country.landBorders}</div>
                <div className="mt-0.5 font-mono text-slate-700 dark:text-slate-300">
                  {profileData.profile.borders.length > 0
                    ? profileData.profile.borders.join(' · ')
                    : t.country.islandNone}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2.5 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {t.country.macroTitle} ({profileData.macro.source})
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-slate-500">{t.country.gdp}</div>
                  <div className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100" dir="ltr">
                    {profileData.macro.gdpUsd
                      ? `$${(profileData.macro.gdpUsd.value / 1e9).toFixed(1)}B (${profileData.macro.gdpUsd.year})`
                      : t.country.unavailable}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{t.country.inflation}</div>
                  <div className="mt-0.5 font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400" dir="ltr">
                    {profileData.macro.inflationPct
                      ? `${profileData.macro.inflationPct.value}% (${profileData.macro.inflationPct.year})`
                      : t.country.unavailable}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Country Events & Infrastructure */}
          <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
              <span>
                {t.country.activityTitle} ({profileData.events.length})
              </span>
              <span className="text-[11px] font-normal text-slate-500">{t.country.windowNote}</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800/80 max-h-[520px] overflow-y-auto">
              {profileData.events.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {t.country.noActivity}
                </div>
              ) : (
                profileData.events.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onSelectEvent(ev)}
                    className="w-full text-start p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                        {translateCategory(ev.category, lang)} · {translateNature(ev.nature, lang)}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {formatRelativeTime(ev.publishedAt, lang)}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {ev.title}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {ev.summary}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
