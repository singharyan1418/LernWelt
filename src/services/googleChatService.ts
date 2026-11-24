import type { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ClassifiedGoogleChatError,
  GoogleChatMessageItem,
  GoogleChatSpaceItem,
  classifyGoogleChatApiError,
  normalizeGoogleChatMessages,
  normalizeGoogleChatSpaces
} from './googleChatLogic';
import {
  getWorkspaceAccessToken,
  invalidateWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeWorkspaceAuth
} from './googleWorkspaceAuth';

export class GoogleChatApiException extends Error {
  public readonly details: ClassifiedGoogleChatError;

  constructor(details: ClassifiedGoogleChatError) {
    super(details.message);
    this.name = 'GoogleChatApiException';
    this.details = details;
  }
}

export const initGoogleChatAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthRequired?: (user: User | null) => void
) => {
  return subscribeWorkspaceAuth(onAuthSuccess, onAuthRequired);
};

export const signInToGoogleChat = async (): Promise<{ user: User; accessToken: string }> => {
  return signInWithGoogleWorkspace();
};

export const getGoogleChatAccessToken = (): string | null => {
  return getWorkspaceAccessToken();
};

export const clearGoogleChatAccessToken = (): void => {
  invalidateWorkspaceAccessToken();
};

export const signOutFromGoogleChat = async (): Promise<void> => {
  await signOutGoogleWorkspace();
};

async function googleChatFetch<T = any>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://chat.googleapis.com/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  const rawText = await response.text();

  if (!response.ok) {
    const classified = classifyGoogleChatApiError(
      response.status,
      rawText,
      firebaseConfig.projectId
    );
    if (classified.needsReauth) {
      invalidateWorkspaceAccessToken();
    }
    throw new GoogleChatApiException(classified);
  }

  if (!rawText.trim()) {
    return {} as T;
  }

  return JSON.parse(rawText) as T;
}

export async function listGoogleChatSpaces(accessToken: string): Promise<GoogleChatSpaceItem[]> {
  const data = await googleChatFetch<{ spaces?: unknown[] }>('spaces?pageSize=30', accessToken);
  return normalizeGoogleChatSpaces(data.spaces || []);
}

export async function listGoogleChatMessages(
  accessToken: string,
  spaceName: string
): Promise<GoogleChatMessageItem[]> {
  const encodedPath = `${spaceName}/messages?pageSize=25&orderBy=${encodeURIComponent('createTime desc')}`;
  const data = await googleChatFetch<{ messages?: unknown[] }>(encodedPath, accessToken);
  return normalizeGoogleChatMessages(data.messages || []);
}

export async function createGoogleChatSpace(
  accessToken: string,
  displayName: string
): Promise<GoogleChatSpaceItem> {
  const created = await googleChatFetch<Record<string, any>>('spaces', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      spaceType: 'SPACE',
      displayName: displayName.trim()
    })
  });
  const normalized = normalizeGoogleChatSpaces([created]);
  return (
    normalized[0] || {
      name: String(created.name || ''),
      displayName: displayName.trim(),
      spaceType: 'SPACE',
      typeLabel: 'Space'
    }
  );
}

export async function sendGoogleChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<GoogleChatMessageItem> {
  const created = await googleChatFetch<Record<string, any>>(`${spaceName}/messages`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      text: text.trim()
    })
  });
  const normalized = normalizeGoogleChatMessages([created]);
  return (
    normalized[0] || {
      name: String(created.name || `msg_${Date.now()}`),
      text: text.trim(),
      senderName: 'You',
      senderResourceName: '',
      senderType: 'HUMAN',
      createTime: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactionCount: 0
    }
  );
}

export async function deleteGoogleChatMessage(
  accessToken: string,
  messageName: string
): Promise<void> {
  await googleChatFetch(messageName, accessToken, {
    method: 'DELETE'
  });
}

export async function deleteGoogleChatSpace(
  accessToken: string,
  spaceName: string
): Promise<void> {
  await googleChatFetch(spaceName, accessToken, {
    method: 'DELETE'
  });
}
