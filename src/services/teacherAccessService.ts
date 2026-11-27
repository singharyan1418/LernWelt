import {
  TeacherAccessPass,
  TeacherAccessStatus,
  TeacherPaymentMethod
} from '../types';

export const TEACHER_ACCESS_PRICE_INR = 999;
export const TEACHER_ACCESS_CURRENCY = 'INR' as const;
export const TEACHER_ACCESS_STORAGE_PREFIX = 'lernwelt_teacher_access_v2';
export const PAYMENT_QR_IMAGE_URL = '/assets/aistudio/IMG-20261112-WA0008_8f6d6d86.jpg';

export interface TeacherPaymentInput {
  paymentMethod: TeacherPaymentMethod;
  amountInr?: number;
  qrConfirmed?: boolean;
  transactionReference?: string;
}

export interface PaymentValidationResult {
  valid: boolean;
  error?: string;
  paymentSummary?: string;
}

/**
 * Adds exactly 1 calendar month from a payment timestamp using UTC date math,
 * clamping to the last valid day of the target month (e.g. Jan 31 -> Feb 28/29).
 */
export function addOneMonthFromDate(startMs: number): number {
  const base = Number.isFinite(startMs) ? new Date(startMs) : new Date();
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  const hours = base.getUTCHours();
  const minutes = base.getUTCMinutes();
  const seconds = base.getUTCSeconds();
  const ms = base.getUTCMilliseconds();

  const targetMonthIndex = month + 1;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedTargetMonth = targetMonthIndex % 12;

  // Day 0 of the following month gives the last day of normalizedTargetMonth
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalizedTargetMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return Date.UTC(
    targetYear,
    normalizedTargetMonth,
    clampedDay,
    hours,
    minutes,
    seconds,
    ms
  );
}

/**
 * Identifies whether a room ID belongs to a 1-on-1 Personal Teacher classroom.
 */
export function isTeacherClassroomRoomId(roomId?: string | null): boolean {
  return String(roomId || '').trim().toLowerCase().startsWith('teacher-room-');
}

/**
 * Extracts the owning teacherId from a 1-on-1 teacher classroom room ID.
 * Supports `teacher-room-<teacherId>` and `teacher-room-<teacherId>-booking_<id>`.
 */
export function extractTeacherIdFromRoomId(
  roomId?: string | null,
  knownTeacherIds: string[] = []
): string | null {
  const raw = String(roomId || '').trim();
  if (!isTeacherClassroomRoomId(raw)) return null;

  const remainder = raw.slice('teacher-room-'.length);
  if (!remainder) return null;

  const normalizedRemainder = remainder.toLowerCase();
  for (const tid of knownTeacherIds) {
    const cleanTid = String(tid || '').trim();
    if (!cleanTid) continue;
    const sanitizedTid = cleanTid.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    if (
      normalizedRemainder === cleanTid.toLowerCase() ||
      normalizedRemainder === sanitizedTid ||
      normalizedRemainder.startsWith(`${cleanTid.toLowerCase()}-`) ||
      normalizedRemainder.startsWith(`${sanitizedTid}-`)
    ) {
      return cleanTid;
    }
  }

  const bookingMarkerIdx = remainder.indexOf('-booking_');
  if (bookingMarkerIdx > 0) {
    return remainder.slice(0, bookingMarkerIdx);
  }
  return remainder;
}

function normalizeTeacherId(teacherId?: string | null): string {
  return String(teacherId || '').trim().toLowerCase();
}

/**
 * Returns true if the pass grants active ₹999 monthly access at `nowMs`
 * for the specified teacher (and always requires a valid per-teacher `teacherId`).
 */
export function isTeacherAccessActive(
  pass: TeacherAccessPass | null | undefined,
  nowMs: number = Date.now(),
  expectedTeacherId?: string | null
): boolean {
  if (!pass || typeof pass !== 'object') return false;
  const passTeacherId = normalizeTeacherId(pass.teacherId);
  if (!passTeacherId) return false;
  if (expectedTeacherId !== undefined && expectedTeacherId !== null) {
    if (passTeacherId !== normalizeTeacherId(expectedTeacherId)) return false;
  }
  if (pass.amountInr !== TEACHER_ACCESS_PRICE_INR) return false;
  if (pass.currency !== TEACHER_ACCESS_CURRENCY) return false;
  if (!Number.isFinite(pass.paidAt) || !Number.isFinite(pass.expiresAt)) return false;
  if (pass.expiresAt <= pass.paidAt) return false;
  return nowMs >= pass.paidAt && nowMs < pass.expiresAt;
}

