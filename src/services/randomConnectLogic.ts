import { LanguageRoom } from '../types';
import { createInitialsAvatarDataUri } from '../data/teacherData';

export type RandomCallMode = 'video' | 'audio';

export interface VerifiedRandomCandidate {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  country: string;
  nativeLanguage: string;
  targetLanguage: string;
  preferredLanguage: string; // 'any' or language code/name like 'German'
  preferredMode: RandomCallMode;
  isVerified: boolean;
  verifiedId: string;
  joinedAt: number;
}

export interface RandomMatchResult {
  matchId: string;
  room: LanguageRoom;
  userA: VerifiedRandomCandidate;
  userB: VerifiedRandomCandidate;
  resolvedCallMode: RandomCallMode;
  createdAt: number;
}

export function normalizePreferredLanguage(lang?: string): string {
  const clean = String(lang || 'any').trim().toLowerCase();
  if (!clean || clean === 'all' || clean === 'any' || clean === 'global') {
    return 'any';
  }
  return clean;
}

export function areLanguagesCompatible(langA: string, langB: string): boolean {
  const normA = normalizePreferredLanguage(langA);
  const normB = normalizePreferredLanguage(langB);
  if (normA === 'any' || normB === 'any') return true;
  return normA === normB;
}

const LANGUAGE_FLAG_LOOKUP: Record<string, { code: string; name: string; flag: string }> = {
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  english: { code: 'en', name: 'English', flag: '🇬🇧' },
  de: { code: 'de', name: 'German', flag: '🇩🇪' },
  german: { code: 'de', name: 'German', flag: '🇩🇪' },
  es: { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  spanish: { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  fr: { code: 'fr', name: 'French', flag: '🇫🇷' },
  french: { code: 'fr', name: 'French', flag: '🇫🇷' },
  it: { code: 'it', name: 'Italian', flag: '🇮🇹' },
  italian: { code: 'it', name: 'Italian', flag: '🇮🇹' },
  ja: { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  japanese: { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  zh: { code: 'zh', name: 'Mandarin', flag: '🇨🇳' },
  mandarin: { code: 'zh', name: 'Mandarin', flag: '🇨🇳' },
  pt: { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  portuguese: { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }
};

export function buildRandomVerifiedRoom(
  userA: VerifiedRandomCandidate,
  userB: VerifiedRandomCandidate,
  now: number = Date.now()
): RandomMatchResult {
  const shortHash = Math.abs(
    Array.from(`${userA.userId}_${userB.userId}_${now}`).reduce(
      (acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0,
      0
    )
  )
    .toString(36)
    .slice(0, 6);

  const matchId = `rmatch_${now}_${shortHash}`;
  const roomId = `random-verified-${shortHash}-${String(now).slice(-4)}`;

  const langKey =
    normalizePreferredLanguage(userA.preferredLanguage) !== 'any'
      ? normalizePreferredLanguage(userA.preferredLanguage)
      : normalizePreferredLanguage(userB.preferredLanguage) !== 'any'
        ? normalizePreferredLanguage(userB.preferredLanguage)
        : normalizePreferredLanguage(userA.targetLanguage);

  const langMeta = LANGUAGE_FLAG_LOOKUP[langKey] || {
    code: 'en',
    name: 'Global Exchange',
    flag: '🌍'
  };

  // Only launch video if both opted for video, or default to each user's preference; if both chose audio, audio
  const resolvedCallMode: RandomCallMode =
    userA.preferredMode === 'audio' && userB.preferredMode === 'audio' ? 'audio' : 'video';

  const avatarA = userA.avatarUrl || createInitialsAvatarDataUri(userA.name, '#4f46e5');

  const room: LanguageRoom = {
    id: roomId,
    languageCode: langMeta.code,
    languageName: langMeta.name,
    flag: langMeta.flag,
    title: `Verified Match · ${userA.name.split(' ')[0]} & ${userB.name.split(' ')[0]}`,
    subtitle: `Verified ID Random ${resolvedCallMode === 'video' ? 'Video & Audio' : 'Audio'} Session · Screen Share & Personal Chat Enabled`,
    currentTopic: `1-on-1 Verified Exchange (${userA.verifiedId} ↔ ${userB.verifiedId})`,
    levelRange: 'Verified Members',
    activeLearnersCount: 2,
    activeNativesCount: 2,
    roomKind: 'random-verified',
    welcomeMessage: `Matched! Both ${userA.name} (${userA.verifiedId}) and ${userB.name} (${userB.verifiedId}) have verified IDs. Use Video, Audio, Screen Share, and Personal Chat freely!`,
    suggestedPhrases: [
      `Hi! Nice to connect with another verified learner!`,
      `Where are you joining from today, and which language are you practicing?`,
      `Feel free to share your screen if we review notes or phrases together!`
    ],
    host: {
      id: userA.userId,
      name: userA.name,
      avatarUrl: avatarA,
      country: userA.country || 'Global',
      countryCode: langMeta.flag,
      nativeLanguage: userA.nativeLanguage || 'English',
      learningLanguage: userA.targetLanguage || langMeta.name,
      learningLevel: 'B1',
      rating: 5.0,
      reviewCount: 1,
      sessionsCompleted: 1,
      isOnline: true,
      interests: ['Verified Random Exchange', 'Live Video & Screen Share'],
      bio: `Verified Learner (${userA.verifiedId})`,
      availability: 'Available Now',
      verifiedNative: true
    }
  };

  return {
    matchId,
    room,
    userA,
    userB,
    resolvedCallMode,
    createdAt: now
  };
}

/**
 * Server-authoritative matchmaking queue exclusively for Verified-ID users.
 */
export class VerifiedRandomMatchmaker {
  private waitingQueue = new Map<string, VerifiedRandomCandidate>();
  private recentMatchesByUser = new Map<string, RandomMatchResult>();

  public enqueueOrMatch(
    candidate: VerifiedRandomCandidate,
    options?: { excludePartnerId?: string; now?: number }
  ): {
    status: 'matched' | 'waiting' | 'rejected';
    error?: string;
    match?: RandomMatchResult;
    queueSize: number;
  } {
    const now = options?.now ?? Date.now();

    if (!candidate.userId || !candidate.isVerified || !String(candidate.verifiedId || '').trim()) {
      return {
        status: 'rejected',
        error: 'Only verified learners can join Verified Random Connect.',
        queueSize: this.waitingQueue.size
      };
    }

    // Clear stale entries (> 3 minutes inactive)
    for (const [uid, entry] of this.waitingQueue.entries()) {
      if (now - entry.joinedAt > 3 * 60 * 1000) {
        this.waitingQueue.delete(uid);
      }
    }

    // Remove previous pending match receipt when explicitly starting a new search
    this.recentMatchesByUser.delete(candidate.userId);

    // Search FIFO for a compatible verified peer currently waiting
    for (const [otherId, other] of this.waitingQueue.entries()) {
      if (otherId === candidate.userId) continue;
      if (options?.excludePartnerId && otherId === options.excludePartnerId) continue;
      if (!other.isVerified) {
        this.waitingQueue.delete(otherId);
        continue;
      }

      if (areLanguagesCompatible(candidate.preferredLanguage, other.preferredLanguage)) {
        this.waitingQueue.delete(otherId);
        this.waitingQueue.delete(candidate.userId);

        const match = buildRandomVerifiedRoom(other, candidate, now);
        this.recentMatchesByUser.set(other.userId, match);
        this.recentMatchesByUser.set(candidate.userId, match);

        return {
          status: 'matched',
          match,
          queueSize: this.waitingQueue.size
        };
      }
    }

    // Otherwise add/refresh candidate in the waiting queue
    this.waitingQueue.set(candidate.userId, {
      ...candidate,
      preferredLanguage: normalizePreferredLanguage(candidate.preferredLanguage),
      joinedAt: now
    });

    return {
      status: 'waiting',
      queueSize: this.waitingQueue.size
    };
  }

  public leaveQueue(userId: string): number {
    this.waitingQueue.delete(userId);
    return this.waitingQueue.size;
  }

  public getRecentMatchForUser(userId: string): RandomMatchResult | null {
    return this.recentMatchesByUser.get(userId) || null;
  }

  public clearRecentMatchForUser(userId: string): void {
    this.recentMatchesByUser.delete(userId);
  }

  public getWaitingCandidates(): VerifiedRandomCandidate[] {
    return Array.from(this.waitingQueue.values());
  }

  public getQueueSize(): number {
    return this.waitingQueue.size;
  }
}

/**
 * Counts how many other verified users are actively searching in the queue
 * (excluding the current user and optionally filtering by compatible language).
 */
export function countOtherSearchingCandidates(
  waitingCandidates: ReadonlyArray<Pick<VerifiedRandomCandidate, 'userId' | 'preferredLanguage' | 'isVerified'>>,
  selfUserId: string,
  preferredLanguage: string = 'any'
): number {
  let count = 0;
  for (const candidate of waitingCandidates) {
    if (!candidate || !candidate.userId || candidate.userId === selfUserId) continue;
    if (!candidate.isVerified) continue;
    if (areLanguagesCompatible(preferredLanguage, candidate.preferredLanguage)) {
      count += 1;
    }
  }
  return count;
}

