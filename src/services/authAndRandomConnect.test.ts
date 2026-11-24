import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerAuthManager } from './serverAuthStore';
import {
  VerifiedRandomMatchmaker,
  VerifiedRandomCandidate,
  countOtherSearchingCandidates
} from './randomConnectLogic';
import { generateAccurateAiCoachReply } from './aiCoachEngine';

test('direct auth rejects invalid email or short password', () => {
  const auth = new ServerAuthManager({ persistFilePath: null, seedDemoAccount: true });

  const badEmail = auth.loginDirectly({
    email: 'invalid-email',
    password: 'StrongPassword1'
  });
  assert.equal(badEmail.ok, false);
  assert.equal(badEmail.status, 400);

  const shortPass = auth.loginDirectly({
    email: 'learner@example.com',
    password: '123'
  });
  assert.equal(shortPass.ok, false);
  assert.equal(shortPass.status, 400);
});

test('direct auth registers new user and grants verified access without OTP', () => {
  const auth = new ServerAuthManager({ persistFilePath: null, seedDemoAccount: false });

  // Direct registration creates verified user profile without OTP
  const registered = auth.registerDirectly({
    email: 'abhay@example.com',
    password: 'CorrectHorseBattery9',
    name: 'Abhay Singh',
    nativeLanguage: 'Hindi',
    targetLanguageCode: 'de'
  });
  assert.equal(registered.ok, true);
  assert.equal(registered.verifiedAccount?.isVerified, true);
  assert.match(registered.verifiedAccount?.verifiedId || '', /^LW-ID-[A-F0-9]{6}$/);
  assert.equal(registered.verifiedAccount?.name, 'Abhay Singh');
  assert.equal(auth.isUserVerified(registered.verifiedAccount!.userId), true);

  // Sign in with correct password works immediately
  const loginSuccess = auth.loginDirectly({
    email: 'abhay@example.com',
    password: 'CorrectHorseBattery9'
  });
  assert.equal(loginSuccess.ok, true);
  assert.equal(loginSuccess.verifiedAccount?.isVerified, true);

  // Attempt login with WRONG password fails with 401
  const wrongPass = auth.loginDirectly({
    email: 'abhay@example.com',
    password: 'WrongPassword999'
  });
  assert.equal(wrongPass.ok, false);
  assert.equal(wrongPass.status, 401);
});