/**
 * Normalizes either a single pass or pass list into an array of valid per-teacher passes.
 */
export function normalizeTeacherAccessPassList(
  input: TeacherAccessPass[] | TeacherAccessPass | null | undefined
): TeacherAccessPass[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  return arr.filter(
    (p): p is TeacherAccessPass =>
      Boolean(
        p &&
          typeof p === 'object' &&
          typeof p.teacherId === 'string' &&
          p.teacherId.trim().length > 0 &&
          p.amountInr === TEACHER_ACCESS_PRICE_INR &&
          p.currency === TEACHER_ACCESS_CURRENCY &&
          Number.isFinite(p.paidAt) &&
          Number.isFinite(p.expiresAt)
      )
  );
}

/**
 * Finds the most recent pass for a specific teacher.
 */
export function getTeacherPassForTeacher(
  passes: TeacherAccessPass[] | TeacherAccessPass | null | undefined,
  teacherId?: string | null
): TeacherAccessPass | null {
  const target = normalizeTeacherId(teacherId);
  if (!target) return null;
  const list = normalizeTeacherAccessPassList(passes);
  let matched: TeacherAccessPass | null = null;
  for (const pass of list) {
    if (normalizeTeacherId(pass.teacherId) === target) {
      if (!matched || pass.paidAt >= matched.paidAt) {
        matched = pass;
      }
    }
  }
  return matched;
}

/**
 * Returns true if the user holds an active ₹999 monthly pass for this specific teacher.
 */
export function hasActiveAccessForTeacher(
  passes: TeacherAccessPass[] | TeacherAccessPass | null | undefined,
  teacherId?: string | null,
  nowMs: number = Date.now()
): boolean {
  const target = normalizeTeacherId(teacherId);
  if (!target) return false;
  const pass = getTeacherPassForTeacher(passes, target);
  return isTeacherAccessActive(pass, nowMs, target);
}

/**
 * Computes normalized access status for a single pass.
 */
export function getTeacherAccessStatus(
  pass: TeacherAccessPass | null | undefined,
  nowMs: number = Date.now()
): TeacherAccessStatus {
  if (
    !pass ||
    typeof pass !== 'object' ||
    !normalizeTeacherId(pass.teacherId) ||
    !Number.isFinite(pass.paidAt) ||
    !Number.isFinite(pass.expiresAt)
  ) {
    return {
      hasActiveAccess: false,
      isExpired: false,
      amountInr: TEACHER_ACCESS_PRICE_INR,
      teacherId: null,
      paidAt: null,
      expiresAt: null,
      remainingDays: 0,
      pass: null
    };
  }

  const active = isTeacherAccessActive(pass, nowMs);
  const expired = pass.amountInr === TEACHER_ACCESS_PRICE_INR && nowMs >= pass.expiresAt;
  const remainingMs = Math.max(0, pass.expiresAt - nowMs);
  const remainingDays = active ? Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))) : 0;

  return {
    hasActiveAccess: active,
    isExpired: expired,
    amountInr: TEACHER_ACCESS_PRICE_INR,
    teacherId: pass.teacherId,
    paidAt: pass.paidAt,
    expiresAt: pass.expiresAt,
    remainingDays,
    pass
  };
}

/**
 * Computes normalized access status for a specific teacher from the user's pass list.
 */
export function getTeacherAccessStatusForTeacher(
  passes: TeacherAccessPass[] | TeacherAccessPass | null | undefined,
  teacherId?: string | null,
  nowMs: number = Date.now()
): TeacherAccessStatus {
  const pass = getTeacherPassForTeacher(passes, teacherId);
  if (!pass) {
    return {
      hasActiveAccess: false,
      isExpired: false,
      amountInr: TEACHER_ACCESS_PRICE_INR,
      teacherId: teacherId ? String(teacherId).trim() : null,
      paidAt: null,
      expiresAt: null,
      remainingDays: 0,
      pass: null
    };
  }
  return getTeacherAccessStatus(pass, nowMs);
}

/**
 * Upserts a per-teacher pass into an array of passes (replacing older pass for same teacherId,
 * while preserving passes unlocked for other teachers).
 */
export function upsertTeacherAccessPass(
  existing: TeacherAccessPass[] | null | undefined,
  nextPass: TeacherAccessPass
): TeacherAccessPass[] {
  const list = normalizeTeacherAccessPassList(existing);
  const targetKey = normalizeTeacherId(nextPass.teacherId);
  if (!targetKey) return list;
  const filtered = list.filter((p) => normalizeTeacherId(p.teacherId) !== targetKey);
  return [nextPass, ...filtered];
}

