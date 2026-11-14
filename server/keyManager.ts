import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import type {
  FreeProviderMirrorStatus,
  KeyPoolSlotStatus,
  KeyRotationSummary,
} from '../src/types/intelligence.ts';

export const FREE_GEMINI_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

interface InternalKeySlot {
  key: string;
  slotIndex: number;
  sourceVar: string;
  status: 'ready' | 'cooldown' | 'invalid';
  cooldownUntil: number;
  successCount: number;
  errorCount: number;
  lastUsedAt: string | null;
  lastError?: string;
}

const PLACEHOLDER_VALUES = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'REPLACE_ME',
  'NONE',
  'NULL',
]);

function isUsableKey(val: string | undefined): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length < 12) return false;
  return !PLACEHOLDER_VALUES.has(trimmed.toUpperCase()) && trimmed !== 'MY_GEMINI_API_KEY';
}

class ZeroCostKeyAndMirrorManager {
  private slots: InternalKeySlot[] = [];
  private activeIdx = 0;
  private rotationCount = 0;
  private reloadCount = 0;
  private lastReloadAt = new Date().toISOString();
  private lastRotationAt: string | null = null;
  private lastEnvMtimeMs = 0;
  private lastSignature = '';
  private firmsKey = '';
  private openSkyUser = '';
  private openSkyPass = '';
  private autoSyncIntervalSec = Math.max(
    15,
    Number(process.env.KEY_ROTATION_INTERVAL_SEC || 30) || 30
  );
  private nextAutoSyncAt = new Date(Date.now() + 30_000).toISOString();
  private mirrors = new Map<string, FreeProviderMirrorStatus>([
    [
      'aviation',
      {
        id: 'aviation',
        name: 'ADS-B Live Aviation',
        activeEndpoint: 'OpenSky Network / adsb.lol v2 Community',
        mirrorCount: 3,
        failoverCount: 0,
        requiresKey: false,
        lastUpdatedAt: null,
      },
    ],
    [
      'economy',
      {
        id: 'economy',
        name: 'Public Markets & FX',
        activeEndpoint: 'Yahoo Finance (query1/query2) + Open-ER-API / Frankfurter',
        mirrorCount: 4,
        failoverCount: 0,
        requiresKey: false,
        lastUpdatedAt: null,
      },
    ],
    [
      'firms',
      {
        id: 'firms',
        name: 'NASA FIRMS Active Fire',
        activeEndpoint: 'NASA MODIS C6.1 Public 24h CSV',
        mirrorCount: 2,
        failoverCount: 0,
        requiresKey: false,
        lastUpdatedAt: null,
      },
    ],
    [
      'maritime',
      {
        id: 'maritime',
        name: 'Free Open Maritime AIS',
        activeEndpoint: 'Digitraffic Finland AIS (CC-BY-4.0)',
        mirrorCount: 1,
        failoverCount: 0,
        requiresKey: false,
        lastUpdatedAt: null,
      },
    ],
    [
      'ai',
      {
        id: 'ai',
        name: 'Analyst Engine',
        activeEndpoint: 'Gemini Free-Tier + Deterministic Local Correlator',
        mirrorCount: 3,
        failoverCount: 0,
        requiresKey: false,
        lastUpdatedAt: null,
      },
    ],
  ]);

  constructor() {
    this.syncFromEnvironment(true);
  }

  private readDotEnvOverrides(): Record<string, string> {
    const envFiles = ['.env', '.env.local'];
    const merged: Record<string, string> = {};
    let maxMtime = 0;

    for (const fname of envFiles) {
      const fullPath = path.resolve(process.cwd(), fname);
      try {
        if (!fs.existsSync(fullPath)) continue;
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
        const parsed = dotenv.parse(fs.readFileSync(fullPath, 'utf8'));
        Object.assign(merged, parsed);
      } catch {
        // Ignore transient file read errors during atomic writes
      }
    }
    if (maxMtime > 0) this.lastEnvMtimeMs = maxMtime;
    return merged;
  }

