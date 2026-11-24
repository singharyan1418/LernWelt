export const GOOGLE_CHAT_PROJECT_ID = 'affable-brand-kbcxw';

export const GOOGLE_CHAT_CONSOLE_CONFIG_URL = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${GOOGLE_CHAT_PROJECT_ID}`;

/**
 * User-delegated and organization Google Chat OAuth scopes configured on the OAuth brand.
 */
export const GOOGLE_CHAT_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/chat.admin.delete',
  'https://www.googleapis.com/auth/chat.admin.memberships',
  'https://www.googleapis.com/auth/chat.admin.memberships.readonly',
  'https://www.googleapis.com/auth/chat.admin.spaces',
  'https://www.googleapis.com/auth/chat.admin.spaces.readonly',
  'https://www.googleapis.com/auth/chat.customemojis',
  'https://www.googleapis.com/auth/chat.customemojis.readonly',
  'https://www.googleapis.com/auth/chat.delete',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.app',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.reactions',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
  'https://www.googleapis.com/auth/chat.messages.reactions.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.users.readstate',
  'https://www.googleapis.com/auth/chat.users.readstate.readonly',
  'https://www.googleapis.com/auth/chat.users.sections',
  'https://www.googleapis.com/auth/chat.users.sections.readonly',
  'https://www.googleapis.com/auth/chat.users.spacesettings'
] as const;

export type GoogleChatSpaceType = 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' | 'SPACE_TYPE_UNSPECIFIED';

export interface GoogleChatSpaceItem {
  name: string;
  displayName: string;
  spaceType: GoogleChatSpaceType;
  typeLabel: string;
  memberCountLabel?: string;
  lastActiveTime?: string;
}

export interface GoogleChatMessageItem {
  name: string;
  text: string;
  senderName: string;
  senderResourceName: string;
  senderType: 'HUMAN' | 'BOT' | 'TYPE_UNSPECIFIED';
  createTime: string;
  formattedTime: string;
  reactionCount: number;
}

export type GoogleChatErrorKind =
  | 'chat_app_not_configured'
  | 'workspace_account_required'
  | 'unauthorized'
  | 'api_error';

export interface ClassifiedGoogleChatError {
  kind: GoogleChatErrorKind;
  status: number;
  title: string;
  message: string;
  rawErrorMessage: string;
  consoleUrl?: string;
  needsReauth: boolean;
}

export function extractApiErrorMessage(rawBody: string, fallbackStatus: number): string {
  if (!rawBody || !rawBody.trim()) {
    return `Google Chat API returned HTTP ${fallbackStatus}.`;
  }
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed?.error?.message && typeof parsed.error.message === 'string') {
      return parsed.error.message;
    }
    if (typeof parsed?.message === 'string') {
      return parsed.message;
    }
  } catch {
    // Non-JSON response body
  }
  return rawBody.trim().slice(0, 300);
}

/**
 * Classifies Google Chat REST API errors, explicitly surfacing the mandatory
 * Google Cloud Console Chat App configuration step (HTTP 404) and Google Workspace
 * Business/Enterprise account requirement (consumer @gmail.com unsupported).
 */
export function classifyGoogleChatApiError(
  status: number,
  rawBody: string,
  projectId: string = GOOGLE_CHAT_PROJECT_ID
): ClassifiedGoogleChatError {
  const rawMsg = extractApiErrorMessage(rawBody, status);
  const lower = rawMsg.toLowerCase();
  const consoleUrl = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${projectId}`;

  if (status === 401) {
    return {
      kind: 'unauthorized',
      status,
      title: 'Google Session Expired',
      message: 'Your Google Chat access token has expired. Please sign in with Google again to continue.',
      rawErrorMessage: rawMsg,
      needsReauth: true
    };
  }

  if (
    status === 404 &&
    (lower.includes('google chat app not found') ||
      lower.includes('configure the app') ||
      lower.includes('chat api'))
  ) {
    return {
      kind: 'chat_app_not_configured',
      status,
      title: 'Google Chat App Configuration Required',
      message:
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure Application info (App name, Avatar URL, and Description) on the Google Chat API > Configuration page in the Google Cloud Console.',
      rawErrorMessage: rawMsg,
      consoleUrl,
      needsReauth: false
    };
  }

  if (
    (status === 403 || status === 400) &&
    (lower.includes('google workspace') ||
      lower.includes('not available for consumer') ||
      lower.includes('hangouts chat is not enabled') ||
      lower.includes('chat is not enabled') ||
      lower.includes('domain') ||
      lower.includes('workspace user'))
  ) {
    return {
      kind: 'workspace_account_required',
      status,
      title: 'Google Workspace Account Required',
      message:
        'Calling the Google Chat API requires a Business or Enterprise Google Workspace account with Google Chat enabled. Consumer @gmail.com accounts are not supported by the Google Chat API.',
      rawErrorMessage: rawMsg,
      consoleUrl,
      needsReauth: false
    };
  }

  return {
    kind: 'api_error',
    status,
    title: `Google Chat API Error (${status})`,
    message: rawMsg,
    rawErrorMessage: rawMsg,
    consoleUrl: status === 404 || status === 403 ? consoleUrl : undefined,
    needsReauth: false
  };
}

