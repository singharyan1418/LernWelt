import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PERSONAL_TEACHERS } from '../data/teacherData';
import { INITIAL_USER_PROFILE } from '../data/mockData';
import { TeacherLessonBooking } from '../types';
import {
  buildTeacherClassroomRoom,
  buildTeacherRoomId,
  filterPersonalTeachers,
  mergePersonalTeachers,
  mergeTeacherBookings,
  provisionUniversalUserProfile,
  validateLessonBookingInput,
  validateTeacherRegistrationInput
} from './personalTeacherService';

test('provisionUniversalUserProfile grants immediate unique learner identity to new visitors', () => {
  const profile = provisionUniversalUserProfile(null, null, INITIAL_USER_PROFILE);
  assert.ok(profile.id.startsWith('usr_'));
  assert.notEqual(profile.id, 'usr_main_992');
  assert.equal(profile.name, INITIAL_USER_PROFILE.name);
  assert.equal(profile.isOnline, true);
  assert.ok(profile.avatarUrl.startsWith('data:image/svg+xml'));
});

test('provisionUniversalUserProfile upgrades legacy hardcoded ID and honors URL name parameter', () => {
  const legacySaved = JSON.stringify({
    ...INITIAL_USER_PROFILE,
    id: 'usr_main_992',
    name: 'Saved Learner'
  });
  const upgraded = provisionUniversalUserProfile(legacySaved, 'Priya Sharma', INITIAL_USER_PROFILE);
  assert.notEqual(upgraded.id, 'usr_main_992');
  assert.equal(upgraded.name, 'Priya Sharma');
});

test('filterPersonalTeachers filters accurately by language, specialty, availability, and search query', () => {
  const germanTeachers = filterPersonalTeachers(INITIAL_PERSONAL_TEACHERS, {
    language: 'de'
  });
  assert.equal(germanTeachers.length, 1);
  assert.equal(germanTeachers[0].name, 'Dr. Hannah Lindner');

  const pronunciationTeachers = filterPersonalTeachers(INITIAL_PERSONAL_TEACHERS, {
    specialty: 'Pronunciation & Accent',
    availableNowOnly: true
  });
  assert.ok(pronunciationTeachers.length >= 2);
  assert.ok(
    pronunciationTeachers.every(
      t =>
        t.specialties.includes('Pronunciation & Accent') &&
        t.availability === 'Available Now'
    )
  );

  const searchSubjunctive = filterPersonalTeachers(INITIAL_PERSONAL_TEACHERS, {
    search: 'subjunctive'
  });
  assert.ok(searchSubjunctive.some(t => t.languageCode === 'es'));
});

test('validateLessonBookingInput rejects empty or too-short goals and accepts valid bookings', () => {
  assert.equal(
    validateLessonBookingInput({ slotLabel: '', learningGoal: 'Practice speaking' }).valid,
    false
  );
  assert.equal(
    validateLessonBookingInput({ slotLabel: 'Today · 18:00', learningGoal: '   ' }).valid,
    false
  );
  assert.equal(
    validateLessonBookingInput({ slotLabel: 'Today · 18:00', learningGoal: 'abc' }).valid,
    false
  );
  assert.equal(
    validateLessonBookingInput({
      slotLabel: 'Today · 18:00',
      learningGoal: 'Master German dative prepositions in conversation'
    }).valid,
    true
  );
});

test('validateTeacherRegistrationInput enforces required teacher profile fields', () => {
  assert.equal(
    validateTeacherRegistrationInput({
      name: '',
      languageName: 'German',
      credentials: 'Goethe Tutor',
      lessonFocus: 'Speaking confidence',
      bio: 'Experienced native teacher.'
    }).valid,
    false
  );

  assert.equal(
    validateTeacherRegistrationInput({
      name: 'Sofia Rossi',
      languageName: 'Italian',
      credentials: 'DITALS Certified Instructor',
      lessonFocus: 'Conversational fluency & grammar',
      bio: 'Native Italian instructor helping learners speak naturally.'
    }).valid,
    true
  );
});

test('buildTeacherRoomId and buildTeacherClassroomRoom create deterministic 1-on-1 room metadata', () => {
  const teacher = INITIAL_PERSONAL_TEACHERS[0];
  const roomId = buildTeacherRoomId(teacher.id);
  assert.equal(roomId, 'teacher-room-teacher_de_hannah');

  const room = buildTeacherClassroomRoom(teacher, 'Aarav');
  assert.equal(room.id, roomId);
  assert.equal(room.languageCode, 'de');
  assert.ok(room.subtitle.includes('Aarav'));
  assert.equal(room.host.name, teacher.name);
});

test('mergePersonalTeachers and mergeTeacherBookings are idempotent on duplicate and updated events', () => {
  const mergedTeachers = mergePersonalTeachers(INITIAL_PERSONAL_TEACHERS, [
    INITIAL_PERSONAL_TEACHERS[0]
  ]);
  assert.equal(mergedTeachers.length, INITIAL_PERSONAL_TEACHERS.length);

  const sampleBooking: TeacherLessonBooking = {
    id: 'bk_101',
    teacherId: 'teacher_de_hannah',
    teacherName: 'Dr. Hannah Lindner',
    teacherAvatar: 'data:image/svg+xml;utf8,test',
    languageCode: 'de',
    languageName: 'German',
    flag: '🇩🇪',
    studentId: 'usr_1',
    studentName: 'Alex Rivera',
    slotLabel: 'Today · 17:00',
    learningGoal: 'Prepare for Goethe B2 oral debate',
    focusArea: 'Exam Preparation',
    roomId: 'teacher-room-teacher_de_hannah',
    status: 'confirmed',
    createdAt: 1700000000000
  };

  const once = mergeTeacherBookings([], sampleBooking);
  const twice = mergeTeacherBookings(once, sampleBooking);
  assert.equal(twice.length, 1);

  const cancelled = mergeTeacherBookings(twice, {
    ...sampleBooking,
    status: 'cancelled'
  });
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].status, 'cancelled');
});