test('direct auth supports Google login and direct profile update without OTP', () => {
  const auth = new ServerAuthManager({ persistFilePath: null, seedDemoAccount: false });

  // Google sign in authenticates directly
  const googleAuth = auth.googleAuthDirectly({
    email: 'priya@gmail.com',
    name: 'Priya Nair',
    targetLanguageCode: 'es'
  });
  assert.equal(googleAuth.ok, true);
  assert.equal(googleAuth.verifiedAccount?.isVerified, true);
  assert.match(googleAuth.verifiedAccount?.verifiedId || '', /^LW-ID-[A-F0-9]{6}$/);

  // Direct profile update without OTP
  const updated = auth.updateProfileDirectly({
    userId: googleAuth.verifiedAccount!.userId,
    email: 'priya@gmail.com',
    name: 'Priya N. (Updated)',
    bio: 'Learning Spanish for travel'
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.verifiedAccount?.name, 'Priya N. (Updated)');
  assert.equal(updated.verifiedAccount?.bio, 'Learning Spanish for travel');
});

test('returning users keep saved nativeLanguage, targetLanguageCode, level, and targetLanguages across logins and DB hydration', () => {
  const auth = new ServerAuthManager({ persistFilePath: null, seedDemoAccount: false });

  const reg = auth.registerDirectly({
    email: 'rohan@example.com',
    password: 'SecretPassword99',
    name: 'Rohan Verma',
    nativeLanguage: 'Hindi',
    country: 'India',
    timezone: 'Asia/Kolkata',
    targetLanguageCode: 'es',
    level: 'B2',
    targetLanguages: [
      { language: 'Spanish', level: 'B2', goal: 'Fluency for Madrid work' }
    ]
  });
  assert.equal(reg.ok, true);
  assert.equal(reg.verifiedAccount?.nativeLanguage, 'Hindi');
  assert.equal(reg.verifiedAccount?.targetLanguageCode, 'es');
  assert.equal(reg.verifiedAccount?.level, 'B2');
  assert.equal(reg.verifiedAccount?.country, 'India');
  assert.equal(reg.verifiedAccount?.targetLanguages?.[0]?.language, 'Spanish');

  // Re-login without passing targetLanguageCode or with conflicting default does NOT overwrite saved preferences
  const relogin = auth.loginDirectly({
    email: 'rohan@example.com',
    password: 'SecretPassword99',
    targetLanguageCode: 'de',
    level: 'A1',
    overridePreferences: false
  });
  assert.equal(relogin.ok, true);
  assert.equal(relogin.verifiedAccount?.nativeLanguage, 'Hindi');
  assert.equal(relogin.verifiedAccount?.targetLanguageCode, 'es');
  assert.equal(relogin.verifiedAccount?.level, 'B2');
  assert.equal(relogin.verifiedAccount?.targetLanguages?.[0]?.language, 'Spanish');

  // Google Sign-In on returning account also preserves saved native & target languages
  const googleReturning = auth.googleAuthDirectly({
    email: 'rohan@example.com',
    name: 'Rohan Verma',
    targetLanguageCode: 'de',
    level: 'A1'
  });
  assert.equal(googleReturning.ok, true);
  assert.equal(googleReturning.verifiedAccount?.nativeLanguage, 'Hindi');
  assert.equal(googleReturning.verifiedAccount?.targetLanguageCode, 'es');
  assert.equal(googleReturning.verifiedAccount?.level, 'B2');

  // Hydration from Cloud SQL row into a fresh ServerAuthManager restores profile
  const freshAuth = new ServerAuthManager({ persistFilePath: null, seedDemoAccount: false });
  const hydrated = freshAuth.hydrateAccountFromDbRow({
    uid: reg.verifiedAccount!.userId,
    email: 'rohan@example.com',
    displayName: 'Rohan Verma',
    nativeLanguage: 'Hindi',
    targetLanguageCode: 'es',
    cefrLevel: 'B2',
    targetLanguagesJson: JSON.stringify([{ language: 'Spanish', level: 'B2', goal: 'Fluency for Madrid work' }]),
    bio: 'Speaking daily',
    country: 'India',
    timezone: 'Asia/Kolkata'
  });
  assert.ok(hydrated);
  assert.equal(hydrated?.nativeLanguage, 'Hindi');
  assert.equal(hydrated?.targetLanguageCode, 'es');
  assert.equal(hydrated?.targetLanguages?.[0]?.language, 'Spanish');
});

test('VerifiedRandomMatchmaker rejects unverified users and pairs two verified users into a live room', () => {
  const matchmaker = new VerifiedRandomMatchmaker();

  const unverifiedUser: VerifiedRandomCandidate = {
    userId: 'usr_unverified',
    name: 'Unverified Guest',
    email: 'guest@example.com',
    avatarUrl: '',
    country: 'India',
    nativeLanguage: 'English',
    targetLanguage: 'German',
    preferredLanguage: 'any',
    preferredMode: 'video',
    isVerified: false,
    verifiedId: '',
    joinedAt: 1000
  };

  const rejected = matchmaker.enqueueOrMatch(unverifiedUser, { now: 1000 });
  assert.equal(rejected.status, 'rejected');
  assert.equal(matchmaker.getQueueSize(), 0);

  const verifiedA: VerifiedRandomCandidate = {
    userId: 'usr_ver_a',
    name: 'Lukas Meyer',
    email: 'lukas@example.com',
    avatarUrl: '',
    country: 'Germany',
    nativeLanguage: 'German',
    targetLanguage: 'English',
    preferredLanguage: 'German',
    preferredMode: 'video',
    isVerified: true,
    verifiedId: 'LW-ID-11AA22',
    joinedAt: 1100
  };

  const verifiedB: VerifiedRandomCandidate = {
    userId: 'usr_ver_b',
    name: 'Sara Alvarez',
    email: 'sara@example.com',
    avatarUrl: '',
    country: 'Spain',
    nativeLanguage: 'Spanish',
    targetLanguage: 'German',
    preferredLanguage: 'any',
    preferredMode: 'video',
    isVerified: true,
    verifiedId: 'LW-ID-33BB44',
    joinedAt: 1200
  };

  const firstJoin = matchmaker.enqueueOrMatch(verifiedA, { now: 1100 });
  assert.equal(firstJoin.status, 'waiting');
  assert.equal(firstJoin.queueSize, 1);

  const secondJoin = matchmaker.enqueueOrMatch(verifiedB, { now: 1200 });
  assert.equal(secondJoin.status, 'matched');
  assert.equal(secondJoin.queueSize, 0);
  assert.ok(secondJoin.match?.room.id.startsWith('random-verified-'));
  assert.equal(secondJoin.match?.resolvedCallMode, 'video');
});

test('VerifiedRandomMatchmaker keeps solitary searcher waiting until another real searcher joins and counts others accurately', () => {
  const matchmaker = new VerifiedRandomMatchmaker();

  const alice: VerifiedRandomCandidate = {
    userId: 'usr_alice',
    name: 'Alice',
    email: 'alice@example.com',
    avatarUrl: '',
    country: 'UK',
    nativeLanguage: 'English',
    targetLanguage: 'German',
    preferredLanguage: 'German',
    preferredMode: 'video',
    isVerified: true,
    verifiedId: 'LW-ID-ALICE1',
    joinedAt: 2000
  };

  const waiting = matchmaker.enqueueOrMatch(alice, { now: 2000 });
  assert.equal(waiting.status, 'waiting');
  assert.equal(waiting.match, undefined);
  assert.equal(countOtherSearchingCandidates(matchmaker.getWaitingCandidates(), 'usr_alice', 'German'), 0);
  assert.equal(countOtherSearchingCandidates(matchmaker.getWaitingCandidates(), 'usr_bob', 'German'), 1);
  assert.equal(countOtherSearchingCandidates(matchmaker.getWaitingCandidates(), 'usr_bob', 'Spanish'), 0);

  // If Alice leaves because no one else was searching, Bob searching next also waits (never pairs with departed/fake user)
  matchmaker.leaveQueue('usr_alice');
  assert.equal(matchmaker.getQueueSize(), 0);

  const bob: VerifiedRandomCandidate = {
    ...alice,
    userId: 'usr_bob',
    name: 'Bob',
    email: 'bob@example.com',
    verifiedId: 'LW-ID-BOB002',
    preferredLanguage: 'any',
    joinedAt: 3000
  };
  const bobJoin = matchmaker.enqueueOrMatch(bob, { now: 3000 });
  assert.equal(bobJoin.status, 'waiting');
  assert.equal(bobJoin.match, undefined);
});

test('AI Coach engine answers translations, grammar questions, and corrections accurately without errors', () => {
  const transReply = generateAccurateAiCoachReply({
    messages: [{ sender: 'user', text: 'How do I say "I have been waiting for two hours" in German?' }],
    targetLanguage: 'German',
    userLevel: 'B1'
  });
  assert.ok(transReply.replyText.includes('Ich warte schon seit zwei Stunden'));

  const grammarReply = generateAccurateAiCoachReply({
    messages: [{ sender: 'user', text: 'What is the difference between ser vs estar?' }],
    targetLanguage: 'Spanish',
    userLevel: 'A2'
  });
  assert.ok(grammarReply.replyText.includes('Ser'));
  assert.ok(grammarReply.replyText.includes('Estar'));

  const correctionReply = generateAccurateAiCoachReply({
    messages: [{ sender: 'user', text: 'Ich helfe dich heute.' }],
    targetLanguage: 'German',
    userLevel: 'B1'
  });
  assert.ok(correctionReply.replyText.includes('dir'));
});
