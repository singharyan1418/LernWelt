import { GOOGLE_CHAT_PROJECT_ID, GOOGLE_CHAT_SCOPES } from './googleChatLogic';
import { GOOGLE_TASKS_SCOPES } from './googleTasksLogic';
import { GOOGLE_CALENDAR_SCOPES } from './googleCalendarLogic';

/**
 * Full set of Gmail OAuth scopes configured for LernWelt.
 */
export const GMAIL_SCOPES: readonly string[] = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing'
] as const;

/**
 * Combined Google Workspace OAuth scopes (Google Chat + Gmail + Google Tasks + Google Calendar).
 */
export const COMBINED_WORKSPACE_SCOPES: readonly string[] = Array.from(
  new Set([
    ...GOOGLE_CHAT_SCOPES,
    ...GMAIL_SCOPES,
    ...GOOGLE_TASKS_SCOPES,
    ...GOOGLE_CALENDAR_SCOPES
  ])
);

export const GMAIL_CONSOLE_API_URL = `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${GOOGLE_CHAT_PROJECT_ID}`;

export type OtpPurpose = 'signin' | 'create-profile' | 'profile-update' | 'resend';

export interface OtpEmailBuildParams {
  recipientEmail: string;
  recipientName: string;
  otpCode: string;
  purpose: OtpPurpose;
  senderEmail?: string;
}

export interface BuiltOtpEmailPayload {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  rawBase64Url: string;
}

export interface GmailHeaderMap {
  subject: string;
  from: string;
  to: string;
  date: string;
  messageId: string;
  references: string;
}

export interface GmailMessageItem {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  formattedDate: string;
  internalDateMs: number;
  messageIdHeader: string;
  referencesHeader: string;
  isUnread: boolean;
  isStarred: boolean;
  isTrash: boolean;
  plainBody: string;
  htmlBody: string;
  extractedOtpCode: string | null;
}

export interface GmailLabelItem {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
}

export type GmailErrorKind =
  | 'unauthorized'
  | 'api_not_enabled'
  | 'insufficient_permissions'
  | 'invalid_argument'
  | 'api_error';

export interface ClassifiedGmailError {
  kind: GmailErrorKind;
  status: number;
  title: string;
  message: string;
  rawErrorMessage: string;
  consoleUrl?: string;
  needsReauth: boolean;
}

const STANDARD_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GMAIL_DOMAIN_REGEX = /^[^\s@]+@(gmail\.com|googlemail\.com)$/i;

