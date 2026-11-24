import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { LanguageRoom } from '../../types';
import {
  ClassifiedGoogleChatError,
  GOOGLE_CHAT_CONSOLE_CONFIG_URL,
  GOOGLE_CHAT_PROJECT_ID,
  GoogleChatMessageItem,
  GoogleChatSpaceItem,
  buildRoomShareDraft,
  validateGoogleChatMessageDraft,
  validateNewSpaceInput
} from '../../services/googleChatLogic';
import {
  GoogleChatApiException,
  createGoogleChatSpace,
  deleteGoogleChatMessage,
  deleteGoogleChatSpace,
  getGoogleChatAccessToken,
  initGoogleChatAuth,
  listGoogleChatMessages,
  listGoogleChatSpaces,
  sendGoogleChatMessage,
  signInToGoogleChat,
  signOutFromGoogleChat
} from '../../services/googleChatService';

interface GoogleChatFloatingWidgetProps {
  currentRoom?: LanguageRoom;
}

type PendingConfirmation =
  | {
      type: 'send_message';
      space: GoogleChatSpaceItem;
      text: string;
    }
  | {
      type: 'create_space';
      displayName: string;
    }
  | {
      type: 'delete_message';
      message: GoogleChatMessageItem;
    }
  | {
      type: 'delete_space';
      space: GoogleChatSpaceItem;
    };

const GoogleChatLogoMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M5 4.5C3.89543 4.5 3 5.39543 3 6.5V15.5C3 16.6046 3.89543 17.5 5 17.5H7.5V20.5L11.2 17.5H16C17.1046 17.5 18 16.6046 18 15.5V6.5C18 5.39543 17.1046 4.5 16 4.5H5Z"
      fill="#00AC47"
    />
    <path
      d="M8.5 8.5H20C20.8284 8.5 21.5 9.17157 21.5 10V17.5C21.5 18.3284 20.8284 19 20 19H17.5V21.2L14.8 19H10C9.17157 19 8.5 18.3284 8.5 17.5V8.5Z"
      fill="#34A853"
      fillOpacity="0.88"
    />
    <path
      d="M7 9.75H14M7 12.75H11.5"
      stroke="#FFFFFF"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const OfficialGoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ onClick, disabled, isLoading }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="gsi-material-button w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-white hover:bg-[#F3F5F8] active:bg-[#E2E6EE] text-[#11141A] font-semibold text-xs border border-[#D4D9E2] shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
  >
    <span className="w-4 h-4 shrink-0 block">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="w-4 h-4 block"
        aria-hidden="true"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
    <span className="gsi-material-button-contents">
      {isLoading ? 'Signing in...' : 'Sign in with Google'}
    </span>
  </button>
);

