import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_CLASSROOM_SCOPES,
  classifyClassroomApiError,
  extractClassroomAttachments,
  filterClassroomCourses,
  formatClassroomDueDate,
  normalizeClassroomAnnouncements,
  normalizeClassroomCourseWork,
  normalizeClassroomCourses,
  normalizeClassroomMaterials,
  normalizeClassroomRoster,
  normalizeClassroomSubmissions,
  normalizeClassroomTopics,
  parseDueDateInput,
  validateAnnouncementDraft,
  validateCourseDraft,
  validateCourseWorkDraft,
  validateTopicDraft
} from './googleClassroomLogic';
import { COMBINED_WORKSPACE_SCOPES } from './gmailLogic';

test('all 24 GOOGLE_CLASSROOM_SCOPES are included in COMBINED_WORKSPACE_SCOPES alongside Chat, Gmail, and Tasks scopes', () => {
  assert.equal(GOOGLE_CLASSROOM_SCOPES.length, 24);
  for (const scope of GOOGLE_CLASSROOM_SCOPES) {
    assert.ok(
      COMBINED_WORKSPACE_SCOPES.includes(scope),
      `Missing Classroom scope in COMBINED_WORKSPACE_SCOPES: ${scope}`
    );
  }
  // Verify existing scopes were preserved
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/tasks'));
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/gmail.readonly'));
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/chat.messages'));
});

test('date formatting and due-date input parsing round-trip cleanly', () => {
  assert.equal(
    formatClassroomDueDate({ year: 2026, month: 11, day: 25 }, { hours: 14, minutes: 5 }),
    '2026-11-25 14:05'
  );
  assert.equal(formatClassroomDueDate({ year: 2026, month: 3, day: 9 }), '2026-03-09');
  assert.equal(formatClassroomDueDate(null), '');

  assert.deepEqual(parseDueDateInput('2026-11-25'), { year: 2026, month: 11, day: 25 });
  assert.equal(parseDueDateInput('2026-13-01'), undefined);
  assert.equal(parseDueDateInput('bad-date'), undefined);
});

test('normalizers sanitize courses, announcements, coursework, materials, topics, roster, and submissions', () => {
  const courses = normalizeClassroomCourses([
    {
      id: 'c1',
      name: 'German B2 Conversation',
      section: 'Evening Cohort',
      room: 'Zoom 4',
      courseState: 'ACTIVE',
      enrollmentCode: 'ger2026',
      alternateLink: 'https://classroom.google.com/c/c1'
    },
    {
      id: 'c2',
      name: 'Archived Spanish A1',
      courseState: 'ARCHIVED'
    },
    { name: 'missing-id' }
  ]);
  assert.equal(courses.length, 2);
  assert.equal(courses[0].enrollmentCode, 'ger2026');

  const activeFiltered = filterClassroomCourses(courses, 'ACTIVE', 'german');
  assert.deepEqual(
    activeFiltered.map((c) => c.id),
    ['c1']
  );

  const archivedFiltered = filterClassroomCourses(courses, 'ARCHIVED', '');
  assert.deepEqual(
    archivedFiltered.map((c) => c.id),
    ['c2']
  );

  const announcements = normalizeClassroomAnnouncements(
    [
      {
        id: 'a1',
        text: 'Welcome to week 3! Practice subjunctive sentences.',
        state: 'PUBLISHED',
        materials: [{ link: { url: 'https://example.com', title: 'Grammar Sheet' } }]
      },
      { id: 'a2', text: 'Deleted post', state: 'DELETED' }
    ],
    'c1'
  );
  assert.equal(announcements.length, 1);
  assert.equal(announcements[0].attachments.length, 1);
  assert.equal(announcements[0].attachments[0].kind, 'link');

  const coursework = normalizeClassroomCourseWork(
    [
      {
        id: 'w1',
        title: 'Write 10 Dative Sentences',
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        maxPoints: 100,
        dueDate: { year: 2026, month: 12, day: 1 },
        dueTime: { hours: 18, minutes: 0 }
      },
      { id: 'w2', title: 'Old item', state: 'DELETED' }
    ],
    'c1'
  );
  assert.equal(coursework.length, 1);
  assert.equal(coursework[0].dueDateStr, '2026-12-01 18:00');
  assert.equal(coursework[0].maxPoints, 100);

  const materials = normalizeClassroomMaterials(
    [
      {
        id: 'm1',
        title: 'Pronunciation Audio Pack',
        state: 'PUBLISHED',
        materials: [
          {
            driveFile: {
              driveFile: {
                title: 'Audio.mp3',
                alternateLink: 'https://drive.google.com/file/d/123'
              }
            }
          },
          {
            youtubeVideo: {
              title: 'German R Sound',
              alternateLink: 'https://youtube.com/watch?v=abc'
            }
          }
        ]
      }
    ],
    'c1'
  );
  assert.equal(materials.length, 1);
  assert.equal(materials[0].attachments.length, 2);
  assert.equal(materials[0].attachments[0].kind, 'drive');
  assert.equal(materials[0].attachments[1].kind, 'youtube');

  const topics = normalizeClassroomTopics([{ topicId: 't1', name: 'Grammar Units' }], 'c1');
  assert.equal(topics.length, 1);
  assert.equal(topics[0].name, 'Grammar Units');

  const roster = normalizeClassroomRoster(
    [
      {
        userId: 'u1',
        profile: {
          name: { fullName: 'Prof. Elena' },
          emailAddress: 'elena@example.com',
          photoUrl: '//lh3.googleusercontent.com/avatar.png'
        }
      }
    ],
    'c1',
    'TEACHER'
  );
  assert.equal(roster[0].photoUrl, 'https://lh3.googleusercontent.com/avatar.png');
  assert.equal(roster[0].role, 'TEACHER');

  const submissions = normalizeClassroomSubmissions(
    [{ id: 's1', userId: 'u2', state: 'TURNED_IN', assignedGrade: 95, late: false }],
    'w1'
  );
  assert.equal(submissions[0].assignedGrade, 95);
  assert.equal(submissions[0].state, 'TURNED_IN');

  assert.equal(extractClassroomAttachments(null).length, 0);
});

