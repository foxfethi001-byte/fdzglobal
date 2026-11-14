import React, { useEffect, useState } from 'react';
import {
  Bot,
  Download,
  ExternalLink,
  Send,
  ShieldAlert,
} from 'lucide-react';
import type { AIBriefingReport, SupportedLang } from '../types/intelligence';
import { getSavedReports, saveReportLocally } from '../lib/storage';
import { translateConfidence, useI18n } from '../lib/i18n';

interface AIAnalystViewProps {
  aiEnabled: boolean;
  defaultLanguage: SupportedLang;
  preselectedScope?: { countryCode?: string; scopeLabel?: string } | null;
}

const SCOPE_PRESETS = [
  {
    labelEn: 'Global 24-Hour Digest',
    labelFr: 'Synthèse Mondiale 24h',
    labelAr: 'ملخص العالم خلال 24 ساعة',
    region: 'Global',
    range: '24h',
  },
  {
    labelEn: 'Global 7-Day Strategic Review',
    labelFr: 'Revue Stratégique 7 Jours',
    labelAr: 'المراجعة الاستراتيجية العالمية (7 أيام)',
    region: 'Global',
    range: '7d',
  },
  {
    labelEn: 'Algeria & Maghreb Briefing',
    labelFr: 'Briefing Algérie & Maghreb',
    labelAr: 'تقرير الجزائر والمغرب العربي',
    region: 'North Africa',
    range: '7d',
  },
  {
    labelEn: 'Sahel Security & Humanitarian',
    labelFr: 'Sécurité & Humanitaire Sahel',
    labelAr: 'الوضع الأمني والإنساني في الساحل',
    region: 'Sahel',
    range: '7d',
  },
  {
    labelEn: 'Middle East Escalation & Maritime',
    labelFr: 'Moyen-Orient & Sécurité Maritime',
    labelAr: 'تصعيد الشرق الأوسط والملاحة البحرية',
    region: 'Middle East',
    range: '24h',
  },
  {
    labelEn: 'Europe & Eastern Theater',
    labelFr: 'Europe & Théâtre Oriental',
    labelAr: 'أوروبا والمسرح الشرقي',
    region: 'Europe',
    range: '24h',
  },
  {
    labelEn: 'Asia-Pacific Situation Report',
    labelFr: 'Rapport Asie-Pacifique',
    labelAr: 'تقرير موقف آسيا والمحيط الهادئ',
    region: 'Asia-Pacific',
    range: '7d',
  },
];

