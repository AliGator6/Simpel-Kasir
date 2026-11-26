import { formatDateShort, toDateKey } from './storage';

const LICENSE_STORAGE_KEY = 'simpelkasir_license_state_v1';
const VENDOR_HISTORY_KEY = 'simpelkasir_vendor_history_v1';
const REMINDER_DATE_STORAGE_KEY = 'simpelkasir_lic_reminder_date_v1';

// Crockford-style unambiguous 32-char alphabet (excludes 0/O and 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const EPOCH_2025_UTC_MS = Date.UTC(2025, 0, 1);
const MS_PER_DAY = 86_400_000;

// Constant offline signing secret shared between app verifier & vendor generator
const SIGNING_SECRET = 'SimpelKasir_Offline_License_Cara1_2026_v1';
// SHA-256("SK_VENDOR_GATE_V1::261126")
const VENDOR_PIN_SHA256 = 'c264ac0dbf7a114046106ca6831ab74bb2dfb8bc2ffe7e02611ec08bbb64b64e';

export const TRIAL_DAYS = 7;
export const EXPIRY_REMINDER_DAYS = 3;

export type LicensePlanOption = 'permanen' | '30d' | '90d' | '365d';

export interface LocalLicenseState {
  deviceId: string;
  trialStartMs: number;
  activationCode: string;
}

export interface LicenseVerificationResult {
  valid: boolean;
  plan: 'permanen' | 'berjangka' | null;
  expiresAtMs: number | null;
  expired?: boolean;
  reason?: string;
  normalizedCode?: string;
}

export interface LicenseEvaluation {
  status: 'licensed_permanent' | 'licensed_timed' | 'trial' | 'expired';
  isUnlocked: boolean;
  daysLeft: number;
  expiresAtMs: number | null;
  headline: string;
  detail: string;
}

export interface GeneratedLicenseRecord {
  id: string;
  deviceId: string;
  code: string;
  plan: LicensePlanOption;
  planLabel: string;
  expiresAtMs: number | null;
  note: string;
  createdAt: number;
}

// =========================================================================
// Pure-TS Synchronous SHA-256 (Works 100% offline even on non-HTTPS WebView)
// =========================================================================

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function utf8ToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = unescape(encodeURIComponent(str));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    out[i] = encoded.charCodeAt(i);
  }
  return out;
}

export function sha256Bytes(message: string): Uint8Array {
  const input = utf8ToBytes(message);
  const bitLen = input.length * 8;
  const paddedLen = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function sha256Hex(message: string): string {
  return Array.from(sha256Bytes(message))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =========================================================================
// Device ID & Formatting Helpers
// =========================================================================

function encode15Bits(val: number): string {
  const clamped = Math.max(0, Math.min(32767, Math.floor(val)));
  return (
    ALPHABET[(clamped >> 10) & 31] +
    ALPHABET[(clamped >> 5) & 31] +
    ALPHABET[clamped & 31]
  );
}

function decode15Bits(str3: string): number {
  if (str3.length !== 3) return -1;
  const a = ALPHABET.indexOf(str3[0]);
  const b = ALPHABET.indexOf(str3[1]);
  const c = ALPHABET.indexOf(str3[2]);
  if (a < 0 || b < 0 || c < 0) return -1;
  return (a << 10) | (b << 5) | c;
}

function encode40BitSignature(bytes: Uint8Array): string {
  // Take first 5 bytes = 40 bits -> 8 Base32 characters
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < 5; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
  }
  return out;
}

export function normalizeDeviceId(raw: string): string {
  let clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('SK') && clean.length === 10) {
    clean = clean.slice(2);
  }
  if (clean.length > 8 && clean.startsWith('SK')) {
    clean = clean.slice(2, 10);
  }
  clean = clean.slice(0, 8);
  return clean ? `SK${clean}` : '';
}

