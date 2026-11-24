import React, { useState } from 'react';
import { 
  Globe2, 
  ArrowRight, 
  Check, 
  Sparkles, 
  Target, 
  GraduationCap, 
  Compass,
  MessageSquare
} from 'lucide-react';
import { CEFRLevel, LanguageInfo } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../data/mockData';
import { localizeLanguageName, t } from '../../services/uiLocalization';

interface LanguageOnboardingModalProps {
  onComplete: (language: LanguageInfo, level: CEFRLevel, goal: string) => void;
  nativeLanguage?: string;
}

export const LanguageOnboardingModal: React.FC<LanguageOnboardingModalProps> = ({
  onComplete,
  nativeLanguage
}) => {
  const uiLang = nativeLanguage;
  const [selectedLangCode, setSelectedLangCode] = useState<string>('en');
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>('B1');
  const [selectedGoal, setSelectedGoal] = useState<string>('Conversational Fluency');

  const levels: { level: CEFRLevel; title: string }[] = [
    { level: 'A1', title: 'A1' },
    { level: 'A2', title: 'A2' },
    { level: 'B1', title: 'B1' },
    { level: 'B2', title: 'B2' },
    { level: 'C1', title: 'C1' }
  ];

  const goals = [
    { id: 'Conversational Fluency', label: t('rooms.aiCoach', uiLang), icon: MessageSquare },
    { id: 'Career & Work', label: t('nav.teachers', uiLang), icon: Target },
    { id: 'Travel & Culture', label: t('nav.rooms', uiLang), icon: Compass },
    { id: 'Exam Certification', label: t('nav.aiDrills', uiLang), icon: GraduationCap }
  ];

  const handleStart = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLangCode) || SUPPORTED_LANGUAGES[0];
    onComplete(lang, selectedLevel, selectedGoal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-8 shadow-2xl dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] text-slate-900 dark:text-[#F0F2F5] space-y-6 overflow-hidden">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-[#6485F5]/12 border border-indigo-200 dark:border-[#6485F5]/30 text-indigo-700 dark:text-[#9278D8] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
            <span>{t('auth.welcomeTitle', uiLang)}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F0F2F5]">
            {t('onboarding.title', uiLang)}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2] max-w-md mx-auto">
            {t('onboarding.subtitle', uiLang)}
          </p>
        </div>

        {/* 1. Language Cards Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider block">
            {t('onboarding.step1', uiLang)}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === selectedLangCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLangCode(lang.code)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-[#6485F5]/15 border-[#6485F5] text-slate-900 dark:text-[#F0F2F5]'
                      : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{localizeLanguageName(lang.name, uiLang)}</div>
                    <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2] truncate">{lang.nativeName}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 ml-auto text-indigo-600 dark:text-[#6485F5] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Proficiency Level Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider">
              {t('onboarding.step2', uiLang)}
            </label>
            <span className="text-xs font-semibold text-indigo-600 dark:text-[#9278D8] tabular-nums">
              {selectedLevel}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {levels.map((item) => {
              const isSelected = item.level === selectedLevel;
              return (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => setSelectedLevel(item.level)}
                  className={`py-2 px-1 rounded-lg text-center border transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#6485F5] border-[#6485F5]/50 text-white font-semibold'
                      : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                  }`}
                >
                  <div className="text-xs font-bold">{item.level}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Primary Goal */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider block">
            {t('onboarding.step3', uiLang)}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {goals.map((g) => {
              const isSelected = g.id === selectedGoal;
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGoal(g.id)}
                  className={`p-2.5 rounded-lg border text-center transition-colors duration-150 flex flex-col items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-[#232F3F] border-[#6485F5] text-slate-900 dark:text-[#F0F2F5]'
                      : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-600 dark:text-[#9BA6B2] hover:border-slate-300 dark:hover:border-[#293342] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600 dark:text-[#6485F5]' : 'text-slate-400 dark:text-[#9BA6B2]'}`} />
                  <span className="text-[11px] font-semibold truncate">{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Enter Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-3 px-6 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-sm flex items-center justify-center gap-2 border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors duration-150 active:scale-[0.99] cursor-pointer"
          >
            <span>{t('onboarding.enterBtn', uiLang)}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
