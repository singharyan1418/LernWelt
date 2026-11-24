import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  X,
  CheckCheck,
  Calendar,
  BookMarked,
  UserPlus,
  Video,
  ArrowRight,
  ExternalLink,
  Trash2,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import {
  AppNotification,
  NotificationCategory,
  filterNotificationsByCategory
} from '../../services/notificationService';
import { normalizeNativeLanguage, t } from '../../services/uiLocalization';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  nativeLanguage?: string;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcceptPartnerRequest?: (partnerId: string, partnerName: string) => void;
  onDeclinePartnerRequest?: (partnerId: string) => void;
  onActionClick: (notification: AppNotification) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  nativeLanguage,
  onMarkAllAsRead,
  onMarkAsRead,
  onDismiss,
  onAcceptPartnerRequest,
  onDeclinePartnerRequest,
  onActionClick
}) => {
  const uiLang = normalizeNativeLanguage(nativeLanguage);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredNotifications = filterNotificationsByCategory(notifications, activeCategory);

  const lessonCount = notifications.filter((n) => n.category === 'lesson').length;
  const vocabCount = notifications.filter((n) => n.category === 'vocab').length;
  const partnerCount = notifications.filter((n) => n.category === 'partner').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 dark:bg-[#0D1117]/70 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Slide-out Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('notif.title', uiLang)}
              className="w-screen max-w-md bg-white dark:bg-[#161D27] border-l border-slate-200 dark:border-[#293342] shadow-2xl dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-[#6485F5]/12 border border-indigo-200 dark:border-[#6485F5]/30 flex items-center justify-center text-indigo-600 dark:text-[#6485F5] shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                          {t('notif.title', uiLang)}
                        </h2>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border border-indigo-200 dark:border-[#6485F5]/30 text-[11px] font-semibold tabular-nums">
                            {t('notif.newCount', uiLang, { count: unreadCount })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                        {t('notif.subtitle', uiLang)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllAsRead}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] transition-colors cursor-pointer"
                        title={t('notif.markAllRead', uiLang)}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('notif.markAllRead', uiLang)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t('notif.closeDrawer', uiLang)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200 dark:hover:bg-[#1B2430] transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Category Navigation Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                      activeCategory === 'all'
                        ? 'bg-slate-200 dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] font-semibold border-slate-300 dark:border-[#293342]'
                        : 'bg-white dark:bg-[#161D27] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border-slate-200 dark:border-[#293342]'
                    }`}
                  >
                    <span>{t('notif.tabAll', uiLang)}</span>
                    <span className="text-[11px] opacity-80 tabular-nums">({notifications.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCategory('lesson')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                      activeCategory === 'lesson'
                        ? 'bg-slate-200 dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] font-semibold border-slate-300 dark:border-[#293342]'
                        : 'bg-white dark:bg-[#161D27] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border-slate-200 dark:border-[#293342]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t('notif.tabLessons', uiLang)}</span>
                    {lessonCount > 0 && <span className="text-[11px] opacity-80 tabular-nums">({lessonCount})</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCategory('vocab')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                      activeCategory === 'vocab'
                        ? 'bg-slate-200 dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] font-semibold border-slate-300 dark:border-[#293342]'
                        : 'bg-white dark:bg-[#161D27] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border-slate-200 dark:border-[#293342]'
                    }`}
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>{t('notif.tabVocab', uiLang)}</span>
                    {vocabCount > 0 && <span className="text-[11px] opacity-80 tabular-nums">({vocabCount})</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCategory('partner')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                      activeCategory === 'partner'
                        ? 'bg-slate-200 dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] font-semibold border-slate-300 dark:border-[#293342]'
                        : 'bg-white dark:bg-[#161D27] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border-slate-200 dark:border-[#293342]'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{t('notif.tabPartners', uiLang)}</span>
                    {partnerCount > 0 && <span className="text-[11px] opacity-80 tabular-nums">({partnerCount})</span>}
                  </button>
                </div>
              </div>

              {/* Notification Items List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
                {filteredNotifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] flex items-center justify-center text-slate-400 dark:text-[#9BA6B2]">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5]">{t('notif.empty', uiLang)}</div>
                      <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-1 max-w-xs">
                        {activeCategory === 'all'
                          ? t('notif.emptyDesc', uiLang)
                          : t('notif.emptyFiltered', uiLang)}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => {
                    const isLesson = notif.category === 'lesson';
                    const isVocab = notif.category === 'vocab';
                    const isPartner = notif.category === 'partner';

                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => !notif.isRead && onMarkAsRead(notif.id)}
                        className={`relative rounded-lg p-4 transition-colors duration-150 border ${
                          notif.isRead
                            ? 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342]'
                            : 'bg-white dark:bg-[#1B2430] border-indigo-200 dark:border-[#293342] hover:border-indigo-300 dark:hover:border-[#3A4A6D] shadow-xs dark:shadow-none'
                        }`}
                      >
                        {/* Top Metadata Row */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                isLesson
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'
                                  : isVocab
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                                    : 'bg-indigo-50 dark:bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border-indigo-200 dark:border-[#6485F5]/30'
                              }`}
                            >
                              {isLesson
                                ? t('notif.typeLesson', uiLang)
                                : isVocab
                                  ? t('notif.typeVocab', uiLang)
                                  : t('notif.typePartner', uiLang)}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-[#9BA6B2]">{notif.timestamp}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {!notif.isRead && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#6485F5] shrink-0"
                                title={t('notif.newCount', uiLang, { count: 1 })}
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(notif.id);
                              }}
                              aria-label={t('notif.dismiss', uiLang)}
                              className="text-slate-400 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] p-1 rounded-md hover:bg-slate-100 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div className="mb-3">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] leading-snug">
                            {notif.title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-1 leading-relaxed">
                            {notif.description}
                          </p>
                        </div>

                        {/* Custom Interactive Action Buttons */}
                        {isPartner && notif.metadata?.partnerName ? (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkAsRead(notif.id);
                                if (onAcceptPartnerRequest && notif.actionPayload?.partnerId) {
                                  onAcceptPartnerRequest(
                                    notif.actionPayload.partnerId,
                                    notif.metadata?.partnerName || 'Partner'
                                  );
                                }
                                onActionClick(notif);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold transition-colors cursor-pointer active:scale-[0.99]"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>{t('notif.acceptAndCall', uiLang)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeclinePartnerRequest && notif.actionPayload?.partnerId) {
                                  onDeclinePartnerRequest(notif.actionPayload.partnerId);
                                }
                                onDismiss(notif.id);
                              }}
                              className="py-2 px-3 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-slate-700 dark:text-[#F0F2F5] text-xs font-medium border border-slate-200 dark:border-[#293342] transition-colors cursor-pointer"
                            >
                              {t('notif.decline', uiLang)}
                            </button>
                          </div>
                        ) : notif.actionLabel ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(notif.id);
                              onActionClick(notif);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-[#6485F5] text-slate-800 dark:text-[#F0F2F5] hover:text-white border border-slate-200 dark:border-[#293342] hover:border-[#6485F5] text-xs font-semibold transition-colors duration-150 cursor-pointer active:scale-[0.99]"
                          >
                            <span>{notif.actionLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer Status */}
              <div className="p-4 border-t border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D] text-xs text-slate-600 dark:text-[#9BA6B2] flex items-center justify-between">
                <span>{t('notif.footerTitle', uiLang)}</span>
                <span className="tabular-nums font-mono text-[11px] text-slate-600 dark:text-[#9BA6B2]">
                  {t('notif.footerAlerts', uiLang, {
                    count: notifications.length,
                    label:
                      notifications.length === 1
                        ? t('notif.alertSingular', uiLang)
                        : t('notif.alertPlural', uiLang)
                  })}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
