import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateRealPracticeSeconds,
  applyRealCorrectionEvent,
  buildPersistedStatsSnapshot,
  computeCorrectionCountFromAnalysis,
  computeCorrectionCountFromPronunciation,
  formatPracticedDuration,
  isActivePracticeContext,
  sanitizeToRealStatsProfile,
  sanitizeVocabularyDeck
} from './learningStatsService';
import { INITIAL_USER_PROFILE } from '../data/mockData';
import { CorrectionResult, PronunciationResult, UserProfile, VocabularyWord } from '../types';

test('INITIAL_USER_PROFILE starts with strictly zeroed real metrics and no mock numbers', () => {
  assert.equal(INITIAL_USER_PROFILE.streakDays, 0);
  assert.equal(INITIAL_USER_PROFILE.totalPracticeMinutes, 0);
  assert.equal(INITIAL_USER_PROFILE.totalPracticeSeconds, 0);
  assert.equal(INITIAL_USER_PROFILE.wordsLearned, 0);
  assert.equal(INITIAL_USER_PROFILE.correctionsReceived, 0);
  assert.equal(INITIAL_USER_PROFILE.statsSource, 'real');
  assert.equal(INITIAL_USER_PROFILE.streak?.bestStreak, 0);
  assert.equal(INITIAL_USER_PROFILE.streak?.totalXp, 0);
  assert.equal(INITIAL_USER_PROFILE.streak?.streakFreezesAvailable, 0);
  assert.equal(INITIAL_USER_PROFILE.streak?.streakFreezesUsed, 0);
});

test('sanitizeVocabularyDeck purges unedited legacy mock words while keeping user-added words', () => {
  const legacyOnly = [
    { id: 'voc_1', word: 'Feierabend', translation: 'end of work', language: 'German', contextSentence: '', mastered: false },
    { id: 'voc_2', word: 'Vorfreude', translation: 'anticipation', language: 'German', contextSentence: '', mastered: false }
  ];
  assert.equal(sanitizeVocabularyDeck(legacyOnly, false).length, 0);

  const userAdded: VocabularyWord[] = [
    { id: 'voc_1760000_abcd', word: 'Geduld', translation: 'Patience', language: 'German', contextSentence: 'Geduld ist wichtig.', mastered: false }
  ];
  const kept = sanitizeVocabularyDeck([...legacyOnly, ...userAdded], false);
  assert.equal(kept.length, 3);
  assert.equal(sanitizeVocabularyDeck(userAdded, true).length, 1);
});

test('sanitizeToRealStatsProfile strips stale mock numbers from pre-existing cached sessions', () => {
  const legacyCachedProfile: UserProfile = {
    ...INITIAL_USER_PROFILE,
    statsSource: undefined,
    streakDays: 14,
    totalPracticeMinutes: 380,
    wordsLearned: 142,
    correctionsReceived: 67
  };

  const userVocab: VocabularyWord[] = [
    { id: 'voc_real_1', word: 'Mut', translation: 'Courage', language: 'German', contextSentence: 'Mut haben.', mastered: false }
  ];

  const sanitized = sanitizeToRealStatsProfile(legacyCachedProfile, userVocab, new Date('2026-11-13T10:00:00'));
  assert.equal(sanitized.statsSource, 'real');
  assert.equal(sanitized.streakDays, 0);
  assert.equal(sanitized.totalPracticeMinutes, 0);
  assert.equal(sanitized.totalPracticeSeconds, 0);
  assert.equal(sanitized.correctionsReceived, 0);
  assert.equal(sanitized.wordsLearned, 1);
});

test('accumulateRealPracticeSeconds tracks exact seconds, derives real minutes, and unlocks daily streak at goal', () => {
  const refDate = new Date('2026-11-13T10:00:00');
  let profile = sanitizeToRealStatsProfile(INITIAL_USER_PROFILE, [], refDate);

  // 45 seconds practiced: 0 full minutes, 45 seconds recorded
  profile = accumulateRealPracticeSeconds(profile, 45, refDate);
  assert.equal(profile.totalPracticeSeconds, 45);
  assert.equal(profile.totalPracticeMinutes, 0);
  assert.equal(profile.streak?.todaySeconds, 45);
  assert.equal(profile.streak?.todayMinutes, 0);
  assert.equal(profile.streak?.todayCompleted, false);
  assert.equal(profile.streakDays, 0);

  const formattedSubMinute = formatPracticedDuration(profile.totalPracticeMinutes, profile.totalPracticeSeconds);
  assert.equal(formattedSubMinute.valueLabel, '45s');

  // Add 150 seconds -> 195 seconds = 3 minutes
  profile = accumulateRealPracticeSeconds(profile, 150, refDate);
  assert.equal(profile.totalPracticeSeconds, 195);
  assert.equal(profile.totalPracticeMinutes, 3);
  assert.equal(profile.streak?.todayMinutes, 3);
  assert.equal(profile.streak?.weeklyHistory[6].minutesPracticed, 3);

  // Add 720 seconds (12m) -> 915 seconds = 15m -> meets 15m daily goal and completes streak!
  profile = accumulateRealPracticeSeconds(profile, 720, refDate);
  assert.equal(profile.totalPracticeMinutes, 15);
  assert.equal(profile.streak?.todayMinutes, 15);
  assert.equal(profile.streak?.todayCompleted, true);
  assert.equal(profile.streakDays, 1);
  assert.equal(profile.streak?.totalXp, 50);
});

