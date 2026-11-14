import { GoogleGenAI, Type } from '@google/genai';
import { FREE_GEMINI_MODELS, keyManager } from './keyManager.ts';
import type {
  AIBriefingReport,
  IntelEvent,
  SupportedLang,
} from '../src/types/intelligence.ts';

function buildGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return keyManager.isGeminiConfigured();
}

function buildRuleBasedBriefing(
  scope: string,
  events: IntelEvent[],
  language: SupportedLang,
  reasonNote?: string
): AIBriefingReport {
  const liveEvents = events.filter((e) => e.nature !== 'public_reference');
  const sorted = [...liveEvents].sort((a, b) => {
    const sevOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return (sevOrder[b.severity] - sevOrder[a.severity]) || (b.independentOrgCount - a.independentOrgCount);
  });
  const top = sorted.slice(0, 8);

  const byCat = new Map<string, number>();
  const countries = new Set<string>();
  const conflicts: string[] = [];
  const gaps: string[] = [];

  for (const ev of liveEvents) {
    byCat.set(ev.category, (byCat.get(ev.category) ?? 0) + 1);
    if (ev.country) countries.add(ev.country);
    if (ev.conflictingReports) conflicts.push(`${ev.title}: ${ev.conflictingReports}`);
  }

  const singleSourceCount = liveEvents.filter((e) => e.independentOrgCount <= 1 && e.nature === 'media_report').length;
  const ungeolocatedCount = liveEvents.filter((e) => e.lat === null || e.lon === null).length;

  if (singleSourceCount > 0) {
    gaps.push(`${singleSourceCount} media-reported event(s) currently rely on a single reporting organization and lack independent corroboration.`);
  }
  if (ungeolocatedCount > 0) {
    gaps.push(`${ungeolocatedCount} event(s) could not be mapped to exact coordinates from headline text.`);
  }
  if (liveEvents.length === 0) {
    gaps.push('No live events matched this scope in the selected timeframe.');
  }

  const topCatSummary = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c, n]) => `${c.replace(/_/g, ' ')} (${n})`)
    .join(', ');

  const langTitles: Record<SupportedLang, string> = {
    en: `Analytical Briefing — ${scope}`,
    fr: `Note d'analyse — ${scope}`,
    ar: `موجز تحليلي — ${scope}`,
  };

  const execTemplates: Record<SupportedLang, string> = {
    en: `Rule-based synthesis across ${liveEvents.length} retrieved open-source records for "${scope}". Primary activity clusters: ${topCatSummary || 'none observed'}. ${reasonNote ? `(${reasonNote})` : ''}`,
    fr: `Synthèse algorithmique basée sur ${liveEvents.length} observations open-source pour « ${scope} ». Catégories principales : ${topCatSummary || 'aucune'}. ${reasonNote ? `(${reasonNote})` : ''}`,
    ar: `ملخص تحليلي آلي يستند إلى ${liveEvents.length} سجلاً مفتوح المصدر ضمن نطاق "${scope}". أبرز الفئات المرصودة: ${topCatSummary || 'لا توجد أحداث'}. ${reasonNote ? `(${reasonNote})` : ''}`,
  };

  const highConfCount = liveEvents.filter((e) => e.confidence === 'high').length;
  const level = highConfCount >= Math.max(3, liveEvents.length * 0.4) ? 'high' : liveEvents.length > 0 ? 'medium' : 'low';

  return {
    id: `brief-${Date.now()}`,
    title: langTitles[language],
    scope,
    language,
    generatedAt: new Date().toISOString(),
    mode: 'rule_based_fallback',
    modelUsed: 'Deterministic Rule-Based Correlator (100% Free Local Engine)',
    executiveSummary: execTemplates[language],
    keyDevelopments: top.map((e) => `[${e.severity.toUpperCase()} · ${e.independentOrgCount} org(s)] ${e.title} (${e.country ?? e.region ?? 'Global'})`),
    geographicLocations: Array.from(countries).slice(0, 12),
    supportingSources: top.flatMap((e) =>
      e.sources.slice(0, 2).map((s) => ({
        organization: s.organization,
        title: s.title,
        url: s.url,
        publishedAt: s.publishedAt,
      }))
    ).slice(0, 14),
    informationGaps: gaps.length > 0 ? gaps : ['Standard open-source collection limitations apply; verify operational details with primary agency bulletins.'],
    contradictoryReporting: conflicts.length > 0 ? conflicts : ['No explicit contradictory casualty or denial flags detected in correlated clusters.'],
    confidenceAssessment: {
      level,
      explanation: `Deterministic assessment based on ${highConfCount} high-confidence sensor/multi-org events out of ${liveEvents.length} total retrieved items.`,
    },
    disclaimer: 'Generated deterministically from retrieved open-source feeds without LLM inference or paid APIs. Always inspect primary source links.',
  };
}

