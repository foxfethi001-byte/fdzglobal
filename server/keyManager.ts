import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import type {
  FreeProviderMirrorStatus,
  KeyPoolSlotStatus,
  KeyRotationSummary,
  MirrorCandidateStatus,
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
  totalLatencyMs: number;
  latencySamples: number;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
  lastUsedAt: string | null;
  lastCheckedAt: string | null;
  lastError?: string;
}

interface InternalMirrorCandidate {
  id: string;
  label: string;
  probeUrl: () => string;
  probeMethod?: 'GET' | 'HEAD';
  healthy: boolean;
  latencyMs: number | null;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
}

interface InternalMirrorGroup {
  id: string;
  name: string;
  bestCandidateId: string;
  failoverCount: number;
  lastUpdatedAt: string | null;
  candidates: InternalMirrorCandidate[];
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

function computeCandidateScore(c: InternalMirrorCandidate): number {
  const lat = c.latencyMs ?? 1200;
  if (c.healthy) {
    return Math.round(10_000 - Math.min(8000, lat));
  }
  return Math.round(-5000 - c.consecutiveFailures * 1500 - Math.min(4000, lat));
}

function computeSlotScore(s: InternalKeySlot): number {
  const total = s.successCount + s.errorCount;
  const successRate = total > 0 ? s.successCount / total : 1;
  const latPenalty = s.avgLatencyMs ?? s.lastLatencyMs ?? 350;
  if (s.status === 'invalid') return -20_000;
  if (s.status === 'cooldown') return -5_000;
  return Math.round(10_000 + successRate * 1000 - Math.min(6000, latPenalty));
}

class ZeroCostKeyAndMirrorManager {
  private slots: InternalKeySlot[] = [];
  private activeIdx = 0;
  private rotationCount = 0;
  private autoSwitchCount = 0;
  private reloadCount = 0;
  private lastReloadAt = new Date().toISOString();
  private lastRotationAt: string | null = null;
  private lastAutoBenchmarkAt: string | null = null;
  private lastEnvMtimeMs = 0;
  private lastSignature = '';
  private firmsKey = '';
  private openSkyUser = '';
  private openSkyPass = '';
  private autoSyncIntervalSec = Math.max(
    15,
    Number(process.env.KEY_ROTATION_INTERVAL_SEC || 30) || 30
  );
  private autoBenchmarkIntervalSec = 120;
  private nextAutoSyncAt = new Date(Date.now() + 30_000).toISOString();
  private inFlightBenchmark: Promise<KeyRotationSummary> | null = null;
  private mirrorGroups: Map<string, InternalMirrorGroup>;

