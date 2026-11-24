import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  deriveDisplayNameFromEmail,
  maskEmailAddress,
  normalizeEmail,
  validateCredentialsInput,
  validateOtpCodeFormat
} from './authValidation';

export interface StoredTargetLanguage {
  language: string;
  level: string;
  goal: string;
}

export interface StoredAccountRecord {
  userId: string;
  email: string;
  name: string;
  nativeLanguage?: string;
  bio?: string;
  country?: string;
  timezone?: string;
  passwordSalt: string;
  passwordHash: string;
  verifiedId: string;
  isVerified: boolean;
  targetLanguageCode: string;
  level: string;
  targetLanguages?: StoredTargetLanguage[];
  learningStats?: Record<string, any>;
  createdAt: number;
  lastVerifiedAt: number | null;
}

export interface PendingOtpChallenge {
  challengeId: string;
  email: string;
  name: string;
  nativeLanguage?: string;
  bio?: string;
  otpCode: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  targetLanguageCode: string;
  level: string;
  accountExisted: boolean;
  purpose: 'signin' | 'create-profile' | 'profile-update';
  profileUserId?: string;
}

export interface Step1AuthOutcome {
  ok: boolean;
  status: number;
  error?: string;
  challengeId?: string;
  email?: string;
  name?: string;
  maskedEmail?: string;
  expiresAt?: number;
  otpCodeForDelivery?: string;
  accountExisted?: boolean;
  purpose?: 'signin' | 'create-profile' | 'profile-update';
}

