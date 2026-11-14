import type {
  ConfidenceLevel,
  IntelCategory,
  IntelEvent,
  ObservationNature,
  SeverityLevel,
  SourceCitation,
} from '../src/types/intelligence.ts';

interface GeoMatch {
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lon: number;
  precision: 'city' | 'country' | 'region';
  patterns: RegExp[];
}

const GEO_LEXICON: GeoMatch[] = [
  { country: 'Algeria', countryCode: 'DZA', region: 'North Africa', lat: 36.75, lon: 3.06, precision: 'city', patterns: [/\balgiers\b/i, /\balger\b/i, /الجزائر العاصمة/] },
  { country: 'Algeria', countryCode: 'DZA', region: 'North Africa', lat: 35.70, lon: -0.63, precision: 'city', patterns: [/\boran\b/i, /وهران/] },
  { country: 'Algeria', countryCode: 'DZA', region: 'North Africa', lat: 28.03, lon: 1.66, precision: 'country', patterns: [/\balgeria\b/i, /\balgérie\b/i, /\balgerian\b/i, /الجزائر/] },
  { country: 'Morocco', countryCode: 'MAR', region: 'North Africa', lat: 33.97, lon: -6.85, precision: 'country', patterns: [/\bmorocco\b/i, /\bmaroc\b/i, /\brabat\b/i, /\bcasablanca\b/i, /المغرب/, /الرباط/] },
  { country: 'Tunisia', countryCode: 'TUN', region: 'North Africa', lat: 36.81, lon: 10.18, precision: 'country', patterns: [/\btunisia\b/i, /\btunisie\b/i, /\btunis\b/i, /تونس/] },
  { country: 'Libya', countryCode: 'LBY', region: 'North Africa', lat: 32.89, lon: 13.19, precision: 'country', patterns: [/\blibya\b/i, /\blibye\b/i, /\btripoli\b/i, /\bbenghazi\b/i, /ليبيا/, /طرابلس/] },
  { country: 'Egypt', countryCode: 'EGY', region: 'North Africa', lat: 30.04, lon: 31.24, precision: 'country', patterns: [/\begypt\b/i, /\bégypte\b/i, /\bcairo\b/i, /\bsuez\b/i, /مصر/, /القاهرة/, /السويس/] },
  { country: 'Sudan', countryCode: 'SDN', region: 'Sahel', lat: 15.50, lon: 32.56, precision: 'country', patterns: [/\bsudan\b/i, /\bsoudan\b/i, /\bkhartoum\b/i, /\bdarfur\b/i, /السودان/, /الخرطوم/, /دارفور/] },
  { country: 'Mali', countryCode: 'MLI', region: 'Sahel', lat: 12.64, lon: -8.00, precision: 'country', patterns: [/\bmali\b/i, /\bbamako\b/i, /\bsahel\b/i, /مالي/, /الساحل/] },
  { country: 'Niger', countryCode: 'NER', region: 'Sahel', lat: 13.51, lon: 2.11, precision: 'country', patterns: [/\bniger\b/i, /\bniamey\b/i, /النيجر/] },
  { country: 'Burkina Faso', countryCode: 'BFA', region: 'Sahel', lat: 12.37, lon: -1.52, precision: 'country', patterns: [/\bburkina faso\b/i, /\bouagadougou\b/i, /بوركينا/] },
  { country: 'Palestine', countryCode: 'PSE', region: 'Middle East', lat: 31.50, lon: 34.47, precision: 'city', patterns: [/\bgaza\b/i, /\brafah\b/i, /\bwest bank\b/i, /\bpalestin/i, /غزة/, /فلسطين/, /الضفة/] },
  { country: 'Israel', countryCode: 'ISR', region: 'Middle East', lat: 32.09, lon: 34.78, precision: 'country', patterns: [/\bisrael\b/i, /\bisraël\b/i, /\btel aviv\b/i, /\bjerusalem\b/i, /إسرائيل/, /تل أبيب/, /القدس/] },
  { country: 'Lebanon', countryCode: 'LBN', region: 'Middle East', lat: 33.89, lon: 35.50, precision: 'country', patterns: [/\blebanon\b/i, /\bliban\b/i, /\bbeirut\b/i, /\bhezbollah\b/i, /لبنان/, /بيروت/] },
  { country: 'Syria', countryCode: 'SYR', region: 'Middle East', lat: 33.51, lon: 36.29, precision: 'country', patterns: [/\bsyria\b/i, /\bsyrie\b/i, /\bdamascus\b/i, /\baleppo\b/i, /سوريا/, /دمشق/, /حلب/] },
  { country: 'Iraq', countryCode: 'IRQ', region: 'Middle East', lat: 33.31, lon: 44.36, precision: 'country', patterns: [/\biraq\b/i, /\bbaghdad\b/i, /\berbil\b/i, /العراق/, /بغداد/] },
  { country: 'Iran', countryCode: 'IRN', region: 'Middle East', lat: 35.69, lon: 51.39, precision: 'country', patterns: [/\biran\b/i, /\btehran\b/i, /\btéhéran\b/i, /إيران/, /طهران/] },
  { country: 'Yemen', countryCode: 'YEM', region: 'Middle East', lat: 14.80, lon: 42.95, precision: 'region', patterns: [/\byemen\b/i, /\byémen\b/i, /\bhouthi\b/i, /\bred sea\b/i, /\baden\b/i, /اليمن/, /البحر الأحمر/, /الحوثي/] },
  { country: 'Saudi Arabia', countryCode: 'SAU', region: 'Middle East', lat: 24.71, lon: 46.68, precision: 'country', patterns: [/\bsaudi\b/i, /\briyadh\b/i, /\barabie saoudite\b/i, /السعودية/, /الرياض/] },
  { country: 'Turkey', countryCode: 'TUR', region: 'Middle East', lat: 39.93, lon: 32.86, precision: 'country', patterns: [/\bturkey\b/i, /\btürkiye\b/i, /\bturquie\b/i, /\bankara\b/i, /\bistanbul\b/i, /تركيا/, /أنقرة/, /إسطنبول/] },
  { country: 'Ukraine', countryCode: 'UKR', region: 'Europe', lat: 50.45, lon: 30.52, precision: 'country', patterns: [/\bukraine\b/i, /\bkyiv\b/i, /\bkiev\b/i, /\bkharkiv\b/i, /\bodesa\b/i, /\bcrimea\b/i, /أوكرانيا/, /كييف/] },
  { country: 'Russia', countryCode: 'RUS', region: 'Europe', lat: 55.76, lon: 37.62, precision: 'country', patterns: [/\brussia\b/i, /\brussie\b/i, /\bmoscow\b/i, /\bkremlin\b/i, /روسيا/, /موسكو/] },
  { country: 'France', countryCode: 'FRA', region: 'Europe', lat: 48.86, lon: 2.35, precision: 'country', patterns: [/\bfrance\b/i, /\bparis\b/i, /\bmacron\b/i, /فرنسا/, /باريس/] },
  { country: 'Germany', countryCode: 'DEU', region: 'Europe', lat: 52.52, lon: 13.40, precision: 'country', patterns: [/\bgermany\b/i, /\ballemagne\b/i, /\bberlin\b/i, /ألمانيا/, /برلين/] },
  { country: 'United Kingdom', countryCode: 'GBR', region: 'Europe', lat: 51.51, lon: -0.13, precision: 'country', patterns: [/\bbritain\b/i, /\bu\.k\.\b/i, /\bunited kingdom\b/i, /\blondon\b/i, /بريطانيا/, /لندن/] },
  { country: 'Poland', countryCode: 'POL', region: 'Europe', lat: 52.23, lon: 21.01, precision: 'country', patterns: [/\bpoland\b/i, /\bpologne\b/i, /\bwarsaw\b/i, /بولندا/] },
  { country: 'United States', countryCode: 'USA', region: 'United States', lat: 38.90, lon: -77.04, precision: 'country', patterns: [/\bunited states\b/i, /\bu\.s\.\b/i, /\bwashington\b/i, /\bpentagon\b/i, /\bwhite house\b/i, /\bétats-unis\b/i, /الولايات المتحدة/, /واشنطن/] },
  { country: 'China', countryCode: 'CHN', region: 'Asia-Pacific', lat: 39.90, lon: 116.40, precision: 'country', patterns: [/\bchina\b/i, /\bchine\b/i, /\bbeijing\b/i, /\bsouth china sea\b/i, /الصين/, /بكين/] },
  { country: 'Taiwan', countryCode: 'TWN', region: 'Asia-Pacific', lat: 25.03, lon: 121.57, precision: 'country', patterns: [/\btaiwan\b/i, /\btaipei\b/i, /\btaïwan\b/i, /تايوان/] },
  { country: 'Japan', countryCode: 'JPN', region: 'Asia-Pacific', lat: 35.68, lon: 139.69, precision: 'country', patterns: [/\bjapan\b/i, /\bjapon\b/i, /\btokyo\b/i, /اليابان/, /طوكيو/] },
  { country: 'South Korea', countryCode: 'KOR', region: 'Asia-Pacific', lat: 37.57, lon: 126.98, precision: 'country', patterns: [/\bsouth korea\b/i, /\bseoul\b/i, /\bcorée du sud\b/i, /كوريا الجنوبية/] },
  { country: 'North Korea', countryCode: 'PRK', region: 'Asia-Pacific', lat: 39.04, lon: 125.76, precision: 'country', patterns: [/\bnorth korea\b/i, /\bpyongyang\b/i, /\bcorée du nord\b/i, /كوريا الشمالية/] },
  { country: 'India', countryCode: 'IND', region: 'Asia-Pacific', lat: 28.61, lon: 77.21, precision: 'country', patterns: [/\bindia\b/i, /\binde\b/i, /\bnew delhi\b/i, /الهند/, /نيودلهي/] },
  { country: 'Pakistan', countryCode: 'PAK', region: 'Asia-Pacific', lat: 33.68, lon: 73.05, precision: 'country', patterns: [/\bpakistan\b/i, /\bislamabad\b/i, /باكستان/] },
  { country: 'Myanmar', countryCode: 'MMR', region: 'Asia-Pacific', lat: 19.76, lon: 96.08, precision: 'country', patterns: [/\bmyanmar\b/i, /\bburma\b/i, /\bbirmanie\b/i, /ميانمار/] },
  { country: 'Philippines', countryCode: 'PHL', region: 'Asia-Pacific', lat: 14.60, lon: 120.98, precision: 'country', patterns: [/\bphilippines\b/i, /\bmanila\b/i, /الفلبين/] },
  { country: 'Indonesia', countryCode: 'IDN', region: 'Asia-Pacific', lat: -6.21, lon: 106.85, precision: 'country', patterns: [/\bindonesia\b/i, /\bjakarta\b/i, /إندونيسيا/] },
];

