import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Anchor,
  Plane,
  RefreshCw,
  Ship,
} from 'lucide-react';
import type { AircraftTrack, IntelEvent, VesselTrack } from '../types/intelligence';
import { formatRelativeTime, translateStatus, useI18n } from '../lib/i18n';

const AVIATION_BBOXES = [
  {
    labelEn: 'Mediterranean & North Africa',
    labelFr: 'Méditerranée & Afrique du Nord',
    labelAr: 'المتوسط وشمال أفريقيا',
    lamin: 22,
    lomin: -12,
    lamax: 46,
    lomax: 38,
  },
  {
    labelEn: 'Europe & Black Sea',
    labelFr: 'Europe & Mer Noire',
    labelAr: 'أوروبا والبحر الأسود',
    lamin: 40,
    lomin: -10,
    lamax: 62,
    lomax: 44,
  },
  {
    labelEn: 'Middle East & Red Sea',
    labelFr: 'Moyen-Orient & Mer Rouge',
    labelAr: 'الشرق الأوسط والبحر الأحمر',
    lamin: 12,
    lomin: 30,
    lamax: 38,
    lomax: 60,
  },
  {
    labelEn: 'North America East',
    labelFr: 'Amérique du Nord Est',
    labelAr: 'شرق أمريكا الشمالية',
    lamin: 24,
    lomin: -95,
    lamax: 50,
    lomax: -65,
  },
  {
    labelEn: 'East Asia / Taiwan Strait',
    labelFr: 'Asie de l’Est / Détroit de Taïwan',
    labelAr: 'شرق آسيا / مضيق تايوان',
    lamin: 18,
    lomin: 110,
    lamax: 42,
    lomax: 145,
  },
];