export interface Step2OtpOutcome {
  ok: boolean;
  status: number;
  error?: string;
  verifiedAccount?: {
    userId: string;
    email: string;
    name: string;
    nativeLanguage?: string;
    bio?: string;
    country?: string;
    timezone?: string;
    verifiedId: string;
    isVerified: true;
    targetLanguageCode: string;
    level: string;
    targetLanguages?: StoredTargetLanguage[];
    learningStats?: Record<string, any>;
    verifiedAt: number;
    sessionToken: string;
  };
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

export function hashPasswordScrypt(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPasswordScrypt(password: string, saltHex: string, expectedHashHex: string): boolean {
  try {
    const candidateHex = crypto.scryptSync(password, saltHex, 64).toString('hex');
    const a = Buffer.from(candidateHex, 'hex');
    const b = Buffer.from(expectedHashHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function generateVerifiedLearnerId(email: string): string {
  const digest = crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 6).toUpperCase();
  return `LW-ID-${digest}`;
}

export class ServerAuthManager {
  private accounts = new Map<string, StoredAccountRecord>();
  private challenges = new Map<string, PendingOtpChallenge>();
  private activeSessions = new Map<string, string>(); // sessionToken -> email
  private verifiedUserIds = new Map<string, { verifiedId: string; email: string; name: string; verifiedAt: number }>();
  private persistFilePath: string | null;

  constructor(options?: { persistFilePath?: string | null; seedDemoAccount?: boolean }) {
    this.persistFilePath = options?.persistFilePath ?? null;
    this.loadFromDisk();

    if (options?.seedDemoAccount !== false) {
      const demoSeeds = [
        { userId: 'usr_alex_rivera', email: 'alex.rivera@lernwelt.io', name: 'Alex Rivera' },
        { userId: 'usr_alex_gmail', email: 'alex.rivera@gmail.com', name: 'Alex Rivera' }
      ];
      for (const seedInfo of demoSeeds) {
        if (!this.accounts.has(seedInfo.email)) {
          const { salt, hash } = hashPasswordScrypt('LernWelt2026');
          const seeded: StoredAccountRecord = {
            userId: seedInfo.userId,
            email: seedInfo.email,
            name: seedInfo.name,
            nativeLanguage: 'English',
            passwordSalt: salt,
            passwordHash: hash,
            verifiedId: generateVerifiedLearnerId(seedInfo.email),
            isVerified: true,
            targetLanguageCode: 'de',
            level: 'B1',
            createdAt: Date.now(),
            lastVerifiedAt: Date.now()
          };
          this.accounts.set(seeded.email, seeded);
          this.verifiedUserIds.set(seeded.userId, {
            verifiedId: seeded.verifiedId,
            email: seeded.email,
            name: seeded.name,
            verifiedAt: Date.now()
          });
        }
      }
    }
  }

  private loadFromDisk() {
    if (!this.persistFilePath) return;
    try {
      if (fs.existsSync(this.persistFilePath)) {
        const raw = fs.readFileSync(this.persistFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.accounts)) {
          for (const acc of parsed.accounts) {
            if (acc && acc.email && acc.passwordHash && acc.passwordSalt) {
              this.accounts.set(normalizeEmail(acc.email), acc);
              if (acc.isVerified && acc.userId && acc.verifiedId) {
                this.verifiedUserIds.set(acc.userId, {
                  verifiedId: acc.verifiedId,
                  email: acc.email,
                  name: acc.name,
                  verifiedAt: acc.lastVerifiedAt || Date.now()
                });
              }
            }
          }
        }
      }
    } catch {
      // Ignore disk hydration issues in ephemeral containers
    }
  }

  private saveToDisk() {
    if (!this.persistFilePath) return;
    try {
      const dir = path.dirname(this.persistFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.persistFilePath,
        JSON.stringify({ accounts: Array.from(this.accounts.values()) }, null, 2),
        'utf8'
      );
    } catch {
      // Ignore write failures in read-only sandboxes
    }
  }

  /**
   * Step 1: Verify Gmail/Email + Password before issuing a 6-digit OTP challenge.
   */
  public verifyCredentialsAndIssueOtp(params: {
    email: string;
    password: string;
    mode: 'signin' | 'signup';
    name?: string;
    nativeLanguage?: string;
    bio?: string;
    targetLanguageCode?: string;
    level?: string;
    now?: number;
  }): Step1AuthOutcome {
    const now = params.now ?? Date.now();
    const validation = validateCredentialsInput({
      email: params.email,
      password: params.password,
      mode: params.mode,
      name: params.name
    });

    if (!validation.valid) {
      return {
        ok: false,
        status: 400,
        error: validation.error
      };
    }

    const email = validation.normalizedEmail;
    const existing = this.accounts.get(email);
    let resolvedName = String(params.name || '').trim() || deriveDisplayNameFromEmail(email);
    const cleanNativeLang = String(params.nativeLanguage || '').trim() || undefined;
    const cleanBio = String(params.bio || '').trim() || undefined;

    if (existing) {
      const passwordMatches = verifyPasswordScrypt(
        params.password,
        existing.passwordSalt,
        existing.passwordHash
      );
      if (!passwordMatches) {
        return {
          ok: false,
          status: 401,
          error: 'Incorrect password for this email address. Please enter the correct password to receive your OTP.'
        };
      }
      resolvedName = String(params.name || '').trim() || existing.name;
      if (params.targetLanguageCode) existing.targetLanguageCode = params.targetLanguageCode;
      if (params.level) existing.level = params.level;
      if (cleanNativeLang) existing.nativeLanguage = cleanNativeLang;
      if (cleanBio) existing.bio = cleanBio;
    } else {
      const { salt, hash } = hashPasswordScrypt(params.password);
      const userId = `usr_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 10)}`;
      const created: StoredAccountRecord = {
        userId,
        email,
        name: resolvedName,
        nativeLanguage: cleanNativeLang,
        bio: cleanBio,
        passwordSalt: salt,
        passwordHash: hash,
        verifiedId: generateVerifiedLearnerId(email),
        isVerified: false,
        targetLanguageCode: params.targetLanguageCode || 'de',
        level: params.level || 'B1',
        createdAt: now,
        lastVerifiedAt: null
      };
      this.accounts.set(email, created);
      this.saveToDisk();
    }

    // Invalidate any older login/signup challenges for this email so only the newest OTP is active
    for (const [cid, ch] of this.challenges.entries()) {
      if (ch.email === email && ch.purpose !== 'profile-update') {
        this.challenges.delete(cid);
      }
    }

    const challengeId = `otp_${crypto.randomBytes(12).toString('hex')}`;
    const otpCode = generateSixDigitOtp();
    const expiresAt = now + OTP_TTL_MS;
    const purpose: 'signin' | 'create-profile' =
      params.mode === 'signup' ? 'create-profile' : 'signin';

    this.challenges.set(challengeId, {
      challengeId,
      email,
      name: resolvedName,
      nativeLanguage: cleanNativeLang || existing?.nativeLanguage,
      bio: cleanBio || existing?.bio,
      otpCode,
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      targetLanguageCode: params.targetLanguageCode || existing?.targetLanguageCode || 'de',
      level: params.level || existing?.level || 'B1',
      accountExisted: Boolean(existing),
      purpose
    });

    return {
      ok: true,
      status: 200,
      challengeId,
      email,
      name: resolvedName,
      maskedEmail: maskEmailAddress(email),
      expiresAt,
      otpCodeForDelivery: otpCode,
      accountExisted: Boolean(existing),
      purpose
    };
  }

  /**
   * Issues a 6-digit OTP specifically for creating/updating a user's profile & Gmail address inside ProfileView.
   */
  public issueProfileEmailOtp(params: {
    userId: string;
    email: string;
    name?: string;
    nativeLanguage?: string;
    bio?: string;
    targetLanguageCode?: string;
    level?: string;
    now?: number;
  }): Step1AuthOutcome {
    const now = params.now ?? Date.now();
    const email = normalizeEmail(params.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter a valid Gmail address (for example, yourname@gmail.com).'
      };
    }

    const cleanName = String(params.name || '').trim() || deriveDisplayNameFromEmail(email);
    if (cleanName.length < 2) {
      return {
        ok: false,
        status: 400,
        error: 'Display name must be at least 2 characters.'
      };
    }

    for (const [cid, ch] of this.challenges.entries()) {
      if (ch.email === email && ch.purpose === 'profile-update') {
        this.challenges.delete(cid);
      }
    }

    const challengeId = `otp_prof_${crypto.randomBytes(12).toString('hex')}`;
    const otpCode = generateSixDigitOtp();
    const expiresAt = now + OTP_TTL_MS;

    this.challenges.set(challengeId, {
      challengeId,
      email,
      name: cleanName,
      nativeLanguage: String(params.nativeLanguage || '').trim() || undefined,
      bio: String(params.bio || '').trim() || undefined,
      otpCode,
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      targetLanguageCode: params.targetLanguageCode || 'de',
      level: params.level || 'B1',
      accountExisted: this.accounts.has(email),
      purpose: 'profile-update',
      profileUserId: String(params.userId || '').trim() || `usr_${crypto.randomBytes(5).toString('hex')}`
    });

    return {
      ok: true,
      status: 200,
      challengeId,
      email,
      name: cleanName,
      maskedEmail: maskEmailAddress(email),
      expiresAt,
      otpCodeForDelivery: otpCode,
      accountExisted: this.accounts.has(email),
      purpose: 'profile-update'
    };
  }

  public getActiveChallengeForDispatch(params: {
    challengeId: string;
    email: string;
    now?: number;
  }): PendingOtpChallenge | null {
    const now = params.now ?? Date.now();
    const cleanEmail = normalizeEmail(params.email);
    const ch = this.challenges.get(params.challengeId);
    if (!ch || ch.email !== cleanEmail || now > ch.expiresAt) {
      return null;
    }
    return ch;
  }

  public resendOtp(params: { challengeId: string; email: string; now?: number }): Step1AuthOutcome {
    const now = params.now ?? Date.now();
    const email = normalizeEmail(params.email);
    const existingChallenge = this.challenges.get(params.challengeId);

    if (!existingChallenge || existingChallenge.email !== email) {
      return {
        ok: false,
        status: 400,
        error: 'Your verification session expired. Please request a new OTP.'
      };
    }

    const freshOtp = generateSixDigitOtp();
    const expiresAt = now + OTP_TTL_MS;
    existingChallenge.otpCode = freshOtp;
    existingChallenge.expiresAt = expiresAt;
    existingChallenge.attempts = 0;

    return {
      ok: true,
      status: 200,
      challengeId: existingChallenge.challengeId,
      email,
      name: existingChallenge.name,
      maskedEmail: maskEmailAddress(email),
      expiresAt,
      otpCodeForDelivery: freshOtp,
      accountExisted: existingChallenge.accountExisted,
      purpose: existingChallenge.purpose
    };
  }

  /**
   * Step 2: Verify the 6-digit OTP sent to the user's Gmail address.
   * Grants entry / profile update and Verified ID status ONLY when the exact 6-digit OTP matches before expiry.
   */
  public verifyEmailOtp(params: {
    challengeId: string;
    email: string;
    otp: string;
    now?: number;
  }): Step2OtpOutcome {
    const now = params.now ?? Date.now();
    const formatCheck = validateOtpCodeFormat(params.otp);
    if (!formatCheck.valid) {
      return {
        ok: false,
        status: 400,
        error: formatCheck.error
      };
    }

    const email = normalizeEmail(params.email);
    const challenge = this.challenges.get(params.challengeId);
    if (!challenge || challenge.email !== email) {
      return {
        ok: false,
        status: 400,
        error: 'Verification challenge not found or expired. Please request a new OTP.'
      };
    }

    if (now > challenge.expiresAt) {
      this.challenges.delete(params.challengeId);
      return {
        ok: false,
        status: 400,
        error: 'This OTP has expired. Click "Resend OTP" to receive a new 6-digit code.'
      };
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(params.challengeId);
      return {
        ok: false,
        status: 429,
        error: 'Too many incorrect OTP attempts. Please click "Resend OTP" or try again.'
      };
    }

    const a = Buffer.from(formatCheck.cleanOtp, 'utf8');
    const b = Buffer.from(challenge.otpCode, 'utf8');
    const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!matches) {
      challenge.attempts += 1;
      const remaining = Math.max(0, challenge.maxAttempts - challenge.attempts);
      return {
        ok: false,
        status: 401,
        error:
          remaining > 0
            ? `Invalid OTP code. Please check the 6-digit code sent to ${email} (${remaining} attempts left).`
            : 'Invalid OTP code. Maximum attempts reached—please resend a fresh OTP.'
      };
    }

    // OTP matched!
    this.challenges.delete(params.challengeId);

    if (challenge.purpose === 'profile-update') {
      const userId =
        challenge.profileUserId ||
        `usr_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 10)}`;
      const verifiedId = generateVerifiedLearnerId(email);
      const existingAcc = this.accounts.get(email);
      if (existingAcc) {
        existingAcc.isVerified = true;
        existingAcc.lastVerifiedAt = now;
        existingAcc.name = challenge.name || existingAcc.name;
        if (challenge.nativeLanguage) existingAcc.nativeLanguage = challenge.nativeLanguage;
        if (challenge.bio) existingAcc.bio = challenge.bio;
        this.saveToDisk();
      }

      const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
      this.activeSessions.set(sessionToken, email);
      this.verifiedUserIds.set(userId, {
        verifiedId,
        email,
        name: challenge.name,
        verifiedAt: now
      });

      return {
        ok: true,
        status: 200,
        verifiedAccount: {
          userId,
          email,
          name: challenge.name,
          nativeLanguage: challenge.nativeLanguage,
          bio: challenge.bio,
          verifiedId,
          isVerified: true,
          targetLanguageCode: challenge.targetLanguageCode,
          level: challenge.level,
          verifiedAt: now,
          sessionToken
        }
      };
    }

    const account = this.accounts.get(email);
    if (!account) {
      return {
        ok: false,
        status: 400,
        error: 'Account record missing. Please verify your email and password again.'
      };
    }

    account.isVerified = true;
    account.lastVerifiedAt = now;
    account.name = challenge.name || account.name;
    if (challenge.nativeLanguage) account.nativeLanguage = challenge.nativeLanguage;
    if (challenge.bio) account.bio = challenge.bio;
    this.saveToDisk();

    const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
    this.activeSessions.set(sessionToken, email);
    this.verifiedUserIds.set(account.userId, {
      verifiedId: account.verifiedId,
      email: account.email,
      name: account.name,
      verifiedAt: now
    });

    return {
      ok: true,
      status: 200,
      verifiedAccount: {
        userId: account.userId,
        email: account.email,
        name: account.name,
        nativeLanguage: account.nativeLanguage,
        bio: account.bio,
        verifiedId: account.verifiedId,
        isVerified: true,
        targetLanguageCode: challenge.targetLanguageCode,
        level: challenge.level,
        verifiedAt: now,
        sessionToken
      }
    };
  }

  public getAccountByEmail(email: string): StoredAccountRecord | null {
    const cleanEmail = normalizeEmail(email);
    return this.accounts.get(cleanEmail) || null;
  }

  public hydrateAccountFromDbRow(row: {
    uid?: string;
    email: string;
    displayName?: string | null;
    nativeLanguage?: string | null;
    targetLanguageCode?: string | null;
    cefrLevel?: string | null;
    targetLanguagesJson?: string | null;
    bio?: string | null;
    country?: string | null;
    timezone?: string | null;
  }): StoredAccountRecord | null {
    const cleanEmail = normalizeEmail(row.email || '');
    if (!cleanEmail) return null;

    let parsedTargets: StoredTargetLanguage[] | undefined;
    if (row.targetLanguagesJson) {
      try {
        const parsed = JSON.parse(row.targetLanguagesJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsedTargets = parsed;
        }
      } catch {}
    }

    const existing = this.accounts.get(cleanEmail);
    if (existing) {
      if (!existing.nativeLanguage && row.nativeLanguage) existing.nativeLanguage = row.nativeLanguage;
      if (!existing.targetLanguageCode && row.targetLanguageCode) existing.targetLanguageCode = row.targetLanguageCode;
      if (!existing.level && row.cefrLevel) existing.level = row.cefrLevel;
      if ((!existing.targetLanguages || existing.targetLanguages.length === 0) && parsedTargets) {
        existing.targetLanguages = parsedTargets;
      }
      if (!existing.bio && row.bio) existing.bio = row.bio;
      if (!existing.country && row.country) existing.country = row.country;
      if (!existing.timezone && row.timezone) existing.timezone = row.timezone;
      if (!existing.name && row.displayName) existing.name = row.displayName;
      return existing;
    }

    const { salt, hash } = hashPasswordScrypt(crypto.randomBytes(24).toString('hex'));
    const userId = row.uid || `usr_${crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 10)}`;
    const hydrated: StoredAccountRecord = {
      userId,
      email: cleanEmail,
      name: row.displayName || deriveDisplayNameFromEmail(cleanEmail),
      nativeLanguage: row.nativeLanguage || 'English',
      bio: row.bio || undefined,
      country: row.country || undefined,
      timezone: row.timezone || undefined,
      passwordSalt: salt,
      passwordHash: hash,
      verifiedId: generateVerifiedLearnerId(cleanEmail),
      isVerified: true,
      targetLanguageCode: row.targetLanguageCode || 'de',
      level: row.cefrLevel || 'B1',
      targetLanguages: parsedTargets,
      createdAt: Date.now(),
      lastVerifiedAt: Date.now()
    };
    this.accounts.set(cleanEmail, hydrated);
    this.verifiedUserIds.set(userId, {
      verifiedId: hydrated.verifiedId,
      email: cleanEmail,
      name: hydrated.name,
      verifiedAt: Date.now()
    });
    return hydrated;
  }

  /**
   * Direct login with email and password without OTP verification.
   * Restores all previously saved profile preferences (nativeLanguage, targetLanguageCode, level, targetLanguages, bio, country)
   * instead of overwriting them with login-screen defaults.
   */
  public loginDirectly(params: {
    email: string;
    password: string;
    targetLanguageCode?: string;
    level?: string;
    overridePreferences?: boolean;
    now?: number;
  }): Step2OtpOutcome {
    const now = params.now ?? Date.now();
    const cleanEmail = normalizeEmail(params.email);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter a valid email address.'
      };
    }

