import React, { useState, useMemo } from 'react';
import { 
  CalendarEvent, 
  LanguageInfo, 
  UserProfile 
} from '../../types';
import { 
  getStoredCalendarEvents, 
  saveStoredCalendarEvents, 
  formatDateKey, 
  downloadIcsFile 
} from '../../data/calendarEventsData';
import { CreateEventModal } from './CreateEventModal';
import { EventDetailsModal } from './EventDetailsModal';
import {
  getHtmlLangCode,
  getLocalizedCalendarWeekdays,
  localizeLanguageName,
  t
} from '../../services/uiLocalization';
import { 
  Calendar as CalendarIcon, 
  CalendarDays,
  Clock, 
  Users, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  CheckCircle2, 
  Sparkles, 
  Video, 
  Download, 
  UserCheck,
  Trash2
} from 'lucide-react';

interface EventCalendarViewProps {
  selectedLanguage: LanguageInfo;
  supportedLanguages: LanguageInfo[];
  userProfile: UserProfile;
  onJoinRoom?: (roomId: string) => void;
  onShowToast?: (msg: string) => void;
}

type ViewMode = 'month' | 'agenda';
type TimeFilter = 'all' | 'upcoming' | 'this-week';

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  selectedLanguage,
  supportedLanguages,
  userProfile,
  onJoinRoom,
  onShowToast
}) => {
  const uiLang = userProfile.nativeLanguage;
  const localeCode = getHtmlLangCode(uiLang);
  const weekdayHeaders = getLocalizedCalendarWeekdays(uiLang);

  // Calendar State - strictly user's planned events
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    return getStoredCalendarEvents().filter(e => e.isUserHost === true);
  });
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [planInitialDate, setPlanInitialDate] = useState<string | undefined>(undefined);

  // Sync state to localStorage
  const handleUpdateEvents = (updated: CalendarEvent[]) => {
    const userOnly = updated.filter(e => e.isUserHost === true);
    setEvents(userOnly);
    saveStoredCalendarEvents(userOnly);
  };

  const handleCreateEvent = (newEvent: CalendarEvent) => {
    // Explicitly guarantee user ownership
    const plannedEvent: CalendarEvent = {
      ...newEvent,
      isUserHost: true,
      isUserAttending: true,
      hostName: userProfile.name ? `${userProfile.name} (You)` : 'You (Organizer)',
      hostAvatar: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    };
    const updated = [plannedEvent, ...events];
    handleUpdateEvents(updated);
    onShowToast?.(`🎉 You planned "${plannedEvent.title}"!`);
  };

  const handleToggleRsvp = (eventId: string) => {
    const updated = events.map(evt => {
      if (evt.id === eventId) {
        const willAttend = !evt.isUserAttending;
        return {
          ...evt,
          isUserAttending: willAttend,
          attendeesCount: willAttend ? evt.attendeesCount + 1 : Math.max(1, evt.attendeesCount - 1)
        };
      }
      return evt;
    });

    handleUpdateEvents(updated);

    const changed = updated.find(e => e.id === eventId);
    if (changed) {
      setSelectedEvent(changed);
      onShowToast?.(
        changed.isUserAttending
          ? `✓ Attendance confirmed for "${changed.title}"`
          : `Attendance updated for "${changed.title}"`
      );
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    const updated = events.filter(e => e.id !== eventId);
    handleUpdateEvents(updated);
    onShowToast?.('Planned event cancelled and removed from your calendar.');
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateKey(formatDateKey(today));
  };

  // Filtered Events: ONLY SHOW MY PLANNED EVENTS
  const filteredEvents = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const weekAheadDate = new Date();
    weekAheadDate.setDate(weekAheadDate.getDate() + 7);
    const weekAheadKey = formatDateKey(weekAheadDate);

    return events.filter(evt => {
      // Exclusively show events planned by the user
      if (!evt.isUserHost) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = evt.title.toLowerCase().includes(query);
        const matchDesc = evt.description.toLowerCase().includes(query);
        const matchLang = evt.languageName.toLowerCase().includes(query);
        const matchTopic = evt.topics.some(t => t.toLowerCase().includes(query));
        if (!matchTitle && !matchDesc && !matchLang && !matchTopic) {
          return false;
        }
      }

      // Language
      if (filterLanguage !== 'all' && evt.languageCode !== filterLanguage) {
        return false;
      }

      // Category
      if (filterCategory !== 'all' && evt.category !== filterCategory) {
        return false;
      }

      // Time Filter
      if (timeFilter === 'upcoming' && evt.date < todayKey) {
        return false;
      }
      if (timeFilter === 'this-week' && (evt.date < todayKey || evt.date > weekAheadKey)) {
        return false;
      }

      return true;
    });
  }, [events, searchQuery, filterLanguage, filterCategory, timeFilter]);

  // Calendar Grid Computations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString(localeCode, { month: 'long' });

  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = useMemo(() => {
    const days: { dateKey: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayKey = formatDateKey(new Date());

    // Previous month padding
    for (let i = startingDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const key = formatDateKey(prevDate);
      days.push({
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const thisDate = new Date(year, month, dayNum);
      const key = formatDateKey(thisDate);
      days.push({
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: key === todayKey
      });
    }

    // Remaining days to complete grid (42 cells = 6 rows)
    const remaining = 42 - days.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum);
      const key = formatDateKey(nextDate);
      days.push({
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey
      });
    }

    return days;
  }, [year, month, startingDayIndex, daysInMonth, daysInPrevMonth]);

  // Events map by dateKey
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach(evt => {
      const list = map.get(evt.date) || [];
      list.push(evt);
      map.set(evt.date, list);
    });
    return map;
  }, [filteredEvents]);

  // Statistics for user's planned events
  const stats = useMemo(() => {
    const total = events.length;
    const totalMinutesBooked = events.reduce((acc, curr) => acc + curr.durationMinutes, 0);

    const todayKey = formatDateKey(new Date());
    const upcoming = events
      .filter(e => e.date >= todayKey)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

    const nextEvent = upcoming[0] || null;

    return {
      totalEvents: total,
      upcomingCount: upcoming.length,
      hoursBooked: (totalMinutesBooked / 60).toFixed(1),
      nextEvent
    };
  }, [events]);

  const handleOpenEventDetails = (evt: CalendarEvent) => {
    setSelectedEvent(evt);
    setIsDetailsModalOpen(true);
  };

  const handleQuickAddOnDate = (dateKey: string) => {
    setPlanInitialDate(dateKey);
    setIsCreateModalOpen(true);
  };

  // Export all user's planned events to ICS
  const handleExportAllPlanned = () => {
    if (events.length === 0) {
      onShowToast?.('No planned events to export yet. Click "+ Plan New Event" first!');
      return;
    }
    events.forEach(e => downloadIcsFile(e));
    onShowToast?.(`Exported ${events.length} planned events to calendar!`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-5 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#161D27] p-5 rounded-xl border border-slate-200 dark:border-[#293342] shadow-xs dark:shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/30 flex items-center justify-center text-indigo-600 dark:text-[#6485F5]">
              <CalendarDays className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border border-[#6485F5]/30">
              {t('events.badge', uiLang)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            {t('events.title', uiLang)}
          </h1>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleExportAllPlanned}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer"
            title={t('events.exportIcs', uiLang)}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('events.exportIcs', uiLang)}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPlanInitialDate(selectedDateKey);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-medium border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('events.planEvent', uiLang)}</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards for User's Planned Events */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-3.5 sm:p-4 rounded-xl flex items-center gap-3 shadow-xs dark:shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/25 flex items-center justify-center text-indigo-600 dark:text-[#6485F5] shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] block">{t('events.statTotal', uiLang)}</span>
            <span className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-[#F0F2F5] tabular-nums">{stats.totalEvents}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-3.5 sm:p-4 rounded-xl flex items-center gap-3 shadow-xs dark:shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] block">{t('events.statUpcoming', uiLang)}</span>
            <span className="text-lg sm:text-xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{t('events.plannedCount', uiLang, { count: stats.upcomingCount })}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-3.5 sm:p-4 rounded-xl flex items-center gap-3 shadow-xs dark:shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] block">{t('events.statTime', uiLang)}</span>
            <span className="text-lg sm:text-xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{t('events.hrs', uiLang, { hours: stats.hoursBooked })}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-3.5 sm:p-4 rounded-xl flex items-center gap-3 shadow-xs dark:shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] block">{t('events.statNext', uiLang)}</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] truncate block">
              {stats.nextEvent ? `${stats.nextEvent.flag} ${stats.nextEvent.title}` : t('events.noneYet', uiLang)}
            </span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-4 rounded-xl space-y-3 shadow-xs dark:shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Calendar Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] hover:border-slate-400 dark:hover:border-[#3A4A6D] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer"
              aria-label={t('events.prevMonth', uiLang)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleGoToday}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] hover:border-slate-400 dark:hover:border-[#3A4A6D] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] text-xs font-medium transition-colors cursor-pointer"
            >
              {t('events.today', uiLang)}
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] hover:border-slate-400 dark:hover:border-[#3A4A6D] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer"
              aria-label={t('events.nextMonth', uiLang)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-[#F0F2F5] ml-1">
              {monthName} <span className="text-slate-500 dark:text-[#9BA6B2] font-normal">{year}</span>
            </h2>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#10151D] p-1 rounded-lg border border-slate-200 dark:border-[#293342]">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('events.monthView', uiLang)}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'agenda'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('events.agendaView', uiLang)}
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200 dark:border-[#293342]">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('events.searchPlaceholder', uiLang)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          {/* Language Filter */}
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer transition-colors"
          >
            <option value="all" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🌍 {t('events.allLanguages', uiLang)}</option>
            {supportedLanguages.map(l => (
              <option key={l.code} value={l.code} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                {l.flag} {localizeLanguageName(l.name, uiLang)}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer transition-colors"
          >
            <option value="all" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🏷️ {t('events.allCategories', uiLang)}</option>
            <option value="speaking-club" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">💬 {t('events.catSpeaking', uiLang)}</option>
            <option value="1-on-1-exchange" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">👥 {t('events.catTandem', uiLang)}</option>
            <option value="grammar-workshop" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">📖 {t('events.catGrammar', uiLang)}</option>
            <option value="cultural-night" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🍷 {t('events.catCultural', uiLang)}</option>
            <option value="exam-prep" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🏆 {t('events.catExam', uiLang)}</option>
            <option value="trivia-games" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">✨ {t('events.catTrivia', uiLang)}</option>
          </select>

          {/* Time Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#10151D] p-1 rounded-lg border border-slate-200 dark:border-[#293342]">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`flex-1 py-1 rounded-md text-[11px] font-medium text-center transition-colors cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('events.filterAllPlanned', uiLang, { count: events.length })}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('upcoming')}
              className={`flex-1 py-1 rounded-md text-[11px] font-medium text-center transition-colors cursor-pointer ${
                timeFilter === 'upcoming'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('events.filterUpcoming', uiLang, { count: stats.upcomingCount })}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('this-week')}
              className={`flex-1 py-1 rounded-md text-[11px] font-medium text-center transition-colors cursor-pointer ${
                timeFilter === 'this-week'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('events.filterNext7Days', uiLang)}
            </button>
          </div>
        </div>
      </div>

      {/* Main Calendar Month View */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl shadow-xs dark:shadow-sm overflow-hidden">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D] text-center py-2.5 text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] uppercase tracking-wider">
            {weekdayHeaders.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-[#293342] bg-transparent">
            {calendarDays.map((day, idx) => {
              const dayEvents = eventsByDate.get(day.dateKey) || [];
              const isSelected = day.dateKey === selectedDateKey;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  className={`min-h-[105px] sm:min-h-[125px] p-1.5 sm:p-2 transition-colors relative group cursor-pointer ${
                    !day.isCurrentMonth
                      ? 'bg-slate-50 dark:bg-[#10151D] opacity-55 dark:opacity-45 hover:opacity-85 dark:hover:opacity-80'
                      : 'hover:bg-slate-50 dark:hover:bg-[#1B2430]'
                  } ${isSelected ? 'ring-1 ring-[#6485F5] ring-inset bg-[#6485F5]/10' : ''}`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center tabular-nums ${
                        day.isToday
                          ? 'bg-[#6485F5] text-white'
                          : day.isCurrentMonth
                          ? 'text-slate-800 dark:text-[#F0F2F5]'
                          : 'text-slate-400 dark:text-[#9BA6B2]'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Quick Add Button on Hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAddOnDate(day.dateKey);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-slate-100 dark:bg-[#1B2430] hover:bg-[#6485F5] text-slate-600 dark:text-[#9BA6B2] hover:text-white border border-slate-300 dark:border-[#293342] transition-colors cursor-pointer"
                      title={t('events.planOnDateTitle', uiLang)}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Event Chips (strictly user-planned) */}
                  <div className="space-y-1 overflow-y-auto max-h-[90px]">
                    {dayEvents.slice(0, 3).map(evt => {
                      const colorMap: Record<string, string> = {
                        indigo: 'bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border-[#6485F5]/35 hover:border-[#6485F5]/60',
                        emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 hover:border-emerald-500/60 dark:hover:border-emerald-400/60',
                        amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 hover:border-amber-500/60 dark:hover:border-amber-400/60',
                        rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35 hover:border-rose-500/60 dark:hover:border-rose-400/60',
                        purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35 hover:border-purple-500/60 dark:hover:border-purple-400/60',
                        cyan: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/35 hover:border-cyan-500/60 dark:hover:border-cyan-400/60'
                      };
                      const themeClass = colorMap[evt.colorTheme || 'indigo'];

                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEventDetails(evt);
                          }}
                          className={`px-1.5 py-1 rounded-md border text-[10px] font-medium leading-tight truncate flex items-center gap-1 transition-colors cursor-pointer ${themeClass}`}
                        >
                          <span className="shrink-0">{evt.flag}</span>
                          <span className="font-semibold tabular-nums">{evt.startTime}</span>
                          <span className="truncate">{evt.title}</span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-slate-600 dark:text-[#9BA6B2] font-medium block text-center">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Date Focus Row (Below Month View) */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-6 shadow-xs dark:shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-[#293342]">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2 flex-wrap">
                <span>{t('events.sessionsFor', uiLang)}</span>
                <span className="text-indigo-600 dark:text-[#6485F5]">
                  {new Date(selectedDateKey + 'T12:00:00').toLocaleDateString(localeCode, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] font-medium border border-[#6485F5]/30">
                  {t('events.plannedCount', uiLang, { count: (eventsByDate.get(selectedDateKey) || []).length })}
                </span>
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleQuickAddOnDate(selectedDateKey)}
              className="text-xs font-medium text-indigo-600 dark:text-[#6485F5] hover:text-indigo-700 dark:hover:text-[#9278D8] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('events.planForDate', uiLang)}
            </button>
          </div>

          {(eventsByDate.get(selectedDateKey) || []).length === 0 ? (
            <div className="py-8 text-center text-slate-600 dark:text-[#9BA6B2] text-xs">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-[#9BA6B2]" />
              <p>{t('events.noDateEvents', uiLang)}</p>
              <button
                type="button"
                onClick={() => handleQuickAddOnDate(selectedDateKey)}
                className="mt-2.5 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-xs font-medium cursor-pointer transition-colors"
              >
                + {t('events.planForDayBtn', uiLang)}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(eventsByDate.get(selectedDateKey) || []).map(evt => (
                <div
                  key={evt.id}
                  onClick={() => handleOpenEventDetails(evt)}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] hover:bg-slate-100 dark:hover:bg-[#1B2430] transition-colors cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{evt.flag}</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5]">
                          {evt.cefrLevel}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border border-[#6485F5]/30">
                          {t('events.plannedByYou', uiLang)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-indigo-700 dark:text-[#9278D8] flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3 text-indigo-600 dark:text-[#6485F5]" />
                        {evt.startTime} ({evt.durationMinutes}m)
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] group-hover:text-indigo-600 dark:group-hover:text-[#9278D8] transition-colors line-clamp-1">
                      {evt.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] mt-1 line-clamp-2">
                      {evt.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-[#293342] text-xs">
                    <span className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
                      {t('events.capacity', uiLang, { count: evt.maxAttendees })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {evt.roomId && onJoinRoom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onJoinRoom(evt.roomId!);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" />
                          <span>{t('events.startRoom', uiLang)}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(evt.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        aria-label={t('events.deleteEventBtn', uiLang)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agenda / List View: Strictly My Planned Events */}
      {viewMode === 'agenda' && (
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl text-slate-600 dark:text-[#9BA6B2] text-xs shadow-xs dark:shadow-sm">
              <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-slate-400 dark:text-[#9BA6B2]" />
              <p className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] mb-1">{t('events.noEventsAgenda', uiLang)}</p>
              <p>{t('events.noEventsDesc', uiLang)}</p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-medium border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer"
              >
                + {t('events.planEvent', uiLang)}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map(evt => {
                const eventDate = new Date(evt.date + 'T12:00:00');
                const dateHeader = eventDate.toLocaleDateString(localeCode, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div
                    key={evt.id}
                    onClick={() => handleOpenEventDetails(evt)}
                    className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group shadow-xs dark:shadow-sm"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] flex flex-col items-center justify-center shrink-0">
                        <span className="text-lg leading-none">{evt.flag}</span>
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-[#9BA6B2] uppercase mt-0.5">
                          {evt.languageCode}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium text-indigo-700 dark:text-[#9278D8] flex items-center gap-1 tabular-nums">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {dateHeader} · {evt.startTime}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1B2430] text-slate-700 dark:text-[#F0F2F5] border border-slate-200 dark:border-[#293342]">
                            {evt.cefrLevel}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border border-[#6485F5]/30">
                            {t('events.plannedByYou', uiLang)}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-[#9BA6B2]">
                            • {evt.durationMinutes} {t('common.min', uiLang)}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F0F2F5] group-hover:text-indigo-600 dark:group-hover:text-[#9278D8] transition-colors">
                          {evt.title}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-1 line-clamp-2 max-w-2xl">
                          {evt.description}
                        </p>

                        {/* Topics tags */}
                        {evt.topics && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {evt.topics.slice(0, 3).map((tItem, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 dark:bg-[#10151D] text-slate-600 dark:text-[#9BA6B2] border border-slate-200 dark:border-[#293342]">
                                {tItem}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-[#293342]">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        {t('events.hostYou', uiLang)}
                      </span>

                      <div className="flex items-center gap-2">
                        {evt.roomId && onJoinRoom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJoinRoom(evt.roomId!);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-medium flex items-center gap-1 cursor-pointer border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>{t('events.startSession', uiLang)}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(evt.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          aria-label={t('events.deleteEventBtn', uiLang)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSaveEvent={handleCreateEvent}
        supportedLanguages={supportedLanguages}
        currentLanguage={selectedLanguage}
        userProfile={userProfile}
        initialDate={planInitialDate}
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={isDetailsModalOpen}
        nativeLanguage={userProfile.nativeLanguage}
        onClose={() => setIsDetailsModalOpen(false)}
        onToggleRsvp={handleToggleRsvp}
        onDeleteEvent={handleDeleteEvent}
        onJoinRoom={onJoinRoom}
      />
    </div>
  );
};