export async function generateIntelligenceBriefing(params: {
  scope: string;
  events: IntelEvent[];
  language: SupportedLang;
  aiEnabled: boolean;
  question?: string;
}): Promise<AIBriefingReport> {
  const { scope, events, language, aiEnabled, question } = params;
  const liveEvents = events.filter((e) => e.nature !== 'public_reference').slice(0, 35);

  if (!aiEnabled) {
    return buildRuleBasedBriefing(scope, liveEvents, language, 'AI assistant disabled by user setting');
  }

  const candidates = keyManager.getGeminiKeyCandidates();
  if (candidates.length === 0) {
    return buildRuleBasedBriefing(scope, liveEvents, language, 'Zero-cost mode active without Gemini key; deterministic correlator used');
  }

  const langName = language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English';
  const evidenceContext = liveEvents.map((ev) => ({
    id: ev.id,
    title: ev.title,
    category: ev.category,
    severity: ev.severity,
    nature: ev.nature,
    location: [ev.country, ev.region].filter(Boolean).join(', ') || 'Unmapped',
    publishedAt: ev.publishedAt,
    independentOrgs: ev.independentOrgCount,
    confidence: ev.confidence,
    conflictingReports: ev.conflictingReports ?? null,
    sources: ev.sources.slice(0, 3).map((s) => ({
      org: s.organization,
      title: s.title,
      url: s.url,
      publishedAt: s.publishedAt,
    })),
  }));

  const prompt = question
    ? `Answer the analyst question strictly using ONLY the retrieved intelligence dataset below. Question: "${question}". Scope: "${scope}". Respond in ${langName}.`
    : `Produce a structured intelligence briefing for scope "${scope}" in ${langName} based strictly on the retrieved open-source events below.`;

  let lastErrorMsg = 'All free-tier Gemini key slots unavailable';

  for (const candidate of candidates) {
    const ai = buildGeminiClient(candidate.key);
    for (const modelName of FREE_GEMINI_MODELS) {
      const callStarted = performance.now();
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `${prompt}\n\nRETRIEVED_EVENTS_JSON:\n${JSON.stringify(evidenceContext)}`,
          config: {
            systemInstruction:
              'You are a senior OSINT intelligence analyst. Ground EVERY statement strictly in RETRIEVED_EVENTS_JSON. NEVER invent events, coordinates, casualties, or sources. Clearly distinguish sensor observations from single-source media reports. Highlight information gaps and conflicting claims. Write concise, objective prose.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                executiveSummary: { type: Type.STRING },
                keyDevelopments: { type: Type.ARRAY, items: { type: Type.STRING } },
                geographicLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
                informationGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                contradictoryReporting: { type: Type.ARRAY, items: { type: Type.STRING } },
                confidenceLevel: { type: Type.STRING },
                confidenceExplanation: { type: Type.STRING },
              },
              required: [
                'title',
                'executiveSummary',
                'keyDevelopments',
                'geographicLocations',
                'informationGaps',
                'contradictoryReporting',
                'confidenceLevel',
                'confidenceExplanation',
              ],
            },
          },
        });

        keyManager.markGeminiSuccess(candidate.slotIndex, Math.round(performance.now() - callStarted));
        keyManager.recordMirrorUpdate('ai', `${modelName} (${candidate.sourceVar})`, modelName !== FREE_GEMINI_MODELS[0]);

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          title?: string;
          executiveSummary?: string;
          keyDevelopments?: string[];
          geographicLocations?: string[];
          informationGaps?: string[];
          contradictoryReporting?: string[];
          confidenceLevel?: string;
          confidenceExplanation?: string;
        };

        const rawLvl = (parsed.confidenceLevel ?? 'medium').toLowerCase();
        const level = rawLvl === 'high' || rawLvl === 'low' ? rawLvl : 'medium';

        return {
          id: `ai-${Date.now()}`,
          title: parsed.title || `Intelligence Briefing — ${scope}`,
          scope,
          language,
          generatedAt: new Date().toISOString(),
          mode: 'gemini',
          modelUsed: `${modelName} (Free-Tier · ${candidate.sourceVar})`,
          executiveSummary: parsed.executiveSummary || 'Summary unavailable.',
          keyDevelopments: parsed.keyDevelopments ?? [],
          geographicLocations: parsed.geographicLocations ?? [],
          supportingSources: liveEvents
            .flatMap((e) =>
              e.sources.slice(0, 1).map((s) => ({
                organization: s.organization,
                title: s.title,
                url: s.url,
                publishedAt: s.publishedAt,
              }))
            )
            .slice(0, 14),
          informationGaps: parsed.informationGaps ?? ['Verify single-source media claims against primary agency releases.'],
          contradictoryReporting: parsed.contradictoryReporting ?? [],
          confidenceAssessment: {
            level,
            explanation: parsed.confidenceExplanation || 'Assessed from source diversity and sensor telemetry in retrieved dataset.',
          },
          disclaimer: 'AI-generated analytical synthesis grounded in retrieved WIH open-source records. Not an independent confirmation of unverified claims.',
        };
      } catch (err) {
        const lat = Math.round(performance.now() - callStarted);
        lastErrorMsg = err instanceof Error ? err.message : 'Gemini request failed';
        const isModelMissing = /(NOT_FOUND|404)/i.test(lastErrorMsg);
        if (isModelMissing && modelName !== FREE_GEMINI_MODELS[FREE_GEMINI_MODELS.length - 1]) {
          continue;
        }
        keyManager.markGeminiError(candidate.slotIndex, lastErrorMsg, lat);
        break; // Rotate to next available key slot immediately
      }
    }
  }

  keyManager.recordMirrorUpdate('ai', 'Deterministic Rule-Based Correlator (Failover)', true);
  return buildRuleBasedBriefing(scope, liveEvents, language, `Free-tier AI failover (${lastErrorMsg}); deterministic correlator active`);
}