    if (!params.password || params.password.length < 6) {
      return {
        ok: false,
        status: 400,
        error: 'Password must be at least 6 characters long.'
      };
    }

    const existing = this.accounts.get(cleanEmail);
    if (!existing) {
      return {
        ok: false,
        status: 404,
        error: 'No account found with this email. Please switch to "Create Profile" to register.'
      };
    }

    const passwordMatches = verifyPasswordScrypt(
      params.password,
      existing.passwordSalt,
      existing.passwordHash
    );

    if (!passwordMatches) {
      return {
        ok: false,
        status: 401,
        error: 'Incorrect password. Please verify and try again.'
      };
    }

    existing.isVerified = true;
    existing.lastVerifiedAt = now;
    if (params.overridePreferences) {
      if (params.targetLanguageCode) existing.targetLanguageCode = params.targetLanguageCode;
      if (params.level) existing.level = params.level;
    } else {
      if (!existing.targetLanguageCode && params.targetLanguageCode) {
        existing.targetLanguageCode = params.targetLanguageCode;
      }
      if (!existing.level && params.level) {
        existing.level = params.level;
      }
    }
    this.saveToDisk();

    const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
    this.activeSessions.set(sessionToken, cleanEmail);
    this.verifiedUserIds.set(existing.userId, {
      verifiedId: existing.verifiedId,
      email: existing.email,
      name: existing.name,
      verifiedAt: now
    });