  private collectCandidateKeys(envMap: Record<string, string | undefined>): Array<{ key: string; sourceVar: string }> {
    const seen = new Set<string>();
    const out: Array<{ key: string; sourceVar: string }> = [];

    const pushKey = (raw: string | undefined, sourceVar: string) => {
      if (!isUsableKey(raw)) return;
      const k = raw.trim();
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ key: k, sourceVar });
    };

    pushKey(envMap.GEMINI_API_KEY, 'GEMINI_API_KEY');

    if (envMap.GEMINI_API_KEYS) {
      const parts = envMap.GEMINI_API_KEYS.split(/[,;\s]+/).filter(Boolean);
      parts.forEach((p, i) => pushKey(p, `GEMINI_API_KEYS[${i + 1}]`));
    }

    for (let i = 1; i <= 10; i++) {
      const varName = `GEMINI_API_KEY_${i}`;
      pushKey(envMap[varName], varName);
    }

    return out;
  }

  public syncFromEnvironment(force = false): boolean {
    const now = Date.now();
    this.nextAutoSyncAt = new Date(now + this.autoSyncIntervalSec * 1000).toISOString();

    // Recover expired cooldowns continuously
    for (const slot of this.slots) {
      if (slot.status === 'cooldown' && slot.cooldownUntil <= now) {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
      }
    }

    // Check if .env or .env.local changed on disk
    let diskChanged = false;
    for (const fname of ['.env', '.env.local']) {
      const fullPath = path.resolve(process.cwd(), fname);
      try {
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > this.lastEnvMtimeMs) diskChanged = true;
        }
      } catch {
        // ignore
      }
    }

    const diskEnv = diskChanged || force ? this.readDotEnvOverrides() : {};
    const effectiveEnv: Record<string, string | undefined> = {
      ...process.env,
      ...diskEnv,
    };

    // Update process.env when .env on disk was updated so external updates hot-reload seamlessly
    if (diskChanged) {
      for (const [k, v] of Object.entries(diskEnv)) {
        if (typeof v === 'string' && v.trim() !== '') {
          process.env[k] = v;
        }
      }
    }

    const candidates = this.collectCandidateKeys(effectiveEnv);
    const firmsCandidate = effectiveEnv.NASA_FIRMS_KEY?.trim() || '';
    const openSkyUserCandidate = effectiveEnv.OPENSKY_USERNAME?.trim() || '';
    const openSkyPassCandidate = effectiveEnv.OPENSKY_PASSWORD?.trim() || '';

    const sig = `${candidates.map((c) => `${c.sourceVar}:${c.key.slice(-4)}`).join('|')}#${firmsCandidate ? 1 : 0}#${openSkyUserCandidate ? 1 : 0}`;
    if (!force && !diskChanged && sig === this.lastSignature) {
      return false;
    }

    const existingByKey = new Map(this.slots.map((s) => [s.key, s]));
    this.slots = candidates.map((c, idx) => {
      const prev = existingByKey.get(c.key);
      return prev
        ? { ...prev, slotIndex: idx, sourceVar: c.sourceVar }
        : {
            key: c.key,
            slotIndex: idx,
            sourceVar: c.sourceVar,
            status: 'ready',
            cooldownUntil: 0,
            successCount: 0,
            errorCount: 0,
            lastUsedAt: null,
          };
    });

    if (this.activeIdx >= this.slots.length) {
      this.activeIdx = 0;
    }

    this.firmsKey = firmsCandidate;
    this.openSkyUser = openSkyUserCandidate;
    this.openSkyPass = openSkyPassCandidate;
    this.lastSignature = sig;
    this.reloadCount++;
    this.lastReloadAt = new Date(now).toISOString();

    if (this.firmsKey) {
      this.recordMirrorUpdate('firms', 'NASA FIRMS Keyed API + Public CSV Backup', false);
    } else {
      this.recordMirrorUpdate('firms', 'NASA FIRMS MODIS C6.1 Public 24h CSV (Free Keyless)', false);
    }
    this.recordMirrorUpdate(
      'ai',
      this.slots.length > 0
        ? `Gemini Free-Tier Pool (${this.slots.length} slot) + Local Fallback`
        : 'Deterministic Rule-Based Correlator (100% Free Local)',
      false
    );

    return true;
  }

  public getGeminiKeyCandidates(): Array<{ key: string; slotIndex: number; sourceVar: string }> {
    this.syncFromEnvironment(false);
    if (this.slots.length === 0) return [];
    const now = Date.now();
    const ordered: Array<{ key: string; slotIndex: number; sourceVar: string }> = [];
    for (let offset = 0; offset < this.slots.length; offset++) {
      const idx = (this.activeIdx + offset) % this.slots.length;
      const slot = this.slots[idx];
      if (slot.status === 'invalid') continue;
      if (slot.status === 'cooldown' && slot.cooldownUntil > now) continue;
      if (slot.status === 'cooldown' && slot.cooldownUntil <= now) {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
      }
      ordered.push({ key: slot.key, slotIndex: slot.slotIndex, sourceVar: slot.sourceVar });
    }
    return ordered;
  }

  public markGeminiSuccess(slotIndex: number) {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    slot.status = 'ready';
    slot.cooldownUntil = 0;
    slot.successCount++;
    slot.lastUsedAt = new Date().toISOString();
    slot.lastError = undefined;
    // Rotate active pointer round-robin when multiple free keys exist to distribute quota evenly
    if (this.slots.length > 1) {
      this.activeIdx = (slotIndex + 1) % this.slots.length;
      this.rotationCount++;
      this.lastRotationAt = new Date().toISOString();
    }
  }

  public markGeminiError(slotIndex: number, errMsg: string) {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    const now = Date.now();
    slot.errorCount++;
    slot.lastUsedAt = new Date(now).toISOString();
    slot.lastError = errMsg.slice(0, 180);

    const isInvalid = /(API_KEY_INVALID|PERMISSION_DENIED|403|401|invalid api key)/i.test(errMsg);
    const isQuota = /(RESOURCE_EXHAUSTED|429|quota|rate limit)/i.test(errMsg);

    if (isInvalid) {
      slot.status = 'invalid';
      slot.cooldownUntil = now + 600_000;
    } else if (isQuota) {
      slot.status = 'cooldown';
      slot.cooldownUntil = now + 90_000;
    } else {
      slot.status = 'cooldown';
      slot.cooldownUntil = now + 30_000;
    }

    if (this.slots.length > 1) {
      this.activeIdx = (slotIndex + 1) % this.slots.length;
      this.rotationCount++;
      this.lastRotationAt = new Date(now).toISOString();
    }
  }

  public forceRefreshAndRotate(): KeyRotationSummary {
    this.syncFromEnvironment(true);
    const now = new Date().toISOString();
    // Reset temporary cooldowns/errors so rotated or newly refreshed keys can be retried cleanly
    for (const slot of this.slots) {
      if (slot.status !== 'ready') {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
      }
    }
    if (this.slots.length > 1) {
      this.activeIdx = (this.activeIdx + 1) % this.slots.length;
      this.rotationCount++;
      this.lastRotationAt = now;
    }
    return this.getSummary();
  }

  public recordMirrorUpdate(id: string, activeEndpoint: string, isFailover: boolean) {
    const prev = this.mirrors.get(id);
    if (!prev) return;
    this.mirrors.set(id, {
      ...prev,
      activeEndpoint,
      failoverCount: isFailover ? prev.failoverCount + 1 : prev.failoverCount,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  public getOptionalFirmsKey(): string {
    return this.firmsKey;
  }

  public getOptionalOpenSkyAuthHeader(): string | null {
    if (!this.openSkyUser || !this.openSkyPass) return null;
    const token = Buffer.from(`${this.openSkyUser}:${this.openSkyPass}`).toString('base64');
    return `Basic ${token}`;
  }

  public isGeminiConfigured(): boolean {
    this.syncFromEnvironment(false);
    return this.slots.length > 0;
  }

  public getSummary(): KeyRotationSummary {
    this.syncFromEnvironment(false);
    const now = Date.now();
    const publicSlots: KeyPoolSlotStatus[] = this.slots.map((s) => ({
      slotIndex: s.slotIndex,
      sourceVar: s.sourceVar,
      status: s.status,
      cooldownRemainingSec: s.cooldownUntil > now ? Math.ceil((s.cooldownUntil - now) / 1000) : 0,
      successCount: s.successCount,
      errorCount: s.errorCount,
      lastUsedAt: s.lastUsedAt,
      lastError: s.lastError,
    }));

    return {
      freeTierOnly: true,
      zeroPaidApis: true,
      aiConfigured: this.slots.length > 0,
      aiMode: this.slots.length > 0 ? 'gemini_pool' : 'rule_based_free_fallback',
      allowedFreeModels: [...FREE_GEMINI_MODELS],
      poolSize: this.slots.length,
      activeSlotIndex: this.slots.length > 0 ? this.activeIdx : 0,
      readyCount: publicSlots.filter((s) => s.status === 'ready').length,
      cooldownCount: publicSlots.filter((s) => s.status === 'cooldown').length,
      invalidCount: publicSlots.filter((s) => s.status === 'invalid').length,
      rotationCount: this.rotationCount,
      reloadCount: this.reloadCount,
      firmsKeyConfigured: Boolean(this.firmsKey),
      openSkyAuthConfigured: Boolean(this.openSkyUser && this.openSkyPass),
      lastReloadAt: this.lastReloadAt,
      lastRotationAt: this.lastRotationAt,
      nextAutoSyncAt: this.nextAutoSyncAt,
      autoSyncIntervalSec: this.autoSyncIntervalSec,
      slots: publicSlots,
      mirrors: Array.from(this.mirrors.values()),
    };
  }
}

export const keyManager = new ZeroCostKeyAndMirrorManager();