export function normalizeGmailInput(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export function isGmailAddress(raw: string): boolean {
  return GMAIL_DOMAIN_REGEX.test(normalizeGmailInput(raw));
}

export function validateEmailForGmailOtp(
  rawEmail: string,
  options?: { requireGmailDomain?: boolean }
): { valid: boolean; normalizedEmail: string; isGmail: boolean; error?: string } {
  const normalizedEmail = normalizeGmailInput(rawEmail);
  if (!normalizedEmail || !STANDARD_EMAIL_REGEX.test(normalizedEmail)) {
    return {
      valid: false,
      normalizedEmail,
      isGmail: false,
      error: 'Please enter a valid Gmail address (for example, yourname@gmail.com).'
    };
  }

  const gmailMatch = isGmailAddress(normalizedEmail);
  if (options?.requireGmailDomain && !gmailMatch) {
    return {
      valid: false,
      normalizedEmail,
      isGmail: false,
      error: 'Please enter a Gmail address ending in @gmail.com.'
    };
  }

  return {
    valid: true,
    normalizedEmail,
    isGmail: gmailMatch
  };
}

/**
 * UTF-8 safe RFC 4648 base64url encoder compatible with both Node.js and browsers.
 */
export function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * UTF-8 safe RFC 4648 base64url decoder compatible with both Node.js and browsers.
 */
export function decodeBase64Url(encoded: string): string {
  if (!encoded) return '';
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function sanitizeHeaderLine(value: string): string {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Encodes non-ASCII header text using RFC 2047 UTF-8 Base64 so international names/subjects render cleanly in Gmail.
 */
export function encodeMimeHeaderUtf8(value: string): string {
  const clean = sanitizeHeaderLine(value);
  if (!clean) return '';
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean;
  }
  const bytes = new TextEncoder().encode(clean);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

export function escapeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds an RFC 2822 message and returns its base64url representation for Gmail API messages.send / drafts.create.
 */
export function buildRfc2822RawEmail(params: {
  to: string;
  from?: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const cleanTo = sanitizeHeaderLine(params.to);
  const encodedSubject = encodeMimeHeaderUtf8(params.subject);
  const headers: string[] = [];

  if (params.from) {
    headers.push(`From: ${sanitizeHeaderLine(params.from)}`);
  }
  headers.push(`To: ${cleanTo}`);
  headers.push(`Subject: ${encodedSubject}`);
  headers.push('MIME-Version: 1.0');

  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${sanitizeHeaderLine(params.inReplyTo)}`);
  }
  if (params.references) {
    headers.push(`References: ${sanitizeHeaderLine(params.references)}`);
  }

  if (params.htmlBody && params.textBody) {
    const boundary = `lernwelt_mime_${Math.random().toString(36).slice(2, 12)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const multipartBody = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      params.textBody,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      params.htmlBody,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    return encodeBase64Url(`${headers.join('\r\n')}\r\n\r\n${multipartBody}`);
  }

  if (params.htmlBody) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    return encodeBase64Url(`${headers.join('\r\n')}\r\n\r\n${params.htmlBody}`);
  }

  headers.push('Content-Type: text/plain; charset="UTF-8"');
  return encodeBase64Url(`${headers.join('\r\n')}\r\n\r\n${params.textBody || ''}`);
}

export function getOtpPurposeLabel(purpose: OtpPurpose): {
  heading: string;
  actionDescription: string;
  subjectPrefix: string;
} {
  switch (purpose) {
    case 'create-profile':
      return {
        heading: 'Verify your new LernWelt profile',
        actionDescription: 'complete creating your verified language learner profile and activate your Verified Learner ID',
        subjectPrefix: 'Create Profile OTP'
      };
    case 'profile-update':
      return {
        heading: 'Verify your updated Gmail & LernWelt profile',
        actionDescription: 'confirm updating your profile Gmail address and Verified Learner ID',
        subjectPrefix: 'Profile Verification OTP'
      };
    case 'resend':
      return {
        heading: 'Your refreshed LernWelt verification code',
        actionDescription: 'complete your verification on LernWelt',
        subjectPrefix: 'Verification OTP'
      };
    case 'signin':
    default:
      return {
        heading: 'Verify your LernWelt sign-in',
        actionDescription: 'complete signing in to your LernWelt account and unlock live exchange rooms',
        subjectPrefix: 'Sign-In OTP'
      };
  }
}

export function buildOtpEmailPayload(params: OtpEmailBuildParams): BuiltOtpEmailPayload {
  const cleanRecipient = normalizeGmailInput(params.recipientEmail);
  const safeName = escapeHtmlEntities(params.recipientName.trim() || cleanRecipient.split('@')[0] || 'Learner');
  const cleanOtp = String(params.otpCode || '').trim();
  const labels = getOtpPurposeLabel(params.purpose);

  const subject = `${cleanOtp} is your LernWelt verification code (${labels.subjectPrefix})`;
  const textBody = [
    `Hi ${params.recipientName.trim() || 'Learner'},`,
    '',
    `Your 6-digit LernWelt verification code is: ${cleanOtp}`,
    '',
    `Enter this code in LernWelt to ${labels.actionDescription}.`,
    'This one-time code expires in 10 minutes.',
    '',
    'If you did not request this verification code, you can safely ignore this email.'
  ].join('\n');

  const htmlBody = `<div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#0f172a;color:#f8fafc;border-radius:18px;border:1px solid #1e293b;">
  <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#818cf8;margin-bottom:8px;">LernWelt · Verified Language Exchange</div>
  <h2 style="margin:0 0 12px;font-size:20px;color:#ffffff;">${escapeHtmlEntities(labels.heading)}</h2>
  <p style="margin:0 0 18px;color:#cbd5e1;font-size:14px;line-height:1.6;">Hi ${safeName}, enter the 6-digit OTP below to ${escapeHtmlEntities(labels.actionDescription)}:</p>
  <div style="margin:20px 0;padding:18px;background:#020617;border:1px solid #312e81;border-radius:14px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#a5b4fc;">${escapeHtmlEntities(cleanOtp)}</div>
  <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.5;">Recipient Gmail: <strong style="color:#e2e8f0;">${escapeHtmlEntities(cleanRecipient)}</strong> · Valid for 10 minutes.</p>
  <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">If you did not request this code, no changes will be made to your account.</p>
</div>`;

  const rawBase64Url = buildRfc2822RawEmail({
    to: cleanRecipient,
    from: params.senderEmail ? `LernWelt Security <${sanitizeHeaderLine(params.senderEmail)}>` : undefined,
    subject,
    textBody,
    htmlBody
  });

  return {
    to: cleanRecipient,
    subject,
    textBody,
    htmlBody,
    rawBase64Url
  };
}

export function stripHtmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMimeParts(payload: any): { plain: string; html: string } {
  if (!payload || typeof payload !== 'object') {
    return { plain: '', html: '' };
  }

  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType.toLowerCase() : '';
  const bodyData = typeof payload.body?.data === 'string' ? payload.body.data : '';

  if (mimeType === 'text/plain' && bodyData) {
    return { plain: decodeBase64Url(bodyData), html: '' };
  }
  if (mimeType === 'text/html' && bodyData) {
    return { plain: '', html: decodeBase64Url(bodyData) };
  }

  let plain = '';
  let html = '';
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const sub = extractMimeParts(part);
      if (sub.plain && !plain) plain = sub.plain;
      if (sub.html && !html) html = sub.html;
    }
  }

  if (!plain && !html && bodyData) {
    plain = decodeBase64Url(bodyData);
  }

  return { plain, html };
}

export function extractSixDigitOtpFromMessage(subject: string, snippetOrBody: string): string | null {
  const combined = `${subject} ${snippetOrBody}`;
  if (!/lernwelt|verification|otp/i.test(combined)) {
    return null;
  }
  const match = combined.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

export function formatGmailDate(rawDateHeader: string, internalDateMs: number): string {
  const d = internalDateMs > 0 ? new Date(internalDateMs) : new Date(rawDateHeader);
  if (Number.isNaN(d.getTime())) {
    return rawDateHeader || '';
  }
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function parseGmailMessageFull(rawMsg: any): GmailMessageItem {
  const headersList: any[] = Array.isArray(rawMsg?.payload?.headers) ? rawMsg.payload.headers : [];
  const getHeader = (name: string): string => {
    const found = headersList.find(
      (h) => h && typeof h.name === 'string' && h.name.toLowerCase() === name.toLowerCase()
    );
    return typeof found?.value === 'string' ? found.value : '';
  };

  const labelIds: string[] = Array.isArray(rawMsg?.labelIds)
    ? rawMsg.labelIds.filter((l: unknown): l is string => typeof l === 'string')
    : [];

  const subject = getHeader('Subject') || '(No subject)';
  const from = getHeader('From') || 'Unknown sender';
  const to = getHeader('To') || '';
  const dateHeader = getHeader('Date');
  const messageIdHeader = getHeader('Message-ID');
  const referencesHeader = getHeader('References');
  const internalDateMs = Number(rawMsg?.internalDate) || 0;
  const snippet = typeof rawMsg?.snippet === 'string' ? rawMsg.snippet : '';

  const { plain, html } = extractMimeParts(rawMsg?.payload);
  const plainBody = plain || (html ? stripHtmlToPlainText(html) : snippet);

  return {
    id: String(rawMsg?.id || ''),
    threadId: String(rawMsg?.threadId || ''),
    labelIds,
    snippet,
    subject,
    from,
    to,
    date: dateHeader,
    formattedDate: formatGmailDate(dateHeader, internalDateMs),
    internalDateMs,
    messageIdHeader,
    referencesHeader,
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    isTrash: labelIds.includes('TRASH'),
    plainBody,
    htmlBody: html,
    extractedOtpCode: extractSixDigitOtpFromMessage(subject, plainBody || snippet)
  };
}

export function classifyGmailApiError(
  status: number,
  rawBody: string,
  projectId: string = GOOGLE_CHAT_PROJECT_ID
): ClassifiedGmailError {
  let rawMsg = `Gmail API returned HTTP ${status}.`;
  if (rawBody && rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody);
      if (typeof parsed?.error?.message === 'string') {
        rawMsg = parsed.error.message;
      } else if (typeof parsed?.message === 'string') {
        rawMsg = parsed.message;
      } else {
        rawMsg = rawBody.trim().slice(0, 300);
      }
    } catch {
      rawMsg = rawBody.trim().slice(0, 300);
    }
  }

  const lower = rawMsg.toLowerCase();
  const consoleUrl = `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${projectId}`;

  if (status === 401) {
    return {
      kind: 'unauthorized',
      status,
      title: 'Gmail Session Expired',
      message: 'Your Google OAuth access token expired. Sign in with Google again to continue using Gmail.',
      rawErrorMessage: rawMsg,
      needsReauth: true
    };
  }

  if (
    status === 403 &&
    (lower.includes('has not been used in project') ||
      lower.includes('gmail api has not been used') ||
      lower.includes('is disabled'))
  ) {
    return {
      kind: 'api_not_enabled',
      status,
      title: 'Enable Gmail API in Google Cloud Console',
      message:
        'The Gmail API is not yet enabled on your Google Cloud project. Enable Gmail API in Cloud Console and retry.',
      rawErrorMessage: rawMsg,
      consoleUrl,
      needsReauth: false
    };
  }

  if (
    status === 403 &&
    (lower.includes('insufficient authentication scopes') || lower.includes('insufficient permission'))
  ) {
    return {
      kind: 'insufficient_permissions',
      status,
      title: 'Additional Gmail Permission Needed',
      message:
        'Please sign in with Google again and approve the requested Gmail permissions so LernWelt can send and read emails.',
      rawErrorMessage: rawMsg,
      needsReauth: true
    };
  }

  if (status === 400) {
    return {
      kind: 'invalid_argument',
      status,
      title: 'Invalid Email Details',
      message: rawMsg,
      rawErrorMessage: rawMsg,
      needsReauth: false
    };
  }

  return {
    kind: 'api_error',
    status,
    title: `Gmail API Error (${status})`,
    message: rawMsg,
    rawErrorMessage: rawMsg,
    consoleUrl: status === 403 ? consoleUrl : undefined,
    needsReauth: false
  };
}

export function validateComposeEmailDraft(params: {
  to: string;
  subject: string;
  body: string;
}): { valid: boolean; normalizedTo: string; error?: string } {
  const normalizedTo = normalizeGmailInput(params.to);
  if (!normalizedTo || !STANDARD_EMAIL_REGEX.test(normalizedTo)) {
    return {
      valid: false,
      normalizedTo,
      error: 'Please enter a valid recipient email address (e.g., partner@gmail.com).'
    };
  }
  if (!params.subject || !params.subject.trim()) {
    return {
      valid: false,
      normalizedTo,
      error: 'Please enter an email subject.'
    };
  }
  if (!params.body || !params.body.trim()) {
    return {
      valid: false,
      normalizedTo,
      error: 'Please write an email message before continuing.'
    };
  }
  if (params.body.length > 50_000) {
    return {
      valid: false,
      normalizedTo,
      error: 'Email message is too long (maximum 50,000 characters).'
    };
  }
  return {
    valid: true,
    normalizedTo
  };
}

export function buildGmailRoomInviteDraft(
  roomTitle: string,
  roomId: string,
  languageName: string,
  origin: string
): { subject: string; body: string } {
  const cleanOrigin = origin.replace(/\/$/, '');
  const url = `${cleanOrigin}/?room=${encodeURIComponent(roomId)}&tab=chat-room`;
  return {
    subject: `Join my live ${languageName} practice session on LernWelt: ${roomTitle}`,
    body: [
      'Hi there,',
      '',
      `I am practicing ${languageName} live on LernWelt in "${roomTitle}".`,
      'Click the room link below to join me for live video, audio, screen share, and AI-assisted conversation:',
      url,
      '',
      'See you inside!'
    ].join('\n')
  };
}
