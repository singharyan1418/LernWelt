import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_CHAT_CONSOLE_CONFIG_URL,
  GOOGLE_CHAT_PROJECT_ID,
  GOOGLE_CHAT_SCOPES,
  buildRoomShareDraft,
  classifyGoogleChatApiError,
  normalizeGoogleChatMessages,
  normalizeGoogleChatSpaces,
  validateGoogleChatMessageDraft,
  validateNewSpaceInput
} from './googleChatLogic';

test('GOOGLE_CHAT_SCOPES contains all configured user and admin Google Chat OAuth scopes', () => {
  assert.equal(GOOGLE_CHAT_SCOPES.length, 25);
  assert.ok(GOOGLE_CHAT_SCOPES.includes('https://www.googleapis.com/auth/chat.spaces'));
  assert.ok(GOOGLE_CHAT_SCOPES.includes('https://www.googleapis.com/auth/chat.messages'));
  assert.ok(GOOGLE_CHAT_SCOPES.includes('https://www.googleapis.com/auth/chat.memberships'));
  assert.equal(
    GOOGLE_CHAT_CONSOLE_CONFIG_URL,
    `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${GOOGLE_CHAT_PROJECT_ID}`
  );
});

test('classifyGoogleChatApiError surfaces Chat App 404 configuration prerequisite with Cloud Console URL', () => {
  const raw404 = JSON.stringify({
    error: {
      code: 404,
      message:
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.'
    }
  });
  const classified = classifyGoogleChatApiError(404, raw404);
  assert.equal(classified.kind, 'chat_app_not_configured');
  assert.equal(classified.needsReauth, false);
  assert.equal(classified.consoleUrl, GOOGLE_CHAT_CONSOLE_CONFIG_URL);
  assert.ok(classified.message.includes('Google Chat app not found'));
});

test('classifyGoogleChatApiError detects consumer Gmail / Google Workspace account requirement and 401 expiry', () => {
  const raw403 = JSON.stringify({
    error: {
      code: 403,
      message: 'Google Chat is not available for consumer accounts. Use a Google Workspace account.'
    }
  });
  const wsErr = classifyGoogleChatApiError(403, raw403);
  assert.equal(wsErr.kind, 'workspace_account_required');
  assert.equal(wsErr.needsReauth, false);

  const authErr = classifyGoogleChatApiError(401, '{"error":{"message":"Invalid Credentials"}}');
  assert.equal(authErr.kind, 'unauthorized');
  assert.equal(authErr.needsReauth, true);
});

test('normalizeGoogleChatSpaces maps spaces, group chats, and DMs cleanly', () => {
  const spaces = normalizeGoogleChatSpaces([
    {
      name: 'spaces/AAAA123',
      displayName: 'German B2 Study Group',
      spaceType: 'SPACE',
      membershipCount: { joinedDirectHumanUserCount: 8 }
    },
    {
      name: 'spaces/BBBB456',
      spaceType: 'DIRECT_MESSAGE'
    }
  ]);

  assert.equal(spaces.length, 2);
  assert.equal(spaces[0].displayName, 'German B2 Study Group');
  assert.equal(spaces[0].typeLabel, 'Space');
  assert.equal(spaces[0].memberCountLabel, '8 members');
  assert.equal(spaces[1].displayName, 'Direct Message (BBBB456)');
  assert.equal(spaces[1].typeLabel, 'Direct Message');
});

test('normalizeGoogleChatMessages sorts chronologically and aggregates reaction counts', () => {
  const messages = normalizeGoogleChatMessages([
    {
      name: 'spaces/AAAA123/messages/m2',
      text: 'Second message',
      createTime: '2026-11-02T17:10:00Z',
      sender: { name: 'users/222', displayName: 'Mateo', type: 'HUMAN' },
      emojiReactionSummaries: [{ reactionCount: 2 }, { reactionCount: 1 }]
    },
    {
      name: 'spaces/AAAA123/messages/m1',
      text: 'First message',
      createTime: '2026-11-02T17:05:00Z',
      sender: { name: 'users/111', type: 'HUMAN' }
    }
  ]);

  assert.equal(messages.length, 2);
  assert.equal(messages[0].text, 'First message');
  assert.equal(messages[0].senderName, 'User 111');
  assert.equal(messages[1].text, 'Second message');
  assert.equal(messages[1].senderName, 'Mateo');
  assert.equal(messages[1].reactionCount, 3);
});

test('validateGoogleChatMessageDraft, validateNewSpaceInput, and buildRoomShareDraft enforce rules', () => {
  assert.equal(validateGoogleChatMessageDraft('   ').valid, false);
  assert.equal(validateGoogleChatMessageDraft('Guten Abend zusammen!').valid, true);
  assert.equal(validateNewSpaceInput('A').valid, false);
  assert.equal(validateNewSpaceInput('Spanish Tandem Space').valid, true);

  const shareText = buildRoomShareDraft('Global English Lounge', 'room-en', 'http://localhost:3000/');
  assert.ok(shareText.includes('Global English Lounge'));
  assert.ok(shareText.includes('http://localhost:3000/?room=room-en&tab=chat-room'));
});
