import React from 'react';
import { IncomingCallEvent } from '../../services/realtimePresence';
import { Phone, PhoneOff, Video, Mic, Smartphone } from 'lucide-react';
import { t } from '../../services/uiLocalization';

interface IncomingCallModalProps {
  incomingCall: IncomingCallEvent | null;
  nativeLanguage?: string;
  onAccept: (mode: 'video' | 'audio') => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  nativeLanguage,
  onAccept,
  onDecline
}) => {
  if (!incomingCall) return null;
  const uiLang = nativeLanguage || 'English';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 shadow-2xl dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] text-center space-y-5">
        {/* Ringing avatar */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <img
            src={incomingCall.caller.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'}
            alt={incomingCall.caller.name}
            className="relative w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-[#293342]"
          />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2 border border-emerald-500/25">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('call.incoming', uiLang)}</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-[#F0F2F5]">{incomingCall.caller.name}</h3>
          <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-1">
            {incomingCall.mode === 'video' ? t('call.callingVideo', uiLang) : t('call.callingAudio', uiLang)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-rose-500/15 border border-slate-300 dark:border-[#293342] hover:border-rose-500/35 text-slate-700 dark:text-[#F0F2F5] hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>{t('call.decline', uiLang)}</span>
          </button>

          <button
            type="button"
            onClick={() => onAccept(incomingCall.mode === 'video' ? 'video' : 'audio')}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold border border-emerald-500/40 transition-colors cursor-pointer active:scale-[0.99]"
          >
            {incomingCall.mode === 'video' ? <Video className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{t('call.accept', uiLang)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