/**
 * Strictly validates ₹999 QR-only teacher pass payment confirmation.
 */
export function validateTeacherPaymentInput(
  input: TeacherPaymentInput,
  _nowMs: number = Date.now()
): PaymentValidationResult {
  if (input.amountInr !== undefined && Number(input.amountInr) !== TEACHER_ACCESS_PRICE_INR) {
    return {
      valid: false,
      error: `Unlocking a teacher requires an exact payment of ₹${TEACHER_ACCESS_PRICE_INR}.`
    };
  }

  if (input.paymentMethod !== 'qr') {
    return { valid: false, error: 'Only QR code payment is supported.' };
  }

  if (!input.qrConfirmed) {
    return {
      valid: false,
      error: 'Please scan the QR code and confirm your ₹999 payment to continue.'
    };
  }

  const ref = String(input.transactionReference || '').trim();
  if (ref && !/^[a-zA-Z0-9._-]{4,40}$/.test(ref)) {
    return {
      valid: false,
      error: 'Enter a valid UPI transaction reference (4–40 alphanumeric characters) or leave it blank.'
    };
  }

  return {
    valid: true,
    paymentSummary: ref ? `QR Payment · Ref ${ref}` : `QR Payment · ₹${TEACHER_ACCESS_PRICE_INR}`
  };
}

/**
 * Constructs a server/client TeacherAccessPass enforcing ₹999 and 1-month validity from `paidAt`
 * scoped strictly to one single teacher (`teacherId`).
 */
export function createTeacherAccessPass(params: {
  userId: string;
  teacherId: string;
  teacherName?: string;
  userName?: string;
  userEmail?: string;
  paymentMethod: TeacherPaymentMethod;
  paymentSummary: string;
  paidAt?: number;
  passId?: string;
}): TeacherAccessPass {
  const paidAt = Number.isFinite(params.paidAt) ? Number(params.paidAt) : Date.now();
  const expiresAt = addOneMonthFromDate(paidAt);
  const cleanUserId = String(params.userId || '').trim();
  const cleanTeacherId = String(params.teacherId || '').trim();
  if (!cleanTeacherId) {
    throw new Error('teacherId is required to create a per-teacher access pass.');
  }

  return {
    id: params.passId || `tpass_${cleanTeacherId}_${paidAt}_${Math.random().toString(36).slice(2, 8)}`,
    userId: cleanUserId,
    teacherId: cleanTeacherId,
    teacherName: params.teacherName?.trim() || undefined,
    userName: params.userName?.trim() || undefined,
    userEmail: params.userEmail?.trim().toLowerCase() || undefined,
    amountInr: TEACHER_ACCESS_PRICE_INR,
    currency: TEACHER_ACCESS_CURRENCY,
    paymentMethod: params.paymentMethod,
    paymentSummary: params.paymentSummary,
    paidAt,
    expiresAt
  };
}

/**
 * Formats pass timestamps into human-readable dates for EN/DE UI.
 */
export function formatTeacherPassDate(
  timestampMs: number,
  uiLang?: string | null
): string {
  if (!Number.isFinite(timestampMs)) return '';
  const isGerman = String(uiLang || '').toLowerCase().startsWith('de') || String(uiLang || '').toLowerCase() === 'german';
  const locale = isGerman ? 'de-DE' : 'en-IN';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toISOString().slice(0, 10);
  }
}

export function getTeacherAccessStorageKey(userId: string): string {
  const clean = String(userId || 'guest').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  return `${TEACHER_ACCESS_STORAGE_PREFIX}_${clean}`;
}

export function readStoredTeacherAccessPasses(userId: string): TeacherAccessPass[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(getTeacherAccessStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeTeacherAccessPassList(parsed);
  } catch {
    return [];
  }
}

export function saveStoredTeacherAccessPasses(userId: string, passes: TeacherAccessPass[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const normalized = normalizeTeacherAccessPassList(passes);
    window.localStorage.setItem(getTeacherAccessStorageKey(userId), JSON.stringify(normalized));
  } catch {
    // Ignore quota or storage errors
  }
}

export function saveStoredTeacherAccessPass(pass: TeacherAccessPass): TeacherAccessPass[] {
  if (typeof window === 'undefined' || !pass?.userId || !pass?.teacherId) return [];
  const current = readStoredTeacherAccessPasses(pass.userId);
  const next = upsertTeacherAccessPass(current, pass);
  saveStoredTeacherAccessPasses(pass.userId, next);
  return next;
}
