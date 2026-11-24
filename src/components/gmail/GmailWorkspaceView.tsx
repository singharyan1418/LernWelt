import React, { useCallback, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  ExternalLink,
  FileEdit,
  Inbox,
  Link2,
  LogOut,
  Mail,
  MailOpen,
  PenSquare,
  RefreshCw,
  Reply,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  X
} from 'lucide-react';
import { LanguageInfo, LanguageRoom, UserProfile, VocabularyWord } from '../../types';
import {
  ClassifiedGmailError,
  GMAIL_CONSOLE_API_URL,
  GmailLabelItem,
  GmailMessageItem,
  buildGmailRoomInviteDraft,
  validateComposeEmailDraft
} from '../../services/gmailLogic';
import {
  GmailApiException,
  GmailUserProfile,
  createGmailDraft,
  getGmailAccessToken,
  getGmailProfile,
  initGmailAuth,
  listGmailLabels,
  listGmailMessages,
  modifyGmailMessageLabels,
  sendGmailMessage,
  signInToGmail,
  signOutFromGmail,
  trashGmailMessage,
  untrashGmailMessage
} from '../../services/gmailService';
import { OfficialGoogleSignInButton } from '../common/OfficialGoogleSignInButton';
import { t } from '../../services/uiLocalization';

interface GmailWorkspaceViewProps {
  userProfile: UserProfile;
  selectedLanguage: LanguageInfo;
  currentRoom?: LanguageRoom;
  onSaveToVocabDeck?: (item: Partial<VocabularyWord>) => void;
}

type ActiveFolderId = 'INBOX' | 'STARRED' | 'SENT' | 'DRAFT' | 'TRASH';

type PendingGmailMutation =
  | {
      type: 'send_email';
      to: string;
      subject: string;
      body: string;
      threadId?: string;
      inReplyTo?: string;
      references?: string;
    }
  | {
      type: 'save_draft';
      to: string;
      subject: string;
      body: string;
      threadId?: string;
    }
  | {
      type: 'toggle_star';
      message: GmailMessageItem;
      nextStarred: boolean;
    }
  | {
      type: 'toggle_unread';
      message: GmailMessageItem;
      nextUnread: boolean;
    }
  | {
      type: 'trash_message';
      message: GmailMessageItem;
    }
  | {
      type: 'untrash_message';
      message: GmailMessageItem;
    };