export function normalizeCoordinates(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const parsedLat = typeof lat === 'number' ? lat : typeof lat === 'string' && lat.trim() !== '' ? Number(lat) : NaN;
  const parsedLon = typeof lon === 'number' ? lon : typeof lon === 'string' && lon.trim() !== '' ? Number(lon) : NaN;
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) return null;
  if (parsedLat === 0 && parsedLon === 0) return null;
  return { lat: Number(parsedLat.toFixed(4)), lon: Number(parsedLon.toFixed(4)) };
}

export function validateCoordinates(lat: number | null | undefined, lon: number | null | undefined): { lat: number; lon: number } | null {
  return normalizeCoordinates(lat, lon);
}

function ringCentroid(ring: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const c = normalizeCoordinates(pt[1], pt[0]);
      if (c) {
        sumLat += c.lat;
        sumLon += c.lon;
        count++;
      }
    }
  }
  if (count === 0) return null;
  return normalizeCoordinates(sumLat / count, sumLon / count);
}

export function extractPointOrCentroid(
  geometry: { type?: string; coordinates?: unknown; geometries?: Array<{ type?: string; coordinates?: unknown }> } | null | undefined
): { lat: number; lon: number } | null {
  if (!geometry) return null;
  const coords = geometry.coordinates;
  if (geometry.type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
    return normalizeCoordinates(coords[1], coords[0]);
  }
  if (geometry.type === 'MultiPoint' && Array.isArray(coords) && coords.length > 0) {
    return ringCentroid(coords);
  }
  if (geometry.type === 'Polygon' && Array.isArray(coords) && coords.length > 0) {
    return ringCentroid(coords[0]);
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(coords) && Array.isArray(coords[0]) && coords[0].length > 0) {
    return ringCentroid((coords[0] as unknown[])[0]);
  }
  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    for (const g of geometry.geometries) {
      const found = extractPointOrCentroid(g);
      if (found) return found;
    }
  }
  return null;
}

