import React, { createContext, useContext } from 'react';
import type {
  ConfidenceLevel,
  IntelCategory,
  NavSection,
  ObservationNature,
  SeverityLevel,
  SupportedLang,
} from '../types/intelligence';

export const UI_STRINGS: Record<SupportedLang, {
  appName: string;
  searchPlaceholder: string;
  refresh: string;
  syncing: string;
  offlineBanner: string;
  nav: Record<NavSection, string>;
  provenanceTitle: string;
  noFakeDataNotice: string;
}> = {
  en: {
    appName: 'World Intelligence Hub',
    searchPlaceholder: 'Search events, countries, sources, CVE, coordinates...',
    refresh: 'Sync Feeds',
    syncing: 'Syncing...',
    offlineBanner: 'Offline Mode — Showing locally cached intelligence records.',
    nav: {
      overview: 'Global Overview',
      map: 'Live Intelligence Map',
      conflicts: 'Conflicts & Military',
      aviation: 'Aviation',
      maritime: 'Maritime',
      disasters: 'Natural Disasters',
      cyber: 'Cyber Intelligence',
      geopolitics: 'Geopolitics & News',
      economy: 'Economy & Markets',
      country: 'Country Intelligence',
      ai_reports: 'AI Intelligence Reports',
      alerts: 'Alerts & Watchlists',
      timeline: 'Historical Timeline',
      diagnostics: 'Source Diagnostics',
      settings: 'Settings',
    },
    provenanceTitle: 'Source Provenance & Reliability',
    noFakeDataNotice: 'All telemetry and news items come from live open sources or labeled static public references.',
  },
  fr: {
    appName: 'World Intelligence Hub',
    searchPlaceholder: 'Rechercher événements, pays, sources, CVE...',
    refresh: 'Actualiser',
    syncing: 'Synchronisation...',
    offlineBanner: 'Mode hors ligne — Données en cache local affichées.',
    nav: {
      overview: 'Vue Globale',
      map: 'Carte Intelligence',
      conflicts: 'Conflits & Militaire',
      aviation: 'Aviation',
      maritime: 'Maritime',
      disasters: 'Catastrophes Naturelles',
      cyber: 'Cyber Intelligence',
      geopolitics: 'Géopolitique & Médias',
      economy: 'Économie & Marchés',
      country: 'Profils Pays',
      ai_reports: 'Rapports Analyste IA',
      alerts: 'Alertes & Listes',
      timeline: 'Chronologie Historique',
      diagnostics: 'État des Sources',
      settings: 'Paramètres',
    },
    provenanceTitle: 'Provenance et Fiabilité des Sources',
    noFakeDataNotice: 'Toutes les observations proviennent de flux ouverts réels ou de références publiques documentées.',
  },
  ar: {
    appName: 'مركز الاستخبارات العالمي',
    searchPlaceholder: 'ابحث في الأحداث، الدول، المصادر، الإحداثيات، الثغرات...',
    refresh: 'تحديث المصادر',
    syncing: 'جاري المزامنة...',
    offlineBanner: 'وضع عدم الاتصال — يتم عرض السجلات المخزنة محلياً.',
    nav: {
      overview: 'النظرة العالمية',
      map: 'خريطة الاستخبارات الحية',
      conflicts: 'النزاعات والعسكرية',
      aviation: 'الملاحة الجوية',
      maritime: 'الملاحة البحرية',
      disasters: 'الكوارث الطبيعية',
      cyber: 'الاستخبارات السيبرانية',
      geopolitics: 'الجيوسياسة والأخبار',
      economy: 'الاقتصاد والأسواق',
      country: 'ملفات الدول',
      ai_reports: 'تقارير المحلل الذكي',
      alerts: 'التنبيهات والمراقبة',
      timeline: 'الخط الزمني التاريخي',
      diagnostics: 'صحة المصادر والتشخيص',
      settings: 'الإعدادات',
    },
    provenanceTitle: 'موثوقية ومصدر البيانات',
    noFakeDataNotice: 'جميع البيانات مستمدة من مصادر مفتوحة حقيقية أو مراجع جغرافية عامة موثقة.',
  },
};

export const CATEGORY_LABELS: Record<SupportedLang, Record<IntelCategory, string>> = {
  en: {
    armed_conflict: 'Armed Conflicts',
    military_incident: 'Military Incidents',
    airstrike_explosion: 'Airstrikes & Explosions',
    political_unrest: 'Political Unrest',
    protest: 'Protests & Demonstrations',
    terrorism: 'Terrorism Reports',
    earthquake: 'Earthquakes',
    wildfire: 'Wildfires & Thermal',
    flood: 'Floods',
    severe_weather: 'Severe Weather',
    volcano: 'Volcanoes',
    cyber_incident: 'Cyber Incidents',
    aviation: 'Aviation Tracking',
    maritime: 'Maritime Activity',
    strategic_infra: 'Strategic Infrastructure',
    energy_infra: 'Energy Infrastructure',
    nuclear_facility: 'Nuclear Facilities',
    military_base: 'Military Bases (Ref)',
    undersea_cable: 'Undersea Cables',
    port_chokepoint: 'Ports & Chokepoints',
  },
  fr: {
    armed_conflict: 'Conflits Armés',
    military_incident: 'Incidents Militaires',
    airstrike_explosion: 'Frappes & Explosions',
    political_unrest: 'Instabilité Politique',
    protest: 'Manifestations',
    terrorism: 'Rapports Terrorisme',
    earthquake: 'Séismes',
    wildfire: 'Feux & Anomalies Thermiques',
    flood: 'Inondations',
    severe_weather: 'Météo Sévère',
    volcano: 'Volcans',
    cyber_incident: 'Cyberincidents',
    aviation: 'Suivi Aérien',
    maritime: 'Activité Maritime',
    strategic_infra: 'Infrastructures Stratégiques',
    energy_infra: 'Infrastructures Énergétiques',
    nuclear_facility: 'Sites Nucléaires',
    military_base: 'Bases Militaires (Réf)',
    undersea_cable: 'Câbles Sous-Marins',
    port_chokepoint: 'Ports & Détroits',
  },
  ar: {
    armed_conflict: 'نزاعات مسلحة',
    military_incident: 'حوادث عسكرية',
    airstrike_explosion: 'غارات وانفجارات',
    political_unrest: 'اضطرابات سياسية',
    protest: 'احتجاجات ومظاهرات',
    terrorism: 'تقارير إرهابية',
    earthquake: 'زلازل',
    wildfire: 'حرائق وغابات',
    flood: 'فيضانات وسيول',
    severe_weather: 'طقس قاسٍ وأعاصير',
    volcano: 'نشاط بركاني',
    cyber_incident: 'حوادث سيبرانية',
    aviation: 'حركة الطيران',
    maritime: 'النشاط البحري',
    strategic_infra: 'بنية تحتية استراتيجية',
    energy_infra: 'بنية تحتية للطاقة',
    nuclear_facility: 'منشآت نووية',
    military_base: 'قواعد عسكرية (مرجعي)',
    undersea_cable: 'كابلات بحرية',
    port_chokepoint: 'موانئ ومضائق بحرية',
  },
};

export const SEVERITY_LABELS: Record<SupportedLang, Record<SeverityLevel, string>> = {
  en: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
  fr: { critical: 'Critique', high: 'Élevé', medium: 'Moyen', low: 'Faible', info: 'Info' },
  ar: { critical: 'حرج', high: 'مرتفع', medium: 'متوسط', low: 'منخفض', info: 'معلومات' },
};

