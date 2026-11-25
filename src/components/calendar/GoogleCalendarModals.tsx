import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  Trash2,
  Users,
  Video,
  X
} from 'lucide-react';
import {
  GoogleCalendarEventDraft,
  GoogleCalendarEventItem,
  validateCalendarEventDraft
} from '../../services/googleCalendarLogic';
import { getHtmlLangCode, t } from '../../services/uiLocalization';

export type PendingCalendarMutation =
  | {
      type: 'update_event';
      event: GoogleCalendarEventItem;
      draft: GoogleCalendarEventDraft;
    }
  | {
      type: 'delete_event';
      event: GoogleCalendarEventItem;
    };

interface GoogleCalendarDetailsModalProps {
  event: GoogleCalendarEventItem | null;
  isOpen: boolean;
  uiLang?: string;
  onClose: () => void;
  onRequestEdit: (event: GoogleCalendarEventItem) => void;
  onRequestDelete: (event: GoogleCalendarEventItem) => void;
}

export const GoogleCalendarDetailsModal: React.FC<GoogleCalendarDetailsModalProps> = ({
  event,
  isOpen,
  uiLang,
  onClose,
  onRequestEdit,
  onRequestDelete
}) => {
  if (!isOpen || !event) return null;

  const formattedDate = new Date(`${event.date}T12:00:00`).toLocaleDateString(
    getHtmlLangCode(uiLang),
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={event.summary}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl shadow-2xl overflow-hidden my-6">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                {t('gcal.googleEventBadge', uiLang)}
              </span>
              {!event.canEdit && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-[#1B2430] text-slate-600 dark:text-[#9BA6B2] border border-slate-300 dark:border-[#293342]">
                  {t('gcal.readOnly', uiLang)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', uiLang)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200/60 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5] mt-2.5 tracking-tight">
            {event.summary}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-700 dark:text-[#F0F2F5]">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5 tabular-nums">
              <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>
                {event.isAllDay
                  ? t('gcal.allDay', uiLang)
                  : `${event.startTime} - ${event.endTime} (${event.durationMinutes} ${t('common.min', uiLang)})`}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] flex items-start gap-2">
              <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9BA6B2] block">
                  {t('gcal.locationLabel', uiLang)}
                </span>
                <span className="text-slate-800 dark:text-[#F0F2F5] break-words">
                  {event.location || t('gcal.noLocation', uiLang)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] flex items-start gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-[#6485F5] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9BA6B2] block">
                  {t('events.maxParticipants', uiLang)}
                </span>
                <span className="text-slate-800 dark:text-[#F0F2F5] tabular-nums">
                  {event.attendeesCount > 0 ? event.attendeesCount : 1}
                </span>
              </div>
            </div>
          </div>

          {event.hangoutLink && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
              <div className="flex items-center gap-2.5 min-w-0">
                <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                  {t('gcal.joinMeet', uiLang)}
                </span>
              </div>
              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
              >
                <span>{t('gcal.joinMeet', uiLang)}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {event.description && (
            <div>
              <h3 className="text-[11px] font-semibold text-slate-600 dark:text-[#9BA6B2] uppercase tracking-wider mb-1.5">
                {t('events.aboutSession', uiLang)}
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-[#F0F2F5] leading-relaxed bg-slate-50 dark:bg-[#10151D] p-3.5 rounded-lg border border-slate-200 dark:border-[#293342] whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {event.htmlLink && (
            <div className="pt-1">
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                <span>{t('gcal.openInGoogle', uiLang)}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
          <div className="flex items-center gap-2">
            {event.canEdit && (
              <button
                type="button"
                onClick={() => onRequestDelete(event)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/25 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('gcal.deleteEvent', uiLang)}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('common.close', uiLang)}
            </button>
            {event.canEdit && (
              <button
                type="button"
                onClick={() => onRequestEdit(event)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold border border-[#6485F5]/40 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t('gcal.editEvent', uiLang)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface GoogleCalendarFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialDate: string;
  editingEvent: GoogleCalendarEventItem | null;
  uiLang?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmitCreate: (draft: GoogleCalendarEventDraft) => Promise<void> | void;
  onRequestUpdate: (event: GoogleCalendarEventItem, draft: GoogleCalendarEventDraft) => void;
}

export const GoogleCalendarFormModal: React.FC<GoogleCalendarFormModalProps> = ({
  isOpen,
  mode,
  initialDate,
  editingEvent,
  uiLang,
  isSubmitting = false,
  onClose,
  onSubmitCreate,
  onRequestUpdate
}) => {
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (mode === 'edit' && editingEvent) {
      setSummary(editingEvent.summary);
      setDate(editingEvent.date);
      setStartTime(editingEvent.startTime || '18:00');
      setDurationMinutes(editingEvent.durationMinutes || 60);
      setIsAllDay(editingEvent.isAllDay);
      setLocation(editingEvent.location || '');
      setDescription(editingEvent.description || '');
    } else {
      setSummary('');
      setDate(initialDate);
      setStartTime('18:00');
      setDurationMinutes(60);
      setIsAllDay(false);
      setLocation('LernWelt Live Practice Room');
      setDescription('');
    }
  }, [isOpen, mode, editingEvent, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCalendarEventDraft({
      summary,
      date,
      startTime,
      durationMinutes,
      isAllDay,
      location,
      description
    });
    if (!validation.valid) {
      setFormError(validation.error || 'Please check event details.');
      return;
    }

    if (mode === 'edit' && editingEvent) {
      onRequestUpdate(editingEvent, validation.normalized);
    } else {
      await onSubmitCreate(validation.normalized);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'edit' ? t('gcal.editTitle', uiLang) : t('gcal.createTitle', uiLang)}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F0F2F5]">
              {mode === 'edit' ? t('gcal.editTitle', uiLang) : t('gcal.createTitle', uiLang)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', uiLang)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200/60 dark:hover:bg-[#232F3F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label htmlFor="gcal-summary" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('gcal.eventSummary', uiLang)}
            </label>
            <input
              id="gcal-summary"
              type="text"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. German B1 Speaking Session"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-sm text-slate-900 dark:text-[#F0F2F5] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="gcal-date" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                {t('events.dateLabel', uiLang)}
              </label>
              <input
                id="gcal-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none"
              />
            </div>

            {!isAllDay && (
              <>
                <div>
                  <label htmlFor="gcal-time" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                    {t('events.timeLabel', uiLang)}
                  </label>
                  <input
                    id="gcal-time"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="gcal-duration" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                    {t('events.durationLabel', uiLang)}
                  </label>
                  <select
                    id="gcal-duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none"
                  >
                    <option value={15}>15 {t('common.min', uiLang)}</option>
                    <option value={30}>30 {t('common.min', uiLang)}</option>
                    <option value={45}>45 {t('common.min', uiLang)}</option>
                    <option value={60}>60 {t('common.min', uiLang)}</option>
                    <option value={90}>90 {t('common.min', uiLang)}</option>
                    <option value={120}>120 {t('common.min', uiLang)}</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-[#F0F2F5] cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded border-slate-300 dark:border-[#293342] accent-[#6485F5] w-4 h-4 cursor-pointer"
            />
            <span>{t('gcal.allDayToggle', uiLang)}</span>
          </label>

          <div>
            <label htmlFor="gcal-location" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('gcal.locationLabel', uiLang)}
            </label>
            <input
              id="gcal-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="LernWelt Live Practice Room or address"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="gcal-description" className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('events.descriptionAgenda', uiLang)}
            </label>
            <textarea
              id="gcal-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('events.notesLabel', uiLang)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#293342]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] text-xs font-semibold cursor-pointer"
            >
              {t('common.cancel', uiLang)}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold border border-[#6485F5]/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? t('common.saving', uiLang)
                : mode === 'edit'
                ? t('gcal.saveChangesBtn', uiLang)
                : t('gcal.createBtn', uiLang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GoogleCalendarConfirmModalProps {
  pendingMutation: PendingCalendarMutation | null;
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const GoogleCalendarConfirmModal: React.FC<GoogleCalendarConfirmModalProps> = ({
  pendingMutation,
  isApplying,
  onCancel,
  onConfirm
}) => {
  if (!pendingMutation) return null;

  const isDelete = pendingMutation.type === 'delete_event';
  const title = isDelete
    ? 'Delete Google Calendar Event?'
    : 'Save Changes to Google Calendar Event?';
  const description = isDelete
    ? `Permanently delete "${pendingMutation.event.summary}" (${pendingMutation.event.date}) from your Google Calendar? This action cannot be undone.`
    : `Update "${pendingMutation.event.summary}" in your Google Calendar with "${pendingMutation.draft.summary}" on ${pendingMutation.draft.date}?`;
  const confirmLabel = isDelete ? 'Delete Event' : 'Confirm Update';

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gcal-confirm-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isDelete
                ? 'bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-indigo-50 dark:bg-[#6485F5]/15 border border-indigo-200 dark:border-[#6485F5]/30 text-indigo-600 dark:text-[#6485F5]'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 id="gcal-confirm-title" className="text-base font-bold text-slate-900 dark:text-[#F0F2F5]">
              {title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isApplying}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isApplying}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500/40'
                : 'bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40'
            }`}
          >
            {isApplying ? 'Applying...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
