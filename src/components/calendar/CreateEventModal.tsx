import React, { useState } from 'react';
import { CalendarEvent, EventCategory, CEFRLevel, LanguageInfo, UserProfile } from '../../types';
import { formatDateKey } from '../../data/calendarEventsData';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Sparkles, 
  Globe2, 
  Tag, 
  CheckCircle2, 
  Plus, 
  Trash2,
  BookOpen,
  MessageSquare,
  Award,
  Video
} from 'lucide-react';
import { localizeLanguageName, t } from '../../services/uiLocalization';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEvent: (event: CalendarEvent) => void;
  supportedLanguages: LanguageInfo[];
  currentLanguage: LanguageInfo;
  userProfile: UserProfile;
  initialDate?: string;
}

const CATEGORIES: { id: EventCategory; label: string; icon: any; color: string; desc: string }[] = [
  { id: 'speaking-club', label: 'Speaking Club', icon: MessageSquare, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30', desc: 'Group conversation & free speaking' },
  { id: '1-on-1-exchange', label: '1-on-1 Practice', icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', desc: 'Direct language tandem pair' },
  { id: 'grammar-workshop', label: 'Grammar Workshop', icon: BookOpen, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', desc: 'Deep dive into grammar & case rules' },
  { id: 'cultural-night', label: 'Cultural Night', icon: Globe2, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', desc: 'Cuisine, films, travel & traditions' },
  { id: 'exam-prep', label: 'Exam Sprint', icon: Award, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', desc: 'DELE, Goethe, JLPT, HSK, TOEFL prep' },
  { id: 'trivia-games', label: 'Language Trivia', icon: Sparkles, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30', desc: 'Vocabulary games and quiz competition' },
];

const PRESETS = [
  {
    title: 'Weekend Speaking & Coffee Cafe',
    category: 'speaking-club' as EventCategory,
    level: 'B1' as CEFRLevel,
    duration: 60,
    topics: ['Weekend routines', 'Favorite local spots', 'Food & cooking habits'],
    description: 'Casual speaking session to practice conversational flow and storytelling. All accents and learners welcome!'
  },
  {
    title: 'Target Grammar & Common Traps Clinic',
    category: 'grammar-workshop' as EventCategory,
    level: 'A2' as CEFRLevel,
    duration: 45,
    topics: ['Preposition rules', 'Word order traps', 'Correct pronunciation of tricky phonemes'],
    description: 'Interactive grammar drill session. We will break down confusing rules and test ourselves with rapid sentence exercises.'
  },
  {
    title: 'Exam Speaking Task Mock Simulation',
    category: 'exam-prep' as EventCategory,
    level: 'B2' as CEFRLevel,
    duration: 60,
    topics: ['Presentation structure', 'Formal connectors', 'Timed spontaneous response'],
    description: 'Timed speaking practice structured like official certification oral exams. Get constructive feedback from peers!'
  }
];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSaveEvent,
  supportedLanguages,
  currentLanguage,
  userProfile,
  initialDate
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLangCode, setSelectedLangCode] = useState(currentLanguage.code);
  const [category, setCategory] = useState<EventCategory>('speaking-club');
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel | 'All Levels'>('B1');
  const [date, setDate] = useState(initialDate || formatDateKey(new Date()));
  const [startTime, setStartTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxAttendees, setMaxAttendees] = useState(12);
  const [topicInput, setTopicInput] = useState('');
  const [topics, setTopics] = useState<string[]>(['Spontaneous conversation', 'Pronunciation rhythm', 'Everyday vocabulary']);
  const [colorTheme, setColorTheme] = useState<'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan'>('indigo');
  const [linkToRoom, setLinkToRoom] = useState(true);

  if (!isOpen) return null;

  const localizedCategoryLabel = (id: EventCategory): string => {
    switch (id) {
      case 'speaking-club': return t('events.catSpeaking', uiLang);
      case '1-on-1-exchange': return t('events.catTandem', uiLang);
      case 'grammar-workshop': return t('events.catGrammar', uiLang);
      case 'cultural-night': return t('events.catCultural', uiLang);
      case 'exam-prep': return t('events.catExam', uiLang);
      case 'trivia-games': return t('events.catTrivia', uiLang);
      default: return id;
    }
  };

  const currentLangObj = supportedLanguages.find(l => l.code === selectedLangCode) || currentLanguage;

  const handleAddTopic = () => {
    if (topicInput.trim() && !topics.includes(topicInput.trim())) {
      setTopics([...topics, topicInput.trim()]);
      setTopicInput('');
    }
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    setTopics(topics.filter((_, i) => i !== indexToRemove));
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setTitle(`${currentLangObj.name} ${preset.title}`);
    setCategory(preset.category);
    setCefrLevel(preset.level);
    setDurationMinutes(preset.duration);
    setTopics(preset.topics);
    setDescription(preset.description);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Calculate end time
    const [startH, startM] = startTime.split(':').map(Number);
    const startTotal = (startH || 18) * 60 + (startM || 0);
    const endTotal = startTotal + durationMinutes;
    const endH = Math.floor((endTotal / 60) % 24);
    const endM = endTotal % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const newEvent: CalendarEvent = {
      id: 'event_' + Date.now(),
      title: title.trim(),
      description: description.trim() || `Join our ${currentLangObj.name} exchange event to practice speaking and learn with peers!`,
      languageCode: currentLangObj.code,
      languageName: currentLangObj.name,
      flag: currentLangObj.flag,
      category,
      cefrLevel,
      date,
      startTime,
      endTime,
      durationMinutes,
      hostName: userProfile.name || 'You (Host)',
      hostAvatar: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      hostIsNative: false,
      maxAttendees,
      attendeesCount: 1,
      isUserAttending: true,
      isUserHost: true,
      roomId: linkToRoom ? `room-${currentLangObj.code}` : undefined,
      topics: topics.length > 0 ? topics : ['Language Exchange', 'Conversational Practice'],
      colorTheme,
      reminderSet: true
    };

    onSaveEvent(newEvent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#293342] bg-slate-50 dark:bg-[#10151D]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/30 flex items-center justify-center text-indigo-600 dark:text-[#6485F5]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                {t('events.createModalTitle', uiLang)}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#6485F5]/15 text-indigo-700 dark:text-[#9278D8] border border-[#6485F5]/30">
                  {t('events.newSessionBadge', uiLang)}
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">{t('events.createSub', uiLang)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', uiLang)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-200/60 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="px-6 py-2.5 bg-slate-100/80 dark:bg-[#10151D]/80 border-b border-slate-200 dark:border-[#293342] flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-600 dark:text-[#9BA6B2] font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            {t('events.quickPresets', uiLang)}
          </span>
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#1B2430] hover:bg-slate-50 dark:hover:bg-[#232F3F] hover:border-slate-400 dark:hover:border-[#293342] border border-slate-300 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-all whitespace-nowrap cursor-pointer text-[11px]"
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('events.eventTitle', uiLang)}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('events.eventTitle', uiLang)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none transition-all"
            />
          </div>

          {/* Language & CEFR Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                {t('events.targetLanguage', uiLang)}
              </label>
              <select
                value={selectedLangCode}
                onChange={(e) => setSelectedLangCode(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none cursor-pointer"
              >
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                    {lang.flag} {localizeLanguageName(lang.name, uiLang)} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                {t('events.targetCefr', uiLang)}
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none cursor-pointer"
              >
                <option value="All Levels" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('common.allLevels', uiLang)}</option>
                <option value="A1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A1</option>
                <option value="A2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A2</option>
                <option value="B1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B1</option>
                <option value="B2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B2</option>
                <option value="C1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">C1</option>
                <option value="C2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">C2</option>
              </select>
            </div>
          </div>

          {/* Event Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('events.categoryLabel', uiLang)}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-[#6485F5]/10 dark:bg-[#6485F5]/15 border-[#6485F5] ring-1 ring-[#6485F5]/40'
                        : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600 dark:text-[#6485F5]' : 'text-slate-500 dark:text-[#9BA6B2]'}`} />
                      <span className={`text-xs font-semibold ${isSelected ? 'text-slate-900 dark:text-[#F0F2F5]' : 'text-slate-700 dark:text-[#F0F2F5]'}`}>
                        {localizedCategoryLabel(cat.id)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                {t('events.dateLabel', uiLang)}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                {t('events.timeLabel', uiLang)}
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                {t('events.durationLabel', uiLang)}
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none cursor-pointer"
              >
                <option value={15} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">15 {t('common.min', uiLang)}</option>
                <option value={30} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">30 {t('common.min', uiLang)}</option>
                <option value={45} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">45 {t('common.min', uiLang)}</option>
                <option value={60} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">60 {t('common.min', uiLang)}</option>
                <option value={75} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">75 {t('common.min', uiLang)}</option>
                <option value={90} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">90 {t('common.min', uiLang)}</option>
              </select>
            </div>
          </div>

          {/* Max Attendees & Link to Room */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                  {t('events.maxParticipants', uiLang)}
                </span>
                <span className="text-indigo-600 dark:text-[#6485F5] font-bold tabular-nums">{t('events.peopleCount', uiLang, { count: maxAttendees })}</span>
              </label>
              <input
                type="range"
                min={2}
                max={50}
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(Number(e.target.value))}
                className="w-full accent-[#6485F5] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-[#9BA6B2] mt-0.5 font-mono tabular-nums">
                <span>2</span>
                <span>12</span>
                <span>50</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] cursor-pointer hover:border-slate-300 dark:hover:border-[#293342] transition-colors">
                <input
                  type="checkbox"
                  checked={linkToRoom}
                  onChange={(e) => setLinkToRoom(e.target.checked)}
                  className="rounded border-slate-300 dark:border-[#293342] text-[#6485F5] focus:ring-[#6485F5] accent-[#6485F5] w-4 h-4 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {t('events.autoLinkRoom', uiLang, { lang: localizeLanguageName(currentLangObj.name, uiLang) })}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-[#9BA6B2] block">{t('events.autoLinkSub', uiLang)}</span>
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('events.descriptionAgenda', uiLang)}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('events.notesLabel', uiLang)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Topics & Talking Points */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                {t('events.talkingPoints', uiLang)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#9BA6B2] font-mono tabular-nums">{t('events.addedCount', uiLang, { count: topics.length })}</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                placeholder={t('events.notesLabel', uiLang)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('events.addBtn', uiLang)}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((tItem, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#6485F5]/10 border border-[#6485F5]/25 text-indigo-700 dark:text-[#9278D8] text-[11px] font-medium"
                >
                  {tItem}
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(idx)}
                    className="text-indigo-600 dark:text-[#6485F5] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Color Tag */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] mb-1.5">
              {t('events.colorTag', uiLang)}
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'indigo', bg: 'bg-indigo-500' },
                { id: 'emerald', bg: 'bg-emerald-500' },
                { id: 'amber', bg: 'bg-amber-500' },
                { id: 'rose', bg: 'bg-rose-500' },
                { id: 'purple', bg: 'bg-purple-500' },
                { id: 'cyan', bg: 'bg-cyan-500' },
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorTheme(c.id as any)}
                  className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                    colorTheme === c.id ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#161D27] scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {colorTheme === c.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-[#293342]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('common.cancel', uiLang)}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('events.publishEventBtn', uiLang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