export const CONFIDENCE_LABELS: Record<SupportedLang, Record<ConfidenceLevel, string>> = {
  en: { high: 'High', medium: 'Medium', low: 'Low' },
  fr: { high: 'Élevée', medium: 'Moyenne', low: 'Faible' },
  ar: { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' },
};

export const NATURE_LABELS_I18N: Record<SupportedLang, Record<ObservationNature, string>> = {
  en: {
    real_observation: 'Real Observation (Sensor / Agency)',
    official_statement: 'Official Advisory / Statement',
    media_report: 'Independent Media Report',
    unverified_claim: 'Unverified Claim',
    historical_record: 'Historical Record',
    public_reference: 'Static Public Reference Dataset',
    ai_analysis: 'AI Analytical Synthesis',
  },
  fr: {
    real_observation: 'Observation Réelle (Capteur / Agence)',
    official_statement: 'Avis / Communiqué Officiel',
    media_report: 'Rapport Média Indépendant',
    unverified_claim: 'Allégation Non Vérifiée',
    historical_record: 'Archive Historique',
    public_reference: 'Jeu de Référence Public Statique',
    ai_analysis: 'Synthèse Analytique IA',
  },
  ar: {
    real_observation: 'رصد حقيقي (مستشعر / وكالة رسمية)',
    official_statement: 'بيان أو تحذير رسمي',
    media_report: 'تقرير إعلامي مستقل',
    unverified_claim: 'ادعاء غير مؤكد',
    historical_record: 'سجل تاريخي',
    public_reference: 'بيانات مرجعية عامة ثابتة',
    ai_analysis: 'تحليل ذكاء اصطناعي',
  },
};

export const REGION_LABELS: Record<SupportedLang, Record<string, string>> = {
  en: {
    'North Africa': 'North Africa',
    Sahel: 'Sahel',
    'Middle East': 'Middle East',
    Europe: 'Europe',
    'United States': 'United States',
    'Asia-Pacific': 'Asia-Pacific',
    Global: 'Global',
  },
  fr: {
    'North Africa': 'Afrique du Nord',
    Sahel: 'Sahel',
    'Middle East': 'Moyen-Orient',
    Europe: 'Europe',
    'United States': 'États-Unis',
    'Asia-Pacific': 'Asie-Pacifique',
    Global: 'Mondial',
  },
  ar: {
    'North Africa': 'شمال أفريقيا',
    Sahel: 'الساحل',
    'Middle East': 'الشرق الأوسط',
    Europe: 'أوروبا',
    'United States': 'الولايات المتحدة',
    'Asia-Pacific': 'آسيا والمحيط الهادئ',
    Global: 'عالمي',
  },
};

export const STATUS_LABELS: Record<SupportedLang, Record<'operational' | 'degraded' | 'unavailable' | 'reference', string>> = {
  en: { operational: 'Operational', degraded: 'Degraded', unavailable: 'Unavailable', reference: 'Reference' },
  fr: { operational: 'Opérationnel', degraded: 'Dégradé', unavailable: 'Indisponible', reference: 'Référence' },
  ar: { operational: 'تشغيلي', degraded: 'متدهور', unavailable: 'غير متاح', reference: 'مرجعي' },
};

export interface FullUiCopy {
  freeOsint: string;
  liveFeedsActive: string;
  localSnapshot: string;
  degradedModulesPrefix: string;
  inspectDiagnostics: string;
  overview: {
    liveEvents: string;
    highConfRecords: string;
    conflictReports: string;
    multiSourceGdelt: string;
    naturalHazards: string;
    cyberAdvisories: string;
    cisaReporting: string;
    regionalBreakdown: string;
    clickRegionFilter: string;
    highCount: string;
    liveFeedTitle: string;
    allSeverities: string;
    noFilterMatch: string;
    orgsCount: string;
    confSuffix: string;
  };
  feeds: {
    allCategories: string;
    allSeverities: string;
    allNatures: string;
    allLanguages: string;
    noRecords: string;
    reportsCount: string;
    conflictingClaims: string;
    sourceLink: string;
    conflictsTitle: string;
    conflictsSubtitle: string;
    conflictsDisclaimer: string;
    disastersTitle: string;
    disastersSubtitle: string;
    cyberTitle: string;
    cyberSubtitle: string;
    cyberDisclaimer: string;
    geopoliticsTitle: string;
    geopoliticsSubtitle: string;
  };
  map: {
    layersBtn: string;
    densityBtn: string;
    globalView: string;
    countryLabel: string;
    openProfile: string;
    mappedMarkers: string;
    drawerTitle: string;
    rendererUnavailable: string;
    groups: Record<'conflict' | 'disaster' | 'cyber' | 'mobility' | 'infrastructure', string>;
  };
  detail: {
    emptyTitle: string;
    emptySubtitle: string;
    openCountryProfile: string;
    location: string;
    unmapped: string;
    coordinates: string;
    noCoords: string;
    publishedTime: string;
    collectedTime: string;
    magnitude: string;
    depth: string;
    provenanceConfidence: string;
    confSuffix: string;
    classification: string;
    independentOrgs: string;
    totalReports: string;
    conflictingFlagged: string;
    supportingSources: string;
    pubLabel: string;
    originalLink: string;
    bookmarkAdd: string;
    bookmarkRemove: string;
    exportJson: string;
  };
  aviation: {
    title: string;
    subtitle: string;
    refresh: string;
    statusLabel: string;
    querying: string;
    callsign: string;
    originFeed: string;
    coordinates: string;
    altitude: string;
    speed: string;
    heading: string;
    contact: string;
    loading: string;
    empty: string;
  };
  maritime: {
    title: string;
    subtitle: string;
    refreshAis: string;
    globalUnavailableTitle: string;
    globalUnavailableNote: string;
    regionalTitle: string;
    chokepointsTitle: string;
    staticRef: string;
    incidentsTitle: string;
    noIncidents: string;
    vesselsTitle: string;
    loading: string;
    empty: string;
  };
  economy: {
    title: string;
    subtitle: string;
    refresh: string;
    categories: Record<'all' | 'energy' | 'metals' | 'index' | 'currency', string>;
    unavailable: string;
    observed: string;
  };
  country: {
    regionalTitle: string;
    regionalSubtitle: string;
    correlatedInTheater: string;
    profileLabel: string;
    saveCountry: string;
    savedCountry: string;
    situationReport: string;
    loading: string;
    capital: string;
    region: string;
    population: string;
    area: string;
    languages: string;
    currencies: string;
    landBorders: string;
    islandNone: string;
    macroTitle: string;
    gdp: string;
    inflation: string;
    unavailable: string;
    activityTitle: string;
    windowNote: string;
    noActivity: string;
  };
  ai: {
    title: string;
    subtitle: string;
    generate: string;
    generating: string;
    askPlaceholder: string;
    askBtn: string;
    emptyPrompt: string;
    aiMode: string;
    ruleMode: string;
    exportMd: string;
    execSummary: string;
    keyDevs: string;
    geoLocs: string;
    noGeoTags: string;
    confAssessment: string;
    infoGaps: string;
    contradictions: string;
    supportingSources: string;
    link: string;
    savedReportsTitle: string;
    savedReportsEmpty: string;
  };
  alerts: {
    title: string;
    subtitle: string;
    enableNotif: string;
    ackAll: string;
    createRuleTitle: string;
    ruleName: string;
    rulePlaceholder: string;
    countriesLabel: string;
    minSeverity: string;
    keywordsLabel: string;
    browserNotifCheck: string;
    saveRule: string;
    configuredRules: string;
    noRules: string;
    active: string;
    paused: string;
    triggeredLog: string;
    noTriggered: string;
    newBadge: string;
    watchlistsTitle: string;
    watchlistPlaceholder: string;
    isoPlaceholder: string;
    keywordsPlaceholder: string;
    addBtn: string;
    savedEventsTitle: string;
    savedEventsEmpty: string;
  };
  timeline: {
    title: string;
    subtitle: string;
    allRegions: string;
    allCategories: string;
    exportCsv: string;
    distribution: string;
    comparison: string;
    clear: string;
    selected: string;
    compare: string;
  };
  diagnostics: {
    title: string;
    subtitle: string;
    runProbe: string;
    probing: string;
    pingBtn: string;
    pinging: string;
    refreshBtn: string;
    exportJson: string;
    opRefFeeds: string;
    degUnavailFeeds: string;
    trackedRoutes: string;
    geminiKey: string;
    configured: string;
    fallbackActive: string;
    degradedModulesTitle: string;
    upstreamTitle: string;
    colSource: string;
    colStatus: string;
    colHttp: string;
    colRecords: string;
    colLatency: string;
    colCadence: string;
    colEndpoint: string;
    endpointsTitle: string;
    colEndpointPath: string;
    colLastHttp: string;
    colLastLatency: string;
    colAvgLatency: string;
    colCalls: string;
    colErrors: string;
    colLastCalled: string;
    noTelemetry: string;
    errorLogsTitle: string;
    noErrors: string;
    freeTierBadge: string;
    zeroPaidGuarantee: string;
    refreshKeysBtn: string;
    refreshingKeys: string;
    keyPoolTitle: string;
    poolSlotsLabel: string;
    rotationsLabel: string;
    lastReloadLabel: string;
    autoSyncEveryLabel: string;
    freeModelsLabel: string;
    mirrorsTitle: string;
    noKeyNeededBadge: string;
    failoversLabel: string;
    slotLabel: string;
    readyState: string;
    cooldownState: string;
    invalidState: string;
    zeroCostFallbackNote: string;
  };
  settings: {
    title: string;
    subtitle: string;
    langTitle: string;
    langDesc: string;
    themeTitle: string;
    themeDesc: string;
    dark: string;
    light: string;
    refreshTitle: string;
    refreshDesc: string;
    every2m: string;
    every5m: string;
    every10m: string;
    manualOnly: string;
    aiTitle: string;
    aiDesc: string;
    aiOn: string;
    aiOff: string;
    cacheTitle: string;
    cacheDesc: string;
    clearCache: string;
    cacheCleared: string;
  };
  pwa: {
    installApp: string;
    installIos: string;
    iosModalTitle: string;
    iosStep1: string;
    iosStep2: string;
    iosStep3: string;
  };
  mobileNav: {
    overview: string;
    map: string;
    conflicts: string;
    alerts: string;
    modules: string;
  };
}

export const FULL_UI_COPY: Record<SupportedLang, FullUiCopy> = {
  en: {
    freeOsint: '100% Free Open-Source OSINT',
    liveFeedsActive: 'live feeds active',
    localSnapshot: 'Snapshot',
    degradedModulesPrefix: 'Degraded modules detected',
    inspectDiagnostics: 'View Diagnostics',
    overview: {
      liveEvents: 'Live Correlated Events',
      highConfRecords: 'high-confidence records',
      conflictReports: 'Conflict & Security Reports',
      multiSourceGdelt: 'Multi-source RSS & GDELT',
      naturalHazards: 'Natural Hazards',
      cyberAdvisories: 'Cyber Advisories',
      cisaReporting: 'CISA & Threat Reporting',
      regionalBreakdown: 'Regional Observation Breakdown',
      clickRegionFilter: 'Click a region to filter feed',
      highCount: 'high',
      liveFeedTitle: 'Live Intelligence Feed',
      allSeverities: 'All Severities',
      noFilterMatch: 'No events match the active region/severity filters.',
      orgsCount: 'org(s)',
      confSuffix: 'conf',
    },
    feeds: {
      allCategories: 'All Categories',
      allSeverities: 'All Severities',
      allNatures: 'All Source Natures',
      allLanguages: 'All Languages (EN/FR/AR)',
      noRecords: 'No records found matching current filters in this module.',
      reportsCount: 'report(s)',
      conflictingClaims: 'Conflicting claims',
      sourceLink: 'Source',
      conflictsTitle: 'Conflicts & Military Monitoring',
      conflictsSubtitle: 'Reported armed clashes, airstrikes, explosions, terrorism reports, and publicly documented reference bases.',
      conflictsDisclaimer: 'Distinguishes corroborated multi-source reports from single-source claims. Static military base coordinates represent public open-source references only, not active force deployments.',
      disastersTitle: 'Natural Disaster Intelligence Center',
      disastersSubtitle: 'Real-time seismic telemetry (USGS), wildfires & thermal anomalies (NASA EONET / FIRMS), floods, cyclones, and volcanoes (GDACS).',
      cyberTitle: 'Cyber Intelligence & Defensive Advisories',
      cyberSubtitle: 'Official CISA cybersecurity advisories and publicly reported ransomware, data breach, and vulnerability disclosures.',
      cyberDisclaimer: 'Defensive intelligence and public advisory tracking only. Many cyber incidents lack physical coordinates.',
      geopoliticsTitle: 'Multilingual Geopolitics & Correlated News Engine',
      geopoliticsSubtitle: 'Correlated English, French, and Arabic reporting from BBC, Al Jazeera, France 24, DW, and GDELT with duplicate clustering.',
    },
    map: {
      layersBtn: 'Layers',
      densityBtn: 'Density',
      globalView: 'Global View',
      countryLabel: 'Country',
      openProfile: 'Open Profile',
      mappedMarkers: 'mapped markers',
      drawerTitle: 'Intelligence Map Layers (20)',
      rendererUnavailable: 'Map Renderer Unavailable',
      groups: {
        conflict: 'Conflict & Security',
        disaster: 'Natural Disasters',
        cyber: 'Cyber Intelligence',
        mobility: 'Aviation & Maritime',
        infrastructure: 'Strategic Infrastructure',
      },
    },
    detail: {
      emptyTitle: 'Select an Event or Map Marker',
      emptySubtitle: 'Inspect source provenance, publication vs. collection timestamps, coordinate precision, and independent corroboration counts.',
      openCountryProfile: 'Open Country Profile',
      location: 'Location',
      unmapped: 'Unmapped',
      coordinates: 'Coordinates',
      noCoords: 'No coordinates',
      publishedTime: 'Published Time',
      collectedTime: 'Collected Time',
      magnitude: 'Magnitude',
      depth: 'Depth',
      provenanceConfidence: 'Source Provenance & Confidence',
      confSuffix: 'confidence',
      classification: 'Classification',
      independentOrgs: 'Independent Organizations',
      totalReports: 'Total Reports',
      conflictingFlagged: 'Conflicting Reporting Flagged',
      supportingSources: 'Supporting Sources',
      pubLabel: 'Pub',
      originalLink: 'Original Link',
      bookmarkAdd: 'Bookmark event locally',
      bookmarkRemove: 'Remove bookmark',
      exportJson: 'Export JSON record',
    },
    aviation: {
      title: 'Aviation Transponder Tracking',
      subtitle: 'Public ADS-B telemetry (OpenSky Network / community ADS-B). Coverage depends on volunteer receiver density.',
      refresh: 'Refresh',
      statusLabel: 'Status',
      querying: 'Querying public ADS-B receivers...',
      callsign: 'Callsign / ICAO24',
      originFeed: 'Origin / Feed',
      coordinates: 'Coordinates',
      altitude: 'Altitude (m)',
      speed: 'Speed (m/s)',
      heading: 'Heading',
      contact: 'Contact',
      loading: 'Loading live aircraft states...',
      empty: 'No live aircraft states returned for this bounding box / source state.',
    },
    maritime: {
      title: 'Maritime Activity, Chokepoints & AIS',
      subtitle: 'Strategic maritime chokepoints, shipping incidents from public news, and free regional Baltic AIS telemetry.',
      refreshAis: 'Refresh AIS',
      globalUnavailableTitle: '100% Free Policy: Commercial Global AIS Excluded',
      globalUnavailableNote: 'Commercial paid AIS feeds are excluded to keep WIH 100% free. Showing live CC-BY-4.0 Digitraffic Baltic AIS + verified chokepoints + maritime incident reports.',
      regionalTitle: 'Regional Open AIS (Digitraffic Finland CC-BY-4.0)',
      chokepointsTitle: 'Ports & Maritime Chokepoints',
      staticRef: 'Static Reference',
      incidentsTitle: 'Reported Maritime Incidents',
      noIncidents: 'No maritime incident headlines matched in the current feed window.',
      vesselsTitle: 'Live Baltic Regional AIS Vessels',
      loading: 'Fetching Baltic AIS positions...',
      empty: 'No vessel tracks available.',
    },
    economy: {
      title: 'Economic & Strategic Commodity Intelligence',
      subtitle: 'Crude oil, natural gas, gold, equity benchmarks, and foreign exchange rates from free public feeds.',
      refresh: 'Refresh',
      categories: { all: 'All', energy: 'Energy', metals: 'Metals', index: 'Indices', currency: 'Currencies' },
      unavailable: 'Unavailable',
      observed: 'Obs',
    },
    country: {
      regionalTitle: 'Regional Intelligence Dashboards',
      regionalSubtitle: 'Priority regional theaters: Algeria, North Africa, Sahel, Middle East, Europe, United States, Asia-Pacific.',
      correlatedInTheater: 'correlated records in theater',
      profileLabel: 'Country Profile',
      saveCountry: 'Save Country',
      savedCountry: 'Saved Country',
      situationReport: 'Situation Report',
      loading: 'Loading country intelligence profile...',
      capital: 'Capital',
      region: 'Region',
      population: 'Population',
      area: 'Area',
      languages: 'Languages',
      currencies: 'Currencies',
      landBorders: 'Land Borders',
      islandNone: 'Island / None',
      macroTitle: 'Macroeconomic Indicators',
      gdp: 'GDP (Current USD)',
      inflation: 'CPI Inflation',
      unavailable: 'Unavailable',
      activityTitle: 'Country Activity, Disasters, Infrastructure & News',
      windowNote: '7-day window + Public Reference',
      noActivity: 'No recent events or public reference records matched in the 7-day window.',
    },
    ai: {
      title: 'Intelligence Analyst & Situation Reports',
      subtitle: 'Optional Gemini synthesis grounded strictly in retrieved data, with deterministic non-AI fallback.',
      generate: 'Generate Briefing',
      generating: 'Generating...',
      askPlaceholder: 'Ask a question grounded in retrieved OSINT events...',
      askBtn: 'Ask',
      emptyPrompt: 'Select a briefing scope or ask an intelligence query above.',
      aiMode: 'AI-GENERATED ANALYSIS',
      ruleMode: 'RULE-BASED ANALYTICAL SYNTHESIS',
      exportMd: 'Export MD',
      execSummary: 'Executive Summary',
      keyDevs: 'Key Developments',
      geoLocs: 'Geographic Locations',
      noGeoTags: 'No specific country tags extracted.',
      confAssessment: 'Confidence Assessment',
      infoGaps: 'Information Gaps',
      contradictions: 'Contradictory Reporting',
      supportingSources: 'Supporting Sources',
      link: 'Link',
      savedReportsTitle: 'Locally Saved Reports',
      savedReportsEmpty: 'Generated briefings are stored locally in IndexedDB for offline access.',
    },
    alerts: {
      title: 'Alerts, Watchlists & Bookmarked Intelligence',
      subtitle: 'Local-first rule evaluation with duplicate suppression. Browser notifications work while the app tab/PWA is active.',
      enableNotif: 'Enable Browser Notifications',
      ackAll: 'Acknowledge All',
      createRuleTitle: 'Create Alert Rule',
      ruleName: 'Rule Name',
      rulePlaceholder: 'e.g., Red Sea Maritime / Algiers Seismic',
      countriesLabel: 'Countries (comma sep)',
      minSeverity: 'Min Severity',
      keywordsLabel: 'Keywords (comma sep)',
      browserNotifCheck: 'Trigger browser notification',
      saveRule: 'Save Alert Rule',
      configuredRules: 'Configured Rules',
      noRules: 'No custom alert rules configured yet.',
      active: 'Active',
      paused: 'Paused',
      triggeredLog: 'Triggered Alerts Log',
      noTriggered: 'No alert matches triggered yet. Create a rule to monitor incoming feeds.',
      newBadge: 'NEW',
      watchlistsTitle: 'Personal Regional Watchlists',
      watchlistPlaceholder: 'Watchlist name',
      isoPlaceholder: 'ISO3 codes (DZA, EGY)',
      keywordsPlaceholder: 'Keywords',
      addBtn: 'Add',
      savedEventsTitle: 'Saved Events',
      savedEventsEmpty: 'Bookmark any event from the feed or map to retain it locally offline.',
    },
    timeline: {
      title: 'Historical Intelligence Timeline & Comparison',
      subtitle: 'Distinguishes historical observations from real-time snapshots. Export records in CSV format.',
      allRegions: 'All Regions',
      allCategories: 'All Categories',
      exportCsv: 'Export CSV',
      distribution: 'Event Distribution',
      comparison: 'Event Comparison',
      clear: 'Clear',
      selected: 'Selected',
      compare: 'Compare',
    },
    diagnostics: {
      title: 'Source Health, API Quotas & System Diagnostics',
      subtitle: 'Live verification of upstream OSINT feeds, HTTP status codes, latency, caching age, and recent error logs.',
      runProbe: 'Run Live Diagnostic Probe',
      probing: 'Probing All Endpoints...',
      pingBtn: 'Ping Endpoints',
      pinging: 'Pinging...',
      refreshBtn: 'Refresh',
      exportJson: 'Export JSON',
      opRefFeeds: 'Operational / Reference Feeds',
      degUnavailFeeds: 'Degraded / Unavailable Feeds',
      trackedRoutes: 'Tracked Backend Routes',
      geminiKey: 'Optional Gemini Server Key',
      configured: 'Configured (gemini-4-hydrogen)',
      fallbackActive: 'Not Set — Rule-Based Fallback',
      degradedModulesTitle: 'Degraded / Impacted Application Modules',
      upstreamTitle: 'Upstream Data Sources',
      colSource: 'Data Source',
      colStatus: 'Status',
      colHttp: 'HTTP',
      colRecords: 'Records',
      colLatency: 'Latency',
      colCadence: 'Update Cadence',
      colEndpoint: 'Endpoint & Limitations',
      endpointsTitle: 'Backend API Endpoint Telemetry',
      colEndpointPath: 'Endpoint',
      colLastHttp: 'Last HTTP',
      colLastLatency: 'Last Latency',
      colAvgLatency: 'Avg Latency',
      colCalls: 'Calls',
      colErrors: 'Errors',
      colLastCalled: 'Last Called',
      noTelemetry: 'No API endpoint telemetry captured yet.',
      errorLogsTitle: 'Recent Upstream Error Logs',
      noErrors: 'No recent upstream synchronization errors recorded in this session.',
      freeTierBadge: '100% Free-Tier · Zero Paid APIs',
      zeroPaidGuarantee: 'All core OSINT feeds, free-tier AI models (gemini-4-hydrogen / gemini-3.1-flash-lite), and public mirrors operate at zero mandatory cost with continuous server-side environment key sync.',
      refreshKeysBtn: 'Refresh Keys & Mirrors',
      refreshingKeys: 'Syncing Keys & Mirrors...',
      keyPoolTitle: 'Continuous Server Key Pool & Free-Tier Rotation',
      poolSlotsLabel: 'Key Pool Slots',
      rotationsLabel: 'Rotations',
      lastReloadLabel: 'Last Env Sync',
      autoSyncEveryLabel: 'Auto-Sync Cycle',
      freeModelsLabel: 'Free-Tier Models',
      mirrorsTitle: 'Keyless Free Public API Mirrors & Automatic Failover',
      noKeyNeededBadge: 'Keyless · 100% Free',
      failoversLabel: 'Failovers',
      slotLabel: 'Slot',
      readyState: 'Ready',
      cooldownState: 'Cooldown',
      invalidState: 'Invalid',
      zeroCostFallbackNote: 'Running in 100% free keyless mode (local deterministic correlator + open public OSINT feeds).',
    },
    settings: {
      title: 'Platform Settings & Local-First Personalization',
      subtitle: 'All preferences are stored locally in IndexedDB with zero mandatory registration or tracking.',
      langTitle: 'Interface Language',
      langDesc: 'Switches UI labels and default AI briefing output language (EN / AR / FR).',
      themeTitle: 'Appearance Theme',
      themeDesc: 'Dark Graphite command theme or crisp Light analyst mode.',
      dark: 'Dark',
      light: 'Light',
      refreshTitle: 'Auto-Refresh Interval',
      refreshDesc: 'Rate-limited background sync cadence to respect free API quotas.',
      every2m: 'Every 2 minutes',
      every5m: 'Every 5 minutes (Recommended)',
      every10m: 'Every 10 minutes',
      manualOnly: 'Manual only',
      aiTitle: 'Optional Gemini AI Analyst',
      aiDesc: 'When disabled or unconfigured, all reports run using deterministic non-AI correlation.',
      aiOn: 'Enabled (Optional)',
      aiOff: 'Disabled (Rule-Based Only)',
      cacheTitle: 'Offline IndexedDB Event Cache',
      cacheDesc: 'Clears locally cached event snapshots (keeps bookmarks and watchlists).',
      clearCache: 'Clear Event Cache',
      cacheCleared: 'Cache Cleared',
    },
    pwa: {
      installApp: 'Install App',
      installIos: 'Install iOS',
      iosModalTitle: 'Install World Intelligence Hub',
      iosStep1: 'Tap the Share button in Safari toolbar.',
      iosStep2: 'Scroll down and tap Add to Home Screen.',
      iosStep3: 'Launch WIH in standalone offline-capable mode.',
    },
    mobileNav: {
      overview: 'Overview',
      map: 'Map',
      conflicts: 'Conflicts',
      alerts: 'Alerts',
      modules: 'Modules',
    },
  },
  fr: {
    freeOsint: 'OSINT Open-Source 100% Gratuit',
    liveFeedsActive: 'flux actifs',
    localSnapshot: 'Instantané',
    degradedModulesPrefix: 'Modules dégradés détectés',
    inspectDiagnostics: 'Voir Diagnostics',
    overview: {
      liveEvents: 'Événements Corrélés',
      highConfRecords: 'enregistrements haute confiance',
      conflictReports: 'Conflits & Sécurité',
      multiSourceGdelt: 'RSS multilingue & GDELT',
      naturalHazards: 'Risques Naturels',
      cyberAdvisories: 'Cybermenaces & Avis',
      cisaReporting: 'CISA & Rapports Cyber',
      regionalBreakdown: 'Répartition Régionale des Observations',
      clickRegionFilter: 'Cliquez sur une région pour filtrer',
      highCount: 'élevé',
      liveFeedTitle: 'Flux d’Intelligence en Direct',
      allSeverities: 'Toutes Gravités',
      noFilterMatch: 'Aucun événement ne correspond aux filtres actifs.',
      orgsCount: 'org(s)',
      confSuffix: 'conf.',
    },
    feeds: {
      allCategories: 'Toutes Catégories',
      allSeverities: 'Toutes Gravités',
      allNatures: 'Toutes Natures',
      allLanguages: 'Toutes Langues (EN/FR/AR)',
      noRecords: 'Aucun enregistrement trouvé dans ce module.',
      reportsCount: 'rapport(s)',
      conflictingClaims: 'Sources contradictoires',
      sourceLink: 'Source',
      conflictsTitle: 'Suivi des Conflits & Activités Militaires',
      conflictsSubtitle: 'Affrontements armés, frappes, explosions, terrorisme et bases de référence publiques.',
      conflictsDisclaimer: 'Distingue les rapports multi-sources corroborés des affirmations isolées.',
      disastersTitle: 'Centre des Catastrophes Naturelles',
      disastersSubtitle: 'Télémétrie sismique (USGS), incendies (NASA EONET / FIRMS), inondations et volcans (GDACS).',
      cyberTitle: 'Cyber Intelligence & Avis Défensifs',
      cyberSubtitle: 'Avis officiels CISA et divulgations publiques de rançongiciels et vulnérabilités.',
      cyberDisclaimer: 'Renseignement défensif uniquement ; de nombreux incidents cyber n’ont pas de coordonnées physiques.',
      geopoliticsTitle: 'Géopolitique Multilingue & Corrélation Médias',
      geopoliticsSubtitle: 'Couverture corrélée EN/FR/AR depuis BBC, Al Jazeera, France 24, DW et GDELT.',
    },
    map: {
      layersBtn: 'Couches',
      densityBtn: 'Densité',
      globalView: 'Vue Globale',
      countryLabel: 'Pays',
      openProfile: 'Ouvrir Profil',
      mappedMarkers: 'marqueurs cartographiés',
      drawerTitle: 'Couches Cartographiques (20)',
      rendererUnavailable: 'Moteur Cartographique Indisponible',
      groups: {
        conflict: 'Conflits & Sécurité',
        disaster: 'Catastrophes Naturelles',
        cyber: 'Cyber Intelligence',
        mobility: 'Aviation & Maritime',
        infrastructure: 'Infrastructures Stratégiques',
      },
    },
    detail: {
      emptyTitle: 'Sélectionnez un Événement ou Marqueur',
      emptySubtitle: 'Consultez la provenance des sources, l’horodatage, la précision géographique et la corroboration.',
      openCountryProfile: 'Ouvrir le Profil Pays',
      location: 'Localisation',
      unmapped: 'Non géolocalisé',
      coordinates: 'Coordonnées',
      noCoords: 'Aucune coordonnée',
      publishedTime: 'Publication',
      collectedTime: 'Collecte',
      magnitude: 'Magnitude',
      depth: 'Profondeur',
      provenanceConfidence: 'Provenance & Confiance',
      confSuffix: 'confiance',
      classification: 'Classification',
      independentOrgs: 'Organisations Indépendantes',
      totalReports: 'Total Rapports',
      conflictingFlagged: 'Rapports Contradictoires Signalés',
      supportingSources: 'Sources à l’Appui',
      pubLabel: 'Pub',
      originalLink: 'Lien Original',
      bookmarkAdd: 'Enregistrer localement',
      bookmarkRemove: 'Retirer des favoris',
      exportJson: 'Exporter en JSON',
    },
    aviation: {
      title: 'Suivi Aérien ADS-B',
      subtitle: 'Télémétrie ADS-B publique (OpenSky Network / communauté ADS-B).',
      refresh: 'Actualiser',
      statusLabel: 'Statut',
      querying: 'Interrogation des récepteurs ADS-B...',
      callsign: 'Indicatif / ICAO24',
      originFeed: 'Origine / Flux',
      coordinates: 'Coordonnées',
      altitude: 'Altitude (m)',
      speed: 'Vitesse (m/s)',
      heading: 'Cap',
      contact: 'Contact',
      loading: 'Chargement des pistes aériennes...',
      empty: 'Aucune piste aérienne disponible pour cette zone.',
    },
    maritime: {
      title: 'Activité Maritime, Détroits & AIS',
      subtitle: 'Détroits stratégiques, incidents maritimes publics et télémétrie AIS régionale Baltique gratuite.',
      refreshAis: 'Actualiser AIS',
      globalUnavailableTitle: 'Politique 100% Gratuite : AIS Commercial Exclu',
      globalUnavailableNote: 'Les flux AIS payants sont exclus pour garantir une gratuité totale. Affichage du flux AIS gratuit Digitraffic Baltique (CC-BY-4.0), des détroits et incidents maritimes.',
      regionalTitle: 'AIS Régional Ouvert (Digitraffic Finlande CC-BY-4.0)',
      chokepointsTitle: 'Ports & Détroits Stratégiques',
      staticRef: 'Référence Statique',
      incidentsTitle: 'Incidents Maritimes Signalés',
      noIncidents: 'Aucun incident maritime dans la fenêtre actuelle.',
      vesselsTitle: 'Navires AIS Régional Baltique',
      loading: 'Chargement des positions AIS...',
      empty: 'Aucune piste de navire disponible.',
    },
    economy: {
      title: 'Intelligence Économique & Matières Premières',
      subtitle: 'Pétrole, gaz naturel, or, indices boursiers et taux de change issus de flux publics.',
      refresh: 'Actualiser',
      categories: { all: 'Tout', energy: 'Énergie', metals: 'Métaux', index: 'Indices', currency: 'Devises' },
      unavailable: 'Indisponible',
      observed: 'Obs',
    },
    country: {
      regionalTitle: 'Tableaux de Bord Régionaux',
      regionalSubtitle: 'Théâtres prioritaires : Algérie, Afrique du Nord, Sahel, Moyen-Orient, Europe, États-Unis, Asie-Pacifique.',
      correlatedInTheater: 'enregistrements corrélés dans la zone',
      profileLabel: 'Profil Pays',
      saveCountry: 'Enregistrer Pays',
      savedCountry: 'Pays Enregistré',
      situationReport: 'Rapport de Situation',
      loading: 'Chargement du profil pays...',
      capital: 'Capitale',
      region: 'Région',
      population: 'Population',
      area: 'Superficie',
      languages: 'Langues',
      currencies: 'Devises',
      landBorders: 'Frontières Terrestres',
      islandNone: 'Île / Aucune',
      macroTitle: 'Indicateurs Macroéconomiques',
      gdp: 'PIB (USD courant)',
      inflation: 'Inflation IPC',
      unavailable: 'Indisponible',
      activityTitle: 'Activité, Catastrophes, Infrastructures & Médias',
      windowNote: 'Fenêtre 7 jours + Référence Publique',
      noActivity: 'Aucun événement récent trouvé sur 7 jours.',
    },
    ai: {
      title: 'Analyste IA & Rapports de Situation',
      subtitle: 'Synthèse Gemini optionnelle fondée sur les données collectées, avec repli déterministe.',
      generate: 'Générer le Rapport',
      generating: 'Génération...',
      askPlaceholder: 'Posez une question basée sur les événements OSINT collectés...',
      askBtn: 'Envoyer',
      emptyPrompt: 'Sélectionnez un périmètre ou posez une question ci-dessus.',
      aiMode: 'ANALYSE GÉNÉRÉE PAR IA',
      ruleMode: 'SYNTHÈSE DÉTERMINISTE SANS IA',
      exportMd: 'Exporter MD',
      execSummary: 'Résumé Exécutif',
      keyDevs: 'Développements Clés',
      geoLocs: 'Localisations Géographiques',
      noGeoTags: 'Aucun pays spécifique extrait.',
      confAssessment: 'Évaluation de Confiance',
      infoGaps: 'Lacunes d’Information',
      contradictions: 'Rapports Contradictoires',
      supportingSources: 'Sources à l’Appui',
      link: 'Lien',
      savedReportsTitle: 'Rapports Sauvegardés Localement',
      savedReportsEmpty: 'Les rapports générés sont conservés localement dans IndexedDB.',
    },
    alerts: {
      title: 'Alertes, Listes de Surveillance & Favoris',
      subtitle: 'Évaluation locale des règles avec suppression des doublons.',
      enableNotif: 'Activer Notifications Navigateur',
      ackAll: 'Tout Acquitter',
      createRuleTitle: 'Créer une Règle d’Alerte',
      ruleName: 'Nom de la Règle',
      rulePlaceholder: 'ex. Mer Rouge / Séisme Alger',
      countriesLabel: 'Pays (séparés par virgule)',
      minSeverity: 'Gravité Min.',
      keywordsLabel: 'Mots-clés (séparés par virgule)',
      browserNotifCheck: 'Notification navigateur',
      saveRule: 'Enregistrer la Règle',
      configuredRules: 'Règles Configurées',
      noRules: 'Aucune règle personnalisée configurée.',
      active: 'Active',
      paused: 'En pause',
      triggeredLog: 'Journal des Alertes Déclenchées',
      noTriggered: 'Aucune alerte déclenchée pour le moment.',
      newBadge: 'NOUVEAU',
      watchlistsTitle: 'Listes de Surveillance Régionales',
      watchlistPlaceholder: 'Nom de la liste',
      isoPlaceholder: 'Codes ISO3 (DZA, EGY)',
      keywordsPlaceholder: 'Mots-clés',
      addBtn: 'Ajouter',
      savedEventsTitle: 'Événements Sauvegardés',
      savedEventsEmpty: 'Ajoutez un événement aux favoris pour le conserver hors ligne.',
    },
    timeline: {
      title: 'Chronologie Historique & Comparaison',
      subtitle: 'Distingue les observations historiques des flux temps réel. Export CSV disponible.',
      allRegions: 'Toutes Régions',
      allCategories: 'Toutes Catégories',
      exportCsv: 'Exporter CSV',
      distribution: 'Répartition des Événements',
      comparison: 'Comparaison d’Événements',
      clear: 'Effacer',
      selected: 'Sélectionné',
      compare: 'Comparer',
    },
    diagnostics: {
      title: 'Santé des Sources, Quotas & Diagnostics',
      subtitle: 'Vérification en direct des flux OSINT, codes HTTP, latence, cache et journaux d’erreurs.',
      runProbe: 'Lancer Sonde Complète',
      probing: 'Sonde en cours...',
      pingBtn: 'Ping Endpoints',
      pinging: 'Ping...',
      refreshBtn: 'Actualiser',
      exportJson: 'Exporter JSON',
      opRefFeeds: 'Flux Opérationnels / Référence',
      degUnavailFeeds: 'Flux Dégradés / Indisponibles',
      trackedRoutes: 'Routes API Suivies',
      geminiKey: 'Clé Serveur Gemini (Optionnelle)',
      configured: 'Configurée (gemini-4-hydrogen)',
      fallbackActive: 'Absente — Repli Déterministe',
      degradedModulesTitle: 'Modules Impactés / Dégradés',
      upstreamTitle: 'Sources de Données Amont',
      colSource: 'Source',
      colStatus: 'Statut',
      colHttp: 'HTTP',
      colRecords: 'Éléments',
      colLatency: 'Latence',
      colCadence: 'Fréquence',
      colEndpoint: 'Endpoint & Limites',
      endpointsTitle: 'Télémétrie des Endpoints Backend',
      colEndpointPath: 'Endpoint',
      colLastHttp: 'Dernier HTTP',
      colLastLatency: 'Dernière Latence',
      colAvgLatency: 'Latence Moy.',
      colCalls: 'Appels',
      colErrors: 'Erreurs',
      colLastCalled: 'Dernier Appel',
      noTelemetry: 'Aucune télémétrie capturée.',
      errorLogsTitle: 'Journaux d’Erreurs Récents',
      noErrors: 'Aucune erreur de synchronisation récente.',
      freeTierBadge: '100% Gratuit · Zéro API Payante',
      zeroPaidGuarantee: 'Tous les flux OSINT, modèles gratuits (gemini-4-hydrogen / gemini-3.1-flash-lite) et miroirs publics fonctionnent gratuitement avec synchronisation continue côté serveur.',
      refreshKeysBtn: 'Actualiser Clés & Miroirs',
      refreshingKeys: 'Synchronisation...',
      keyPoolTitle: 'Pool de Clés Serveur & Rotation Gratuite Continue',
      poolSlotsLabel: 'Emplacements',
      rotationsLabel: 'Rotations',
      lastReloadLabel: 'Dernière Synchro',
      autoSyncEveryLabel: 'Cycle Auto',
      freeModelsLabel: 'Modèles Gratuits',
      mirrorsTitle: 'Miroirs Publics Gratuits Sans Clé & Bascule Automatique',
      noKeyNeededBadge: 'Sans Clé · 100% Gratuit',
      failoversLabel: 'Bascules',
      slotLabel: 'Slot',
      readyState: 'Prêt',
      cooldownState: 'Pause',
      invalidState: 'Invalide',
      zeroCostFallbackNote: 'Fonctionnement 100% gratuit sans clé (corrélateur déterministe local + flux OSINT ouverts).',
    },
    settings: {
      title: 'Paramètres & Personnalisation Locale',
      subtitle: 'Toutes les préférences sont stockées localement dans IndexedDB sans inscription.',
      langTitle: 'Langue de l’Interface',
      langDesc: 'Change la langue de l’interface et des rapports IA (EN / AR / FR).',
      themeTitle: 'Thème Visuel',
      themeDesc: 'Mode Sombre Graphite ou mode Clair analytique.',
      dark: 'Sombre',
      light: 'Clair',
      refreshTitle: 'Intervalle d’Actualisation',
      refreshDesc: 'Fréquence de synchronisation respectant les quotas gratuits.',
      every2m: 'Toutes les 2 minutes',
      every5m: 'Toutes les 5 minutes (Recommandé)',
      every10m: 'Toutes les 10 minutes',
      manualOnly: 'Manuel uniquement',
      aiTitle: 'Analyste IA Gemini (Optionnel)',
      aiDesc: 'Si désactivé, les rapports utilisent la corrélation déterministe sans IA.',
      aiOn: 'Activé (Optionnel)',
      aiOff: 'Désactivé (Sans IA)',
      cacheTitle: 'Cache Hors Ligne IndexedDB',
      cacheDesc: 'Efface les instantanés locaux (conserve favoris et listes).',
      clearCache: 'Vider le Cache',
      cacheCleared: 'Cache Vidé',
    },
    pwa: {
      installApp: 'Installer l’App',
      installIos: 'Installer iOS',
      iosModalTitle: 'Installer World Intelligence Hub',
      iosStep1: 'Appuyez sur Partager dans Safari.',
      iosStep2: 'Sélectionnez Sur l’écran d’accueil.',
      iosStep3: 'Lancez WIH en mode autonome hors ligne.',
    },
    mobileNav: {
      overview: 'Accueil',
      map: 'Carte',
      conflicts: 'Conflits',
      alerts: 'Alertes',
      modules: 'Modules',
    },
  },
  ar: {
    freeOsint: 'استخبارات مفتوحة المصدر مجانية 100%',
    liveFeedsActive: 'مصادر نشطة',
    localSnapshot: 'آخر تحديث',
    degradedModulesPrefix: 'تنبيه: وحدات متأثرة أو متدهورة',
    inspectDiagnostics: 'فحص التشخيص',
    overview: {
      liveEvents: 'الأحداث المترابطة الحية',
      highConfRecords: 'سجل عالي الموثوقية',
      conflictReports: 'تقارير النزاعات والأمن',
      multiSourceGdelt: 'أخبار متعددة المصادر و GDELT',
      naturalHazards: 'المخاطر الطبيعية',
      cyberAdvisories: 'التنبيهات السيبرانية',
      cisaReporting: 'تحذيرات CISA والتقارير الأمنية',
      regionalBreakdown: 'توزيع الرصد الإقليمي',
      clickRegionFilter: 'اضغط على منطقة لتصفية الأخبار',
      highCount: 'مرتفع',
      liveFeedTitle: 'البث الاستخباراتي الحي',
      allSeverities: 'جميع المستويات',
      noFilterMatch: 'لا توجد أحداث مطابقة لمرشحات المنطقة والخطورة الحالية.',
      orgsCount: 'مصدر',
      confSuffix: 'ثقة',
    },
    feeds: {
      allCategories: 'جميع الفئات',
      allSeverities: 'جميع درجات الخطورة',
      allNatures: 'جميع أنواع المصادر',
      allLanguages: 'جميع اللغات (عربي/إنجليزي/فرنسي)',
      noRecords: 'لا توجد سجلات مطابقة للمرشحات الحالية في هذه الوحدة.',
      reportsCount: 'تقرير',
      conflictingClaims: 'روايات متضاربة',
      sourceLink: 'المصدر',
      conflictsTitle: 'مراقبة النزاعات والنشاط العسكري',
      conflictsSubtitle: 'الاشتباكات المسلحة المبلغ عنها، الغارات الجوية، الانفجارات، تقارير الإرهاب، والقواعد المرجعية الموثقة.',
      conflictsDisclaimer: 'يميز النظام بين التقارير المؤكدة من مصادر متعددة والروايات الفردية. إحداثيات القواعد العسكرية ثابتة ومرجعية فقط ولا تعبر عن انتشار ميداني حي.',
      disastersTitle: 'مركز استخبارات الكوارث الطبيعية',
      disastersSubtitle: 'رصد الزلازل الحي (USGS)، حرائق الغابات والانبعاثات الحرارية (NASA EONET / FIRMS)، الفيضانات والأعاصير والبراكين (GDACS).',
      cyberTitle: 'الاستخبارات السيبرانية والتحذيرات الدفاعية',
      cyberSubtitle: 'تحذيرات CISA الرسمية والتقارير المنشورة حول هجمات الفدية واختراقات البيانات والثغرات.',
      cyberDisclaimer: 'للاستخبارات الدفاعية ومتابعة التحذيرات العامة فقط. العديد من الحوادث السيبرانية لا ترتبط بإحداثيات جغرافية محددة.',
      geopoliticsTitle: 'الجيوسياسة والأخبار المرتبطة متعددة اللغات',
      geopoliticsSubtitle: 'تغطية مترابطة بالعربية والإنجليزية والفرنسية من BBC والجزيرة وفرانس 24 وDW وGDELT مع إزالة التكرار.',
    },
    map: {
      layersBtn: 'الطبقات',
      densityBtn: 'الكثافة',
      globalView: 'النظرة العالمية',
      countryLabel: 'الدولة',
      openProfile: 'فتح ملف الدولة',
      mappedMarkers: 'نقطة على الخريطة',
      drawerTitle: 'طبقات الخريطة الاستخباراتية (20)',
      rendererUnavailable: 'عارض الخريطة غير متاح',
      groups: {
        conflict: 'النزاعات والأمن',
        disaster: 'الكوارث الطبيعية',
        cyber: 'الاستخبارات السيبرانية',
        mobility: 'الملاحة الجوية والبحرية',
        infrastructure: 'البنية التحتية الاستراتيجية',
      },
    },
    detail: {
      emptyTitle: 'اختر حدثاً أو علامة على الخريطة',
      emptySubtitle: 'استعرض مصدر البيانات، توقيت النشر والجمع، دقة الإحداثيات، وعدد الجهات المستقلة المؤكدة للخبر.',
      openCountryProfile: 'فتح ملف الدولة',
      location: 'الموقع',
      unmapped: 'غير محدد جغرافياً',
      coordinates: 'الإحداثيات',
      noCoords: 'لا توجد إحداثيات',
      publishedTime: 'وقت النشر',
      collectedTime: 'وقت الجمع',
      magnitude: 'القوة (ريختر)',
      depth: 'العمق',
      provenanceConfidence: 'المصدر ومستوى الثقة',
      confSuffix: 'مستوى الثقة',
      classification: 'التصنيف',
      independentOrgs: 'الجهات المستقلة',
      totalReports: 'إجمالي التقارير',
      conflictingFlagged: 'تم رصد تضارب في التقارير',
      supportingSources: 'المصادر الداعمة',
      pubLabel: 'نُشر',
      originalLink: 'الرابط الأصلي',
      bookmarkAdd: 'حفظ الحدث محلياً',
      bookmarkRemove: 'إزالة من المحفوظات',
      exportJson: 'تصدير سجل JSON',
    },
    aviation: {
      title: 'تتبع حركة الطيران (ADS-B)',
      subtitle: 'بيانات ADS-B العامة (شبكة OpenSky / مجتمع ADS-B المفتوح). التغطية تعتمد على كثافة أجهزة الاستقبال.',
      refresh: 'تحديث',
      statusLabel: 'الحالة',
      querying: 'جاري الاستعلام من مستقبلات ADS-B العامة...',
      callsign: 'رمز النداء / ICAO24',
      originFeed: 'المنشأ / المصدر',
      coordinates: 'الإحداثيات',
      altitude: 'الارتفاع (م)',
      speed: 'السرعة (م/ث)',
      heading: 'الاتجاه',
      contact: 'آخر اتصال',
      loading: 'جاري تحميل مسارات الطائرات الحية...',
      empty: 'لا توجد بيانات طيران متاحة حالياً ضمن هذا النطاق الجغرافي.',
    },
    maritime: {
      title: 'النشاط البحري والمضائق ونظام AIS',
      subtitle: 'المضائق البحرية الاستراتيجية، الحوادث الملاحية من الأخبار العامة، وبث AIS الإقليمي المجاني لبحر البلطيق.',
      refreshAis: 'تحديث AIS',
      globalUnavailableTitle: 'سياسة المجانية التامة: استبعاد الاشتراكات التجارية لـ AIS',
      globalUnavailableNote: 'يستبعد التطبيق أي اشتراكات مدفوعة لضمان المجانية الكاملة؛ ويعتمد على بث Digitraffic البلطيقي المجاني (CC-BY-4.0) والمضائق العالمية وتقارير الحوادث.',
      regionalTitle: 'بث AIS الإقليمي المفتوح (Digitraffic فنلندا CC-BY-4.0)',
      chokepointsTitle: 'الموانئ والمضائق البحرية',
      staticRef: 'مرجع ثابت',
      incidentsTitle: 'الحوادث البحرية المبلغ عنها',
      noIncidents: 'لم يتم رصد عناوين حوادث بحرية في النطاق الزمني الحالي.',
      vesselsTitle: 'السفن الحية في منطقة البلطيق (AIS)',
      loading: 'جاري جلب مواقع السفن...',
      empty: 'لا توجد مسارات سفن متاحة حالياً.',
    },
    economy: {
      title: 'الاستخبارات الاقتصادية والسلع الاستراتيجية',
      subtitle: 'أسعار النفط والغاز الطبيعي والذهب والمؤشرات العالمية وأسعار الصرف من مصادر عامة مجانية.',
      refresh: 'تحديث',
      categories: { all: 'الكل', energy: 'الطاقة', metals: 'المعادن', index: 'المؤشرات', currency: 'العملات' },
      unavailable: 'غير متاح',
      observed: 'رصد',
    },
    country: {
      regionalTitle: 'لوحات الاستخبارات الإقليمية',
      regionalSubtitle: 'المناطق ذات الأولوية: الجزائر، شمال أفريقيا، الساحل، الشرق الأوسط، أوروبا، الولايات المتحدة، آسيا والمحيط الهادئ.',
      correlatedInTheater: 'سجلاً مترابطاً في النطاق',
      profileLabel: 'ملف الدولة',
      saveCountry: 'حفظ الدولة',
      savedCountry: 'دولة محفوظة',
      situationReport: 'تقرير الموقف',
      loading: 'جاري تحميل ملف الاستخبارات الوطني...',
      capital: 'العاصمة',
      region: 'الإقليم',
      population: 'السكان',
      area: 'المساحة',
      languages: 'اللغات',
      currencies: 'العملات',
      landBorders: 'الحدود البرية',
      islandNone: 'جزيرة / لا يوجد',
      macroTitle: 'المؤشرات الاقتصادية الكلية',
      gdp: 'الناتج المحلي الإجمالي (دولار)',
      inflation: 'معدل التضخم (CPI)',
      unavailable: 'غير متاح',
      activityTitle: 'النشاط الأمني والكوارث والبنية التحتية والأخبار',
      windowNote: 'نافذة 7 أيام + مراجع عامة',
      noActivity: 'لا توجد أحداث حديثة أو مراجع عامة مطابقة خلال آخر 7 أيام.',
    },
    ai: {
      title: 'محلل الاستخبارات وتقارير الموقف',
      subtitle: 'تحليل اختياري عبر Gemini مستند حصراً إلى البيانات الحية المجمّعة، مع وضع بديل حتمي بدون ذكاء اصطناعي.',
      generate: 'توليد التقرير',
      generating: 'جاري التحليل...',
      askPlaceholder: 'اطرح سؤالاً استخباراتياً مستنداً إلى الأحداث الحية (مثال: لخّص الزلازل والأحداث في شمال أفريقيا خلال 7 أيام)...',
      askBtn: 'اسأل',
      emptyPrompt: 'اختر نطاق التقرير أو اطرح سؤالاً استخباراتياً أعلاه لعرض الملخص التنفيذي والمصادر وفجوات المعلومات.',
      aiMode: 'تحليل مُولّد بالذكاء الاصطناعي',
      ruleMode: 'تحليل استنتاجي بدون ذكاء اصطناعي',
      exportMd: 'تصدير Markdown',
      execSummary: 'الملخص التنفيذي',
      keyDevs: 'أبرز التطورات',
      geoLocs: 'المواقع الجغرافية',
      noGeoTags: 'لم يتم استخراج وسوم دول محددة.',
      confAssessment: 'تقييم الثقة',
      infoGaps: 'فجوات المعلومات',
      contradictions: 'التقارير المتعارضة',
      supportingSources: 'المصادر الداعمة',
      link: 'الرابط',
      savedReportsTitle: 'التقارير المحفوظة محلياً',
      savedReportsEmpty: 'تُحفظ التقارير المولدة محلياً في IndexedDB للوصول إليها دون اتصال.',
    },
    alerts: {
      title: 'التنبيهات وقوائم المراقبة والأحداث المحفوظة',
      subtitle: 'تقييم محلي لقواعد التنبيه مع منع التكرار. تعمل إشعارات المتصفح أثناء فتح التطبيق أو تثبيته كـ PWA.',
      enableNotif: 'تفعيل إشعارات المتصفح',
      ackAll: 'تأكيد قراءة الكل',
      createRuleTitle: 'إنشاء قاعدة تنبيه',
      ruleName: 'اسم القاعدة',
      rulePlaceholder: 'مثال: ملاحة البحر الأحمر / زلازل الجزائر',
      countriesLabel: 'الدول (مفصولة بفاصلة)',
      minSeverity: 'الحد الأدنى للخطورة',
      keywordsLabel: 'الكلمات المفتاحية (مفصولة بفاصلة)',
      browserNotifCheck: 'إرسال إشعار متصفح',
      saveRule: 'حفظ قاعدة التنبيه',
      configuredRules: 'القواعد المفعّلة',
      noRules: 'لا توجد قواعد تنبيه مخصصة بعد.',
      active: 'نشط',
      paused: 'متوقف مؤقتاً',
      triggeredLog: 'سجل التنبيهات المُفعّلة',
      noTriggered: 'لم يتم تفعيل أي تنبيه بعد. أنشئ قاعدة لمراقبة المصادر الواردة.',
      newBadge: 'جديد',
      watchlistsTitle: 'قوائم المراقبة الإقليمية الشخصية',
      watchlistPlaceholder: 'اسم القائمة',
      isoPlaceholder: 'رموز ISO3 (DZA, EGY)',
      keywordsPlaceholder: 'الكلمات المفتاحية',
      addBtn: 'إضافة',
      savedEventsTitle: 'الأحداث المحفوظة',
      savedEventsEmpty: 'احفظ أي حدث من البث أو الخريطة للاحتفاظ به محلياً دون اتصال.',
    },
    timeline: {
      title: 'الخط الزمني التاريخي والمقارنة',
      subtitle: 'يميز بين الأرصاد التاريخية واللقطات الفورية مع إمكانية التصدير بصيغة CSV.',
      allRegions: 'جميع الأقاليم',
      allCategories: 'جميع الفئات',
      exportCsv: 'تصدير CSV',
      distribution: 'توزيع الأحداث حسب الفئة',
      comparison: 'مقارنة الأحداث',
      clear: 'مسح',
      selected: 'مختار',
      compare: 'مقارنة',
    },
    diagnostics: {
      title: 'صحة المصادر وحصص API وتشخيص النظام',
      subtitle: 'تحقق حي من مصادر الاستخبارات مفتوحة المصدر، رموز حالة HTTP، زمن الاستجابة، عمر التخزين المؤقت، وسجل الأخطاء.',
      runProbe: 'فحص شامل مباشر للمصادر',
      probing: 'جاري فحص جميع المصادر...',
      pingBtn: 'اختبار سريع للروابط (Ping)',
      pinging: 'جاري الفحص...',
      refreshBtn: 'تحديث',
      exportJson: 'تصدير JSON',
      opRefFeeds: 'مصادر تشغيلية / مرجعية',
      degUnavailFeeds: 'مصادر متدهورة / غير متاحة',
      trackedRoutes: 'مسارات الخادم المراقَبة',
      geminiKey: 'مفتاح Gemini الاختياري',
      configured: 'مُفعّل (gemini-4-hydrogen)',
      fallbackActive: 'غير مضبوط — التحليل الحتمي نشط',
      degradedModulesTitle: 'الوحدات المتدهورة أو المتأثرة حالياً',
      upstreamTitle: 'مصادر البيانات الخارجية',
      colSource: 'المصدر',
      colStatus: 'الحالة',
      colHttp: 'HTTP',
      colRecords: 'السجلات',
      colLatency: 'الاستجابة',
      colCadence: 'معدل التحديث',
      colEndpoint: 'الرابط والقيود الموثقة',
      endpointsTitle: 'قياسات نقاط نهاية الخادم (/api/*)',
      colEndpointPath: 'المسار',
      colLastHttp: 'آخر HTTP',
      colLastLatency: 'آخر زمن',
      colAvgLatency: 'متوسط الزمن',
      colCalls: 'الطلبات',
      colErrors: 'الأخطاء',
      colLastCalled: 'آخر طلب',
      noTelemetry: 'لم يتم تسجيل قياسات بعد.',
      errorLogsTitle: 'سجل الأخطاء الحديثة',
      noErrors: 'لم يتم تسجيل أخطاء مزامنة حديثة في هذه الجلسة.',
      freeTierBadge: 'مجانية تامة 100% · دون أي واجهات مدفوعة',
      zeroPaidGuarantee: 'تعمل جميع مصادر الاستخبارات والنماذج المجانية (gemini-4-hydrogen / gemini-3.1-flash-lite) والمزودات المفتوحة بتكلفة صفرية كاملة مع تحديث وتدوير مستمر للمفاتيح على الخادم.',
      refreshKeysBtn: 'تحديث المفاتيح والمزودين',
      refreshingKeys: 'جاري التحديث...',
      keyPoolTitle: 'التحديث المستمر وتدوير مفاتيح الخادم (الفئة المجانية)',
      poolSlotsLabel: 'مخازن المفاتيح',
      rotationsLabel: 'عمليات التدوير',
      lastReloadLabel: 'آخر مزامنة للبيئة',
      autoSyncEveryLabel: 'دورة التحديث التلقائي',
      freeModelsLabel: 'النماذج المجانية المعتمدة',
      mirrorsTitle: 'المزودات المجانية بدون مفتاح والتحويل التلقائي (Failover)',
      noKeyNeededBadge: 'بدون مفتاح · مجاني 100%',
      failoversLabel: 'التحويلات',
      slotLabel: 'منفذ',
      readyState: 'جاهز',
      cooldownState: 'تهدئة مؤقتة',
      invalidState: 'غير صالح',
      zeroCostFallbackNote: 'يعمل التطبيق الآن بالوضع المجاني الكامل بدون مفاتيح (المحرك التحليلي المحلي + المصادر المفتوحة).',
    },
    settings: {
      title: 'إعدادات المنصة والتخصيص المحلي',
      subtitle: 'جميع التفضيلات محفوظة محلياً في IndexedDB بدون تسجيل إلزامي أو تتبع.',
      langTitle: 'لغة الواجهة',
      langDesc: 'تغيير لغة الواجهة بالكامل ولغة تقارير المحلل الذكي (العربية / الإنجليزية / الفرنسية).',
      themeTitle: 'مظهر الواجهة',
      themeDesc: 'الوضع الداكن الاحترافي أو الوضع الفاتح.',
      dark: 'داكن',
      light: 'فاتح',
      refreshTitle: 'فترة التحديث التلقائي',
      refreshDesc: 'معدل المزامنة التلقائية مع احترام حدود المصادر المجانية.',
      every2m: 'كل دقيقتين',
      every5m: 'كل 5 دقائق (موصى به)',
      every10m: 'كل 10 دقائق',
      manualOnly: 'تحديث يدوي فقط',
      aiTitle: 'محلل Gemini الاختياري',
      aiDesc: 'عند التعطيل أو عدم وجود مفتاح، تعتمد التقارير على الترابط الحتمي دون ذكاء اصطناعي.',
      aiOn: 'مُفعّل (اختياري)',
      aiOff: 'مُعطّل (قواعد حتمية فقط)',
      cacheTitle: 'ذاكرة التخزين المؤقت للأحداث (IndexedDB)',
      cacheDesc: 'مسح اللقطات المخزنة محلياً مع الإبقاء على المحفوظات وقوائم المراقبة.',
      clearCache: 'مسح ذاكرة الأحداث',
      cacheCleared: 'تم مسح الذاكرة',
    },
    pwa: {
      installApp: 'تثبيت التطبيق',
      installIos: 'تثبيت iOS',
      iosModalTitle: 'تثبيت مركز الاستخبارات العالمي',
      iosStep1: 'اضغط على زر المشاركة في شريط Safari.',
      iosStep2: 'مرر للأسفل واختر إضافة إلى الشاشة الرئيسية.',
      iosStep3: 'افتح التطبيق بوضع مستقل يدعم العمل دون اتصال.',
    },
    mobileNav: {
      overview: 'الرئيسية',
      map: 'الخريطة',
      conflicts: 'النزاعات',
      alerts: 'التنبيهات',
      modules: 'الوحدات',
    },
  },
};

export function translateCategory(cat: IntelCategory, lang: SupportedLang): string {
  return CATEGORY_LABELS[lang]?.[cat] ?? cat.replace(/_/g, ' ');
}

export function translateSeverity(sev: SeverityLevel, lang: SupportedLang): string {
  return SEVERITY_LABELS[lang]?.[sev] ?? sev;
}

export function translateConfidence(conf: ConfidenceLevel, lang: SupportedLang): string {
  return CONFIDENCE_LABELS[lang]?.[conf] ?? conf;
}

export function translateNature(nature: ObservationNature, lang: SupportedLang): string {
  return NATURE_LABELS_I18N[lang]?.[nature] ?? nature.replace(/_/g, ' ');
}

export function translateRegion(region: string | undefined, lang: SupportedLang): string {
  if (!region) return REGION_LABELS[lang]?.Global ?? 'Global';
  return REGION_LABELS[lang]?.[region] ?? region;
}

export function translateStatus(
  status: 'operational' | 'degraded' | 'unavailable' | 'reference',
  lang: SupportedLang
): string {
  return STATUS_LABELS[lang]?.[status] ?? status;
}

export function formatUtcAndLocal(date: Date) {
  const utc = date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const local = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return { utc, local };
}

export function formatRelativeTime(iso: string, lang: SupportedLang = 'en'): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return lang === 'ar' ? 'غير معروف' : lang === 'fr' ? 'Inconnu' : 'Unknown';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) {
    if (lang === 'ar') return `منذ ${diffSec} ث`;
    if (lang === 'fr') return `il y a ${diffSec}s`;
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    if (lang === 'ar') return `منذ ${diffMin} د`;
    if (lang === 'fr') return `il y a ${diffMin}m`;
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 48) {
    if (lang === 'ar') return `منذ ${diffHr} س`;
    if (lang === 'fr') return `il y a ${diffHr}h`;
    return `${diffHr}h ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  if (lang === 'ar') return `منذ ${diffDays} ي`;
  if (lang === 'fr') return `il y a ${diffDays}j`;
  return `${diffDays}d ago`;
}

interface I18nContextValue {
  lang: SupportedLang;
  t: FullUiCopy;
  nav: Record<NavSection, string>;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  t: FULL_UI_COPY.en,
  nav: UI_STRINGS.en.nav,
});

export const I18nProvider: React.FC<{ lang: SupportedLang; children: React.ReactNode }> = ({ lang, children }) => {
  return React.createElement(
    I18nContext.Provider,
    {
      value: {
        lang,
        t: FULL_UI_COPY[lang] ?? FULL_UI_COPY.en,
        nav: (UI_STRINGS[lang] ?? UI_STRINGS.en).nav,
      },
    },
    children
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
