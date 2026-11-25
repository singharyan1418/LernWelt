import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEACHER_ACCESS_PRICE_INR,
  addOneMonthFromDate,
  createTeacherAccessPass,
  extractTeacherIdFromRoomId,
  getTeacherAccessStatus,
  getTeacherAccessStatusForTeacher,
  hasActiveAccessForTeacher,
  isTeacherAccessActive,
  isTeacherClassroomRoomId,
  normalizeTeacherAccessPassList,
  upsertTeacherAccessPass,
  validateTeacherPaymentInput
} from './teacherAccessService';
import { TeacherAccessPass } from '../types';

describe('teacherAccessService (per-teacher ₹999 monthly gate)', () => {
  it('blocks direct access when pass is null or invalid', () => {
    assert.equal(isTeacherAccessActive(null), false);
    assert.equal(isTeacherAccessActive(undefined), false);
    assert.equal(hasActiveAccessForTeacher([], 'teacher_de_hannah'), false);

    const status = getTeacherAccessStatus(null);
    assert.equal(status.hasActiveAccess, false);
    assert.equal(status.isExpired, false);
    assert.equal(status.amountInr, 999);
    assert.equal(status.remainingDays, 0);
    assert.equal(status.teacherId, null);
  });

  it('computes exact 1 calendar month validity from date of payment including month-end clamping', () => {
    const paidFeb = Date.UTC(2026, 1, 10, 9, 30, 0); // Feb 10, 2026
    assert.equal(addOneMonthFromDate(paidFeb), Date.UTC(2026, 2, 10, 9, 30, 0)); // Mar 10, 2026

    const paidJan31 = Date.UTC(2026, 0, 31, 14, 0, 0); // Jan 31, 2026
    assert.equal(addOneMonthFromDate(paidJan31), Date.UTC(2026, 1, 28, 14, 0, 0)); // Feb 28, 2026 (non-leap)

    const paidLeapJan31 = Date.UTC(2024, 0, 31, 14, 0, 0); // Jan 31, 2024
    assert.equal(addOneMonthFromDate(paidLeapJan31), Date.UTC(2024, 1, 29, 14, 0, 0)); // Feb 29, 2024 (leap)

    const paidDec15 = Date.UTC(2026, 11, 15, 8, 0, 0); // Dec 15, 2026
    assert.equal(addOneMonthFromDate(paidDec15), Date.UTC(2027, 0, 15, 8, 0, 0)); // Jan 15, 2027
  });

  it('activates for 1 month after ₹999 payment for that specific teacher and expires automatically after 1 month', () => {
    const paidAt = Date.UTC(2026, 4, 5, 10, 0, 0); // May 5, 2026
    const pass = createTeacherAccessPass({
      userId: 'usr_123',
      teacherId: 'teacher_de_hannah',
      teacherName: 'Dr. Hannah Lindner',
      userName: 'Aryan',
      paymentMethod: 'upi',
      paymentSummary: 'UPI · aryan@upi',
      paidAt
    });

    assert.equal(pass.teacherId, 'teacher_de_hannah');
    assert.equal(pass.amountInr, TEACHER_ACCESS_PRICE_INR);
    assert.equal(pass.currency, 'INR');
    assert.equal(pass.expiresAt, Date.UTC(2026, 5, 5, 10, 0, 0)); // June 5, 2026

    // Active on day of payment and 15 days later for Dr. Hannah Lindner
    const activeStatus = getTeacherAccessStatus(pass, paidAt + 1000 * 60 * 60 * 24 * 15);
    assert.equal(activeStatus.hasActiveAccess, true);
    assert.equal(activeStatus.isExpired, false);
    assert.equal(activeStatus.remainingDays, 16);
    assert.equal(activeStatus.teacherId, 'teacher_de_hannah');

    // Expired right at expiresAt
    const expiredStatus = getTeacherAccessStatus(pass, pass.expiresAt);
    assert.equal(expiredStatus.hasActiveAccess, false);
    assert.equal(expiredStatus.isExpired, true);
    assert.equal(expiredStatus.remainingDays, 0);
  });

  it('isolates ₹999 unlocks per individual teacher and supports unlocking others separately', () => {
    const paidHannah = Date.UTC(2026, 4, 5, 10, 0, 0);
    const paidMateo = Date.UTC(2026, 4, 12, 11, 0, 0);

    const hannahPass = createTeacherAccessPass({
      userId: 'usr_123',
      teacherId: 'teacher_de_hannah',
      teacherName: 'Dr. Hannah Lindner',
      paymentMethod: 'upi',
      paymentSummary: 'UPI · aryan@okaxis',
      paidAt: paidHannah
    });

    // Paying ₹999 for Hannah unlocks ONLY Hannah, leaving Mateo locked
    let passes = upsertTeacherAccessPass([], hannahPass);
    assert.equal(hasActiveAccessForTeacher(passes, 'teacher_de_hannah', paidHannah + 1000), true);
    assert.equal(hasActiveAccessForTeacher(passes, 'teacher_es_mateo', paidHannah + 1000), false);
    assert.equal(
      getTeacherAccessStatusForTeacher(passes, 'teacher_es_mateo', paidHannah + 1000).hasActiveAccess,
      false
    );

    // Paying another ₹999 for Mateo unlocks Mateo independently while keeping Hannah's pass intact
    const mateoPass = createTeacherAccessPass({
      userId: 'usr_123',
      teacherId: 'teacher_es_mateo',
      teacherName: 'Prof. Mateo Valdés',
      paymentMethod: 'upi',
      paymentSummary: 'UPI · aryan@okaxis',
      paidAt: paidMateo
    });
    passes = upsertTeacherAccessPass(passes, mateoPass);

    assert.equal(passes.length, 2);
    assert.equal(hasActiveAccessForTeacher(passes, 'teacher_de_hannah', paidMateo + 1000), true);
    assert.equal(hasActiveAccessForTeacher(passes, 'teacher_es_mateo', paidMateo + 1000), true);
    assert.equal(hasActiveAccessForTeacher(passes, 'teacher_fr_claire', paidMateo + 1000), false);
  });

  it('rejects legacy passes missing teacherId and passes with tampered price below ₹999', () => {
    const paidAt = Date.UTC(2026, 4, 5, 10, 0, 0);
    const pass = createTeacherAccessPass({
      userId: 'usr_123',
      teacherId: 'teacher_de_hannah',
      paymentMethod: 'upi',
      paymentSummary: 'UPI · aryan@upi',
      paidAt
    });
    const tamperedPrice = { ...pass, amountInr: 1 };
    assert.equal(isTeacherAccessActive(tamperedPrice, paidAt + 1000), false);

    const legacyGlobalPass = { ...pass, teacherId: '' } as TeacherAccessPass;
    assert.equal(isTeacherAccessActive(legacyGlobalPass, paidAt + 1000), false);
    assert.equal(normalizeTeacherAccessPassList([legacyGlobalPass, pass]).length, 1);
  });

  it('validates UPI, Card, and Net Banking payment inputs strictly', () => {
    const now = Date.UTC(2026, 4, 5, 10, 0, 0);

    // Reject wrong amount
    assert.equal(
      validateTeacherPaymentInput({ paymentMethod: 'upi', amountInr: 500, upiId: 'user@upi' }, now).valid,
      false
    );

    // UPI validation
    assert.equal(validateTeacherPaymentInput({ paymentMethod: 'upi', upiId: 'invalid' }, now).valid, false);
    assert.equal(validateTeacherPaymentInput({ paymentMethod: 'upi', upiId: 'aryan@okaxis' }, now).valid, true);

    // Card validation
    assert.equal(
      validateTeacherPaymentInput({
        paymentMethod: 'card',
        cardHolder: 'Aryan',
        cardNumber: '1234',
        cardExpiry: '12/28',
        cardCvv: '123'
      }, now).valid,
      false
    );
    assert.equal(
      validateTeacherPaymentInput({
        paymentMethod: 'card',
        cardHolder: 'Aryan',
        cardNumber: '4242 4242 4242 4242',
        cardExpiry: '01/25', // expired vs May 2026
        cardCvv: '123'
      }, now).valid,
      false
    );
    assert.equal(
      validateTeacherPaymentInput({
        paymentMethod: 'card',
        cardHolder: 'Aryan',
        cardNumber: '4242 4242 4242 4242',
        cardExpiry: '12/28',
        cardCvv: '456'
      }, now).valid,
      true
    );

    // Net banking validation
    assert.equal(
      validateTeacherPaymentInput({
        paymentMethod: 'netbanking',
        bankName: '',
        accountHolder: 'Aryan'
      }, now).valid,
      false
    );
    assert.equal(
      validateTeacherPaymentInput({
        paymentMethod: 'netbanking',
        bankName: 'HDFC Bank',
        accountHolder: 'Aryan Sharma'
      }, now).valid,
      true
    );
  });

  it('identifies teacher classroom room IDs and extracts owning teacherId safely', () => {
    assert.equal(isTeacherClassroomRoomId('teacher-room-teacher_de_hannah'), true);
    assert.equal(isTeacherClassroomRoomId('TEACHER-ROOM-teacher_fr_claire'), true);
    assert.equal(isTeacherClassroomRoomId('de-berlin-cafe'), false);
    assert.equal(isTeacherClassroomRoomId(''), false);

    assert.equal(
      extractTeacherIdFromRoomId('teacher-room-teacher_de_hannah', ['teacher_de_hannah', 'teacher_es_mateo']),
      'teacher_de_hannah'
    );
    assert.equal(
      extractTeacherIdFromRoomId('teacher-room-teacher_de_hannah-booking_sample_01', ['teacher_de_hannah']),
      'teacher_de_hannah'
    );
    assert.equal(
      extractTeacherIdFromRoomId('teacher-room-teacher_es_mateo-booking_99'),
      'teacher_es_mateo'
    );
    assert.equal(extractTeacherIdFromRoomId('de-berlin-cafe'), null);
  });
});