export function extractGeoFromText(text: string): Omit<GeoMatch, 'patterns'> | null {
  for (const entry of GEO_LEXICON) {
    if (entry.patterns.some((rx) => rx.test(text))) {
      return {
        country: entry.country,
        countryCode: entry.countryCode,
        region: entry.region,
        lat: entry.lat,
        lon: entry.lon,
        precision: entry.precision,
      };
    }
  }
  return null;
}

export function inferRegionFromCoords(lat: number, lon: number): string {
  if (lat >= 18 && lat <= 38 && lon >= -18 && lon <= 36) return 'North Africa';
  if (lat >= 10 && lat < 22 && lon >= -18 && lon <= 38) return 'Sahel';
  if (lat >= 12 && lat <= 42 && lon > 34 && lon <= 64) return 'Middle East';
  if (lat >= 35 && lat <= 72 && lon >= -12 && lon <= 50) return 'Europe';
  if (lat >= 24 && lat <= 50 && lon >= -126 && lon <= -66) return 'United States';
  if (lat >= -45 && lat <= 55 && lon >= 65 && lon <= 180) return 'Asia-Pacific';
  return 'Global';
}

export function classifyHeadline(text: string, defaultCategory: IntelCategory = 'political_unrest'): {
  category: IntelCategory;
  severity: SeverityLevel;
} {
  const t = text.toLowerCase();
  if (/(airstrike|air strike|bombing|missile strike|shelling|explosion|blast|drone strike|frappe aérienne|غارة|قصف|انفجار|صاروخ)/i.test(t)) {
    return { category: 'airstrike_explosion', severity: 'high' };
  }
  if (/(terror|isis|al-qaeda|extremist attack|suicide bomb|attentat|إرهاب|هجوم إرهابي|تنظيم)/i.test(t)) {
    return { category: 'terrorism', severity: 'high' };
  }
  if (/(ceasefire|battle|clashes|frontline|troops|armed conflict|war|invasion|offensive|combat|اشتباكات|حرب|قتال|جبهة|معركة)/i.test(t)) {
    return { category: 'armed_conflict', severity: 'high' };
  }
  if (/(military|navy|warship|fighter jet|defense minister|nato|exercise|missile test|عسكري|جيش|مناورات|دفاع)/i.test(t)) {
    return { category: 'military_incident', severity: 'medium' };
  }
  if (/(cyber|ransomware|malware|cve-|data breach|hacked|vulnerability|cisa|piratage|cyberattaque|سيبراني|اختراق|فدية)/i.test(t)) {
    return { category: 'cyber_incident', severity: 'high' };
  }
  if (/(shipping|vessel|tanker|strait|red sea ship|maritime|piracy|cargo ship|سفينة|ناقلة|ملاحة|مضيق)/i.test(t)) {
    return { category: 'maritime', severity: 'medium' };
  }
  if (/(protest|demonstration|rally|strike|unrest|riot|manifestation|مظاهرات|احتجاجات|إضراب)/i.test(t)) {
    return { category: 'protest', severity: 'medium' };
  }
  if (/(earthquake|quake|seismic|magnitude|زلزال|هزة أرضية|séisme)/i.test(t)) {
    return { category: 'earthquake', severity: 'medium' };
  }
  if (/(wildfire|forest fire|bushfire|incendie|حرائق غابات|حريق)/i.test(t)) {
    return { category: 'wildfire', severity: 'medium' };
  }
  if (/(flood|flooding|inondation|فيضانات|سيول)/i.test(t)) {
    return { category: 'flood', severity: 'medium' };
  }
  if (/(hurricane|cyclone|typhoon|storm|tornado|tempête|إعصار|عاصفة)/i.test(t)) {
    return { category: 'severe_weather', severity: 'medium' };
  }
  if (/(volcano|eruption|volcan|بركان)/i.test(t)) {
    return { category: 'volcano', severity: 'medium' };
  }
  return { category: defaultCategory, severity: 'low' };
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'after', 'over', 'into', 'says', 'amid',
  'more', 'near', 'about', 'what', 'when', 'where', 'will', 'been', 'les', 'des', 'une', 'dans', 'pour',
  'avec', 'sur', 'par', 'qui', 'que', 'est', 'sont', 'après', 'من', 'في', 'على', 'إلى', 'عن', 'مع', 'بعد',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const w of setA) {
    if (setB.has(w)) inter++;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function evaluateConfidence(
  nature: ObservationNature,
  sources: SourceCitation[],
  geoPrecision: IntelEvent['geoPrecision'],
  hasConflict: boolean
): { independentOrgCount: number; confidence: ConfidenceLevel; confidenceExplanation: string } {
  const uniqueOrgs = new Set(sources.map((s) => s.organization.trim().toLowerCase()));
  const orgCount = uniqueOrgs.size;

  if (nature === 'real_observation') {
    return {
      independentOrgCount: orgCount,
      confidence: 'high',
      confidenceExplanation: `High confidence: direct instrument/agency telemetry from ${sources.map((s) => s.organization).join(', ')} (${geoPrecision} coordinates).`,
    };
  }
  if (nature === 'public_reference') {
    return {
      independentOrgCount: orgCount,
      confidence: 'high',
      confidenceExplanation: `High geographic confidence: verified static public reference (${sources[0]?.organization ?? 'Open Geospatial Reference'}).`,
    };
  }
  if (hasConflict) {
    return {
      independentOrgCount: orgCount,
      confidence: 'low',
      confidenceExplanation: `Low confidence due to conflicting figures or contested claims across ${orgCount} reporting organization(s) (${sources.length} total article(s)).`,
    };
  }
  if (orgCount >= 3) {
    return {
      independentOrgCount: orgCount,
      confidence: 'high',
      confidenceExplanation: `High confidence: corroborated independently by ${orgCount} distinct reporting organizations (${sources.length} total items) with aligned ${geoPrecision} location.`,
    };
  }
  if (orgCount === 2) {
    return {
      independentOrgCount: orgCount,
      confidence: 'medium',
      confidenceExplanation: `Medium confidence: reported by 2 distinct organizations (${Array.from(uniqueOrgs).join(', ')}). Awaiting additional independent corroboration.`,
    };
  }
  if (nature === 'official_statement') {
    return {
      independentOrgCount: orgCount,
      confidence: 'medium',
      confidenceExplanation: `Medium confidence: official agency advisory (${sources[0]?.organization ?? 'Agency'}) without secondary third-party cross-check.`,
    };
  }
  return {
    independentOrgCount: orgCount,
    confidence: 'low',
    confidenceExplanation: `Low confidence: single-source media report (${sources[0]?.organization ?? 'Unknown'}) at ${geoPrecision} precision; article volume is not treated as independent confirmation.`,
  };
}

function detectConflictingFigures(sources: SourceCitation[]): string | undefined {
  if (sources.length < 2) return undefined;
  const numSets = sources.map((s) => {
    const matches = (s.title + ' ' + (s.snippet ?? '')).match(/\b(\d{1,5})\s+(killed|dead|injured|wounded|troops|arrested|displaced|قتيل|جريح|morts|blessés)\b/gi) ?? [];
    return { org: s.organization, matches };
  });
  const populated = numSets.filter((n) => n.matches.length > 0);
  if (populated.length >= 2) {
    const vals = new Set(populated.flatMap((p) => p.matches.map((m) => m.replace(/\D+/g, ''))));
    if (vals.size > 1) {
      return `Divergent casualty/count figures reported across sources: ${populated.map((p) => `${p.org} (${p.matches.join(', ')})`).join(' vs. ')}.`;
    }
  }
  const hasDenial = sources.some((s) => /\b(denies|denied|disputes|unconfirmed|claims|alleged|dément|ينفي|مزاعم)\b/i.test(s.title + ' ' + (s.snippet ?? '')));
  if (hasDenial && sources.length >= 2) {
    return 'At least one source includes a denial, dispute, or unverified claim framing; treat attribution cautiously.';
  }
  return undefined;
}

export function correlateAndDeduplicateEvents(rawEvents: IntelEvent[]): IntelEvent[] {
  const result: IntelEvent[] = [];
  const tokenCache: string[][] = [];
  const seenIds = new Set<string>();

  for (const rawEv of rawEvents) {
    if (seenIds.has(rawEv.id)) continue;
    seenIds.add(rawEv.id);

    const normalizedCoords =
      rawEv.lat !== null && rawEv.lon !== null
        ? normalizeCoordinates(rawEv.lat, rawEv.lon)
        : null;
    const ev: IntelEvent =
      rawEv.lat !== null || rawEv.lon !== null
        ? normalizedCoords
          ? { ...rawEv, lat: normalizedCoords.lat, lon: normalizedCoords.lon }
          : { ...rawEv, lat: null, lon: null, geoPrecision: 'ungeolocated' }
        : rawEv;

    if (ev.nature === 'real_observation' || ev.nature === 'public_reference') {
      result.push(ev);
      tokenCache.push(tokenize(ev.title));
      continue;
    }

    const tokens = tokenize(ev.title);
    const evTime = new Date(ev.publishedAt).getTime();
    let mergedIdx = -1;

    for (let i = 0; i < result.length; i++) {
      const candidate = result[i];
      if (candidate.nature === 'real_observation' || candidate.nature === 'public_reference') continue;

      const candTime = new Date(candidate.publishedAt).getTime();
      if (Math.abs(evTime - candTime) > 36 * 3600 * 1000) continue;

      const sameCountry = ev.countryCode && candidate.countryCode && ev.countryCode === candidate.countryCode;
      const sameCategory = ev.category === candidate.category;
      const sim = jaccard(tokens, tokenCache[i]);

      if ((sameCountry && sim >= 0.28) || (sameCategory && sim >= 0.42) || sim >= 0.55) {
        mergedIdx = i;
        break;
      }
    }

    if (mergedIdx === -1) {
      result.push(ev);
      tokenCache.push(tokens);
    } else {
      const target = result[mergedIdx];
      const existingUrls = new Set(target.sources.map((s) => s.url));
      const newSources = ev.sources.filter((s) => !existingUrls.has(s.url));
      if (newSources.length > 0) {
        target.sources = [...target.sources, ...newSources];
      }
      if (new Date(ev.publishedAt).getTime() > new Date(target.updatedAt).getTime()) {
        target.updatedAt = ev.publishedAt;
      }
      if (target.lat === null && ev.lat !== null && ev.lon !== null) {
        target.lat = ev.lat;
        target.lon = ev.lon;
        target.geoPrecision = ev.geoPrecision;
        target.country = ev.country;
        target.countryCode = ev.countryCode;
        target.region = ev.region;
      }
      const conflictNote = detectConflictingFigures(target.sources);
      target.conflictingReports = conflictNote;
      const conf = evaluateConfidence(target.nature, target.sources, target.geoPrecision, Boolean(conflictNote));
      target.independentOrgCount = conf.independentOrgCount;
      target.confidence = conf.confidence;
      target.confidenceExplanation = conf.confidenceExplanation;
      // Escalate severity conservatively if >=3 independent orgs corroborate a high/medium event
      if (target.independentOrgCount >= 3 && target.severity === 'medium') {
        target.severity = 'high';
      }
    }
  }

  return result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}
