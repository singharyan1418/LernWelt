import type { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ClassifiedGmailError,
  GmailLabelItem,
  GmailMessageItem,
  buildRfc2822RawEmail,
  classifyGmailApiError,
  parseGmailMessageFull
} from './gmailLogic';
import {
  getWorkspaceAccessToken,
  getWorkspaceCurrentUser,
  invalidateWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeWorkspaceAuth
} from './googleWorkspaceAuth';

export class GmailApiException extends Error {
  public readonly details: ClassifiedGmailError;

  constructor(details: ClassifiedGmailError) {
    super(details.message);
    this.name = 'GmailApiException';
    this.details = details;
  }
}

export interface GmailUserProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId?: string;
}

export const initGmailAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthRequired?: (user: User | null) => void
) => {
  return subscribeWorkspaceAuth(onAuthSuccess, onAuthRequired);
};

export const signInToGmail = async (): Promise<{ user: User; accessToken: string }> => {
  return signInWithGoogleWorkspace();
};

export const getGmailAccessToken = (): string | null => {
  return getWorkspaceAccessToken();
};

export const getGmailCurrentUser = (): User | null => {
  return getWorkspaceCurrentUser();
};

export const signOutFromGmail = async (): Promise<void> => {
  await signOutGoogleWorkspace();
};

async function gmailFetch<T = any>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const cleanPath = path.replace(/^\//, '');
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${cleanPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  const rawText = await response.text();
  if (!response.ok) {
    const classified = classifyGmailApiError(
      response.status,
      rawText,
      firebaseConfig.projectId
    );
    if (classified.needsReauth) {
      invalidateWorkspaceAccessToken();
    }
    throw new GmailApiException(classified);
  }

  if (!rawText.trim()) {
    return {} as T;
  }

  return JSON.parse(rawText) as T;
}

export async function getGmailProfile(accessToken: string): Promise<GmailUserProfile> {
  const data = await gmailFetch<any>('profile', accessToken);
  return {
    emailAddress: String(data?.emailAddress || ''),
    messagesTotal: Number(data?.messagesTotal) || 0,
    threadsTotal: Number(data?.threadsTotal) || 0,
    historyId: typeof data?.historyId === 'string' ? data.historyId : undefined
  };
}

export async function listGmailLabels(accessToken: string): Promise<GmailLabelItem[]> {
  const data = await gmailFetch<{ labels?: any[] }>('labels', accessToken);
  const raw = Array.isArray(data?.labels) ? data.labels : [];
  return raw
    .filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string')
    .map((l) => ({
      id: String(l.id),
      name: String(l.name),
      type: l.type === 'user' ? 'user' : 'system',
      messagesTotal: typeof l.messagesTotal === 'number' ? l.messagesTotal : undefined,
      messagesUnread: typeof l.messagesUnread === 'number' ? l.messagesUnread : undefined
    }));
}

export async function listGmailMessages(
  accessToken: string,
  options?: {
    labelId?: string;
    query?: string;
    maxResults?: number;
  }
): Promise<GmailMessageItem[]> {
  const params = new URLSearchParams();
  params.set('maxResults', String(options?.maxResults || 15));
  if (options?.labelId && options.labelId !== 'ALL') {
    params.append('labelIds', options.labelId);
  }
  if (options?.query && options.query.trim()) {
    params.set('q', options.query.trim());
  }

  const listData = await gmailFetch<{ messages?: Array<{ id: string; threadId: string }> }>(
    `messages?${params.toString()}`,
    accessToken
  );

  const stubs = Array.isArray(listData?.messages) ? listData.messages.slice(0, options?.maxResults || 15) : [];
  if (stubs.length === 0) {
    return [];
  }

  const detailed = await Promise.all(
    stubs.map(async (stub) => {
      try {
        const raw = await gmailFetch<any>(`messages/${encodeURIComponent(stub.id)}?format=full`, accessToken);
        return parseGmailMessageFull(raw);
      } catch {
        return null;
      }
    })
  );

  return detailed.filter((item): item is GmailMessageItem => item !== null);
}

export async function getGmailMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageItem> {
  const raw = await gmailFetch<any>(`messages/${encodeURIComponent(messageId)}?format=full`, accessToken);
  return parseGmailMessageFull(raw);
}

export async function sendGmailMessage(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    textBody: string;
    htmlBody?: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }
): Promise<{ id: string; threadId: string }> {
  const raw = buildRfc2822RawEmail({
    to: params.to,
    subject: params.subject,
    textBody: params.textBody,
    htmlBody: params.htmlBody,
    inReplyTo: params.inReplyTo,
    references: params.references
  });

  const bodyPayload: Record<string, string> = { raw };
  if (params.threadId) {
    bodyPayload.threadId = params.threadId;
  }

  const sent = await gmailFetch<{ id?: string; threadId?: string }>('messages/send', accessToken, {
    method: 'POST',
    body: JSON.stringify(bodyPayload)
  });

  return {
    id: String(sent?.id || ''),
    threadId: String(sent?.threadId || '')
  };
}

export async function createGmailDraft(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    textBody: string;
    threadId?: string;
  }
): Promise<{ draftId: string; messageId: string }> {
  const raw = buildRfc2822RawEmail({
    to: params.to,
    subject: params.subject,
    textBody: params.textBody
  });

  const messageObj: Record<string, string> = { raw };
  if (params.threadId) {
    messageObj.threadId = params.threadId;
  }

  const created = await gmailFetch<{ id?: string; message?: { id?: string } }>('drafts', accessToken, {
    method: 'POST',
    body: JSON.stringify({ message: messageObj })
  });

  return {
    draftId: String(created?.id || ''),
    messageId: String(created?.message?.id || '')
  };
}

export async function modifyGmailMessageLabels(
  accessToken: string,
  messageId: string,
  changes: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
): Promise<GmailMessageItem> {
  const updated = await gmailFetch<any>(
    `messages/${encodeURIComponent(messageId)}/modify`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds: changes.addLabelIds || [],
        removeLabelIds: changes.removeLabelIds || []
      })
    }
  );
  return parseGmailMessageFull(updated);
}

export async function trashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  await gmailFetch(`messages/${encodeURIComponent(messageId)}/trash`, accessToken, {
    method: 'POST'
  });
}

export async function untrashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  await gmailFetch(`messages/${encodeURIComponent(messageId)}/untrash`, accessToken, {
    method: 'POST'
  });
}

/**
 * Read-only helper to look up the newest LernWelt verification code email in the user's Gmail mailbox.
 */
export async function findLatestLernWeltOtpEmail(
  accessToken: string,
  recipientEmail?: string
): Promise<GmailMessageItem | null> {
  const queryParts = ['"LernWelt verification code"'];
  if (recipientEmail && recipientEmail.trim()) {
    queryParts.push(`to:${recipientEmail.trim()}`);
  }
  const items = await listGmailMessages(accessToken, {
    query: queryParts.join(' '),
    maxResults: 5
  });
  return items.find((m) => Boolean(m.extractedOtpCode)) || items[0] || null;
}