export const GmailWorkspaceView: React.FC<GmailWorkspaceViewProps> = ({
  userProfile,
  selectedLanguage,
  currentRoom,
  onSaveToVocabDeck
}) => {
  const uiLang = userProfile.nativeLanguage || 'English';
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [gmailProfile, setGmailProfile] = useState<GmailUserProfile | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeFolder, setActiveFolder] = useState<ActiveFolderId>('INBOX');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appliedQuery, setAppliedQuery] = useState<string>('');
  const [labels, setLabels] = useState<GmailLabelItem[]>([]);
  const [messages, setMessages] = useState<GmailMessageItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageItem | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [apiError, setApiError] = useState<ClassifiedGmailError | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Compose / Reply Modal state
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [replyContext, setReplyContext] = useState<{
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  } | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Mandatory Confirmation Dialog state for all mutating/destructive Gmail API calls
  const [pendingMutation, setPendingMutation] = useState<PendingGmailMutation | null>(null);
  const [isExecutingMutation, setIsExecutingMutation] = useState<boolean>(false);

  const loadMailbox = useCallback(
    async (
      folder: ActiveFolderId,
      queryStr: string,
      tokenOverride?: string | null
    ) => {
      const token = tokenOverride ?? getGmailAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      setIsLoadingMessages(true);
      setApiError(null);

      try {
        // Strictly exclude LernWelt verification OTP emails from in-app display so OTPs appear ONLY on external Gmail devices
        const baseExclusion = '-subject:"LernWelt verification code"';
        const effectiveQuery = queryStr.trim()
          ? `${queryStr.trim()} ${baseExclusion}`
          : baseExclusion;

        const [profileRes, labelsRes, messageList] = await Promise.all([
          getGmailProfile(token),
          listGmailLabels(token).catch(() => [] as GmailLabelItem[]),
          listGmailMessages(token, {
            labelId: folder,
            query: effectiveQuery,
            maxResults: 15
          })
        ]);

        setGmailProfile(profileRes);
        setLabels(labelsRes);
        setMessages(messageList);
        setSelectedMessage((prev) => {
          if (!messageList.length) return null;
          if (prev) {
            const match = messageList.find((m) => m.id === prev.id);
            if (match) return match;
          }
          return messageList[0];
        });
      } catch (err: any) {
        if (err instanceof GmailApiException) {
          setApiError(err.details);
          if (err.details.needsReauth) {
            setAccessToken(null);
            setNeedsAuth(true);
          }
        } else {
          setApiError({
            kind: 'api_error',
            status: 500,
            title: 'Gmail Connection Error',
            message: err?.message || 'Unable to load Gmail messages right now.',
            rawErrorMessage: err?.message || '',
            needsReauth: false
          });
        }
      } finally {
        setIsLoadingMessages(false);
      }
    },
    []
  );

  useEffect(() => {
    const unsub = initGmailAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
        void loadMailbox('INBOX', '', token);
      },
      (user) => {
        setGoogleUser(user);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, [loadMailbox]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    setApiError(null);
    try {
      const res = await signInToGmail();
      setGoogleUser(res.user);
      setAccessToken(res.accessToken);
      setNeedsAuth(false);
      await loadMailbox(activeFolder, appliedQuery, res.accessToken);
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing Gmail authorization.');
      } else {
        setAuthError(err?.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromGmail();
    setAccessToken(null);
    setGoogleUser(null);
    setGmailProfile(null);
    setNeedsAuth(true);
    setMessages([]);
    setSelectedMessage(null);
    setPendingMutation(null);
  };

  const handleSelectFolder = (folder: ActiveFolderId) => {
    setActiveFolder(folder);
    void loadMailbox(folder, appliedQuery, accessToken);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(searchQuery);
    void loadMailbox(activeFolder, searchQuery, accessToken);
  };

  const openNewCompose = () => {
    setReplyContext(null);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeError(null);
    setIsComposeOpen(true);
  };

  const openReplyCompose = (msg: GmailMessageItem) => {
    const emailMatch = msg.from.match(/<([^>]+)>/);
    const replyRecipient = emailMatch ? emailMatch[1] : msg.from;
    const normalizedSubject = msg.subject.toLowerCase().startsWith('re:')
      ? msg.subject
      : `Re: ${msg.subject}`;

    setReplyContext({
      threadId: msg.threadId || undefined,
      inReplyTo: msg.messageIdHeader || undefined,
      references: msg.referencesHeader
        ? `${msg.referencesHeader} ${msg.messageIdHeader}`.trim()
        : msg.messageIdHeader || undefined
    });
    setComposeTo(replyRecipient);
    setComposeSubject(normalizedSubject);
    setComposeBody(`\n\n--- On ${msg.date || msg.formattedDate}, ${msg.from} wrote: ---\n${msg.plainBody.slice(0, 600)}`);
    setComposeError(null);
    setIsComposeOpen(true);
  };

  const handleInsertLiveRoomInvite = () => {
    if (!currentRoom) return;
    const draft = buildGmailRoomInviteDraft(
      currentRoom.title,
      currentRoom.id,
      selectedLanguage.name,
      window.location.origin
    );
    if (!composeSubject.trim()) {
      setComposeSubject(draft.subject);
    }
    setComposeBody(draft.body);
    setComposeError(null);
  };

  const handlePrepareSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateComposeEmailDraft({
      to: composeTo,
      subject: composeSubject,
      body: composeBody
    });
    if (!validation.valid) {
      setComposeError(validation.error || 'Please check recipient, subject, and message.');
      return;
    }
    setComposeError(null);
    setPendingMutation({
      type: 'send_email',
      to: validation.normalizedTo,
      subject: composeSubject.trim(),
      body: composeBody.trim(),
      threadId: replyContext?.threadId,
      inReplyTo: replyContext?.inReplyTo,
      references: replyContext?.references
    });
  };

  const handlePrepareSaveDraft = () => {
    const validation = validateComposeEmailDraft({
      to: composeTo,
      subject: composeSubject,
      body: composeBody
    });
    if (!validation.valid) {
      setComposeError(validation.error || 'Please fill recipient, subject, and message before saving a draft.');
      return;
    }
    setComposeError(null);
    setPendingMutation({
      type: 'save_draft',
      to: validation.normalizedTo,
      subject: composeSubject.trim(),
      body: composeBody.trim(),
      threadId: replyContext?.threadId
    });
  };

  const executeConfirmedMutation = async () => {
    if (!pendingMutation) return;
    const token = accessToken ?? getGmailAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setPendingMutation(null);
      return;
    }

    setIsExecutingMutation(true);
    setApiError(null);

    try {
      if (pendingMutation.type === 'send_email') {
        await sendGmailMessage(token, {
          to: pendingMutation.to,
          subject: pendingMutation.subject,
          textBody: pendingMutation.body,
          threadId: pendingMutation.threadId,
          inReplyTo: pendingMutation.inReplyTo,
          references: pendingMutation.references
        });
        setIsComposeOpen(false);
        setPendingMutation(null);
        setStatusBanner(`Email sent to ${pendingMutation.to} via Gmail!`);
        void loadMailbox(activeFolder, appliedQuery, token);
      } else if (pendingMutation.type === 'save_draft') {
        await createGmailDraft(token, {
          to: pendingMutation.to,
          subject: pendingMutation.subject,
          textBody: pendingMutation.body,
          threadId: pendingMutation.threadId
        });
        setIsComposeOpen(false);
        setPendingMutation(null);
        setStatusBanner(`Saved draft "${pendingMutation.subject}" in your Gmail Drafts.`);
        if (activeFolder === 'DRAFT') {
          void loadMailbox('DRAFT', appliedQuery, token);
        }
      } else if (pendingMutation.type === 'toggle_star') {
        const updated = await modifyGmailMessageLabels(token, pendingMutation.message.id, {
          addLabelIds: pendingMutation.nextStarred ? ['STARRED'] : [],
          removeLabelIds: pendingMutation.nextStarred ? [] : ['STARRED']
        });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated, plainBody: m.plainBody } : m)));
        if (selectedMessage?.id === updated.id) {
          setSelectedMessage((prev) => (prev ? { ...prev, isStarred: updated.isStarred, labelIds: updated.labelIds } : prev));
        }
        setPendingMutation(null);
      } else if (pendingMutation.type === 'toggle_unread') {
        const updated = await modifyGmailMessageLabels(token, pendingMutation.message.id, {
          addLabelIds: pendingMutation.nextUnread ? ['UNREAD'] : [],
          removeLabelIds: pendingMutation.nextUnread ? [] : ['UNREAD']
        });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated, plainBody: m.plainBody } : m)));
        if (selectedMessage?.id === updated.id) {
          setSelectedMessage((prev) => (prev ? { ...prev, isUnread: updated.isUnread, labelIds: updated.labelIds } : prev));
        }
        setPendingMutation(null);
      } else if (pendingMutation.type === 'trash_message') {
        await trashGmailMessage(token, pendingMutation.message.id);
        setMessages((prev) => prev.filter((m) => m.id !== pendingMutation.message.id));
        if (selectedMessage?.id === pendingMutation.message.id) {
          setSelectedMessage(null);
        }
        setPendingMutation(null);
        setStatusBanner(`Moved "${pendingMutation.message.subject}" to Gmail Trash.`);
      } else if (pendingMutation.type === 'untrash_message') {
        await untrashGmailMessage(token, pendingMutation.message.id);
        setMessages((prev) => prev.filter((m) => m.id !== pendingMutation.message.id));
        if (selectedMessage?.id === pendingMutation.message.id) {
          setSelectedMessage(null);
        }
        setPendingMutation(null);
        setStatusBanner(`Restored "${pendingMutation.message.subject}" from Trash.`);
      }
    } catch (err: any) {
      setPendingMutation(null);
      if (err instanceof GmailApiException) {
        setApiError(err.details);
        if (err.details.needsReauth) {
          setAccessToken(null);
          setNeedsAuth(true);
        }
      } else {
        setApiError({
          kind: 'api_error',
          status: 500,
          title: 'Gmail Action Failed',
          message: err?.message || 'Could not complete the requested Gmail operation.',
          rawErrorMessage: err?.message || '',
          needsReauth: false
        });
      }
    } finally {
      setIsExecutingMutation(false);
    }
  };

  useEffect(() => {
    if (!statusBanner) return;
    const t = setTimeout(() => setStatusBanner(null), 3500);
    return () => clearTimeout(t);
  }, [statusBanner]);

  const inboxLabelStats = labels.find((l) => l.id === 'INBOX');

  const folderItems: {
    id: ActiveFolderId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'INBOX',
      label: 'Inbox',
      icon: <Inbox className="w-4 h-4 shrink-0" />,
      badge: inboxLabelStats?.messagesUnread
    },
    {
      id: 'STARRED',
      label: 'Starred',
      icon: <Star className="w-4 h-4 shrink-0 text-amber-500 dark:text-amber-400" />
    },
    {
      id: 'SENT',
      label: 'Sent',
      icon: <Send className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    },
    {
      id: 'DRAFT',
      label: 'Drafts',
      icon: <FileEdit className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
    },
    {
      id: 'TRASH',
      label: 'Trash',
      icon: <Trash2 className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 text-slate-900 dark:text-[#F0F2F5]">
      {/* Mandatory Confirmation Modal for Mutating or Destructive Gmail API Operations */}
      {pendingMutation && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="gmail-mutation-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#161D27] border border-amber-300 dark:border-amber-500/40 rounded-xl p-6 shadow-2xl space-y-4">
            <h3 id="gmail-mutation-confirm-title" className="text-base font-bold text-slate-900 dark:text-[#F0F2F5]">
              {pendingMutation.type === 'send_email' && `Send email to ${pendingMutation.to}?`}
              {pendingMutation.type === 'save_draft' && 'Save draft to your Gmail account?'}
              {pendingMutation.type === 'toggle_star' &&
                (pendingMutation.nextStarred ? 'Star this email in Gmail?' : 'Remove star from this email?')}
              {pendingMutation.type === 'toggle_unread' &&
                (pendingMutation.nextUnread ? 'Mark this email as unread?' : 'Mark this email as read?')}
              {pendingMutation.type === 'trash_message' && 'Move this email to Gmail Trash?'}
              {pendingMutation.type === 'untrash_message' && 'Restore this email from Gmail Trash?'}
            </h3>

            <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed break-words">
              {pendingMutation.type === 'send_email' &&
                `Subject: "${pendingMutation.subject}". This will send an email from ${gmailProfile?.emailAddress || googleUser?.email || 'your Gmail account'}.`}
              {pendingMutation.type === 'save_draft' &&
                `This will create a draft to ${pendingMutation.to} with subject "${pendingMutation.subject}".`}
              {pendingMutation.type === 'toggle_star' &&
                `Updates the STARRED label on "${pendingMutation.message.subject}".`}
              {pendingMutation.type === 'toggle_unread' &&
                `Updates the UNREAD status on "${pendingMutation.message.subject}".`}
              {pendingMutation.type === 'trash_message' &&
                `"${pendingMutation.message.subject}" will be moved to your Gmail Trash folder.`}
              {pendingMutation.type === 'untrash_message' &&
                `"${pendingMutation.message.subject}" will be restored from your Gmail Trash folder.`}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isExecutingMutation}
                onClick={() => setPendingMutation(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecutingMutation}
                onClick={executeConfirmedMutation}
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer transition-colors ${
                  pendingMutation.type === 'trash_message'
                    ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500/40'
                    : 'bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)]'
                }`}
              >
                {isExecutingMutation
                  ? 'Working...'
                  : pendingMutation.type === 'send_email'
                    ? 'Confirm & Send'
                    : pendingMutation.type === 'trash_message'
                      ? 'Move to Trash'
                      : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose / Reply Modal */}
      {isComposeOpen && !needsAuth && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmail-compose-modal-title"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#10151D] border-b border-slate-200 dark:border-[#293342] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenSquare className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                <h2 id="gmail-compose-modal-title" className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                  {replyContext ? 'Reply via Gmail' : 'New Gmail Message'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                aria-label="Close compose window"
                className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200 dark:hover:bg-[#232F3F] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePrepareSendEmail} noValidate className="p-6 space-y-4">
              {composeError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-500/35 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{composeError}</span>
                </div>
              )}

              <div>
                <label htmlFor="gmail-compose-to" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1">
                  To (Gmail or Email Address)
                </label>
                <input
                  id="gmail-compose-to"
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="partner@gmail.com"
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="gmail-compose-subject" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5]">
                    Subject
                  </label>
                  {currentRoom && (
                    <button
                      type="button"
                      onClick={handleInsertLiveRoomInvite}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-[#6485F5] hover:text-indigo-700 dark:hover:text-[#9278D8] cursor-pointer"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Insert &ldquo;{currentRoom.title}&rdquo; Invite</span>
                    </button>
                  )}
                </div>
                <input
                  id="gmail-compose-subject"
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder={`Language exchange session (${selectedLanguage.name})`}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                />
              </div>

              <div>
                <label htmlFor="gmail-compose-body" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1">
                  Message
                </label>
                <textarea
                  id="gmail-compose-body"
                  rows={7}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg p-3.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePrepareSaveDraft}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold cursor-pointer transition-colors"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer transition-colors"
                  >
                    {t('common.cancel', uiLang)}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Review &amp; Send</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Workspace Header */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs dark:shadow-none">
        <div className="space-y-1 min-w-0">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-rose-50 dark:bg-rose-500/12 border border-rose-200 dark:border-rose-500/25 flex items-center justify-center">
              <Mail className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F0F2F5]">
                {t('gmail.title', uiLang)}
              </h1>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-0.5 tabular-nums">
                {needsAuth
                  ? t('gmail.connectTitle', uiLang)
                  : `${gmailProfile?.emailAddress || googleUser?.email || userProfile.email} · ${gmailProfile?.messagesTotal ?? 0}`}
              </p>
            </div>
          </div>
        </div>

        {!needsAuth && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openNewCompose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors"
            >
              <PenSquare className="w-4 h-4" />
              <span>{t('gmail.composeEmail', uiLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => void loadMailbox(activeFolder, appliedQuery, accessToken)}
              disabled={isLoadingMessages}
              aria-label={t('random.refresh', uiLang)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-indigo-600 dark:text-[#6485F5]' : ''}`} />
              <span>{t('random.refresh', uiLang)}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('gmail.disconnect', uiLang)}</span>
            </button>
          </div>
        )}
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {apiError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 space-y-2"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-200">{apiError.title}</p>
              <p className="text-xs text-rose-700 dark:text-[#F0F2F5] leading-relaxed">{apiError.message}</p>
            </div>
          </div>
          {apiError.consoleUrl && (
            <a
              href={apiError.consoleUrl || GMAIL_CONSOLE_API_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-[#6485F5] hover:text-indigo-700 dark:hover:text-[#9278D8] underline underline-offset-2"
            >
              <span>Open Gmail API in Google Cloud Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {needsAuth ? (
        /* Unauthenticated State with Official Sign in with Google Button */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xs dark:shadow-none">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-[#6485F5]/15 border border-indigo-200 dark:border-[#6485F5]/30 text-indigo-700 dark:text-[#9278D8] text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Google Workspace Gmail Integration</span>
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                {t('gmail.connectTitle', uiLang)}
              </h2>
              <p className="text-sm text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                With your permission, connecting Gmail lets you read and search partner emails, compose messages or live room invitations, manage drafts and labels, and dispatch Sign-In &amp; Create Profile OTPs exclusively to external Gmail devices (verification OTPs are never shown inside the app).
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-500/35 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="max-w-sm space-y-3">
              <OfficialGoogleSignInButton
                onClick={handleGoogleSignIn}
                isLoading={isSigningIn}
                label={t('tasks.signInGoogle', uiLang)}
                loadingLabel={t('auth.authenticating', uiLang)}
              />
              <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
                OAuth access tokens are held strictly in memory for your active browser session and cleared automatically when you sign out.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-8 space-y-4 shadow-xs dark:shadow-none">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">Included Gmail Capabilities</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-1">
                <div className="font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                  <span>External Device Gmail OTP Delivery</span>
                </div>
                <p className="text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
                  Dispatches 6-digit verification codes to the email address entered during Sign In, Create Profile, and Profile edits—delivered strictly to your signed-in Gmail devices and hidden from the app display.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-1">
                <div className="font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Partner Mailbox &amp; Search</span>
                </div>
                <p className="text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
                  Browse Inbox, Starred, Sent, Drafts, and Trash to stay coordinated with your language exchange partners and teachers.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-1">
                <div className="font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Compose, Reply &amp; Share Live Rooms</span>
                </div>
                <p className="text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
                  Send emails or save drafts with one-click live WebRTC language room invitation links—always protected by explicit confirmation before sending.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Authenticated 3-Zone Gmail Mailbox Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Zone 1: Folders / Labels Sidebar */}
          <aside
            aria-label="Gmail Folders"
            className="lg:col-span-3 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-4 space-y-4 shadow-xs dark:shadow-none"
          >
            <form onSubmit={handleSearchSubmit} className="relative">
              <label htmlFor="gmail-search-input" className="sr-only">
                Search Gmail messages
              </label>
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="gmail-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('gmail.searchPlaceholder', uiLang)}
                className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
              />
            </form>

            <nav className="space-y-1">
              {folderItems.map((folder) => {
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleSelectFolder(folder.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#6485F5] text-white'
                        : 'text-slate-700 dark:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {folder.icon}
                      <span>{folder.label}</span>
                    </span>
                    {typeof folder.badge === 'number' && folder.badge > 0 && (
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-md tabular-nums ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-indigo-700 dark:text-[#9278D8]'
                        }`}
                      >
                        {folder.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Zone 2: Message List */}
          <section
            aria-label="Gmail Message List"
            className="lg:col-span-4 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl overflow-hidden flex flex-col max-h-[640px] shadow-xs dark:shadow-none"
          >
            <div className="px-4 py-3 bg-slate-50 dark:bg-[#10151D] border-b border-slate-200 dark:border-[#293342] flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-[#F0F2F5] tabular-nums">
                {folderItems.find((f) => f.id === activeFolder)?.label || 'Messages'} ({messages.length})
              </span>
              {appliedQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setAppliedQuery('');
                    void loadMailbox(activeFolder, '', accessToken);
                  }}
                  className="text-[11px] text-indigo-600 dark:text-[#6485F5] hover:text-indigo-700 dark:hover:text-[#9278D8] font-semibold cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-[#293342]">
              {isLoadingMessages ? (
                <div className="p-8 text-center text-xs text-slate-600 dark:text-[#9BA6B2]">
                  Loading messages from Gmail...
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#F0F2F5]">No messages in this view</p>
                  <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
                    Try switching folders, clearing your search query, or composing a new email.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => setSelectedMessage(msg)}
                      className={`w-full text-left p-4 space-y-1 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-[#6485F5]/12 border-l-2 border-l-[#6485F5]'
                          : 'hover:bg-slate-50 dark:hover:bg-[#1B2430]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`truncate ${
                            msg.isUnread ? 'font-bold text-slate-900 dark:text-[#F0F2F5]' : 'font-semibold text-slate-700 dark:text-[#F0F2F5]'
                          }`}
                        >
                          {msg.from.replace(/<[^>]+>/g, '').trim() || msg.from}
                        </span>
                        <span className="text-slate-500 dark:text-[#9BA6B2] font-mono shrink-0 tabular-nums">
                          {msg.formattedDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {msg.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#6485F5] shrink-0" aria-label="Unread" />
                        )}
                        <p
                          className={`text-xs truncate ${
                            msg.isUnread ? 'font-bold text-slate-900 dark:text-[#F0F2F5]' : 'font-medium text-slate-800 dark:text-[#F0F2F5]'
                          }`}
                        >
                          {msg.subject}
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] line-clamp-2 leading-relaxed">
                        {msg.snippet || msg.plainBody.slice(0, 120)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Zone 3: Selected Message Reader Pane */}
          <section
            aria-label="Gmail Message Reader"
            className="lg:col-span-5 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-6 min-h-[420px] flex flex-col justify-between space-y-5 shadow-xs dark:shadow-none"
          >
            {selectedMessage ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#293342] pb-4">
                    <div className="space-y-1 min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F0F2F5] leading-snug break-words">
                        {selectedMessage.subject}
                      </h2>
                      <p className="text-xs text-slate-700 dark:text-[#F0F2F5] break-words">
                        <span className="text-slate-500 dark:text-[#9BA6B2]">From:</span> {selectedMessage.from}
                      </p>
                      {selectedMessage.to && (
                        <p className="text-xs text-slate-600 dark:text-[#9BA6B2] break-words">
                          <span className="text-slate-500 dark:text-[#9BA6B2]">To:</span> {selectedMessage.to}
                        </p>
                      )}
                      <p className="text-[11px] font-mono text-slate-500 dark:text-[#9BA6B2]">
                        {selectedMessage.date || selectedMessage.formattedDate}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingMutation({
                            type: 'toggle_star',
                            message: selectedMessage,
                            nextStarred: !selectedMessage.isStarred
                          })
                        }
                        aria-label={selectedMessage.isStarred ? 'Remove star' : 'Star email'}
                        title={selectedMessage.isStarred ? 'Starred' : 'Star email'}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-[#10151D] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] cursor-pointer transition-colors"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            selectedMessage.isStarred ? 'fill-amber-400 text-amber-500 dark:text-amber-400' : ''
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPendingMutation({
                            type: 'toggle_unread',
                            message: selectedMessage,
                            nextUnread: !selectedMessage.isUnread
                          })
                        }
                        aria-label={selectedMessage.isUnread ? 'Mark as read' : 'Mark as unread'}
                        title={selectedMessage.isUnread ? 'Mark as read' : 'Mark as unread'}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-[#10151D] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] cursor-pointer transition-colors"
                      >
                        <MailOpen className="w-4 h-4" />
                      </button>

                      {selectedMessage.isTrash ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingMutation({
                              type: 'untrash_message',
                              message: selectedMessage
                            })
                          }
                          aria-label="Restore email from Trash"
                          title="Restore from Trash"
                          className="p-2 rounded-lg bg-slate-100 dark:bg-[#10151D] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-emerald-600 dark:text-emerald-400 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingMutation({
                              type: 'trash_message',
                              message: selectedMessage
                            })
                          }
                          aria-label="Move email to Trash"
                          title="Move to Trash"
                          className="p-2 rounded-lg bg-slate-100 dark:bg-[#10151D] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] max-h-[340px] overflow-y-auto">
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-[#F0F2F5] leading-relaxed whitespace-pre-wrap break-words">
                      {selectedMessage.plainBody || selectedMessage.snippet || '(Empty message body)'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#293342]">
                  <button
                    type="button"
                    onClick={() => openReplyCompose(selectedMessage)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>

                  {onSaveToVocabDeck && selectedMessage.subject && (
                    <button
                      type="button"
                      onClick={() =>
                        onSaveToVocabDeck({
                          word: selectedMessage.subject.slice(0, 60),
                          translation: `Saved from Gmail (${selectedMessage.from.replace(/<[^>]+>/g, '').trim()})`,
                          language: selectedLanguage.name,
                          contextSentence: selectedMessage.snippet.slice(0, 140),
                          tags: ['Gmail Phrase']
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <BookMarked className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                      <span>Save Subject to Vocab Bank</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
                <Mail className="w-8 h-8 text-slate-400 dark:text-[#9BA6B2]" />
                <p className="text-sm font-bold text-slate-800 dark:text-[#F0F2F5]">Select an email to read</p>
                <p className="text-xs text-slate-500 dark:text-[#9BA6B2] max-w-xs">
                  Choose any message from your Gmail folder list on the left or compose a new email to your language partner.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
