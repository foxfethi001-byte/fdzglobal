import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AIBriefingReport,
  AlertRule,
  IntelEvent,
  TriggeredAlert,
  UserPreferences,
} from '../types/intelligence';

interface WihDB extends DBSchema {
  preferences: {
    key: string;
    value: UserPreferences;
  };
  cached_events: {
    key: string;
    value: { id: string; range: string; savedAt: string; events: IntelEvent[] };
  };
  saved_events: {
    key: string;
    value: IntelEvent & { bookmarkedAt: string };
  };
  alert_rules: {
    key: string;
    value: AlertRule;
  };
  triggered_alerts: {
    key: string;
    value: TriggeredAlert;
  };
  saved_reports: {
    key: string;
    value: AIBriefingReport;
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  mapStyle: 'dark',
  refreshIntervalSec: 300,
  visibleLayers: [
    'armed_conflict',
    'military_incident',
    'airstrike_explosion',
    'political_unrest',
    'terrorism',
    'earthquake',
    'wildfire',
    'flood',
    'severe_weather',
    'volcano',
    'cyber_incident',
    'port_chokepoint',
  ],
  favoriteCountries: ['DZA', 'FRA', 'USA', 'UKR', 'PSE'],
  watchlists: [
    {
      id: 'wl-maghreb-sahel',
      name: 'Algeria, Maghreb & Sahel Monitor',
      countries: ['DZA', 'MAR', 'TUN', 'LBY', 'MLI', 'NER'],
      keywords: ['algeria', 'sahel', 'sonatrach', 'maghreb', 'mediterranean'],
    },
  ],
  savedSearches: [],
  aiEnabled: true,
  compactMode: false,
  theme: 'dark',
};

let dbPromise: Promise<IDBPDatabase<WihDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WihDB>('wih-local-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
        if (!db.objectStoreNames.contains('cached_events')) db.createObjectStore('cached_events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('saved_events')) db.createObjectStore('saved_events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('alert_rules')) db.createObjectStore('alert_rules', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('triggered_alerts')) db.createObjectStore('triggered_alerts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('saved_reports')) db.createObjectStore('saved_reports', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const db = await getDB();
    const saved = await db.get('preferences', 'user');
    return saved ? { ...DEFAULT_PREFERENCES, ...saved } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const db = await getDB();
  await db.put('preferences', prefs, 'user');
}

export async function cacheEventsOffline(range: string, events: IntelEvent[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('cached_events', {
      id: `range-${range}`,
      range,
      savedAt: new Date().toISOString(),
      events: events.slice(0, 500),
    });
  } catch {
    // ignore storage quota errors gracefully
  }
}

export async function loadCachedEventsOffline(range: string): Promise<{ savedAt: string; events: IntelEvent[] } | null> {
  try {
    const db = await getDB();
    const row = await db.get('cached_events', `range-${range}`);
    return row ? { savedAt: row.savedAt, events: row.events } : null;
  } catch {
    return null;
  }
}

export async function getSavedEvents(): Promise<Array<IntelEvent & { bookmarkedAt: string }>> {
  const db = await getDB();
  return db.getAll('saved_events');
}

export async function toggleSavedEvent(ev: IntelEvent): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get('saved_events', ev.id);
  if (existing) {
    await db.delete('saved_events', ev.id);
    return false;
  }
  await db.put('saved_events', { ...ev, bookmarkedAt: new Date().toISOString() });
  return true;
}

export async function getAlertRules(): Promise<AlertRule[]> {
  const db = await getDB();
  return db.getAll('alert_rules');
}

export async function saveAlertRule(rule: AlertRule): Promise<void> {
  const db = await getDB();
  await db.put('alert_rules', rule);
}

export async function deleteAlertRule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('alert_rules', id);
}

export async function getTriggeredAlerts(): Promise<TriggeredAlert[]> {
  const db = await getDB();
  const all = await db.getAll('triggered_alerts');
  return all.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
}

export async function saveTriggeredAlert(alert: TriggeredAlert): Promise<void> {
  const db = await getDB();
  await db.put('triggered_alerts', alert);
}

export async function acknowledgeAllAlerts(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('triggered_alerts');
  for (const a of all) {
    if (!a.acknowledged) {
      await db.put('triggered_alerts', { ...a, acknowledged: true });
    }
  }
}

export async function getSavedReports(): Promise<AIBriefingReport[]> {
  const db = await getDB();
  const all = await db.getAll('saved_reports');
  return all.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export async function saveReportLocally(report: AIBriefingReport): Promise<void> {
  const db = await getDB();
  await db.put('saved_reports', report);
}

export async function clearAllLocalCache(): Promise<void> {
  const db = await getDB();
  await db.clear('cached_events');
}