  constructor() {
    this.mirrorGroups = new Map<string, InternalMirrorGroup>([
      [
        'aviation',
        {
          id: 'aviation',
          name: 'ADS-B Live Aviation',
          bestCandidateId: 'opensky',
          failoverCount: 0,
          lastUpdatedAt: null,
          candidates: [
            {
              id: 'opensky',
              label: 'OpenSky Network',
              probeUrl: () => 'https://opensky-network.org/api/states/all?lamin=35&lomin=0&lamax=38&lomax=5',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
            {
              id: 'adsb_regional',
              label: 'adsb.lol Regional (Keyless)',
              probeUrl: () => 'https://api.adsb.lol/v2/lat/36.7/lon/3.0/dist/120',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
            {
              id: 'adsb_mil',
              label: 'adsb.lol Global (Keyless)',
              probeUrl: () => 'https://api.adsb.lol/v2/mil',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
          ],
        },
      ],
      [
        'economy_yahoo',
        {
          id: 'economy_yahoo',
          name: 'Yahoo Finance Public Markets',
          bestCandidateId: 'yahoo_query1',
          failoverCount: 0,
          lastUpdatedAt: null,
          candidates: [
            {
              id: 'yahoo_query1',
              label: 'Yahoo Finance query1',
              probeUrl: () => 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
            {
              id: 'yahoo_query2',
              label: 'Yahoo Finance query2',
              probeUrl: () => 'https://query2.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
          ],
        },
      ],
      [
        'economy_fx',
        {
          id: 'economy_fx',
          name: 'Public FX Rates',
          bestCandidateId: 'openerapi',
          failoverCount: 0,
          lastUpdatedAt: null,
          candidates: [
            {
              id: 'openerapi',
              label: 'Open-ER-API (Free)',
              probeUrl: () => 'https://open.er-api.com/v6/latest/USD',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
            {
              id: 'frankfurter',
              label: 'Frankfurter ECB (Free)',
              probeUrl: () => 'https://api.frankfurter.dev/v1/latest?base=USD',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
          ],
        },
      ],
      [
        'firms',
        {
          id: 'firms',
          name: 'NASA FIRMS Active Fire',
          bestCandidateId: 'firms_public',
          failoverCount: 0,
          lastUpdatedAt: null,
          candidates: [
            {
              id: 'firms_public',
              label: 'NASA MODIS C6.1 24h CSV (Keyless)',
              probeUrl: () => 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv',
              probeMethod: 'HEAD',
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
          ],
        },
      ],
      [
        'maritime',
        {
          id: 'maritime',
          name: 'Free Open Maritime AIS',
          bestCandidateId: 'digitraffic',
          failoverCount: 0,
          lastUpdatedAt: null,
          candidates: [
            {
              id: 'digitraffic',
              label: 'Digitraffic Finland AIS (CC-BY-4.0)',
              probeUrl: () => `https://meri.digitraffic.fi/api/ais/v1/locations?from=${Date.now() - 300_000}`,
              healthy: true,
              latencyMs: null,
              consecutiveFailures: 0,
              lastCheckedAt: null,
            },
          ],
        },
      ],
    ]);

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

  private selectBestKeySlot() {
    if (this.slots.length === 0) {
      this.activeIdx = 0;
      return;
    }
    const ready = this.slots.filter((s) => s.status === 'ready');
    const pool = ready.length > 0 ? ready : this.slots;
    const best = [...pool].sort((a, b) => computeSlotScore(b) - computeSlotScore(a))[0];
    if (best && best.slotIndex !== this.activeIdx) {
      const prev = this.activeIdx;
      this.activeIdx = best.slotIndex;
      this.rotationCount++;
      this.autoSwitchCount++;
      this.lastRotationAt = new Date().toISOString();
      if (this.slots.length > 1) {
        console.info(`[WIH auto-switch] Switched active Gemini key slot #${prev + 1} -> #${best.slotIndex + 1} (${best.sourceVar}, score=${computeSlotScore(best)})`);
      }
    }
  }

  public syncFromEnvironment(force = false): boolean {
    const now = Date.now();
    this.nextAutoSyncAt = new Date(now + this.autoSyncIntervalSec * 1000).toISOString();

    for (const slot of this.slots) {
      if (slot.status === 'cooldown' && slot.cooldownUntil <= now) {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
      }
    }

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
      this.selectBestKeySlot();
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
            totalLatencyMs: 0,
            latencySamples: 0,
            lastLatencyMs: null,
            avgLatencyMs: null,
            lastUsedAt: null,
            lastCheckedAt: null,
          };
    });

    this.firmsKey = firmsCandidate;
    this.openSkyUser = openSkyUserCandidate;
    this.openSkyPass = openSkyPassCandidate;

    // Sync optional keyed NASA FIRMS candidate dynamically
    const firmsGroup = this.mirrorGroups.get('firms');
    if (firmsGroup) {
      const hasKeyed = firmsGroup.candidates.some((c) => c.id === 'firms_keyed');
      if (this.firmsKey && !hasKeyed) {
        firmsGroup.candidates.unshift({
          id: 'firms_keyed',
          label: 'NASA FIRMS Keyed API',
          probeUrl: () =>
            `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(this.firmsKey)}/VIIRS_SNPP_NRT/world/1`,
          probeMethod: 'HEAD',
          healthy: true,
          latencyMs: null,
          consecutiveFailures: 0,
          lastCheckedAt: null,
        });
        firmsGroup.bestCandidateId = 'firms_keyed';
      } else if (!this.firmsKey && hasKeyed) {
        firmsGroup.candidates = firmsGroup.candidates.filter((c) => c.id !== 'firms_keyed');
        firmsGroup.bestCandidateId = 'firms_public';
      }
    }

    if (this.activeIdx >= this.slots.length) {
      this.activeIdx = 0;
    }
    this.selectBestKeySlot();

    this.lastSignature = sig;
    this.reloadCount++;
    this.lastReloadAt = new Date(now).toISOString();
    return true;
  }

  public getGeminiKeyCandidates(): Array<{ key: string; slotIndex: number; sourceVar: string }> {
    this.syncFromEnvironment(false);
    if (this.slots.length === 0) return [];
    const now = Date.now();
    const ready: InternalKeySlot[] = [];

    for (const slot of this.slots) {
      if (slot.status === 'invalid') continue;
      if (slot.status === 'cooldown' && slot.cooldownUntil > now) continue;
      if (slot.status === 'cooldown' && slot.cooldownUntil <= now) {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
      }
      ready.push(slot);
    }

    // Order by highest computed healthScore (best reliability + lowest latency first)
    ready.sort((a, b) => computeSlotScore(b) - computeSlotScore(a));
    if (ready.length > 0 && ready[0].slotIndex !== this.activeIdx) {
      this.activeIdx = ready[0].slotIndex;
    }
    return ready.map((s) => ({ key: s.key, slotIndex: s.slotIndex, sourceVar: s.sourceVar }));
  }

  public markGeminiSuccess(slotIndex: number, latencyMs?: number) {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    slot.status = 'ready';
    slot.cooldownUntil = 0;
    slot.successCount++;
    slot.lastUsedAt = new Date().toISOString();
    slot.lastError = undefined;
    if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
      slot.lastLatencyMs = Math.max(1, Math.round(latencyMs));
      slot.totalLatencyMs += slot.lastLatencyMs;
      slot.latencySamples++;
      slot.avgLatencyMs = Math.round(slot.totalLatencyMs / slot.latencySamples);
    }
    this.selectBestKeySlot();
  }

  public markGeminiError(slotIndex: number, errMsg: string, latencyMs?: number) {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    const now = Date.now();
    slot.errorCount++;
    slot.lastUsedAt = new Date(now).toISOString();
    slot.lastError = errMsg.slice(0, 180);
    if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
      slot.lastLatencyMs = Math.max(1, Math.round(latencyMs));
    }

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

    this.selectBestKeySlot();
  }

  public getRankedMirrors(groupId: string): MirrorCandidateStatus[] {
    const group = this.mirrorGroups.get(groupId);
    if (!group) return [];
    const sorted = [...group.candidates].sort((a, b) => computeCandidateScore(b) - computeCandidateScore(a));
    const bestId = sorted[0]?.id ?? group.bestCandidateId;
    return sorted.map((c) => ({
      id: c.id,
      label: c.label,
      healthy: c.healthy,
      latencyMs: c.latencyMs,
      score: computeCandidateScore(c),
      isBest: c.id === bestId,
      lastCheckedAt: c.lastCheckedAt,
    }));
  }

  public recordMirrorResult(groupId: string, candidateId: string, ok: boolean, latencyMs?: number) {
    const group = this.mirrorGroups.get(groupId);
    if (!group) return;
    const candidate = group.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    const nowIso = new Date().toISOString();
    candidate.lastCheckedAt = nowIso;
    if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
      candidate.latencyMs = Math.max(1, Math.round(latencyMs));
    }
    if (ok) {
      candidate.healthy = true;
      candidate.consecutiveFailures = 0;
    } else {
      candidate.healthy = false;
      candidate.consecutiveFailures++;
    }

    const sorted = [...group.candidates].sort((a, b) => computeCandidateScore(b) - computeCandidateScore(a));
    const nextBest = sorted[0];
    if (nextBest && nextBest.id !== group.bestCandidateId) {
      const prevId = group.bestCandidateId;
      group.bestCandidateId = nextBest.id;
      group.failoverCount++;
      this.autoSwitchCount++;
      console.info(
        `[WIH auto-switch] Server group "${groupId}" automatically switched ${prevId} -> ${nextBest.id} (${nextBest.label}, ${nextBest.latencyMs ?? '?'}ms)`
      );
    }
    group.lastUpdatedAt = nowIso;
  }

  // Backward-compatible helper
  public recordMirrorUpdate(id: string, activeEndpoint: string, isFailover: boolean) {
    const mappedGroup = id === 'economy' ? 'economy_fx' : id;
    const group = this.mirrorGroups.get(mappedGroup);
    if (!group) return;
    group.lastUpdatedAt = new Date().toISOString();
    if (isFailover) {
      group.failoverCount++;
    }
    const matching = group.candidates.find((c) => activeEndpoint.toLowerCase().includes(c.id.replace('_', ' ')) || activeEndpoint.includes(c.label));
    if (matching) {
      group.bestCandidateId = matching.id;
    }
  }

  private async probeSingleMirror(groupId: string, candidate: InternalMirrorCandidate) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'WorldIntelligenceHub/1.0 (+https://github.com/wih-osint; contact@wih.local)',
        Accept: 'application/json, text/csv, */*',
      };
      if (candidate.id === 'opensky') {
        const auth = this.getOptionalOpenSkyAuthHeader();
        if (auth) headers.Authorization = auth;
      }
      const res = await fetch(candidate.probeUrl(), {
        method: candidate.probeMethod ?? 'GET',
        headers,
        signal: controller.signal,
      });
      const lat = Date.now() - started;
      this.recordMirrorResult(groupId, candidate.id, res.ok, lat);
    } catch {
      const lat = Date.now() - started;
      this.recordMirrorResult(groupId, candidate.id, false, lat);
    } finally {
      clearTimeout(timer);
    }
  }