export function formatDeviceId(raw: string): string {
  const norm = normalizeDeviceId(raw);
  if (norm.length < 10) return raw.toUpperCase().trim();
  const body = norm.slice(2);
  return `SK-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export function formatActivationInput(raw: string): string {
  const clean = (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join('-');
}

function generateWebFallbackDeviceId(): string {
  const seed = `${Date.now()}-${Math.random()}-${navigator.userAgent || ''}`;
  const digest = sha256Bytes(`SK_WEB_DEV_V1::${seed}`);
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[digest[i] % ALPHABET.length];
  }
  return `SK-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

// =========================================================================
// Core Offline License Signing & Verification (Cara 1)
// =========================================================================

function computeLicenseTag(normalizedDevId: string, planChar: string, expiryCode: string): string {
  const payload = `${SIGNING_SECRET}|${normalizedDevId}|${planChar}${expiryCode}`;
  return encode40BitSignature(sha256Bytes(payload));
}

export function generateActivationCode(
  rawDeviceId: string,
  plan: LicensePlanOption,
  nowMs = Date.now()
): { code: string; deviceId: string; expiresAtMs: number | null; planLabel: string } {
  const normDev = normalizeDeviceId(rawDeviceId);
  if (normDev.length !== 10) {
    throw new Error('ID Perangkat harus 8 karakter setelah SK- (contoh: SK-7F2A-91C4).');
  }

  let planChar = 'P';
  let expiryDaysVal = 0;
  let expiresAtMs: number | null = null;
  let planLabel = 'Permanen (Selamanya)';

  if (plan !== 'permanen') {
    planChar = 'D';
    const addDays = plan === '30d' ? 30 : plan === '90d' ? 90 : 365;
    planLabel = plan === '30d' ? 'Aktif 30 Hari' : plan === '90d' ? 'Aktif 90 Hari' : 'Aktif 1 Tahun (365 Hari)';
    const todayDayIndex = Math.max(1, Math.floor((nowMs - EPOCH_2025_UTC_MS) / MS_PER_DAY));
    expiryDaysVal = Math.min(32767, todayDayIndex + addDays);
    expiresAtMs = EPOCH_2025_UTC_MS + expiryDaysVal * MS_PER_DAY + (MS_PER_DAY - 1);
  }

  const expiryCode = encode15Bits(expiryDaysVal);
  const tag = computeLicenseTag(normDev, planChar, expiryCode);
  const raw12 = `${planChar}${expiryCode}${tag}`;
  return {
    code: `${raw12.slice(0, 4)}-${raw12.slice(4, 8)}-${raw12.slice(8, 12)}`,
    deviceId: formatDeviceId(normDev),
    expiresAtMs,
    planLabel,
  };
}

export function verifyActivationCode(
  rawCode: string,
  deviceId: string,
  nowMs = Date.now()
): LicenseVerificationResult {
  const clean = (rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 12) {
    return {
      valid: false,
      plan: null,
      expiresAtMs: null,
      reason: 'Kode aktivasi harus berisi 12 huruf/angka (contoh: P222-XXXX-XXXX).',
    };
  }

  for (let i = 0; i < clean.length; i++) {
    if (!ALPHABET.includes(clean[i])) {
      return {
        valid: false,
        plan: null,
        expiresAtMs: null,
        reason: `Karakter "${clean[i]}" tidak valid dalam kode aktivasi. Periksa kembali kode Anda.`,
      };
    }
  }

  const normDev = normalizeDeviceId(deviceId);
  if (normDev.length !== 10) {
    return {
      valid: false,
      plan: null,
      expiresAtMs: null,
      reason: 'ID Perangkat belum siap.',
    };
  }

  const planChar = clean[0];
  const expiryCode = clean.slice(1, 4);
  const givenTag = clean.slice(4, 12);

  if (planChar !== 'P' && planChar !== 'D') {
    return {
      valid: false,
      plan: null,
      expiresAtMs: null,
      reason: 'Kode aktivasi tidak dikenali.',
    };
  }

  const expectedTag = computeLicenseTag(normDev, planChar, expiryCode);
  if (givenTag !== expectedTag) {
    return {
      valid: false,
      plan: null,
      expiresAtMs: null,
      reason: 'Kode aktivasi salah atau bukan untuk ID Perangkat HP ini.',
    };
  }

  const formatted = `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  const expiryDayVal = decode15Bits(expiryCode);

  if (planChar === 'P') {
    if (expiryDayVal !== 0) {
      return {
        valid: false,
        plan: null,
        expiresAtMs: null,
        reason: 'Format kode permanen tidak valid.',
      };
    }
    return {
      valid: true,
      plan: 'permanen',
      expiresAtMs: null,
      normalizedCode: formatted,
    };
  }

  if (expiryDayVal <= 0) {
    return {
      valid: false,
      plan: null,
      expiresAtMs: null,
      reason: 'Format masa berlaku kode tidak valid.',
    };
  }

  const expiresAtMs = EPOCH_2025_UTC_MS + expiryDayVal * MS_PER_DAY + (MS_PER_DAY - 1);
  if (nowMs > expiresAtMs) {
    return {
      valid: false,
      plan: 'berjangka',
      expiresAtMs,
      expired: true,
      reason: `Masa aktif kode ini sudah berakhir pada ${formatDateShort(expiresAtMs)}. Silakan minta kode perpanjangan baru.`,
    };
  }

  return {
    valid: true,
    plan: 'berjangka',
    expiresAtMs,
    normalizedCode: formatted,
  };
}

// =========================================================================
// Local License Persistence & Evaluation
// =========================================================================

export function loadLocalLicenseState(): LocalLicenseState {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalLicenseState>;
      if (parsed && typeof parsed.deviceId === 'string' && parsed.deviceId) {
        const state: LocalLicenseState = {
          deviceId: formatDeviceId(parsed.deviceId),
          trialStartMs:
            typeof parsed.trialStartMs === 'number' && parsed.trialStartMs > 0
              ? parsed.trialStartMs
              : Date.now(),
          activationCode: typeof parsed.activationCode === 'string' ? parsed.activationCode : '',
        };
        return state;
      }
    }
  } catch {
    // ignore storage errors
  }

  const initial: LocalLicenseState = {
    deviceId: generateWebFallbackDeviceId(),
    trialStartMs: Date.now(),
    activationCode: '',
  };
  saveLocalLicenseState(initial);
  return initial;
}

export function saveLocalLicenseState(state: LocalLicenseState): void {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function evaluateLicense(state: LocalLicenseState, nowMs = Date.now()): LicenseEvaluation {
  if (state.activationCode) {
    const check = verifyActivationCode(state.activationCode, state.deviceId, nowMs);
    if (check.valid && check.plan === 'permanen') {
      return {
        status: 'licensed_permanent',
        isUnlocked: true,
        daysLeft: Infinity,
        expiresAtMs: null,
        headline: 'Lisensi Permanen Aktif',
        detail: `Terikat pada perangkat ${state.deviceId}`,
      };
    }
    if (check.valid && check.plan === 'berjangka' && check.expiresAtMs) {
      const daysLeft = Math.max(1, Math.ceil((check.expiresAtMs - nowMs) / MS_PER_DAY));
      return {
        status: 'licensed_timed',
        isUnlocked: true,
        daysLeft,
        expiresAtMs: check.expiresAtMs,
        headline: `Lisensi Aktif (${daysLeft} hari lagi)`,
        detail: `Berlaku sampai ${formatDateShort(check.expiresAtMs)}`,
      };
    }
    if (check.expired && check.expiresAtMs) {
      return {
        status: 'expired',
        isUnlocked: false,
        daysLeft: 0,
        expiresAtMs: check.expiresAtMs,
        headline: 'Masa Aktif Lisensi Berakhir',
        detail: `Berakhir pada ${formatDateShort(check.expiresAtMs)}. Masukkan kode aktivasi perpanjangan untuk melanjutkan.`,
      };
    }
  }

  const trialEndMs = state.trialStartMs + TRIAL_DAYS * MS_PER_DAY;
  if (nowMs <= trialEndMs) {
    const daysLeft = Math.max(1, Math.ceil((trialEndMs - nowMs) / MS_PER_DAY));
    return {
      status: 'trial',
      isUnlocked: true,
      daysLeft,
      expiresAtMs: trialEndMs,
      headline: `Uji Coba Gratis · Sisa ${daysLeft} Hari`,
      detail: `Aktif hingga ${formatDateShort(trialEndMs)}. Masukkan kode aktivasi sebelum masa coba berakhir.`,
    };
  }

  return {
    status: 'expired',
    isUnlocked: false,
    daysLeft: 0,
    expiresAtMs: trialEndMs,
    headline: 'Masa Uji Coba Berakhir',
    detail: 'Uji coba gratis 7 hari sudah selesai. Kirim ID Perangkat ke penjual untuk mendapatkan kode aktivasi.',
  };
}

// =========================================================================
// Vendor Generator Access & History
// =========================================================================

export function verifyVendorPin(pin: string): boolean {
  const clean = (pin || '').trim();
  if (!clean) return false;
  return sha256Hex(`SK_VENDOR_GATE_V1::${clean}`) === VENDOR_PIN_SHA256;
}

export function loadVendorHistory(): GeneratedLicenseRecord[] {
  try {
    const raw = localStorage.getItem(VENDOR_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeneratedLicenseRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveVendorHistory(records: GeneratedLicenseRecord[]): void {
  try {
    localStorage.setItem(VENDOR_HISTORY_KEY, JSON.stringify(records.slice(0, 30)));
  } catch {
    // ignore
  }
}

export function shouldShowDailyExpiryReminder(
  evaluation: LicenseEvaluation,
  nowMs = Date.now()
): boolean {
  if (!evaluation.isUnlocked) return false;
  if (evaluation.status !== 'trial' && evaluation.status !== 'licensed_timed') return false;
  if (evaluation.daysLeft > EXPIRY_REMINDER_DAYS) return false;
  const todayKey = toDateKey(nowMs);
  try {
    const lastShown = localStorage.getItem(REMINDER_DATE_STORAGE_KEY);
    return lastShown !== todayKey;
  } catch {
    return true;
  }
}

export function markDailyExpiryReminderShown(nowMs = Date.now()): void {
  const todayKey = toDateKey(nowMs);
  try {
    localStorage.setItem(REMINDER_DATE_STORAGE_KEY, todayKey);
  } catch {
    // ignore
  }
}