test('computeCorrectionCountFromAnalysis counts real errors and avoids counting error-free checks', () => {
  const withErrors: CorrectionResult = {
    id: 'corr_1',
    originalText: 'Ich bin gut heute und ich habe angst vor der Hund.',
    correctedText: 'Mir geht es heute gut und ich habe Angst vor dem Hund.',
    targetLanguage: 'German',
    hasErrors: true,
    overallFeedback: '2 fixes needed.',
    mistakes: [
      { wrongPart: 'Ich bin gut', suggestion: 'Mir geht es gut', type: 'grammar', explanation: 'Idiomatic phrasing' },
      { wrongPart: 'vor der Hund', suggestion: 'vor dem Hund', type: 'grammar', explanation: 'Dative masculine' }
    ],
    betterWords: [],
    cefrLevelEstimated: 'B1',
    nativeNuanceTip: '',
    timestamp: Date.now()
  };
  assert.equal(computeCorrectionCountFromAnalysis(withErrors), 2);

  const cleanSentence: CorrectionResult = {
    ...withErrors,
    id: 'corr_2',
    originalText: 'Ich gehe heute ins Kino.',
    correctedText: 'Ich gehe heute ins Kino.',
    hasErrors: false,
    mistakes: []
  };
  assert.equal(computeCorrectionCountFromAnalysis(cleanSentence), 0);
});

test('computeCorrectionCountFromPronunciation counts words needing improvement', () => {
  const evalRes: PronunciationResult = {
    accuracyScore: 76,
    fluencyScore: 80,
    overallAssessment: 'Good',
    words: [
      { word: 'Guten', score: 92, status: 'excellent' },
      { word: 'Morgen', score: 62, status: 'needs-work' },
      { word: 'Freund', score: 65, status: 'needs-work' }
    ],
    phoneticAnalysis: '',
    mouthPositionTip: '',
    intonationFeedback: ''
  };
  assert.equal(computeCorrectionCountFromPronunciation(evalRes), 2);
});

test('applyRealCorrectionEvent is idempotent and increments only once per unique correction event', () => {
  let profile = sanitizeToRealStatsProfile(INITIAL_USER_PROFILE, []);
  let seen = new Set<string>();

  const first = applyRealCorrectionEvent(profile, { id: 'corr_abc', count: 2 }, seen);
  profile = first.profile;
  seen = first.nextSeenIds;
  assert.equal(first.added, 2);
  assert.equal(profile.correctionsReceived, 2);

  // Duplicate event must be ignored
  const duplicate = applyRealCorrectionEvent(profile, { id: 'corr_abc', count: 2 }, seen);
  assert.equal(duplicate.added, 0);
  assert.equal(duplicate.profile.correctionsReceived, 2);

  // Zero-count event must not increment
  const zero = applyRealCorrectionEvent(profile, { id: 'corr_clean', count: 0 }, seen);
  assert.equal(zero.added, 0);
  assert.equal(zero.profile.correctionsReceived, 2);
});

test('isActivePracticeContext limits time accumulation strictly to real active practice views', () => {
  assert.equal(isActivePracticeContext({ activeTab: 'profile', isInsideRoom: false }), false);
  assert.equal(isActivePracticeContext({ activeTab: 'vocab-deck', isInsideRoom: false }), false);
  assert.equal(isActivePracticeContext({ activeTab: 'chat-room', isInsideRoom: false }), false);
  assert.equal(isActivePracticeContext({ activeTab: 'chat-room', isInsideRoom: true }), true);
  assert.equal(isActivePracticeContext({ activeTab: 'ai-drills', isInsideRoom: false }), true);
  assert.equal(isActivePracticeContext({ activeTab: 'grammar-lab', isInsideRoom: false }), true);
  assert.equal(isActivePracticeContext({ activeTab: 'ai-coach', isInsideRoom: false }), true);
  assert.equal(isActivePracticeContext({ activeTab: 'random-connect', isInsideRoom: false, isRandomMatchActive: false }), false);
  assert.equal(isActivePracticeContext({ activeTab: 'random-connect', isInsideRoom: false, isRandomMatchActive: true }), true);
});

test('buildPersistedStatsSnapshot produces synchronized snapshot matching vocab deck length', () => {
  const vocab: VocabularyWord[] = [
    { id: 'v1', word: 'Hallo', translation: 'Hello', language: 'German', contextSentence: 'Hallo!', mastered: false },
    { id: 'v2', word: 'Danke', translation: 'Thanks', language: 'German', contextSentence: 'Danke!', mastered: true }
  ];
  let profile = sanitizeToRealStatsProfile(INITIAL_USER_PROFILE, vocab);
  profile = accumulateRealPracticeSeconds(profile, 125);
  const snapshot = buildPersistedStatsSnapshot(profile, vocab, new Set(['c1']));
  assert.equal(snapshot.statsSource, 'real');
  assert.equal(snapshot.totalPracticeSeconds, 125);
  assert.equal(snapshot.totalPracticeMinutes, 2);
  assert.equal(snapshot.vocabulary?.length, 2);
  assert.deepEqual(snapshot.seenCorrectionIds, ['c1']);
});