export const AviationView: React.FC<{
  onTracksLoaded?: (tracks: AircraftTrack[]) => void;
}> = ({ onTracksLoaded }) => {
  const { lang, t } = useI18n();
  const [bboxIdx, setBboxIdx] = useState(0);
  const [tracks, setTracks] = useState<AircraftTrack[]>([]);
  const [status, setStatus] = useState<'operational' | 'degraded' | 'unavailable'>('operational');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const loadAviation = async (idx = bboxIdx) => {
    setLoading(true);
    const b = AVIATION_BBOXES[idx];
    try {
      const res = await fetch(`/api/aviation?lamin=${b.lamin}&lomin=${b.lomin}&lamax=${b.lamax}&lomax=${b.lomax}`);
      const json = (await res.json()) as {
        tracks: AircraftTrack[];
        status: 'operational' | 'degraded' | 'unavailable';
        sourceNote: string;
      };
      setTracks(json.tracks ?? []);
      setStatus(json.status);
      setNote(json.sourceNote);
      onTracksLoaded?.(json.tracks ?? []);
    } catch (err) {
      setStatus('unavailable');
      setNote(err instanceof Error ? err.message : 'Failed to fetch aviation telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAviation(bboxIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxIdx]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.aviation.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.aviation.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Select aviation bounding box"
            value={bboxIdx}
            onChange={(e) => setBboxIdx(Number(e.target.value))}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            {AVIATION_BBOXES.map((b, i) => (
              <option key={b.labelEn} value={i}>
                {lang === 'ar' ? b.labelAr : lang === 'fr' ? b.labelFr : b.labelEn}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadAviation(bboxIdx)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t.aviation.refresh}
          </button>
        </div>
      </div>

      <div className={`rounded-md border p-3 text-xs flex items-start gap-2 ${
        status === 'operational'
          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
          : status === 'degraded'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
      }`}>
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold uppercase me-2">
            {t.aviation.statusLabel}: {translateStatus(status, lang)}
          </span>
          <span>{note || t.aviation.querying}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-3 font-medium text-start">{t.aviation.callsign}</th>
                <th className="py-2.5 px-3 font-medium text-start">{t.aviation.originFeed}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.aviation.coordinates}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.aviation.altitude}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.aviation.speed}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.aviation.heading}</th>
                <th className="py-2.5 px-3 font-medium text-end">{t.aviation.contact}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {tracks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <Plane className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    {loading ? t.aviation.loading : t.aviation.empty}
                  </td>
                </tr>
              ) : (
                tracks.map((track) => (
                  <tr key={`${track.icao24}-${track.callsign}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100" dir="ltr">
                      {track.callsign} <span className="text-slate-500">/ {track.icao24}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                      {track.originCountry} · {track.source}
                    </td>
                    <td className="py-2 px-3 text-end font-mono tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">
                      {track.lat.toFixed(2)}, {track.lon.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-end font-mono tabular-nums" dir="ltr">
                      {track.altitudeM !== null ? `${track.altitudeM} m` : (track.onGround ? 'GND' : '—')}
                    </td>
                    <td className="py-2 px-3 text-end font-mono tabular-nums" dir="ltr">
                      {track.velocityMs !== null ? `${track.velocityMs} m/s` : '—'}
                    </td>
                    <td className="py-2 px-3 text-end font-mono tabular-nums" dir="ltr">
                      {track.headingDeg !== null ? `${track.headingDeg}°` : '—'}
                    </td>
                    <td className="py-2 px-3 text-end font-mono tabular-nums text-slate-500">
                      {formatRelativeTime(track.lastContact, lang)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const MaritimeView: React.FC<{
  events: IntelEvent[];
  onSelectEvent: (ev: IntelEvent) => void;
  onVesselsLoaded?: (vessels: VesselTrack[]) => void;
}> = ({ events, onSelectEvent, onVesselsLoaded }) => {
  const { lang, t } = useI18n();
  const [vessels, setVessels] = useState<VesselTrack[]>([]);
  const [status, setStatus] = useState<'operational' | 'unavailable'>('operational');
  const [note, setNote] = useState('');
  const [globalNote, setGlobalNote] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMaritime = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maritime');
      const json = (await res.json()) as {
        vessels: VesselTrack[];
        status: 'operational' | 'unavailable';
        sourceNote: string;
        globalAisNote: string;
      };
      setVessels(json.vessels ?? []);
      setStatus(json.status);
      setNote(json.sourceNote);
      setGlobalNote(json.globalAisNote);
      onVesselsLoaded?.(json.vessels ?? []);
    } catch (err) {
      setStatus('unavailable');
      setNote(err instanceof Error ? err.message : 'Failed to fetch maritime telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaritime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chokepoints = events.filter((e) => e.category === 'port_chokepoint');
  const incidents = events.filter((e) => e.category === 'maritime');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.maritime.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.maritime.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={loadMaritime}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t.maritime.refreshAis}
        </button>
      </div>

      {/* Honest Coverage Disclosure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300">
          <div className="font-semibold">{t.maritime.globalUnavailableTitle}</div>
          <p className="mt-1 leading-relaxed">
            {lang === 'ar' || lang === 'fr' ? t.maritime.globalUnavailableNote : globalNote || t.maritime.globalUnavailableNote}
          </p>
        </div>
        <div className={`rounded-md border p-3 ${
          status === 'operational'
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300'
            : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="font-semibold">
            {t.maritime.regionalTitle}: {translateStatus(status, lang)}
          </div>
          <p className="mt-1 leading-relaxed">{note}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Chokepoints & Maritime Incidents */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <Anchor className="w-3.5 h-3.5 text-cyan-500" />
                {t.maritime.chokepointsTitle} ({chokepoints.length})
              </span>
              <span className="text-[11px] font-normal text-slate-500">{t.maritime.staticRef}</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
              {chokepoints.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => onSelectEvent(cp)}
                  className="w-full text-start p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 space-y-0.5"
                >
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{cp.title}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums" dir="ltr">
                    {cp.country} · {cp.lat?.toFixed(2)}, {cp.lon?.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
              {t.maritime.incidentsTitle} ({incidents.length})
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800/80 max-h-60 overflow-y-auto">
              {incidents.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">{t.maritime.noIncidents}</div>
              ) : (
                incidents.map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => onSelectEvent(inc)}
                    className="w-full text-start p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 space-y-1"
                  >
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{inc.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {inc.sources[0]?.organization} · {formatRelativeTime(inc.publishedAt, lang)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Live Regional AIS Vessel Table */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-teal-400" />
              {t.maritime.vesselsTitle} ({vessels.length})
            </span>
            <span className="text-[11px] font-normal text-slate-500">Digitraffic Finland</span>
          </div>
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-xs text-start">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500">
                <tr>
                  <th className="py-2 px-3 font-medium text-start">MMSI</th>
                  <th className="py-2 px-3 font-medium text-end">{t.aviation.coordinates}</th>
                  <th className="py-2 px-3 font-medium text-end">SOG (kn)</th>
                  <th className="py-2 px-3 font-medium text-end">COG</th>
                  <th className="py-2 px-3 font-medium text-end">{t.aviation.contact}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {vessels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      {loading ? t.maritime.loading : t.maritime.empty}
                    </td>
                  </tr>
                ) : (
                  vessels.map((v) => (
                    <tr key={v.mmsi} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100" dir="ltr">{v.mmsi}</td>
                      <td className="py-2 px-3 text-end font-mono tabular-nums" dir="ltr">{v.lat.toFixed(3)}, {v.lon.toFixed(3)}</td>
                      <td className="py-2 px-3 text-end font-mono tabular-nums" dir="ltr">{v.sogKnots !== null ? `${v.sogKnots} kn` : '—'}</td>
                      <td className="py-2 px-3 text-end font-mono tabular-nums" dir="ltr">{v.cogDeg !== null ? `${v.cogDeg}°` : '—'}</td>
                      <td className="py-2 px-3 text-end font-mono tabular-nums text-slate-500">{formatRelativeTime(v.timestamp, lang)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