export const AIAnalystView: React.FC<AIAnalystViewProps> = ({
  aiEnabled,
  defaultLanguage,
  preselectedScope,
}) => {
  const { lang, t } = useI18n();
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [language, setLanguage] = useState<SupportedLang>(defaultLanguage);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AIBriefingReport | null>(null);
  const [savedReports, setSavedReports] = useState<AIBriefingReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLanguage(defaultLanguage);
  }, [defaultLanguage]);

  useEffect(() => {
    getSavedReports().then(setSavedReports).catch(() => {});
  }, []);

  const getPresetLabel = (p: (typeof SCOPE_PRESETS)[number], targetLang: SupportedLang) =>
    targetLang === 'ar' ? p.labelAr : targetLang === 'fr' ? p.labelFr : p.labelEn;

  const runBriefing = async (opts?: { countryCode?: string; scope?: string; q?: string }) => {
    setLoading(true);
    setError(null);
    const preset = SCOPE_PRESETS[selectedPreset];
    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: opts?.scope || getPresetLabel(preset, language),
          region: opts?.countryCode ? undefined : preset.region,
          countryCode: opts?.countryCode,
          range: preset.range,
          language,
          aiEnabled,
          question: opts?.q,
        }),
      });
      const json = (await res.json()) as { report?: AIBriefingReport; error?: string };
      if (!res.ok || !json.report) throw new Error(json.error || 'Briefing failed');
      setReport(json.report);
      await saveReportLocally(json.report);
      const updated = await getSavedReports();
      setSavedReports(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (preselectedScope?.countryCode) {
      runBriefing({
        countryCode: preselectedScope.countryCode,
        scope: `${preselectedScope.scopeLabel || preselectedScope.countryCode} — ${t.country.situationReport}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedScope?.countryCode]);

  const exportMarkdown = (r: AIBriefingReport) => {
    const md = [
      `# ${r.title}`,
      `Generated: ${r.generatedAt} | Mode: ${r.mode} (${r.modelUsed}) | Language: ${r.language.toUpperCase()}`,
      '',
      `## ${t.ai.execSummary}`,
      r.executiveSummary,
      '',
      `## ${t.ai.keyDevs}`,
      ...r.keyDevelopments.map((k) => `- ${k}`),
      '',
      `## ${t.ai.geoLocs}`,
      r.geographicLocations.join(', ') || t.ai.noGeoTags,
      '',
      `## ${t.ai.infoGaps}`,
      ...r.informationGaps.map((g) => `- ${g}`),
      '',
      `## ${t.ai.contradictions}`,
      ...r.contradictoryReporting.map((c) => `- ${c}`),
      '',
      `## ${t.ai.confAssessment} (${r.confidenceAssessment.level.toUpperCase()})`,
      r.confidenceAssessment.explanation,
      '',
      `## ${t.ai.supportingSources}`,
      ...r.supportingSources.map((s) => `- [${s.organization}] ${s.title} (${s.publishedAt}) — ${s.url}`),
      '',
      `> ${r.disclaimer}`,
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wih-briefing-${r.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.ai.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.ai.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Report scope"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(Number(e.target.value))}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            {SCOPE_PRESETS.map((p, idx) => (
              <option key={p.labelEn} value={idx}>
                {getPresetLabel(p, lang)}
              </option>
            ))}
          </select>

          <select
            aria-label="Output language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLang)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1.5 text-xs"
          >
            <option value="en">English</option>
            <option value="ar">العربية (Arabic)</option>
            <option value="fr">Français (French)</option>
          </select>

          <button
            type="button"
            onClick={() => runBriefing()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3.5 py-1.5 text-xs font-medium transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            {loading ? t.ai.generating : t.ai.generate}
          </button>
        </div>
      </div>

      {/* Grounded Analyst Q&A Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) runBriefing({ q: question.trim(), scope: question.trim() });
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.ai.askPlaceholder}
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {t.ai.askBtn}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          {!report ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center text-xs text-slate-500">
              {t.ai.emptyPrompt}
            </div>
          ) : (
            <div
              dir={report.language === 'ar' ? 'rtl' : 'ltr'}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                    {report.mode === 'gemini' ? t.ai.aiMode : t.ai.ruleMode} · {report.modelUsed}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {report.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => exportMarkdown(report)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.ai.exportMd}
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{t.ai.execSummary}</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{report.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{t.ai.keyDevs}</h4>
                <ul className="space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                  {report.keyDevelopments.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{t.ai.geoLocs}</h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {report.geographicLocations.join(' · ') || t.ai.noGeoTags}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    {t.ai.confAssessment} ({translateConfidence(report.confidenceAssessment.level, report.language)})
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">{report.confidenceAssessment.explanation}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{t.ai.infoGaps}</h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                    {report.informationGaps.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-1">{t.ai.contradictions}</h4>
                  <ul className="space-y-1 text-amber-800/90 dark:text-amber-200/80 list-disc list-inside">
                    {report.contradictoryReporting.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  {t.ai.supportingSources} ({report.supportingSources.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {report.supportingSources.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-[11px] border-b border-slate-100 dark:border-slate-800/60 pb-1">
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        <strong className="text-cyan-600 dark:text-cyan-400">{s.organization}</strong> — {s.title}
                      </span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 dark:text-cyan-400 hover:underline shrink-0 inline-flex items-center gap-1"
                      >
                        {t.ai.link} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{report.disclaimer}</span>
              </div>
            </div>
          )}
        </div>

        {/* Saved Briefings History */}
        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
            {t.ai.savedReportsTitle} ({savedReports.length})
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800/80 max-h-[520px] overflow-y-auto">
            {savedReports.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">{t.ai.savedReportsEmpty}</div>
            ) : (
              savedReports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReport(r)}
                  className="w-full text-start p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 space-y-1 text-xs"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">{r.title}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {r.mode} · {r.language.toUpperCase()} · {new Date(r.generatedAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