  private async probeSingleGeminiKey(slot: InternalKeySlot) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      // Zero-token metadata validation endpoint using header (never passes key in URL)
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: {
          'x-goog-api-key': slot.key,
          'User-Agent': 'aistudio-build',
        },
        signal: controller.signal,
      });
      const lat = Date.now() - started;
      slot.lastCheckedAt = new Date().toISOString();
      if (res.ok) {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
        slot.lastLatencyMs = lat;
        slot.totalLatencyMs += lat;
        slot.latencySamples++;
        slot.avgLatencyMs = Math.round(slot.totalLatencyMs / slot.latencySamples);
        slot.lastError = undefined;
      } else {
        this.markGeminiError(slot.slotIndex, `HTTP ${res.status}`, lat);
      }
    } catch (err) {
      const lat = Date.now() - started;
      slot.lastCheckedAt = new Date().toISOString();
      this.markGeminiError(slot.slotIndex, err instanceof Error ? err.message : 'Probe timeout', lat);
    } finally {
      clearTimeout(timer);
    }
  }

  public async runAutomaticServerAndKeyCheck(): Promise<KeyRotationSummary> {
    if (this.inFlightBenchmark) {
      return this.inFlightBenchmark;
    }

    this.inFlightBenchmark = (async () => {
      this.syncFromEnvironment(false);
      const tasks: Array<Promise<void>> = [];

      for (const [groupId, group] of this.mirrorGroups.entries()) {
        for (const candidate of group.candidates) {
          tasks.push(this.probeSingleMirror(groupId, candidate));
        }
      }

      for (const slot of this.slots) {
        tasks.push(this.probeSingleGeminiKey(slot));
      }

      await Promise.allSettled(tasks);
      this.selectBestKeySlot();
      this.lastAutoBenchmarkAt = new Date().toISOString();
      return this.getSummary();
    })();

    try {
      return await this.inFlightBenchmark;
    } finally {
      this.inFlightBenchmark = null;
    }
  }

  public async forceRefreshAndRotate(): Promise<KeyRotationSummary> {
    this.syncFromEnvironment(true);
    for (const slot of this.slots) {
      if (slot.status !== 'ready') {
        slot.status = 'ready';
        slot.cooldownUntil = 0;
      }
    }
    return this.runAutomaticServerAndKeyCheck();
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
      lastLatencyMs: s.lastLatencyMs,
      avgLatencyMs: s.avgLatencyMs,
      healthScore: computeSlotScore(s),
      isBest: s.slotIndex === this.activeIdx && s.status === 'ready',
      lastUsedAt: s.lastUsedAt,
      lastCheckedAt: s.lastCheckedAt,
      lastError: s.lastError,
    }));

    const mirrors: FreeProviderMirrorStatus[] = Array.from(this.mirrorGroups.values()).map((g) => {
      const sorted = [...g.candidates].sort((a, b) => computeCandidateScore(b) - computeCandidateScore(a));
      const best = sorted[0];
      const candidates: MirrorCandidateStatus[] = sorted.map((c) => ({
        id: c.id,
        label: c.label,
        healthy: c.healthy,
        latencyMs: c.latencyMs,
        score: computeCandidateScore(c),
        isBest: c.id === best?.id,
        lastCheckedAt: c.lastCheckedAt,
      }));
      return {
        id: g.id,
        name: g.name,
        activeEndpoint: best?.label ?? g.bestCandidateId,
        bestEndpointId: best?.id ?? g.bestCandidateId,
        activeLatencyMs: best?.latencyMs ?? null,
        mirrorCount: g.candidates.length,
        failoverCount: g.failoverCount,
        requiresKey: false,
        lastUpdatedAt: g.lastUpdatedAt,
        candidates,
      };
    });

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
      autoSwitchCount: this.autoSwitchCount,
      reloadCount: this.reloadCount,
      firmsKeyConfigured: Boolean(this.firmsKey),
      openSkyAuthConfigured: Boolean(this.openSkyUser && this.openSkyPass),
      lastReloadAt: this.lastReloadAt,
      lastRotationAt: this.lastRotationAt,
      lastAutoBenchmarkAt: this.lastAutoBenchmarkAt,
      nextAutoSyncAt: this.nextAutoSyncAt,
      autoSyncIntervalSec: this.autoSyncIntervalSec,
      autoBenchmarkIntervalSec: this.autoBenchmarkIntervalSec,
      autoBenchmarkActive: true,
      slots: publicSlots,
      mirrors,
    };
  }
}

export const keyManager = new ZeroCostKeyAndMirrorManager();
