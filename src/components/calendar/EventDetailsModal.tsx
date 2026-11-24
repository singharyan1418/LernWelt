import React, { useState } from 'react';
import { CalendarEvent } from '../../types';
import { createGoogleCalendarUrl, downloadIcsFile } from '../../data/calendarEventsData';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  CheckCircle2, 
  ExternalLink, 
  Download, 
  Bell, 
  Video, 
  Tag, 
  Share2, 
  Trash2,
  Globe2,
  Sparkles,
  BookOpen,
  Award
} from 'lucide-react';
import { getHtmlLangCode, t } from '../../services/uiLocalization';

interface EventDetailsModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  nativeLanguage?: string;
  onClose: () => void;
  onToggleRsvp: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  onJoinRoom?: (roomId: string) => void;
  onToggleReminder?: (eventId: string) => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  isOpen,
  nativeLanguage,
  onClose,
  onToggleRsvp,
  onDeleteEvent,
  onJoinRoom,
  onToggleReminder
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !event) return null;

  const isFull = event.attendeesCount >= event.maxAttendees && !event.isUserAttending;
  const googleCalUrl = createGoogleCalendarUrl(event);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin + `?tab=events-calendar&event=${event.id}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'speaking-club':
        return { label: t('events.catSpeaking', nativeLanguage), bg: 'bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
      case 'grammar-workshop':
        return { label: t('events.catGrammar', nativeLanguage), bg: 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30' };
      case 'cultural-night':
        return { label: t('events.catCultural', nativeLanguage), bg: 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30' };
      case 'exam-prep':
        return { label: t('events.catExam', nativeLanguage), bg: 'bg-purple-500/15 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30' };
      case 'trivia-games':
        return { label: t('events.catTrivia', nativeLanguage), bg: 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/30' };
      default:
        return { label: t('events.catTandem', nativeLanguage), bg: 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    }
  };

  const badge = getCategoryBadge(event.category);

  // Parse friendly date
  const eventDateObj = new Date(event.date + 'T12:00:00');
  const formattedDate = eventDateObj.toLocaleDateString(getHtmlLangCode(nativeLanguage), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Top Banner */}
        <div className="relative px-6 py-5 border-b border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">{event.flag}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                {badge.label}
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-[#1B2430] text-slate-700 dark:text-[#F0F2F5] border border-slate-200 dark:border-[#293342]">
                {event.cefrLevel}
              </span>
              {event.isUserAttending && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('events.youreAttending', nativeLanguage)}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.close', nativeLanguage)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200/60 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5] mt-2.5 tracking-tight leading-snug">
            {event.title}
          </h2>

          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 mt-3 text-xs text-slate-700 dark:text-[#F0F2F5]">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
              <span className="tabular-nums">{event.startTime} - {event.endTime} ({event.durationMinutes} {t('common.min', nativeLanguage)})</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Host Card */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342]">
            <div className="flex items-center gap-3">
              <img
                src={event.hostAvatar}
                alt={event.hostName}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-300 dark:ring-[#293342]"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5]">{event.hostName}</span>
                  {event.hostIsNative && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border border-[#6485F5]/30">
                      {t('common.nativeSpeaker', nativeLanguage)}
                    </span>
                  )}
                  {event.isUserHost && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                      {t('events.hostedByYou', nativeLanguage)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">{t('events.hostOrganizer', nativeLanguage)}</p>
              </div>
            </div>

            {/* Attendance capacity */}
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 dark:text-[#F0F2F5] flex items-center gap-1 justify-end tabular-nums">
                <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                <span>{event.attendeesCount} / {event.maxAttendees}</span>
              </div>
              <span className={`text-[10px] font-medium tabular-nums ${isFull ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isFull
                  ? t('events.sessionFull', nativeLanguage)
                  : t('events.spotsRemaining', nativeLanguage, { count: event.maxAttendees - event.attendeesCount })}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-[11px] font-semibold text-slate-600 dark:text-[#9BA6B2] uppercase tracking-wider mb-1.5">
              {t('events.aboutSession', nativeLanguage)}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#F0F2F5] leading-relaxed bg-slate-50 dark:bg-[#10151D] p-3.5 rounded-lg border border-slate-200 dark:border-[#293342]">
              {event.description}
            </p>
          </div>

          {/* Topics & Agenda */}
          {event.topics && event.topics.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-slate-600 dark:text-[#9BA6B2] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                {t('events.topicsPrompts', nativeLanguage)}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {event.topics.map((tItem, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-[#6485F5]/10 border border-[#6485F5]/25 text-indigo-700 dark:text-[#9278D8] text-xs font-medium"
                  >
                    • {tItem}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Direct Room Access Banner (if linked) */}
          {event.roomId && (
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-[#1B2430] border border-[#6485F5]/35">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/30 flex items-center justify-center text-indigo-600 dark:text-[#6485F5]">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5] block">{t('events.connectedRoom', nativeLanguage)}</span>
                  <span className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">{t('events.connectedRoomSub', nativeLanguage)}</span>
                </div>
              </div>
              {onJoinRoom && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onJoinRoom(event.roomId!);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {t('events.joinRoomNow', nativeLanguage)}
                </button>
              )}
            </div>
          )}

          {/* Calendar Sync & Export Tools */}
          <div className="pt-2 border-t border-slate-200 dark:border-[#293342]">
            <h4 className="text-[11px] font-semibold text-slate-500 dark:text-[#9BA6B2] uppercase tracking-wider mb-2">
              {t('events.syncCalendar', nativeLanguage)}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] transition-colors cursor-pointer text-center"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Google Calendar</span>
                <ExternalLink className="w-3 h-3 text-slate-400 dark:text-[#9BA6B2]" />
              </a>

              <button
                type="button"
                onClick={() => downloadIcsFile(event)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('events.downloadIcs', nativeLanguage)}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{copiedLink ? t('events.linkCopied', nativeLanguage) : t('events.copyShareLink', nativeLanguage)}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
          <div>
            {event.isUserHost && onDeleteEvent && (
              <button
                type="button"
                onClick={() => {
                  onDeleteEvent(event.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/25 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('events.deleteEventBtn', nativeLanguage)}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('common.close', nativeLanguage)}
            </button>

            {event.roomId && onJoinRoom && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onJoinRoom(event.roomId!);
                }}
                className="px-5 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>{t('events.startLiveSession', nativeLanguage)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
