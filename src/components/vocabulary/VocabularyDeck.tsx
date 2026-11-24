import React, { useState } from 'react';
import {
  Volume2,
  Check,
  Plus,
  Trash2,
  Layers,
  Search,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { CEFRLevel, VocabularyWord } from '../../types';
import { validateCustomVocabInput } from '../../services/drillEvaluation';
import { localizeLanguageName, normalizeNativeLanguage, t } from '../../services/uiLocalization';

interface VocabularyDeckProps {
  vocabulary: VocabularyWord[];
  defaultLanguage?: string;
  nativeLanguage?: string;
  onToggleMastered: (id: string) => void;
  onDeleteWord: (id: string) => void;
  onAddWord: (word: Partial<VocabularyWord>) => void;
}

type VocabStatusFilter = 'all' | 'my-words' | 'needs-review' | 'mastered';

const DECK_LANGUAGES = [
  'English',
  'German',
  'Spanish',
  'French',
  'Italian',
  'Japanese',
  'Mandarin',
  'Portuguese'
];

export const VocabularyDeck: React.FC<VocabularyDeckProps> = ({
  vocabulary,
  defaultLanguage = 'English',
  nativeLanguage,
  onToggleMastered,
  onDeleteWord,
  onAddWord
}) => {
  const uiLang = normalizeNativeLanguage(nativeLanguage);
  const [selectedLang, setSelectedLang] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<VocabStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quizHideMeanings, setQuizHideMeanings] = useState<boolean>(false);
  const [revealedInQuiz, setRevealedInQuiz] = useState<Set<string>>(new Set());

  // Inline custom difficult word form state (minimized by default behind "Add New Word" button)
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newLang, setNewLang] = useState(defaultLanguage || 'English');
  const [newLevel, setNewLevel] = useState<CEFRLevel>('B2');
  const [newSentence, setNewSentence] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const toggleRevealCard = (id: string) => {
    setRevealedInQuiz(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const speak = (text: string, lang: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lower = lang.toLowerCase();
    utterance.lang =
      lower === 'german'
        ? 'de-DE'
        : lower === 'spanish'
          ? 'es-ES'
          : lower === 'french'
            ? 'fr-FR'
            : lower === 'italian'
              ? 'it-IT'
              : lower === 'japanese'
                ? 'ja-JP'
                : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleAddDifficultWord = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateCustomVocabInput(newWord, newMeaning);
    if (!check.valid) {
      setFormError(t('vocab.validationError', uiLang));
      return;
    }

    setFormError(null);
    onAddWord({
      word: newWord.trim(),
      translation: newMeaning.trim(),
      language: newLang,
      contextSentence: newSentence.trim(),
      cefrLevel: newLevel,
      tags: ['My Difficult Words']
    });

    setNewWord('');
    setNewMeaning('');
    setNewSentence('');
  };

  const filteredWords = vocabulary.filter(w => {
    if (selectedLang !== 'all' && w.language.toLowerCase() !== selectedLang.toLowerCase()) {
      return false;
    }
    if (statusFilter === 'my-words' && !w.tags?.includes('My Difficult Words')) {
      return false;
    }
    if (statusFilter === 'needs-review' && w.mastered) {
      return false;
    }
    if (statusFilter === 'mastered' && !w.mastered) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        w.word.toLowerCase().includes(q) ||
        w.translation.toLowerCase().includes(q) ||
        (w.contextSentence || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const masteredCount = filteredWords.filter(w => w.mastered).length;
  const customCount = vocabulary.filter(w => w.tags?.includes('My Difficult Words')).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            {t('vocab.title', uiLang)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            data-testid="toggle-add-word-btn"
            onClick={() => setIsAddFormOpen(prev => !prev)}
            aria-expanded={isAddFormOpen}
            aria-controls="add-difficult-word-panel"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isAddFormOpen
                ? 'bg-slate-200 dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border-slate-300 dark:border-[#293342]'
                : 'bg-[#6485F5] hover:bg-[#7593F7] text-white border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Word</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuizHideMeanings(prev => !prev);
              setRevealedInQuiz(new Set());
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              quizHideMeanings
                ? 'bg-[#6485F5] hover:bg-[#7593F7] text-white border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)]'
                : 'bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5] border-slate-300 dark:border-[#293342]'
            }`}
          >
            {quizHideMeanings ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>
              {quizHideMeanings
                ? t('vocab.showAllMeanings', uiLang)
                : t('vocab.quizHideMeanings', uiLang)}
            </span>
          </button>
        </div>
      </div>

      {/* Add Difficult Word & Meaning Creator Card (revealed only when "Add New Word" is clicked) */}
      {isAddFormOpen && (
      <form
        id="add-difficult-word-panel"
        onSubmit={handleAddDifficultWord}
        data-testid="add-difficult-word-form"
        noValidate
        className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-6 shadow-xs dark:shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-500 dark:text-[#9BA6B2]" />
            <span>{t('vocab.addFormTitle', uiLang)}</span>
          </h2>
          <button
            type="button"
            data-testid="minimize-add-word-btn"
            onClick={() => setIsAddFormOpen(false)}
            aria-label="Minimize Add New Word form"
            title="Minimize"
            className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label
              htmlFor="vocab-word-input"
              className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5"
            >
              {t('vocab.wordInputLabel', uiLang)}
            </label>
            <input
              id="vocab-word-input"
              type="text"
              value={newWord}
              onChange={(e) => {
                setNewWord(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={t('vocab.wordPlaceholder', uiLang)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          <div className="md:col-span-5">
            <label
              htmlFor="vocab-meaning-input"
              className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5"
            >
              {t('vocab.meaningInputLabel', uiLang)}
            </label>
            <input
              id="vocab-meaning-input"
              type="text"
              value={newMeaning}
              onChange={(e) => {
                setNewMeaning(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={t('vocab.meaningPlaceholder', uiLang)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="vocab-language-select"
              className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5"
            >
              {t('vocab.languageLabel', uiLang)}
            </label>
            <select
              id="vocab-language-select"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer transition-colors"
            >
              {DECK_LANGUAGES.map((lang) => (
                <option key={lang} value={lang} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                  {localizeLanguageName(lang, uiLang)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label
              htmlFor="vocab-level-select"
              className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5"
            >
              {t('vocab.levelLabel', uiLang)}
            </label>
            <select
              id="vocab-level-select"
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value as CEFRLevel)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-2.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer transition-colors"
            >
              <option value="A2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A2</option>
              <option value="B1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B1</option>
              <option value="B2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B2</option>
              <option value="C1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">C1</option>
              <option value="C2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">C2</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="vocab-sentence-input"
              className="block text-xs font-medium text-slate-600 dark:text-[#9BA6B2] mb-1.5"
            >
              {t('vocab.exampleLabel', uiLang)}
            </label>
            <input
              id="vocab-sentence-input"
              type="text"
              value={newSentence}
              onChange={(e) => setNewSentence(e.target.value)}
              placeholder={t('vocab.examplePlaceholder', uiLang)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          <button
            type="submit"
            data-testid="save-difficult-word-btn"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-medium text-xs sm:text-sm border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t('vocab.addWordBtn', uiLang)}</span>
          </button>
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}
      </form>
      )}

      {/* Filter, Search & Progress Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-4 shadow-xs dark:shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-[#10151D] p-1 rounded-lg border border-slate-200 dark:border-[#293342] text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none' : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('vocab.filterAll', uiLang, { count: vocabulary.length })}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('my-words')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'my-words'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('vocab.filterMyDifficultWords', uiLang, { count: customCount })}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('needs-review')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'needs-review'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('vocab.filterNeedsReview', uiLang)}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('mastered')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'mastered'
                  ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
              }`}
            >
              {t('vocab.filterMastered', uiLang)}
            </button>
          </div>

          <select
            aria-label={t('vocab.languageLabel', uiLang)}
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium px-3 py-2 rounded-lg focus:outline-none focus:border-[#6485F5] cursor-pointer transition-colors"
          >
            <option value="all" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('vocab.allLanguages', uiLang)}</option>
            {DECK_LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                {localizeLanguageName(lang, uiLang)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label={t('vocab.searchPlaceholder', uiLang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('vocab.searchPlaceholder', uiLang)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#9BA6B2] tabular-nums">
            <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-[#9BA6B2]" />
            <span>
              {t('vocab.masteredLabel', uiLang)}{' '}
              <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">{masteredCount}</strong>/{filteredWords.length}
            </span>
          </div>
        </div>
      </div>

      {/* Vocabulary Cards Grid */}
      {filteredWords.length === 0 ? (
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-10 text-center space-y-2 shadow-xs dark:shadow-none">
          <p className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5]">{t('vocab.emptyFilteredTitle', uiLang)}</p>
          <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
            {t('vocab.emptyFilteredDesc', uiLang)}
          </p>
        </div>
      ) : (
        <div
          data-testid="vocab-cards-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredWords.map(word => {
            const isMeaningVisible = !quizHideMeanings || revealedInQuiz.has(word.id);

            return (
              <div
                key={word.id}
                data-testid="vocab-word-card"
                className="rounded-xl p-5 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] transition-colors flex flex-col justify-between gap-4 shadow-xs dark:shadow-sm"
              >
                {/* Top Meta & Actions */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9BA6B2]">
                    <span className="font-medium text-slate-800 dark:text-[#F0F2F5]">
                      {localizeLanguageName(word.language, uiLang)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{word.cefrLevel}</span>
                    {word.tags?.[0] && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-[#9BA6B2] truncate max-w-[110px]">{word.tags[0]}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => speak(word.word, word.language)}
                      className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#232F3F] cursor-pointer transition-colors"
                      aria-label={`${t('common.pronounce', uiLang)} ${word.word}`}
                      title={t('common.pronounce', uiLang)}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleMastered(word.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        word.mastered
                          ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/25'
                          : 'text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#232F3F]'
                      }`}
                      aria-label={
                        word.mastered
                          ? t('vocab.needsReview', uiLang)
                          : t('vocab.markMastered', uiLang)
                      }
                      title={
                        word.mastered
                          ? t('vocab.mastered', uiLang)
                          : t('vocab.markMastered', uiLang)
                      }
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteWord(word.id)}
                      className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      aria-label={`Delete ${word.word}`}
                      title={t('common.clear', uiLang)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Word & Meaning Body */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-[#F0F2F5] tracking-tight">{word.word}</h3>

                  {isMeaningVisible ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
                        {word.translation}
                      </p>
                      {word.contextSentence && (
                        <p className="text-xs text-slate-700 dark:text-[#F0F2F5] italic bg-slate-50 dark:bg-[#10151D] p-2.5 rounded-lg border border-slate-200 dark:border-[#293342]">
                          &ldquo;{word.contextSentence}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleRevealCard(word.id)}
                      className="w-full py-3 px-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-dashed border-slate-300 dark:border-[#293342] text-xs font-medium text-slate-700 dark:text-[#F0F2F5] hover:border-slate-400 dark:hover:border-[#3A4A6D] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer transition-colors"
                    >
                      {t('vocab.revealMeaningBtn', uiLang)}
                    </button>
                  )}
                </div>

                {/* Footer Status */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9BA6B2] pt-2.5 border-t border-slate-200 dark:border-[#293342]">
                  <span>{word.mastered ? t('vocab.mastered', uiLang) : t('vocab.needsReview', uiLang)}</span>
                  {quizHideMeanings && isMeaningVisible && (
                    <button
                      type="button"
                      onClick={() => toggleRevealCard(word.id)}
                      className="text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer transition-colors"
                    >
                      {t('vocab.hideBtn', uiLang)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