export function normalizeGoogleChatSpaces(rawSpaces: unknown): GoogleChatSpaceItem[] {
  if (!Array.isArray(rawSpaces)) return [];

  return rawSpaces
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object' && typeof (item as any).name === 'string'))
    .map((space) => {
      const spaceType: GoogleChatSpaceType =
        space.spaceType === 'SPACE' ||
        space.spaceType === 'GROUP_CHAT' ||
        space.spaceType === 'DIRECT_MESSAGE'
          ? space.spaceType
          : space.type === 'ROOM'
            ? 'SPACE'
            : space.type === 'DM'
              ? 'DIRECT_MESSAGE'
              : 'SPACE_TYPE_UNSPECIFIED';

      const typeLabel =
        spaceType === 'DIRECT_MESSAGE'
          ? 'Direct Message'
          : spaceType === 'GROUP_CHAT'
            ? 'Group Chat'
            : 'Space';

      const fallbackId = String(space.name).replace(/^spaces\//, '');
      const rawDisplayName = typeof space.displayName === 'string' ? space.displayName.trim() : '';
      const displayName =
        rawDisplayName ||
        (spaceType === 'DIRECT_MESSAGE'
          ? `Direct Message (${fallbackId})`
          : spaceType === 'GROUP_CHAT'
            ? `Group Conversation (${fallbackId})`
            : `Space ${fallbackId}`);

      const countNum = space.membershipCount?.joinedDirectHumanUserCount;
      const memberCountLabel =
        typeof countNum === 'number' && countNum > 0
          ? `${countNum} ${countNum === 1 ? 'member' : 'members'}`
          : undefined;

      return {
        name: String(space.name),
        displayName,
        spaceType,
        typeLabel,
        memberCountLabel,
        lastActiveTime: typeof space.lastActiveTime === 'string' ? space.lastActiveTime : undefined
      };
    });
}

export function formatChatTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function normalizeGoogleChatMessages(rawMessages: unknown): GoogleChatMessageItem[] {
  if (!Array.isArray(rawMessages)) return [];

  const items = rawMessages
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object' && typeof (item as any).name === 'string'))
    .map((msg) => {
      const senderObj = msg.sender && typeof msg.sender === 'object' ? msg.sender : {};
      const senderResourceName = typeof senderObj.name === 'string' ? senderObj.name : '';
      const rawSenderDisplay = typeof senderObj.displayName === 'string' ? senderObj.displayName.trim() : '';
      const senderFallback = senderResourceName
        ? senderResourceName.replace(/^users\//, 'User ').slice(0, 18)
        : 'Member';
      const senderType: 'HUMAN' | 'BOT' | 'TYPE_UNSPECIFIED' =
        senderObj.type === 'HUMAN' || senderObj.type === 'BOT' ? senderObj.type : 'TYPE_UNSPECIFIED';

      const text =
        typeof msg.text === 'string' && msg.text.trim()
          ? msg.text.trim()
          : typeof msg.formattedText === 'string' && msg.formattedText.trim()
            ? msg.formattedText.trim()
            : '(Attachment or card message)';

      const createTime = typeof msg.createTime === 'string' ? msg.createTime : '';
      const emojiSummaries = Array.isArray(msg.emojiReactionSummaries) ? msg.emojiReactionSummaries : [];
      const reactionCount = emojiSummaries.reduce(
        (acc: number, item: any) => acc + (typeof item?.reactionCount === 'number' ? item.reactionCount : 0),
        0
      );

      return {
        name: String(msg.name),
        text,
        senderName: rawSenderDisplay || senderFallback,
        senderResourceName,
        senderType,
        createTime,
        formattedTime: formatChatTimestamp(createTime),
        reactionCount
      };
    });

  return items.sort((a, b) => {
    const tA = a.createTime ? Date.parse(a.createTime) : 0;
    const tB = b.createTime ? Date.parse(b.createTime) : 0;
    return tA - tB;
  });
}

export function validateGoogleChatMessageDraft(text: string): { valid: boolean; error?: string } {
  const clean = text.trim();
  if (!clean) {
    return { valid: false, error: 'Please write a message before sending.' };
  }
  if (clean.length > 4096) {
    return { valid: false, error: 'Google Chat messages must be 4,096 characters or fewer.' };
  }
  return { valid: true };
}

export function validateNewSpaceInput(displayName: string): { valid: boolean; error?: string } {
  const clean = displayName.trim();
  if (clean.length < 2) {
    return { valid: false, error: 'Please enter a space name with at least 2 characters.' };
  }
  if (clean.length > 128) {
    return { valid: false, error: 'Space name must be 128 characters or fewer.' };
  }
  return { valid: true };
}

export function buildRoomShareDraft(roomTitle: string, roomId: string, origin: string): string {
  const cleanOrigin = origin.replace(/\/$/, '');
  const url = `${cleanOrigin}/?room=${encodeURIComponent(roomId)}&tab=chat-room`;
  return `Join me in "${roomTitle}" on LernWelt for live language practice: ${url}`;
}