    return {
      ok: true,
      status: 200,
      verifiedAccount: {
        userId: existing.userId,
        email: existing.email,
        name: existing.name,
        nativeLanguage: existing.nativeLanguage,
        bio: existing.bio,
        country: existing.country,
        timezone: existing.timezone,
        verifiedId: existing.verifiedId,
        isVerified: true,
        targetLanguageCode: existing.targetLanguageCode,
        level: existing.level,
        targetLanguages: existing.targetLanguages,
        learningStats: existing.learningStats,
        verifiedAt: now,
        sessionToken
      }
    };
  }

  /**
   * Direct registration with email, password, and profile fields without OTP verification.
   */
  public registerDirectly(params: {
    name: string;
    email: string;
    password: string;
    nativeLanguage?: string;
    bio?: string;
    country?: string;
    timezone?: string;
    targetLanguageCode?: string;
    level?: string;
    targetLanguages?: StoredTargetLanguage[];
    now?: number;
  }): Step2OtpOutcome {
    const now = params.now ?? Date.now();
    const cleanEmail = normalizeEmail(params.email);
    const cleanName = String(params.name || '').trim();

    if (cleanName.length < 2) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter your full name (at least 2 characters).'
      };
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter a valid email address.'
      };
    }

    if (!params.password || params.password.length < 6) {
      return {
        ok: false,
        status: 400,
        error: 'Password must be at least 6 characters long.'
      };
    }

    const existing = this.accounts.get(cleanEmail);
    if (existing) {
      // If account already exists, check password
      const passwordMatches = verifyPasswordScrypt(
        params.password,
        existing.passwordSalt,
        existing.passwordHash
      );
      if (!passwordMatches) {
        return {
          ok: false,
          status: 409,
          error: 'An account with this email already exists. Please sign in with your password.'
        };
      }
      existing.name = cleanName;
      if (params.nativeLanguage) existing.nativeLanguage = params.nativeLanguage.trim();
      if (params.bio !== undefined && params.bio.trim()) existing.bio = params.bio.trim();
      if (params.country) existing.country = params.country.trim();
      if (params.timezone) existing.timezone = params.timezone.trim();
      if (params.targetLanguageCode) existing.targetLanguageCode = params.targetLanguageCode;
      if (params.level) existing.level = params.level;
      if (Array.isArray(params.targetLanguages) && params.targetLanguages.length > 0) {
        existing.targetLanguages = params.targetLanguages;
      }
      existing.isVerified = true;
      existing.lastVerifiedAt = now;
      this.saveToDisk();

      const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
      this.activeSessions.set(sessionToken, cleanEmail);
      this.verifiedUserIds.set(existing.userId, {
        verifiedId: existing.verifiedId,
        email: existing.email,
        name: existing.name,
        verifiedAt: now
      });

      return {
        ok: true,
        status: 200,
        verifiedAccount: {
          userId: existing.userId,
          email: existing.email,
          name: existing.name,
          nativeLanguage: existing.nativeLanguage,
          bio: existing.bio,
          country: existing.country,
          timezone: existing.timezone,
          verifiedId: existing.verifiedId,
          isVerified: true,
          targetLanguageCode: existing.targetLanguageCode,
          level: existing.level,
          targetLanguages: existing.targetLanguages,
          learningStats: existing.learningStats,
          verifiedAt: now,
          sessionToken
        }
      };
    }

    const { salt, hash } = hashPasswordScrypt(params.password);
    const userId = `usr_${crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 10)}`;
    const verifiedId = generateVerifiedLearnerId(cleanEmail);

    const created: StoredAccountRecord = {
      userId,
      email: cleanEmail,
      name: cleanName,
      nativeLanguage: params.nativeLanguage?.trim() || 'English',
      bio: params.bio?.trim(),
      country: params.country?.trim(),
      timezone: params.timezone?.trim(),
      passwordSalt: salt,
      passwordHash: hash,
      verifiedId,
      isVerified: true,
      targetLanguageCode: params.targetLanguageCode || 'de',
      level: params.level || 'B1',
      targetLanguages: Array.isArray(params.targetLanguages) && params.targetLanguages.length > 0
        ? params.targetLanguages
        : undefined,
      createdAt: now,
      lastVerifiedAt: now
    };

    this.accounts.set(cleanEmail, created);
    this.saveToDisk();

    const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
    this.activeSessions.set(sessionToken, cleanEmail);
    this.verifiedUserIds.set(userId, {
      verifiedId,
      email: cleanEmail,
      name: cleanName,
      verifiedAt: now
    });

    return {
      ok: true,
      status: 200,
      verifiedAccount: {
        userId,
        email: cleanEmail,
        name: cleanName,
        nativeLanguage: created.nativeLanguage,
        bio: created.bio,
        country: created.country,
        timezone: created.timezone,
        verifiedId,
        isVerified: true,
        targetLanguageCode: created.targetLanguageCode,
        level: created.level,
        targetLanguages: created.targetLanguages,
        verifiedAt: now,
        sessionToken
      }
    };
  }

  /**
   * Direct Google Sign-In authentication without OTP verification.
   * Preserves existing saved language preferences when returning users sign in with Google.
   */
  public googleAuthDirectly(params: {
    email: string;
    name?: string;
    nativeLanguage?: string;
    targetLanguageCode?: string;
    level?: string;
    now?: number;
  }): Step2OtpOutcome {
    const now = params.now ?? Date.now();
    const cleanEmail = normalizeEmail(params.email);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid Google email address.'
      };
    }

    const cleanName = String(params.name || '').trim() || deriveDisplayNameFromEmail(cleanEmail);
    let account = this.accounts.get(cleanEmail);

    if (account) {
      account.isVerified = true;
      account.lastVerifiedAt = now;
      if (!account.name && params.name) account.name = cleanName;
      if (!account.nativeLanguage && params.nativeLanguage) account.nativeLanguage = params.nativeLanguage;
      if (!account.targetLanguageCode && params.targetLanguageCode) account.targetLanguageCode = params.targetLanguageCode;
      if (!account.level && params.level) account.level = params.level;
    } else {
      const { salt, hash } = hashPasswordScrypt(crypto.randomBytes(24).toString('hex'));
      const userId = `usr_${crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 10)}`;
      const verifiedId = generateVerifiedLearnerId(cleanEmail);

      account = {
        userId,
        email: cleanEmail,
        name: cleanName,
        nativeLanguage: params.nativeLanguage?.trim() || 'English',
        passwordSalt: salt,
        passwordHash: hash,
        verifiedId,
        isVerified: true,
        targetLanguageCode: params.targetLanguageCode || 'de',
        level: params.level || 'B1',
        createdAt: now,
        lastVerifiedAt: now
      };
      this.accounts.set(cleanEmail, account);
    }
    this.saveToDisk();

    const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
    this.activeSessions.set(sessionToken, cleanEmail);
    this.verifiedUserIds.set(account.userId, {
      verifiedId: account.verifiedId,
      email: account.email,
      name: account.name,
      verifiedAt: now
    });

    return {
      ok: true,
      status: 200,
      verifiedAccount: {
        userId: account.userId,
        email: account.email,
        name: account.name,
        nativeLanguage: account.nativeLanguage,
        bio: account.bio,
        country: account.country,
        timezone: account.timezone,
        verifiedId: account.verifiedId,
        isVerified: true,
        targetLanguageCode: account.targetLanguageCode,
        level: account.level,
        targetLanguages: account.targetLanguages,
        learningStats: account.learningStats,
        verifiedAt: now,
        sessionToken
      }
    };
  }

  /**
   * Direct profile update without OTP verification.
   */
  public updateProfileDirectly(params: {
    userId: string;
    email: string;
    name: string;
    nativeLanguage?: string;
    bio?: string;
    country?: string;
    timezone?: string;
    targetLanguageCode?: string;
    level?: string;
    targetLanguages?: StoredTargetLanguage[];
    now?: number;
  }): Step2OtpOutcome {
    const now = params.now ?? Date.now();
    const cleanEmail = normalizeEmail(params.email);
    const cleanName = String(params.name || '').trim();

    if (cleanName.length < 2) {
      return {
        ok: false,
        status: 400,
        error: 'Display name must be at least 2 characters.'
      };
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter a valid email address.'
      };
    }

    const verifiedId = generateVerifiedLearnerId(cleanEmail);
    let existing = this.accounts.get(cleanEmail);

    if (!existing) {
      const { salt, hash } = hashPasswordScrypt(crypto.randomBytes(24).toString('hex'));
      existing = {
        userId: params.userId || `usr_${crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 10)}`,
        email: cleanEmail,
        name: cleanName,
        nativeLanguage: params.nativeLanguage?.trim() || 'English',
        bio: params.bio?.trim(),
        country: params.country?.trim(),
        timezone: params.timezone?.trim(),
        passwordSalt: salt,
        passwordHash: hash,
        verifiedId,
        isVerified: true,
        targetLanguageCode: params.targetLanguageCode || 'de',
        level: params.level || 'B1',
        targetLanguages: Array.isArray(params.targetLanguages) && params.targetLanguages.length > 0
          ? params.targetLanguages
          : undefined,
        createdAt: now,
        lastVerifiedAt: now
      };
      this.accounts.set(cleanEmail, existing);
    } else {
      existing.name = cleanName;
      if (params.nativeLanguage) existing.nativeLanguage = params.nativeLanguage.trim();
      if (params.bio !== undefined) existing.bio = params.bio.trim();
      if (params.country) existing.country = params.country.trim();
      if (params.timezone) existing.timezone = params.timezone.trim();
      if (params.targetLanguageCode) existing.targetLanguageCode = params.targetLanguageCode;
      if (params.level) existing.level = params.level;
      if (Array.isArray(params.targetLanguages) && params.targetLanguages.length > 0) {
        existing.targetLanguages = params.targetLanguages;
      }
      existing.isVerified = true;
      existing.lastVerifiedAt = now;
    }
    this.saveToDisk();

    const sessionToken = `sess_${crypto.randomBytes(18).toString('hex')}`;
    this.activeSessions.set(sessionToken, cleanEmail);
    this.verifiedUserIds.set(existing.userId, {
      verifiedId: existing.verifiedId,
      email: cleanEmail,
      name: cleanName,
      verifiedAt: now
    });

    return {
      ok: true,
      status: 200,
      verifiedAccount: {
        userId: existing.userId,
        email: cleanEmail,
        name: cleanName,
        nativeLanguage: existing.nativeLanguage,
        bio: existing.bio,
        country: existing.country,
        timezone: existing.timezone,
        verifiedId: existing.verifiedId,
        isVerified: true,
        targetLanguageCode: existing.targetLanguageCode,
        level: existing.level,
        targetLanguages: existing.targetLanguages,
        learningStats: existing.learningStats,
        verifiedAt: now,
        sessionToken
      }
    };
  }

  public updateLearningStats(email: string, stats: Record<string, any>): Record<string, any> | null {
    const cleanEmail = normalizeEmail(email || '');
    if (!cleanEmail) return null;
    const existing = this.accounts.get(cleanEmail);
    if (!existing) return null;
    existing.learningStats = {
      ...(existing.learningStats || {}),
      ...stats,
      statsSource: 'real',
      updatedAt: Date.now()
    };
    this.saveToDisk();
    return existing.learningStats;
  }

  public registerVerifiedUserRecord(user: {
    id: string;
    email: string;
    name: string;
    verifiedId?: string;
    isVerified?: boolean;
  }): { isVerified: boolean; verifiedId: string } {
    const cleanEmail = normalizeEmail(user.email || `${user.id}@lernwelt.io`);
    const badge = user.verifiedId || generateVerifiedLearnerId(cleanEmail);
    if (user.isVerified) {
      this.verifiedUserIds.set(user.id, {
        verifiedId: badge,
        email: cleanEmail,
        name: user.name || 'Verified Learner',
        verifiedAt: Date.now()
      });
    }
    return {
      isVerified: Boolean(this.verifiedUserIds.has(user.id) || user.isVerified),
      verifiedId: badge
    };
  }

  public isUserVerified(userId: string): boolean {
    return this.verifiedUserIds.has(userId);
  }

  public getVerifiedBadge(userId: string): string | null {
    return this.verifiedUserIds.get(userId)?.verifiedId ?? null;
  }
}

