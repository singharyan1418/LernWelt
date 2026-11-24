import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Mail, 
  Share2, 
  Users, 
  Link as LinkIcon, 
  Send, 
  Sparkles,
  Globe2,
  CheckCircle2
} from 'lucide-react';
import { getSixDigitRoomCode } from '../../services/roomSessionUtils';

export interface AddPeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  roomTitle?: string;
  directRoomUrl?: string;
  currentUserId?: string;
  connectedParticipants?: any[];
}

interface QuickInviteContact {
  id: string;
  name: string;
  avatar: string;
  nativeLang: string;
  learningLang: string;
  status: 'online' | 'away';
}

const QUICK_CONTACTS: QuickInviteContact[] = [
  {
    id: 'cont-1',
    name: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    nativeLang: 'German 🇩🇪',
    learningLang: 'Spanish 🇪🇸',
    status: 'online'
  },
  {
    id: 'cont-2',
    name: 'Marco Rossi',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
    nativeLang: 'Italian 🇮🇹',
    learningLang: 'German 🇩🇪',
    status: 'online'
  },
  {
    id: 'cont-3',
    name: 'Yuki Tanaka',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    nativeLang: 'Japanese 🇯🇵',
    learningLang: 'English 🇬🇧',
    status: 'online'
  },
  {
    id: 'cont-4',
    name: 'Camille Dupont',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    nativeLang: 'French 🇫🇷',
    learningLang: 'German 🇩🇪',
    status: 'away'
  }
];

export const AddPeopleModal: React.FC<AddPeopleModalProps> = ({
  isOpen,
  onClose,
  roomId = 'practice-room',
  roomTitle = 'Language Exchange Session',
  directRoomUrl,
  connectedParticipants = []
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [invitedMap, setInvitedMap] = useState<Record<string, boolean>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen) return null;

  const effectiveUrl = directRoomUrl || (typeof window !== 'undefined' ? `${window.location.origin}?room=${roomId}` : `https://lernwelt.app/room/${roomId}`);
  const displayRoomCode = getSixDigitRoomCode(roomId);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(effectiveUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayRoomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleSendQuickInvite = (contactId: string) => {
    setInvitedMap(prev => ({ ...prev, [contactId]: true }));
  };

  const handleSendEmailInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setEmailSent(true);
    setTimeout(() => {
      setInviteEmail('');
      setEmailSent(false);
    }, 2500);
  };

  const mailtoLink = `mailto:?subject=${encodeURIComponent(`Join me on Lernwelt: ${roomTitle}`)}&body=${encodeURIComponent(
    `Hey!\n\nI'm practicing languages in a live interactive room on Lernwelt: "${roomTitle}".\n\nClick the link to join directly with video, live vocabulary assistance, and real-time corrections:\n${effectiveUrl}\n\nRoom ID: ${roomId}\n\nSee you there!`
  )}`;

  const whatsappLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Join my language practice room on Lernwelt: "${roomTitle}"! Link: ${effectiveUrl}`
  )}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-[#F0F2F5] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-200 dark:border-[#293342]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/30 flex items-center justify-center text-indigo-600 dark:text-[#6485F5]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                Invite Language Partners
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2] truncate max-w-[280px]">
                {roomTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Link & Code Section */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" /> Direct Room Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={effectiveUrl}
                className="flex-1 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] select-all"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  copiedLink 
                    ? 'bg-emerald-600 text-white border border-emerald-500/40' 
                    : 'bg-[#6485F5] hover:bg-[#7593F7] text-white border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)]'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342]">
            <div>
              <span className="text-[11px] text-slate-600 dark:text-[#9BA6B2] block">Room ID Code</span>
              <span className="text-sm font-mono font-bold text-slate-900 dark:text-[#F0F2F5]">{displayRoomCode}</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="text-xs font-medium text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-[#293342] hover:border-slate-400 dark:hover:border-[#3A4A6D] bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* One-Click Sharing */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider block">
            Quick Share Channels
          </label>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={mailtoLink}
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors group"
            >
              <Mail className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <span>Email Invite</span>
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors group"
            >
              <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp / Chat</span>
            </a>
          </div>
        </div>

        {/* Quick Invite Active Contacts */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Invite Available Peers
            </label>
            <span className="text-[11px] text-slate-500 dark:text-[#9BA6B2] tabular-nums">
              {QUICK_CONTACTS.filter(c => c.status === 'online').length} online now
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {QUICK_CONTACTS.map(contact => {
              const isInvited = !!invitedMap[contact.id];
              return (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] hover:bg-slate-100 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-[#293342] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-300 dark:ring-[#293342]"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#10151D] ${
                          contact.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-[#9BA6B2]'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5]">
                        {contact.name}
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-[#9BA6B2] flex items-center gap-1">
                        <span>Speaks {contact.nativeLang}</span>
                        <span>•</span>
                        <span>Learning {contact.learningLang}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendQuickInvite(contact.id)}
                    disabled={isInvited}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isInvited
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 cursor-default'
                        : 'bg-[#6485F5]/15 hover:bg-[#6485F5] text-indigo-700 dark:text-[#9278D8] hover:text-white border border-[#6485F5]/30'
                    }`}
                  >
                    {isInvited ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3" /> Invite
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Participants status */}
        {connectedParticipants.length > 0 && (
          <div className="pt-2.5 border-t border-slate-200 dark:border-[#293342] text-xs text-slate-600 dark:text-[#9BA6B2] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" /> Currently connected peers
            </span>
            <span className="font-semibold text-slate-800 dark:text-[#F0F2F5] tabular-nums">
              {connectedParticipants.length} member{connectedParticipants.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="pt-1 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
