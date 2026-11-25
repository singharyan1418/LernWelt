import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_CALENDAR_SCOPES,
  buildCalendarDraftFromLernWeltEvent,
  buildGoogleCalendarEventPayload,
  classifyGoogleCalendarApiError,
  getMonthTimeBoundsIso,
  normalizeGoogleCalendarEvents,
  normalizeGoogleCalendarList,
  validateCalendarEventDraft
} from './googleCalendarLogic';
import { COMBINED_WORKSPACE_SCOPES } from './gmailLogic';

describe('googleCalendarLogic', () => {
  it('includes all 17 Google Calendar scopes inside COMBINED_WORKSPACE_SCOPES', () => {
    assert.equal(GOOGLE_CALENDAR_SCOPES.length, 17);
    assert.ok(GOOGLE_CALENDAR_SCOPES.includes('https://www.googleapis.com/auth/calendar'));
    assert.ok(GOOGLE_CALENDAR_SCOPES.includes('https://www.googleapis.com/auth/calendar.events'));
    for (const scope of GOOGLE_CALENDAR_SCOPES) {
      assert.ok(
        COMBINED_WORKSPACE_SCOPES.includes(scope),
        `Expected COMBINED_WORKSPACE_SCOPES to include ${scope}`
      );
    }
  });

  it('normalizes calendar list with primary calendar sorted first and deleted excluded', () => {
    const lists = normalizeGoogleCalendarList([
      { id: 'work@group.calendar.google.com', summary: 'Work', accessRole: 'writer' },
      { id: 'deleted-cal', summary: 'Removed', deleted: true },
      {
        id: 'primary@gmail.com',
        summary: 'Aryan Singh',
        primary: true,
        accessRole: 'owner',
        timeZone: 'Asia/Kolkata'
      }
    ]);
    assert.equal(lists.length, 2);
    assert.equal(lists[0].id, 'primary@gmail.com');
    assert.equal(lists[0].primary, true);
    assert.equal(lists[1].summary, 'Work');
  });

  it('normalizes timed and all-day Google Calendar events and excludes cancelled items', () => {
    const events = normalizeGoogleCalendarEvents(
      [
        {
          id: 'evt-cancelled',
          summary: 'Cancelled class',
          status: 'cancelled',
          start: { dateTime: '2026-05-10T10:00:00Z' },
          end: { dateTime: '2026-05-10T11:00:00Z' }
        },
        {
          id: 'evt-all-day',
          summary: 'German Immersion Day',
          status: 'confirmed',
          start: { date: '2026-05-12' },
          end: { date: '2026-05-13' }
        },
        {
          id: 'evt-timed',
          summary: 'Spanish Practice Call',
          description: 'Conversation club',
          location: 'Google Meet',
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
          attendees: [{ email: 'a@test.com' }, { email: 'b@test.com' }],
          status: 'confirmed',
          start: { dateTime: '2026-05-12T15:30:00.000Z' },
          end: { dateTime: '2026-05-12T16:15:00.000Z' }
        }
      ],
      'primary',
      'owner'
    );

    assert.equal(events.length, 2);
    const allDay = events.find((e) => e.id === 'evt-all-day');
    const timed = events.find((e) => e.id === 'evt-timed');
    assert.ok(allDay);
    assert.equal(allDay?.isAllDay, true);
    assert.equal(allDay?.date, '2026-05-12');
    assert.ok(timed);
    assert.equal(timed?.isAllDay, false);
    assert.equal(timed?.durationMinutes, 45);
    assert.equal(timed?.attendeesCount, 2);
    assert.equal(timed?.hangoutLink, 'https://meet.google.com/abc-defg-hij');
    assert.equal(timed?.canEdit, true);
  });

  it('marks reader calendar events as non-editable', () => {
    const events = normalizeGoogleCalendarEvents(
      [
        {
          id: 'holiday-1',
          summary: 'Public Holiday',
          start: { date: '2026-01-01' },
          end: { date: '2026-01-02' }
        }
      ],
      'holidays',
      'reader'
    );
    assert.equal(events[0].canEdit, false);
  });

  it('validates event drafts and builds timed and all-day Calendar API payloads', () => {
    const invalid = validateCalendarEventDraft({
      summary: '   ',
      date: '2026-05-15',
      startTime: '18:00'
    });
    assert.equal(invalid.valid, false);

    const timedPayload = buildGoogleCalendarEventPayload({
      summary: 'French Speaking Club',
      description: 'Practice B1 idioms',
      location: 'LernWelt Room',
      date: '2026-05-15',
      startTime: '18:00',
      durationMinutes: 45,
      isAllDay: false
    });
    assert.equal(timedPayload.summary, 'French Speaking Club');
    assert.ok('dateTime' in timedPayload.start);
    assert.ok('dateTime' in timedPayload.end);

    const allDayPayload = buildGoogleCalendarEventPayload({
      summary: 'JLPT Exam Day',
      date: '2026-07-05',
      startTime: '00:00',
      isAllDay: true
    });
    assert.deepEqual(allDayPayload.start, { date: '2026-07-05' });
    assert.deepEqual(allDayPayload.end, { date: '2026-07-06' });
  });

  it('converts a LernWelt CalendarEvent into a Google Calendar draft cleanly', () => {
    const draft = buildCalendarDraftFromLernWeltEvent({
      id: 'cal-1',
      title: 'German Coffee Chat',
      description: 'Casual speaking',
      languageCode: 'de',
      languageName: 'German',
      flag: '🇩🇪',
      category: 'speaking-club',
      cefrLevel: 'B1',
      date: '2026-06-01',
      startTime: '17:00',
      endTime: '18:00',
      durationMinutes: 60,
      hostName: 'Aryan',
      hostAvatar: '',
      hostIsNative: false,
      maxAttendees: 8,
      attendeesCount: 1,
      isUserAttending: true,
      isUserHost: true,
      roomId: 'de-room-1',
      topics: ['Travel', 'Daily Life']
    });

    assert.equal(draft.summary, '🇩🇪 German Coffee Chat');
    assert.equal(draft.date, '2026-06-01');
    assert.equal(draft.startTime, '17:00');
    assert.equal(draft.durationMinutes, 60);
    assert.ok(draft.description?.includes('Travel, Daily Life'));
  });

  it('computes wide month time bounds in ISO format', () => {
    const { timeMin, timeMax } = getMonthTimeBoundsIso(2026, 4); // May 2026
    assert.ok(timeMin < '2026-05-01T00:00:00.000Z');
    assert.ok(timeMax > '2026-05-31T23:59:59.000Z');
  });

  it('classifies 401, 403 API disabled, 403 insufficient scopes, 404, and 429 errors', () => {
    const expired = classifyGoogleCalendarApiError(401, 'Invalid Credentials');
    assert.equal(expired.kind, 'token_expired');
    assert.equal(expired.requiresReauth, true);

    const apiDisabled = classifyGoogleCalendarApiError(
      403,
      'Google Calendar API has not been used in project ancient-cosmos-p01dl before or it is disabled.'
    );
    assert.equal(apiDisabled.kind, 'api_not_enabled');
    assert.ok(apiDisabled.actionUrl?.includes('calendar-json.googleapis.com'));

    const scopesErr = classifyGoogleCalendarApiError(
      403,
      'Request had insufficient authentication scopes.'
    );
    assert.equal(scopesErr.kind, 'insufficient_scopes');
    assert.equal(scopesErr.requiresReauth, true);

    assert.equal(classifyGoogleCalendarApiError(404, 'Not Found').kind, 'not_found');
    assert.equal(classifyGoogleCalendarApiError(429, 'Rate Limit Exceeded').kind, 'rate_limited');
  });
});
