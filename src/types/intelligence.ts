export type IntelCategory =
  | 'armed_conflict'
  | 'military_incident'
  | 'airstrike_explosion'
  | 'political_unrest'
  | 'protest'
  | 'terrorism'
  | 'earthquake'
  | 'wildfire'
  | 'flood'
  | 'severe_weather'
  | 'volcano'
  | 'cyber_incident'
  | 'aviation'
  | 'maritime'
  | 'strategic_infra'
  | 'energy_infra'
  | 'nuclear_facility'
  | 'military_base'
  | 'undersea_cable'
  | 'port_chokepoint';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ObservationNature =
  | 'real_observation'
  | 'official_statement'
  | 'media_report'
  | 'unverified_claim'
  | 'historical_record'
  | 'public_reference'
  | 'ai_analysis';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type SupportedLang = 'en' | 'ar' | 'fr';

export interface SourceCitation {
  id: string;
  organization: string;
  title: string;
  url: string;
  publishedAt: string;
  collectedAt: string;
  language?: 'en' | 'ar' | 'fr' | 'other';
  nature: ObservationNature;
  snippet?: string;
}

export interface IntelEvent {
  id: string;
  title: string;
  summary: string;
  category: IntelCategory;
  severity: SeverityLevel;
  nature: ObservationNature;
  lat: number | null;
  lon: number | null;
  geoPrecision: 'exact' | 'city' | 'region' | 'country' | 'approximate' | 'ungeolocated';
  country?: string;
  countryCode?: string;
  region?: string;
  publishedAt: string;
  collectedAt: string;
  updatedAt: string;
  magnitude?: number;
  depthKm?: number;
  metrics?: Record<string, string | number>;
  sources: SourceCitation[];
  independentOrgCount: number;
  confidence: ConfidenceLevel;
  confidenceExplanation: string;
  conflictingReports?: string;
  tags: string[];
}

export interface LayerDefinition {
  id: IntelCategory;
  label: string;
  group: 'conflict' | 'disaster' | 'cyber' | 'mobility' | 'infrastructure';
  color: string;
  sourceId: string;
  sourceName: string;
  sourceEndpoint: string;
  updateFrequency: string;
  limitations: string;
  defaultVisible: boolean;
}

export interface SourceErrorLog {
  timestamp: string;
  statusCode?: number | null;
  message: string;
  endpoint?: string;
}

export interface SourceHealthItem {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  updateFrequency: string;
  limitations: string;
  status: 'operational' | 'degraded' | 'unavailable' | 'reference';
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatusCode?: number | null;
  itemCount: number;
  latencyMs: number | null;
  errorMessage?: string;
  recentErrors?: SourceErrorLog[];
  cachedAgeSec?: number;
}

export interface ApiEndpointDiagnostic {
  path: string;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
  requestCount: number;
  errorCount: number;
  lastCalledAt: string | null;
  lastError?: string;
}

export interface KeyPoolSlotStatus {
  slotIndex: number;
  sourceVar: string;
  status: 'ready' | 'cooldown' | 'invalid';
  cooldownRemainingSec: number;
  successCount: number;
  errorCount: number;
  lastUsedAt: string | null;
  lastError?: string;
}

export interface FreeProviderMirrorStatus {
  id: string;
  name: string;
  activeEndpoint: string;
  mirrorCount: number;
  failoverCount: number;
  requiresKey: false;
  lastUpdatedAt: string | null;
}

export interface KeyRotationSummary {
  freeTierOnly: true;
  zeroPaidApis: true;
  aiConfigured: boolean;
  aiMode: 'gemini_pool' | 'rule_based_free_fallback';
  allowedFreeModels: string[];
  poolSize: number;
  activeSlotIndex: number;
  readyCount: number;
  cooldownCount: number;
  invalidCount: number;
  rotationCount: number;
  reloadCount: number;
  firmsKeyConfigured: boolean;
  openSkyAuthConfigured: boolean;
  lastReloadAt: string;
  lastRotationAt: string | null;
  nextAutoSyncAt: string;
  autoSyncIntervalSec: number;
  slots: KeyPoolSlotStatus[];
  mirrors: FreeProviderMirrorStatus[];
}

export interface AircraftTrack {
  icao24: string;
  callsign: string;
  originCountry: string;
  lon: number;
  lat: number;
  altitudeM: number | null;
  velocityMs: number | null;
  headingDeg: number | null;
  onGround: boolean;
  lastContact: string;
  source: string;
}

export interface VesselTrack {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  sogKnots: number | null;
  cogDeg: number | null;
  headingDeg: number | null;
  timestamp: string;
  region: string;
  source: string;
}

export interface EconomicIndicator {
  id: string;
  symbol: string;
  name: string;
  category: 'energy' | 'metals' | 'currency' | 'index' | 'macro';
  value: number | null;
  previousValue?: number | null;
  changePct?: number | null;
  unit: string;
  currency: string;
  source: string;
  sourceUrl: string;
  observedAt: string;
  collectedAt: string;
  updateFrequency: string;
  status: 'operational' | 'stale' | 'unavailable';
  note?: string;
}

export interface CountryProfile {
  name: string;
  cca2: string;
  cca3: string;
  region: string;
  subregion: string;
  capital: string;
  population: number;
  areaKm2: number;
  lat: number;
  lon: number;
  borders: string[];
  currencies: string[];
  languages: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  countries: string[];
  regions: string[];
  categories: IntelCategory[];
  severities: SeverityLevel[];
  keywords: string[];
  sources: string[];
  timeWindowHours: number;
  browserNotify: boolean;
  createdAt: string;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  eventId: string;
  eventTitle: string;
  severity: SeverityLevel;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface UserPreferences {
  language: SupportedLang;
  mapStyle: 'dark' | 'osm' | 'topo';
  refreshIntervalSec: number;
  visibleLayers: IntelCategory[];
  favoriteCountries: string[];
  watchlists: { id: string; name: string; countries: string[]; keywords: string[] }[];
  savedSearches: { id: string; label: string; query: string; region: string; category: string }[];
  aiEnabled: boolean;
  compactMode: boolean;
  theme: 'dark' | 'light';
}

export interface AIBriefingReport {
  id: string;
  title: string;
  scope: string;
  language: SupportedLang;
  generatedAt: string;
  mode: 'gemini' | 'rule_based_fallback';
  modelUsed: string;
  executiveSummary: string;
  keyDevelopments: string[];
  geographicLocations: string[];
  supportingSources: { organization: string; title: string; url: string; publishedAt: string }[];
  informationGaps: string[];
  contradictoryReporting: string[];
  confidenceAssessment: {
    level: ConfidenceLevel;
    explanation: string;
  };
  disclaimer: string;
}

export type NavSection =
  | 'overview'
  | 'map'
  | 'conflicts'
  | 'aviation'
  | 'maritime'
  | 'disasters'
  | 'cyber'
  | 'geopolitics'
  | 'economy'
  | 'country'
  | 'ai_reports'
  | 'alerts'
  | 'timeline'
  | 'diagnostics'
  | 'settings';
