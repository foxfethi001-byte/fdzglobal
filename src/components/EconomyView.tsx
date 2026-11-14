import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import type { EconomicIndicator } from '../types/intelligence';
import { formatRelativeTime, useI18n } from '../lib/i18n';

export const EconomyView: React.FC = () => {
  const { lang, t } = useI18n();
  const [indicators, setIndicators] = useState<EconomicIndicator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<string>('all');

  const loadEconomy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/economy');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { indicators: EconomicIndicator[] };
      setIndicators(json.indicators ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load economic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEconomy();
  }, []);

  const filtered = indicators.filter((i) => catFilter === 'all' || i.category === catFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.economy.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.economy.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-900 text-xs">
            {(['all', 'energy', 'metals', 'index', 'currency'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatFilter(c)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  catFilter === c
                    ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 font-medium'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.economy.categories[c]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadEconomy}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t.economy.refresh}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filtered.map((item) => {
          const isUp = (item.changePct ?? 0) >= 0;
          const catLabel =
            t.economy.categories[item.category as keyof typeof t.economy.categories] ?? item.category;
          return (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-col justify-between space-y-2.5"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300" dir="ltr">
                    {item.symbol}
                  </span>
                  <span className="uppercase">{catLabel}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                  {item.name}
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                {item.value !== null ? (
                  <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100" dir="ltr">
                    {item.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                    <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-rose-500">{t.economy.unavailable}</div>
                )}

                {item.changePct !== undefined && item.changePct !== null && (
                  <span
                    dir="ltr"
                    className={`inline-flex items-center gap-0.5 text-xs font-mono tabular-nums font-medium ${
                      isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isUp ? '+' : ''}
                    {item.changePct.toFixed(2)}%
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.source}</span>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 dark:text-cyan-400 hover:underline shrink-0 ms-2"
                    aria-label={`Open ${item.source}`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <span>{t.economy.observed}: {formatRelativeTime(item.observedAt, lang)}</span>
                  <span>{item.updateFrequency}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