export const GoogleChatFloatingWidget: React.FC<GoogleChatFloatingWidgetProps> = ({
  currentRoom
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<GoogleChatSpaceItem[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<GoogleChatSpaceItem | null>(null);
  const [messages, setMessages] = useState<GoogleChatMessageItem[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [apiError, setApiError] = useState<ClassifiedGoogleChatError | null>(null);

  const [showNewSpaceForm, setShowNewSpaceForm] = useState<boolean>(false);
  const [newSpaceName, setNewSpaceName] = useState<string>('');
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [isExecutingMutation, setIsExecutingMutation] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initGoogleChatAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      (user) => {
        setGoogleUser(user);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadSpaces = useCallback(async (tokenToUse?: string | null) => {
    const token = tokenToUse ?? getGoogleChatAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setIsLoadingSpaces(true);
    setApiError(null);
    try {
      const list = await listGoogleChatSpaces(token);
      setSpaces(list);
    } catch (err: any) {
      if (err instanceof GoogleChatApiException) {
        setApiError(err.details);
        if (err.details.needsReauth) {
          setAccessToken(null);
          setNeedsAuth(true);
        }
      } else {
        setApiError({
          kind: 'api_error',
          status: 500,
          title: 'Connection Error',
          message: err?.message || 'Unable to reach Google Chat API.',
          rawErrorMessage: err?.message || '',
          needsReauth: false
        });
      }
    } finally {
      setIsLoadingSpaces(false);
    }
  }, []);

  const loadMessagesForSpace = useCallback(
    async (space: GoogleChatSpaceItem, tokenToUse?: string | null) => {
      const token = tokenToUse ?? getGoogleChatAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      setIsLoadingMessages(true);
      setApiError(null);
      try {
        const items = await listGoogleChatMessages(token, space.name);
        setMessages(items);
      } catch (err: any) {
        if (err instanceof GoogleChatApiException) {
          setApiError(err.details);
          if (err.details.needsReauth) {
            setAccessToken(null);
            setNeedsAuth(true);
          }
        } else {
          setApiError({
            kind: 'api_error',
            status: 500,
            title: 'Could Not Load Messages',
            message: err?.message || 'Failed to load messages from Google Chat.',
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

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    setApiError(null);
    try {
      const res = await signInToGoogleChat();
      setGoogleUser(res.user);
      setAccessToken(res.accessToken);
      setNeedsAuth(false);
      await loadSpaces(res.accessToken);
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing Google authentication.');
      } else {
        setAuthError(err?.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutFromGoogleChat();
    setAccessToken(null);
    setGoogleUser(null);
    setNeedsAuth(true);
    setSpaces([]);
    setSelectedSpace(null);
    setMessages([]);
    setApiError(null);
    setPendingConfirm(null);
  };

  const handleOpenSpace = (space: GoogleChatSpaceItem) => {
    setSelectedSpace(space);
    setFormValidationError(null);
    setPendingConfirm(null);
    void loadMessagesForSpace(space, accessToken);
  };

  const handlePrepareSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpace) return;
    const check = validateGoogleChatMessageDraft(messageDraft);
    if (!check.valid) {
      setFormValidationError(check.error || 'Please write a message first.');
      return;
    }
    setFormValidationError(null);
    setPendingConfirm({
      type: 'send_message',
      space: selectedSpace,
      text: messageDraft.trim()
    });
  };

  const handlePrepareCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateNewSpaceInput(newSpaceName);
    if (!check.valid) {
      setFormValidationError(check.error || 'Please enter a valid space name.');
      return;
    }
    setFormValidationError(null);
    setPendingConfirm({
      type: 'create_space',
      displayName: newSpaceName.trim()
    });
  };

  const handleInsertRoomInvite = () => {
    if (!currentRoom) return;
    const draft = buildRoomShareDraft(
      currentRoom.title,
      currentRoom.id,
      window.location.origin
    );
    setMessageDraft(draft);
    setFormValidationError(null);
  };

  const executeConfirmedAction = async () => {
    if (!pendingConfirm) return;
    const token = accessToken ?? getGoogleChatAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setPendingConfirm(null);
      return;
    }

    setIsExecutingMutation(true);
    setApiError(null);

    try {
      if (pendingConfirm.type === 'send_message') {
        const createdMsg = await sendGoogleChatMessage(
          token,
          pendingConfirm.space.name,
          pendingConfirm.text
        );
        setMessages((prev) => [...prev, createdMsg]);
        setMessageDraft('');
        setPendingConfirm(null);
      } else if (pendingConfirm.type === 'create_space') {
        const createdSpace = await createGoogleChatSpace(token, pendingConfirm.displayName);
        setSpaces((prev) => [createdSpace, ...prev]);
        setNewSpaceName('');
        setShowNewSpaceForm(false);
        setPendingConfirm(null);
        setSelectedSpace(createdSpace);
        setMessages([]);
      } else if (pendingConfirm.type === 'delete_message') {
        await deleteGoogleChatMessage(token, pendingConfirm.message.name);
        setMessages((prev) => prev.filter((m) => m.name !== pendingConfirm.message.name));
        setPendingConfirm(null);
      } else if (pendingConfirm.type === 'delete_space') {
        await deleteGoogleChatSpace(token, pendingConfirm.space.name);
        setSpaces((prev) => prev.filter((s) => s.name !== pendingConfirm.space.name));
        if (selectedSpace?.name === pendingConfirm.space.name) {
          setSelectedSpace(null);
          setMessages([]);
        }
        setPendingConfirm(null);
      }
    } catch (err: any) {
      setPendingConfirm(null);
      if (err instanceof GoogleChatApiException) {
        setApiError(err.details);
        if (err.details.needsReauth) {
          setAccessToken(null);
          setNeedsAuth(true);
        }
      } else {
        setApiError({
          kind: 'api_error',
          status: 500,
          title: 'Action Failed',
          message: err?.message || 'Google Chat request could not be completed.',
          rawErrorMessage: err?.message || '',
          needsReauth: false
        });
      }
    } finally {
      setIsExecutingMutation(false);
    }
  };

  return (
    <>
      {/* Anchored Google Chat Popover Panel */}
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Google Chat Workspace Panel"
          className="fixed bottom-20 right-5 z-50 w-[min(380px,calc(100vw-2.5rem))] max-h-[min(560px,calc(100vh-7rem))] bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-[#F0F2F5]"
        >
          {/* Top Header */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-[#10151D] border-b border-slate-200 dark:border-[#293342] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {selectedSpace && !needsAuth ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSpace(null);
                    setPendingConfirm(null);
                    setFormValidationError(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200 dark:hover:bg-[#232F3F] transition-colors cursor-pointer shrink-0"
                  aria-label="Back to Google Chat spaces"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <GoogleChatLogoMark className="w-5 h-5 shrink-0" />
              )}

              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5] truncate">
                  {selectedSpace && !needsAuth ? selectedSpace.displayName : 'Google Chat'}
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] truncate">
                  {needsAuth
                    ? 'Google Workspace Integration'
                    : selectedSpace
                      ? selectedSpace.typeLabel
                      : googleUser?.email || 'Connected to Google Chat'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!needsAuth && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      selectedSpace
                        ? void loadMessagesForSpace(selectedSpace, accessToken)
                        : void loadSpaces(accessToken)
                    }
                    className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
                    aria-label="Refresh Google Chat"
                    title="Refresh"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isLoadingSpaces || isLoadingMessages ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleSignOut}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-200 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
                    aria-label="Sign out of Google Chat"
                    title="Sign out of Google Chat"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
                aria-label="Close Google Chat panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {/* Mandatory Confirmation Dialog for Mutating / Destructive Operations */}
            {pendingConfirm && (
              <div
                role="alertdialog"
                aria-labelledby="gchat-confirm-title"
                className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-amber-400 dark:border-amber-500/40 space-y-2.5"
              >
                <p id="gchat-confirm-title" className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  {pendingConfirm.type === 'send_message' &&
                    `Send message to "${pendingConfirm.space.displayName}"?`}
                  {pendingConfirm.type === 'create_space' &&
                    `Create new Google Chat space "${pendingConfirm.displayName}"?`}
                  {pendingConfirm.type === 'delete_message' &&
                    'Delete this message from Google Chat?'}
                  {pendingConfirm.type === 'delete_space' &&
                    `Delete space "${pendingConfirm.space.displayName}" from Google Chat?`}
                </p>

                <p className="text-[11px] text-slate-700 dark:text-[#F0F2F5] leading-relaxed break-words">
                  {pendingConfirm.type === 'send_message' &&
                    `This will post the following message on your behalf: "${pendingConfirm.text}"`}
                  {pendingConfirm.type === 'create_space' &&
                    'This will create a new space in your Google Workspace account.'}
                  {pendingConfirm.type === 'delete_message' &&
                    `Message "${pendingConfirm.message.text.slice(0, 90)}" will be permanently removed.`}
                  {pendingConfirm.type === 'delete_space' &&
                    'This space and its conversation history will be permanently deleted.'}
                </p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isExecutingMutation}
                    onClick={() => setPendingConfirm(null)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-semibold text-xs cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isExecutingMutation}
                    onClick={executeConfirmedAction}
                    className={`px-3.5 py-1.5 rounded-lg text-white font-semibold text-xs cursor-pointer whitespace-nowrap ${
                      pendingConfirm.type === 'delete_message' ||
                      pendingConfirm.type === 'delete_space'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {isExecutingMutation
                      ? 'Working...'
                      : pendingConfirm.type === 'send_message'
                        ? 'Confirm & Send'
                        : pendingConfirm.type === 'create_space'
                          ? 'Confirm Create'
                          : 'Delete'}
                  </button>
                </div>
              </div>
            )}

            {/* API Error / Prerequisite Guidance Banner */}
            {apiError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-rose-800 dark:text-rose-200 text-xs">{apiError.title}</p>
                    <p className="text-[11px] text-rose-700 dark:text-[#F0F2F5] leading-relaxed break-words">
                      {apiError.message}
                    </p>
                  </div>
                </div>

                {apiError.consoleUrl && (
                  <a
                    href={apiError.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 underline underline-offset-2"
                  >
                    <span>Open Google Chat API Configuration ({GOOGLE_CHAT_PROJECT_ID})</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
            )}

            {/* Signed-Out State */}
            {needsAuth ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5]">
                    Access your Google Chat spaces &amp; messages
                  </p>
                  <p className="text-xs text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
                    Sign in with your Google Workspace account to browse spaces, read and send messages, or share live LernWelt language room invites.
                  </p>
                </div>

                {authError && (
                  <p
                    role="alert"
                    className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-500/35 text-rose-800 dark:text-rose-200 text-[11px]"
                  >
                    {authError}
                  </p>
                )}

                <OfficialGoogleSignInButton
                  onClick={handleGoogleLogin}
                  disabled={isSigningIn}
                  isLoading={isSigningIn}
                />

                {/* Upfront Google Chat API Prerequisites per reference guide */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2 text-[11px] text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
                  <p className="font-semibold text-slate-800 dark:text-[#F0F2F5]">
                    Google Chat API Prerequisites:
                  </p>
                  <p>
                    1. Requires a <span className="text-slate-900 dark:text-[#F0F2F5] font-medium">Business or Enterprise Google Workspace</span> account (consumer <code className="text-slate-800 dark:text-[#F0F2F5]">@gmail.com</code> accounts are not supported by Google Chat API).
                  </p>
                  <p>
                    2. Ensure the Chat App info (App name, Avatar URL, Description) is saved once in Cloud Console:
                  </p>
                  <a
                    href={GOOGLE_CHAT_CONSOLE_CONFIG_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-[#6485F5] hover:text-indigo-700 dark:hover:text-[#9278D8] underline underline-offset-2"
                  >
                    <span>Configure Chat App ({GOOGLE_CHAT_PROJECT_ID})</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
            ) : !selectedSpace ? (
              /* Signed-In: Spaces List & Create Space */
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#F0F2F5]">
                    Your Spaces ({spaces.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSpaceForm((prev) => !prev);
                      setFormValidationError(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] font-semibold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{showNewSpaceForm ? 'Close' : 'New Space'}</span>
                  </button>
                </div>

                {showNewSpaceForm && (
                  <form
                    onSubmit={handlePrepareCreateSpace}
                    noValidate
                    className="p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2"
                  >
                    <label
                      htmlFor="gchat-new-space-input"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-[#F0F2F5]"
                    >
                      New Google Chat Space Name
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="gchat-new-space-input"
                        type="text"
                        value={newSpaceName}
                        onChange={(e) => {
                          setNewSpaceName(e.target.value);
                          if (formValidationError) setFormValidationError(null);
                        }}
                        placeholder="e.g. German B2 Study Group"
                        className="flex-1 bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Create
                      </button>
                    </div>
                    {formValidationError && (
                      <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">
                        {formValidationError}
                      </p>
                    )}
                  </form>
                )}

                {isLoadingSpaces ? (
                  <div className="py-8 text-center text-slate-600 dark:text-[#9BA6B2]">
                    Loading your Google Chat spaces...
                  </div>
                ) : spaces.length === 0 ? (
                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-center space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-[#F0F2F5]">No Google Chat spaces found</p>
                    <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
                      Create a new space above or join a space in Google Chat, then refresh.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {spaces.map((space) => (
                      <div
                        key={space.name}
                        className="group flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] hover:bg-slate-100 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-[#293342] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenSpace(space)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <p className="font-semibold text-xs text-slate-900 dark:text-[#F0F2F5] truncate">
                            {space.displayName}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] truncate">
                            <span>{space.typeLabel}</span>
                            {space.memberCountLabel && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span>{space.memberCountLabel}</span>
                              </>
                            )}
                          </p>
                        </button>

                        {space.spaceType === 'SPACE' && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingConfirm({
                                type: 'delete_space',
                                space
                              })
                            }
                            aria-label={`Delete space ${space.displayName}`}
                            title="Delete space"
                            className="p-1.5 rounded-lg text-slate-400 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-[#232F3F] transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Signed-In: Selected Space Messages View */
              <div className="space-y-2.5">
                {isLoadingMessages ? (
                  <div className="py-8 text-center text-slate-600 dark:text-[#9BA6B2]">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-center space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-[#F0F2F5]">No messages yet</p>
                    <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
                      Send the first message or share your current LernWelt practice room below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.name}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 truncate">
                            {msg.senderName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {msg.formattedTime && (
                              <span className="text-slate-500 dark:text-[#9BA6B2] tabular-nums">
                                {msg.formattedTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPendingConfirm({
                                  type: 'delete_message',
                                  message: msg
                                })
                              }
                              aria-label="Delete message"
                              title="Delete message"
                              className="p-1 rounded text-slate-400 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-800 dark:text-[#F0F2F5] leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Space Message Composer Footer */}
          {!needsAuth && selectedSpace && (
            <form
              onSubmit={handlePrepareSendMessage}
              noValidate
              className="p-3 bg-slate-50 dark:bg-[#10151D] border-t border-slate-200 dark:border-[#293342] space-y-2 shrink-0"
            >
              {currentRoom && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleInsertRoomInvite}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-[#6485F5] hover:text-indigo-700 dark:hover:text-[#9278D8] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span>Insert &ldquo;{currentRoom.title}&rdquo; Invite</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <label htmlFor="gchat-message-input" className="sr-only">
                  Message {selectedSpace.displayName}
                </label>
                <input
                  id="gchat-message-input"
                  type="text"
                  value={messageDraft}
                  onChange={(e) => {
                    setMessageDraft(e.target.value);
                    if (formValidationError) setFormValidationError(null);
                  }}
                  placeholder={`Message ${selectedSpace.displayName}...`}
                  className="flex-1 bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                />
                <button
                  type="submit"
                  aria-label="Review and send Google Chat message"
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {formValidationError && (
                <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">
                  {formValidationError}
                </p>
              )}
            </form>
          )}
        </section>
      )}

      {/* Small Circular Floating Google Chat Icon at Bottom-Right */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close Google Chat' : 'Open Google Chat'}
        aria-expanded={isOpen}
        title="Google Chat"
        className={`fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center border shadow-xl transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isOpen
            ? 'bg-emerald-600 border-emerald-400 text-white'
            : 'bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] border-slate-300 dark:border-[#293342] text-slate-900 dark:text-white'
        }`}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <GoogleChatLogoMark className="w-6 h-6" />
        )}
      </button>
    </>
  );
};