test('validators enforce required fields and bounds for courses, announcements, coursework, and topics', () => {
  assert.equal(validateCourseDraft({ name: '   ' }).valid, false);
  assert.equal(validateCourseDraft({ name: 'a'.repeat(151) }).valid, false);
  const validCourse = validateCourseDraft({ name: '  French B1  ', section: '  Morning ' });
  assert.equal(validCourse.valid, true);
  assert.equal(validCourse.normalized.name, 'French B1');
  assert.equal(validCourse.normalized.section, 'Morning');

  assert.equal(validateAnnouncementDraft({ text: '  ' }).valid, false);
  assert.equal(validateAnnouncementDraft({ text: 'Class starts in 10 minutes' }).valid, true);

  assert.equal(validateCourseWorkDraft({ title: '' }).valid, false);
  assert.equal(validateCourseWorkDraft({ title: 'Essay', dueDate: 'invalid' }).valid, false);
  assert.equal(validateCourseWorkDraft({ title: 'Essay', maxPoints: -5 }).valid, false);
  const validWork = validateCourseWorkDraft({
    title: '  Vocabulary Quiz  ',
    dueDate: '2026-12-05',
    maxPoints: '50'
  });
  assert.equal(validWork.valid, true);
  assert.deepEqual(validWork.normalized.dueDate, { year: 2026, month: 12, day: 5 });
  assert.equal(validWork.normalized.maxPoints, 50);

  assert.equal(validateTopicDraft({ name: '' }).valid, false);
  assert.equal(validateTopicDraft({ name: 'Week 4' }).valid, true);
});

test('classifyClassroomApiError accurately classifies 401, API disabled, insufficient scopes, 404, and 429', () => {
  assert.equal(classifyClassroomApiError(401, 'Invalid Credentials').requiresReauth, true);

  const disabled = classifyClassroomApiError(
    403,
    JSON.stringify({
      error: { message: 'Google Classroom API has not been used in project ancient-cosmos-p01dl before or it is disabled.' }
    })
  );
  assert.equal(disabled.kind, 'api_not_enabled');
  assert.ok(disabled.actionUrl?.includes('classroom.googleapis.com'));
  assert.ok(disabled.actionUrl?.includes('ancient-cosmos-p01dl'));

  const scopesErr = classifyClassroomApiError(
    403,
    'Request had insufficient authentication scopes.'
  );
  assert.equal(scopesErr.kind, 'insufficient_scopes');
  assert.equal(scopesErr.requiresReauth, true);

  assert.equal(classifyClassroomApiError(404, 'Requested entity was not found.').kind, 'not_found');
  assert.equal(classifyClassroomApiError(429, 'Rate Limit Exceeded').kind, 'rate_limited');
});
