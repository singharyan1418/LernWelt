import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  BookPlus,
  Zap,
  Trophy,
  Lightbulb,
  Check,
  X,
  Volume2,
  Eye,
  RefreshCw,
  Award,
  Flame,
  Globe,
  ExternalLink
} from 'lucide-react';
import { CEFRLevel, DrillType, LanguageInfo, PracticeDrill, UserProfile, UserStreak, VocabularyWord } from '../../types';
import { fetchPracticeDrills } from '../../services/aiService';
import {
  calculateDailyDrillGoalProgress,
  initializeRealUserStreak,
  recordDrillCompletion
} from '../../services/streakService';
import {
  buildMissingWordMask,
  evaluateFillBlankAnswer,
  evaluateGuessMissingWordAnswer,
  evaluateSentenceOrderAnswer,
  filterDistinctDrills,
  filterDrillsByType,
  getDrillComparisonText,
  getPrimaryAnswerString,
  getSeenDrillKeys,
  getSeenDrillPrompts,
  normalizeDrillKey,
  prepareDrillForDisplay,
  recordDrillSeen,
  scrambleSentenceTokens,
  shuffleFillBlankOptions
} from '../../services/drillEvaluation';
import {
  localizeDrillChrome,
  localizeLanguageName,
  normalizeNativeLanguage,
  t
} from '../../services/uiLocalization';

interface PracticeDrillsProps {
  selectedLanguage: LanguageInfo;
  onSaveToVocabDeck: (item: Partial<VocabularyWord>) => void;
  userProfile?: UserProfile;
  userStreak?: UserStreak;
  onDrillCompleted?: (drill: PracticeDrill, xp: number) => void;
  onOpenStreakModal?: () => void;
}

const ROTATING_TOPICS = [
  'Café & Dining Out',
  'City Transit & Travel Adventures',
  'Workplace Conversations & Tech Innovation',
  'Weekend Nature & Outdoor Exploration',
  'Everyday Habits & Healthy Living',
  'Cultural Celebrations & Live Music',
  'Expressing Opinions & Subtle Emotions',
  'Local Markets & Artisan Shopping',
  'Cinema, Books & Storytelling',
  'Casual Gatherings & Making Friends'
];

export const PracticeDrills: React.FC<PracticeDrillsProps> = ({
  selectedLanguage,
  onSaveToVocabDeck,
  userProfile,
  userStreak,
  onDrillCompleted,
  onOpenStreakModal
}) => {
  const userLevel: CEFRLevel =
    userProfile?.targetLanguages?.find(
      (t) => t.language.toLowerCase() === selectedLanguage.name.toLowerCase()
    )?.level ||
    userProfile?.targetLanguages?.[0]?.level ||
    'B1';
  const nativeLanguage = normalizeNativeLanguage(userProfile?.nativeLanguage);
  const targetLangDisplay = localizeLanguageName(selectedLanguage.name, nativeLanguage);
  const [currentStreak, setCurrentStreak] = useState<UserStreak>(() => {
    if (userStreak) return initializeRealUserStreak(userStreak);
    try {
      const saved = localStorage.getItem('lernwelt_real_streak');
      if (saved) return initializeRealUserStreak(JSON.parse(saved));
    } catch {}
    return initializeRealUserStreak();
  });
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  useEffect(() => {
    if (userStreak) {
      setCurrentStreak(initializeRealUserStreak(userStreak));
    }
  }, [userStreak]);

  const todayDrills = currentStreak.todayDrillsCompleted || 0;
  const dailyGoal = currentStreak.dailyDrillGoal || 5;
  const drillProgress = calculateDailyDrillGoalProgress(todayDrills, dailyGoal);

  const handleDrillSuccess = (drill: PracticeDrill, xp: number) => {
    const result = recordDrillCompletion(currentStreak, xp, 2);
    setCurrentStreak(result.streak);
    try {
      localStorage.setItem('lernwelt_real_streak', JSON.stringify(result.streak));
    } catch {}
    if (result.justUnlockedBadge) {
      setShowBadgeCelebration(true);
      setTimeout(() => setShowBadgeCelebration(false), 6000);
    }
    onDrillCompleted?.(drill, xp);
  };

  const [, setSeenKeys] = useState<Set<string>>(() => getSeenDrillKeys());
  const [seenPromptTexts, setSeenPromptTexts] = useState<string[]>(() => getSeenDrillPrompts());
  const [drills, setDrills] = useState<PracticeDrill[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | DrillType>('all');
  const localizedDefaultTopic = t('drills.defaultTopic', nativeLanguage);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingBatch, setIsLoadingBatch] = useState(true);

  // Interactive drill states
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);
  const lastCorrectOptionIndexRef = useRef<number>(-1);
  const isPrefetchingRef = useRef<boolean>(false);
  const inFlightFilterRef = useRef<'all' | DrillType>('all');
  const inFlightPromiseRef = useRef<Promise<number> | null>(null);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef<number>(0);
  const topicCursorRef = useRef<number>(Math.floor(Math.random() * ROTATING_TOPICS.length));
  const drillsRef = useRef<PracticeDrill[]>([]);
  const seenPromptsRef = useRef<string[]>(seenPromptTexts);
  drillsRef.current = drills;
  seenPromptsRef.current = seenPromptTexts;

  const [orderedTokens, setOrderedTokens] = useState<string[]>([]);
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);
  const [typedMissingWord, setTypedMissingWord] = useState<string>('');
  const [revealedLetterCount, setRevealedLetterCount] = useState<number>(0);
  const [accentReminder, setAccentReminder] = useState<string | undefined>(undefined);
  const [resolvedTargetWord, setResolvedTargetWord] = useState<string>('');
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  const pickNextTopic = (customTopic?: string): string => {
    const trimmed = customTopic?.trim();
    if (
      trimmed &&
      trimmed !== 'Daily conversation & travel' &&
      trimmed !== localizedDefaultTopic
    ) {
      return trimmed;
    }
    topicCursorRef.current = (topicCursorRef.current + 1) % ROTATING_TOPICS.length;
    return ROTATING_TOPICS[topicCursorRef.current];
  };

  const markDrillAsSeen = useCallback((drill: PracticeDrill) => {
    const comparison = getDrillComparisonText(drill);
    setSeenKeys((prevKeys) => recordDrillSeen(drill.prompt, prevKeys, comparison));
    setSeenPromptTexts((prevTexts) => {
      const updated = getSeenDrillPrompts();
      const setKeys = new Set(updated.map((p) => normalizeDrillKey(p)));
      const merged = [...updated];
      for (const candidate of [drill.prompt, comparison, ...prevTexts]) {
        const clean = String(candidate || '').trim();
        const k = normalizeDrillKey(clean);
        if (clean && k && !setKeys.has(k)) {
          setKeys.add(k);
          merged.push(clean);
        }
      }
      const sliced = merged.slice(-400);
      seenPromptsRef.current = sliced;
      return sliced;
    });
  }, []);

  const fetchMoreGoogleDrills = useCallback(
    (
      lang: LanguageInfo,
      targetFilter: 'all' | DrillType,
      options: {
        mode?: 'append' | 'prepend' | 'replace';
        customTopic?: string;
        showLoader?: boolean;
        count?: number;
      } = {}
    ): Promise<number> => {
      const { mode = 'append', customTopic, showLoader = false, count = 5 } = options;

      if (
        mode === 'append' &&
        isPrefetchingRef.current &&
        inFlightPromiseRef.current &&
        inFlightFilterRef.current === targetFilter
      ) {
        const activeReqId = requestSeqRef.current;
        if (showLoader) setIsLoadingBatch(true);
        return inFlightPromiseRef.current.finally(() => {
          if (showLoader && requestSeqRef.current === activeReqId) {
            setIsLoadingBatch(false);
          }
        });
      }

      if (mode === 'replace' || (isPrefetchingRef.current && inFlightFilterRef.current !== targetFilter)) {
        activeFetchControllerRef.current?.abort();
        isPrefetchingRef.current = false;
        inFlightPromiseRef.current = null;
      }

      const reqId = ++requestSeqRef.current;
      const controller = new AbortController();
      activeFetchControllerRef.current = controller;
      inFlightFilterRef.current = targetFilter;
      isPrefetchingRef.current = true;
      if (showLoader) setIsLoadingBatch(true);

      const taskPromise = (async (): Promise<number> => {
        try {
          const corpusToAvoid = Array.from(
            new Set([
              ...seenPromptsRef.current,
              ...drillsRef.current.map((d) => d.prompt),
              ...drillsRef.current.map((d) => getDrillComparisonText(d))
            ])
          );
          const queryTopic = pickNextTopic(customTopic);
          const generated = await fetchPracticeDrills(
            lang.name,
            userLevel,
            targetFilter,
            queryTopic,
            corpusToAvoid,
            nativeLanguage,
            { count, signal: controller.signal }
          );

          if (controller.signal.aborted || reqId !== requestSeqRef.current) return 0;

          const langLower = lang.name.toLowerCase();
          const strictlyLang = generated
            .map((d) => prepareDrillForDisplay(d))
            .filter((d) => {
              const dLang = (d.language || '').toLowerCase();
              if (langLower === 'mandarin' || langLower === 'chinese' || langLower === 'zh') {
                return dLang === 'mandarin' || dLang === 'chinese' || dLang === 'zh';
              }
              return dLang === langLower;
            });

          if (mode === 'replace') {
            const distinctInitial = filterDistinctDrills(strictlyLang, seenPromptsRef.current);
            const recentDistinct =
              distinctInitial.length > 0
                ? distinctInitial
                : filterDistinctDrills(strictlyLang, seenPromptsRef.current.slice(-20));
            const finalInitial = recentDistinct.length > 0 ? recentDistinct : strictlyLang;
            drillsRef.current = finalInitial;
            setDrills(finalInitial);
            setCurrentIndex(0);
            return finalInitial.length;
          }

          const currentList = drillsRef.current;
          const currentPrompts = [
            ...currentList.map((p) => p.prompt),
            ...currentList.map((p) => getDrillComparisonText(p))
          ];
          const existingCorpus = [...seenPromptsRef.current, ...currentPrompts];
          const novelStrict = filterDistinctDrills(strictlyLang, existingCorpus);
          const novelRecent =
            novelStrict.length > 0
              ? novelStrict
              : filterDistinctDrills(strictlyLang, [...seenPromptsRef.current.slice(-15), ...currentPrompts]);
          const novel =
            novelRecent.length > 0
              ? novelRecent
              : strictlyLang.filter(
                  (d) => !currentList.some((c) => normalizeDrillKey(c.prompt) === normalizeDrillKey(d.prompt))
                );
          if (novel.length === 0) return 0;

          const nextList = mode === 'prepend' ? [...novel, ...currentList] : [...currentList, ...novel];
          drillsRef.current = nextList;
          setDrills(nextList);
          return novel.length;
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            // Non-fatal; fallback is already handled inside fetchPracticeDrills
          }
          return 0;
        } finally {
          if (reqId === requestSeqRef.current) {
            isPrefetchingRef.current = false;
            inFlightPromiseRef.current = null;
            if (showLoader && !controller.signal.aborted) {
              setIsLoadingBatch(false);
            }
          }
        }
      })();

      inFlightPromiseRef.current = taskPromise;
      return taskPromise;
    },
    [userLevel, nativeLanguage]
  );

  // Whenever user enters AI Drills or switches target language, immediately fetch fresh Google Search-grounded sentences
  useEffect(() => {
    setDrills([]);
    setCurrentIndex(0);
    fetchMoreGoogleDrills(selectedLanguage, activeFilter, {
      mode: 'replace',
      showLoader: true,
      count: 5
    });

    return () => {
      activeFetchControllerRef.current?.abort();
    };
  }, [selectedLanguage.name, userLevel, nativeLanguage]);

  // STRICT LANGUAGE FILTER: Only drills strictly matching the currently selected language
  const languageDrills = useMemo(() => {
    const currentLangLower = selectedLanguage.name.toLowerCase();
    return drills.filter((d) => {
      const dLang = (d.language || '').toLowerCase();
      if (currentLangLower === 'mandarin' || currentLangLower === 'chinese' || currentLangLower === 'zh') {
        return dLang === 'mandarin' || dLang === 'chinese' || dLang === 'zh';
      }
      return dLang === currentLangLower;
    });
  }, [drills, selectedLanguage.name]);

  const filteredDrills = filterDrillsByType(languageDrills, activeFilter);
  const safeIndex =
    filteredDrills.length === 0 ? 0 : Math.min(currentIndex, filteredDrills.length - 1);
  const currentDrill: PracticeDrill | undefined = filteredDrills[safeIndex];
  const localizedDrill = useMemo(
    () => (currentDrill ? localizeDrillChrome(currentDrill, nativeLanguage) : undefined),
    [currentDrill, nativeLanguage]
  );

  const resetDrillState = (drillToInit?: PracticeDrill) => {
    const target = drillToInit ?? currentDrill;
    setSelectedOption(null);
    setTypedMissingWord('');
    setRevealedLetterCount(0);
    setAccentReminder(undefined);
    setResolvedTargetWord('');
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setShowHint(false);

    if (target?.type === 'fill-blank' && Array.isArray(target.options)) {
      const shuffled = shuffleFillBlankOptions(target.options, target.correctAnswer, {
        avoidIndex: lastCorrectOptionIndexRef.current >= 0 ? lastCorrectOptionIndexRef.current : undefined
      });
      setDisplayOptions(shuffled);

      const targetStr = getPrimaryAnswerString(target.correctAnswer).toLowerCase();
      const newPos = shuffled.findIndex((opt) => opt.toLowerCase() === targetStr);
      if (newPos >= 0) {
        lastCorrectOptionIndexRef.current = newPos;
      }
    } else {
      setDisplayOptions([]);
    }

    if (target?.type === 'sentence-ordering') {
      const sourceTokens =
        target.scrambledTokens && target.scrambledTokens.length > 0
          ? target.scrambledTokens
          : Array.isArray(target.correctAnswer)
            ? target.correctAnswer
            : String(target.correctAnswer).split(/\s+/);
      setAvailableTokens(scrambleSentenceTokens(sourceTokens));
      setOrderedTokens([]);
    } else {
      setAvailableTokens([]);
      setOrderedTokens([]);
    }
  };

  useEffect(() => {
    resetDrillState(currentDrill);
  }, [currentDrill?.id, activeFilter]);

  const handleSelectFilter = (nextFilter: 'all' | DrillType) => {
    setActiveFilter(nextFilter);
    setCurrentIndex(0);

    const existingForFilter = filterDrillsByType(languageDrills, nextFilter);
    if (existingForFilter.length === 0) {
      fetchMoreGoogleDrills(selectedLanguage, nextFilter, {
        mode: 'append',
        showLoader: true,
        count: 5
      });
    } else if (existingForFilter.length < 3) {
      fetchMoreGoogleDrills(selectedLanguage, nextFilter, {
        mode: 'append',
        showLoader: false,
        count: 5
      });
    }
  };

  // 1. Fill in the Blank check
  const handleCheckFillBlank = (option: string) => {
    if (!currentDrill || isAnswerChecked) return;
    setSelectedOption(option);
    const correct = evaluateFillBlankAnswer(option, currentDrill.correctAnswer);
    setIsCorrect(correct);
    setIsAnswerChecked(true);
    if (correct) {
      setXpEarned((prev) => prev + 25);
      handleDrillSuccess(currentDrill, 25);
    }
    markDrillAsSeen(currentDrill);
  };

  // 2. Rearrange Words token handlers
  const handleAddToken = (token: string, tokenIndex: number) => {
    if (isAnswerChecked) return;
    setOrderedTokens((prev) => [...prev, token]);
    setAvailableTokens((prev) => prev.filter((_, idx) => idx !== tokenIndex));
  };

  const handleRemoveToken = (token: string, tokenIndex: number) => {
    if (isAnswerChecked) return;
    setOrderedTokens((prev) => prev.filter((_, idx) => idx !== tokenIndex));
    setAvailableTokens((prev) => [...prev, token]);
  };

  const handleCheckSentenceOrder = () => {
    if (!currentDrill || isAnswerChecked || orderedTokens.length === 0) return;
    const correct = evaluateSentenceOrderAnswer(orderedTokens, currentDrill.correctAnswer);
    setIsCorrect(correct);
    setIsAnswerChecked(true);
    if (correct) {
      setXpEarned((prev) => prev + 35);
      handleDrillSuccess(currentDrill, 35);
    }
    markDrillAsSeen(currentDrill);
  };

  // 3. Guess the Missing Word check
  const handleCheckGuessMissingWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDrill || isAnswerChecked || !typedMissingWord.trim()) return;
    const evaluation = evaluateGuessMissingWordAnswer(typedMissingWord, currentDrill.correctAnswer);
    setIsCorrect(evaluation.isCorrect);
    setAccentReminder(evaluation.accentReminder);
    setResolvedTargetWord(evaluation.targetWord);
    setIsAnswerChecked(true);
    if (evaluation.isCorrect) {
      setXpEarned((prev) => prev + 30);
      handleDrillSuccess(currentDrill, 30);
    }
    markDrillAsSeen(currentDrill);
  };

  const handleNextDrill = async () => {
    if (currentDrill) {
      markDrillAsSeen(currentDrill);
    }

    if (safeIndex < filteredDrills.length - 1) {
      const nextIdx = safeIndex + 1;
      setCurrentIndex(nextIdx);
      const remainingAfterNext = filteredDrills.length - 1 - nextIdx;
      if (remainingAfterNext <= 3) {
        fetchMoreGoogleDrills(selectedLanguage, activeFilter, {
          mode: 'append',
          showLoader: false,
          count: 5
        });
      }
      return;
    }

    // Reached the end of buffered drills: fetch (or await in-flight fetch) immediately & advance
    const priorLen = filteredDrills.length;
    const added = await fetchMoreGoogleDrills(selectedLanguage, activeFilter, {
      mode: 'append',
      showLoader: true,
      count: 5
    });
    if (added > 0) {
      setCurrentIndex(priorLen === 0 ? 0 : safeIndex + 1);
    }
  };

  // Generate fresh AI drills directly via Google Search in backend and show immediately
  const handleGenerateAiDrill = async () => {
    if (currentDrill) {
      markDrillAsSeen(currentDrill);
    }
    setIsGenerating(true);
    try {
      const added = await fetchMoreGoogleDrills(selectedLanguage, activeFilter, {
        mode: 'prepend',
        customTopic: localizedDefaultTopic,
        showLoader: false,
        count: 5
      });
      if (added > 0) {
        setCurrentIndex(0);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSpeakPhrase = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang =
      selectedLanguage.code === 'de'
        ? 'de-DE'
        : selectedLanguage.code === 'es'
          ? 'es-ES'
          : selectedLanguage.code === 'fr'
            ? 'fr-FR'
            : 'en-US';
    utt.rate = 0.88;
    window.speechSynthesis.speak(utt);
  };

  const formatDrillTypeLabel = (type: DrillType) => {
    if (type === 'fill-blank') return t('drills.typeLabelFillBlank', nativeLanguage);
    if (type === 'sentence-ordering') return t('drills.typeLabelSentenceOrder', nativeLanguage);
    if (type === 'guess-missing-word') return t('drills.typeLabelGuessMissing', nativeLanguage);
    return t('drills.typeLabelDefault', nativeLanguage);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & AI Drill Generator Bar */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-7 space-y-5 shadow-xs dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
              {t('drills.title', nativeLanguage)}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342]">
              <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2] font-medium">{t('drills.sessionScore', nativeLanguage)}</div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">+{xpEarned} {t('common.xpUnit', nativeLanguage)}</div>
              </div>
            </div>
          </div>
        </div>

        {showBadgeCelebration && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              <div>
                <span className="text-slate-900 dark:text-[#F0F2F5] font-bold">{t('drills.goalCompleted', nativeLanguage)}</span>{' '}
                {t('drills.goalCompletedSub', nativeLanguage)}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider shrink-0 border border-emerald-500/30">
              {t('drills.badgeClaimed', nativeLanguage)}
            </span>
          </div>
        )}

        {/* Daily Drills Goal Progress Bar & Daily Completion Badge */}
        <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-center shrink-0 ${
                  drillProgress.isGoalMet
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
                    : 'bg-[#6485F5]/15 border-[#6485F5]/35 text-indigo-600 dark:text-[#6485F5]'
                }`}
              >
                {drillProgress.isGoalMet ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Flame className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-[#F0F2F5]">
                    {t('drills.dailyGoal', nativeLanguage)}
                  </span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] tabular-nums">
                    {t('drills.drillsToday', nativeLanguage, {
                      done: drillProgress.completedDrills,
                      goal: drillProgress.dailyDrillGoal
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] mt-0.5">
                  {drillProgress.isGoalMet
                    ? t('drills.goalMetDesc', nativeLanguage)
                    : drillProgress.remainingCount === 1
                      ? t('drills.goalRemainingSingle', nativeLanguage)
                      : t('drills.goalRemainingMulti', nativeLanguage, { count: drillProgress.remainingCount })}
                </p>
              </div>
            </div>

            {/* 'Daily Completion' Badge status */}
            <div className="shrink-0 flex items-center gap-2">
              {drillProgress.isGoalMet ? (
                <div
                  data-testid="daily-completion-badge"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                >
                  <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                  <div className="text-left">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {t('drills.goalMet', nativeLanguage)}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-1">
                      <span>{t('drills.dailyCompletion', nativeLanguage)}</span>
                      <span>⭐</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  data-testid="daily-completion-badge-locked"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-600 dark:text-[#9BA6B2]"
                >
                  <Award className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] shrink-0" />
                  <div className="text-left">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9BA6B2]">
                      {t('drills.inProgress', nativeLanguage, { percent: drillProgress.percent })}
                    </div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5]">
                      {t('drills.dailyCompletion', nativeLanguage)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-600 dark:text-[#9BA6B2] text-[11px]">{t('drills.todayProgress', nativeLanguage)}</span>
              <span className={`font-mono font-semibold text-xs tabular-nums ${drillProgress.isGoalMet ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-600 dark:text-[#6485F5]'}`}>
                {t('profile.percentCompleted', nativeLanguage, { percent: drillProgress.percent })}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-[#1B2430] rounded-full overflow-hidden border border-slate-300 dark:border-[#293342]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  drillProgress.isGoalMet
                    ? 'bg-emerald-500'
                    : 'bg-[#6485F5]'
                }`}
                style={{ width: `${drillProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Drills Workbench */}
      <div className="w-full max-w-4xl mx-auto space-y-5">
        {/* Drill Type Filter Tabs & Fresh Sentence Generator */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-xs"
            role="tablist"
            aria-label={t('drills.filterAriaLabel', nativeLanguage)}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'all'}
              onClick={() => handleSelectFilter('all')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-[#6485F5] text-white'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-white dark:hover:bg-[#1B2430]'
              }`}
            >
              {t('drills.filterAll', nativeLanguage, { count: drills.length })}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'fill-blank'}
              onClick={() => handleSelectFilter('fill-blank')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'fill-blank'
                  ? 'bg-[#6485F5] text-white'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-white dark:hover:bg-[#1B2430]'
              }`}
            >
              {t('drills.filterFillBlank', nativeLanguage)}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'sentence-ordering'}
              onClick={() => handleSelectFilter('sentence-ordering')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'sentence-ordering'
                  ? 'bg-[#6485F5] text-white'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-white dark:hover:bg-[#1B2430]'
              }`}
            >
              {t('drills.filterSentenceOrder', nativeLanguage)}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'guess-missing-word'}
              onClick={() => handleSelectFilter('guess-missing-word')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'guess-missing-word'
                  ? 'bg-[#6485F5] text-white'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-white dark:hover:bg-[#1B2430]'
              }`}
            >
              {t('drills.filterGuessMissing', nativeLanguage)}
            </button>
          </div>

          {filteredDrills.length > 0 && (
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                <span>{t('drills.infiniteBadge', nativeLanguage, { lang: targetLangDisplay })}</span>
              </span>
              <span className="text-xs font-mono font-semibold text-slate-700 dark:text-[#F0F2F5] tabular-nums">
                {t('drills.questionNum', nativeLanguage, { num: safeIndex + 1 })}
              </span>
            </div>
          )}
        </div>

          {currentDrill && localizedDrill ? (
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-7 space-y-6 shadow-xs dark:shadow-none">
              {/* Drill Meta Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#293342] pb-3.5">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#9BA6B2] flex-wrap">
                  <span className="font-semibold text-indigo-600 dark:text-[#6485F5]">CEFR {currentDrill.level}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-700 dark:text-[#F0F2F5]">
                    {formatDrillTypeLabel(currentDrill.type)}
                  </span>
                  {currentDrill.groundedByGoogle && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        data-testid="google-grounded-badge"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-semibold"
                        title={t('drills.googleGrounded', nativeLanguage)}
                      >
                        <Globe className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>{t('drills.googleGrounded', nativeLanguage)}</span>
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSpeakPhrase(
                      currentDrill.prompt.replace(
                        '___',
                        isAnswerChecked
                          ? getPrimaryAnswerString(currentDrill.correctAnswer).split('/')[0].trim()
                          : 'blank'
                      )
                    )
                  }
                  className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] font-semibold cursor-pointer transition-colors"
                  title={t('common.listen', nativeLanguage)}
                >
                  <Volume2 className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                  <span>{t('common.listen', nativeLanguage)}</span>
                </button>
              </div>

              {/* Instruction & Translation (hide self-translation before check on self-language drills so the answer is never spoiled) */}
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F0F2F5]">
                  {localizedDrill.instruction}
                </h3>
                {(isAnswerChecked ||
                  currentDrill.type === 'sentence-ordering' ||
                  currentDrill.language.toLowerCase() !== nativeLanguage.toLowerCase()) &&
                  localizedDrill.translation && (
                    <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                      {t('drills.meaningLabel', nativeLanguage)} &ldquo;{localizedDrill.translation}&rdquo;
                    </p>
                  )}
              </div>

              {/* DRILL TYPE 1: Fill in the Blank (Multiple Choice) */}
              {currentDrill.type === 'fill-blank' && (
                <div className="space-y-5">
                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-center">
                    <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5] leading-relaxed">
                      {currentDrill.prompt.split('___').map((chunk, idx, arr) => (
                        <React.Fragment key={idx}>
                          <span>{chunk}</span>
                          {idx < arr.length - 1 && (
                            <span
                              className={`inline-flex items-center justify-center min-w-[72px] px-3 py-1 mx-1.5 rounded-lg border font-mono font-bold text-sm transition-colors ${
                                selectedOption
                                  ? isCorrect
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300'
                                  : 'bg-white dark:bg-[#1B2430] border-[#6485F5]/50 text-indigo-600 dark:text-[#6485F5]'
                              }`}
                            >
                              {selectedOption || '___'}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(displayOptions.length > 0 ? displayOptions : currentDrill.options || []).map((opt, idx) => {
                      const isChosen = selectedOption === opt;
                      const isTargetCorrect = evaluateFillBlankAnswer(opt, currentDrill.correctAnswer);

                      let btnStyle =
                        'bg-slate-50 dark:bg-[#1B2430] border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] hover:border-[#6485F5]/60 hover:bg-slate-100 dark:hover:bg-[#232F3F] hover:text-slate-900 dark:hover:text-white';
                      if (isAnswerChecked) {
                        if (isTargetCorrect) {
                          btnStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300';
                        } else if (isChosen) {
                          btnStyle = 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300';
                        } else {
                          btnStyle = 'opacity-40 bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-500 dark:text-[#9BA6B2]';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isAnswerChecked}
                          onClick={() => handleCheckFillBlank(opt)}
                          className={`p-3.5 rounded-lg border font-semibold text-sm sm:text-base flex items-center justify-between transition-colors cursor-pointer ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {isAnswerChecked && isTargetCorrect && (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {isAnswerChecked && isChosen && !isTargetCorrect && (
                            <X className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DRILL TYPE 2: Rearrange Words to Make a Proper Sentence */}
              {currentDrill.type === 'sentence-ordering' && (
                <div className="space-y-5">
                  <div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-[#9BA6B2] block mb-2">
                      {t('drills.constructedLabel', nativeLanguage)}
                    </span>
                    <div
                      data-testid="constructed-sentence-box"
                      className="min-h-[84px] p-4 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-dashed border-slate-300 dark:border-[#293342] flex flex-wrap items-center gap-2"
                    >
                      {orderedTokens.length === 0 ? (
                        <span className="text-xs text-slate-500 dark:text-[#9BA6B2] select-none">
                          {t('drills.constructedPlaceholder', nativeLanguage)}
                        </span>
                      ) : (
                        orderedTokens.map((token, idx) => (
                          <button
                            key={`${token}_${idx}`}
                            type="button"
                            disabled={isAnswerChecked}
                            onClick={() => handleRemoveToken(token, idx)}
                            className="px-3 py-1.5 rounded-lg bg-[#6485F5]/15 dark:bg-[#6485F5]/20 border border-[#6485F5]/60 text-slate-900 dark:text-[#F0F2F5] font-semibold text-xs sm:text-sm hover:bg-rose-500/20 hover:border-rose-500 transition-colors cursor-pointer"
                          >
                            {token}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#9BA6B2]">
                      <span>{t('drills.scrambledBankLabel', nativeLanguage)}</span>
                      {orderedTokens.length > 0 && !isAnswerChecked && (
                        <button
                          type="button"
                          onClick={() => resetDrillState(currentDrill)}
                          className="text-xs text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t('drills.resetWords', nativeLanguage)}</span>
                        </button>
                      )}
                    </div>

                    <div
                      role="group"
                      aria-label={t('drills.scrambledBankLabel', nativeLanguage)}
                      data-testid="scrambled-word-bank"
                      className="flex flex-wrap gap-2"
                    >
                      {availableTokens.map((token, idx) => (
                        <button
                          key={`${token}_${idx}`}
                          type="button"
                          disabled={isAnswerChecked}
                          onClick={() => handleAddToken(token, idx)}
                          className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] hover:border-[#6485F5]/60 hover:bg-slate-200 dark:hover:bg-[#232F3F] hover:text-slate-900 dark:hover:text-white text-slate-800 dark:text-[#F0F2F5] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isAnswerChecked && (
                    <button
                      type="button"
                      onClick={handleCheckSentenceOrder}
                      disabled={orderedTokens.length === 0}
                      className="w-full py-3 px-5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-sm border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {t('drills.checkOrder', nativeLanguage)}
                    </button>
                  )}
                </div>
              )}

              {/* DRILL TYPE 3: Guess the Missing Word (Type Answer from Context & Meaning Clue) */}
              {currentDrill.type === 'guess-missing-word' && (
                <form onSubmit={handleCheckGuessMissingWord} className="space-y-5">
                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-3 text-center">
                    <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5] leading-relaxed">
                      {currentDrill.prompt.split('___').map((chunk, idx, arr) => (
                        <React.Fragment key={idx}>
                          <span>{chunk}</span>
                          {idx < arr.length - 1 && (
                            <span
                              className={`inline-flex items-center justify-center min-w-[90px] px-3 py-1 mx-1.5 rounded-lg border font-mono font-bold text-sm ${
                                isAnswerChecked
                                  ? isCorrect
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300'
                                  : 'bg-white dark:bg-[#1B2430] border-[#6485F5]/50 text-indigo-600 dark:text-[#6485F5]'
                              }`}
                            >
                              {isAnswerChecked
                                ? resolvedTargetWord || getPrimaryAnswerString(currentDrill.correctAnswer)
                                : typedMissingWord.trim() || '_____'}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-slate-600 dark:text-[#9BA6B2]">
                      {localizedDrill.wordClue && (
                        <span>
                          {t('drills.clueLabel', nativeLanguage)}{' '}
                          <strong className="text-slate-800 dark:text-[#F0F2F5]">{localizedDrill.wordClue}</strong>
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-indigo-600 dark:text-[#6485F5]">
                        {buildMissingWordMask(currentDrill.correctAnswer, revealedLetterCount)}
                      </span>
                    </div>
                  </div>

                  {!isAnswerChecked && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="guess-missing-word-input"
                          className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5]"
                        >
                          {t('drills.typeMissingLabel', nativeLanguage)}
                        </label>
                        <button
                          type="button"
                          onClick={() => setRevealedLetterCount(prev => prev + 1)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-[#6485F5] hover:text-indigo-800 dark:hover:text-white font-semibold cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{t('drills.revealLetter', nativeLanguage)}</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          id="guess-missing-word-input"
                          type="text"
                          value={typedMissingWord}
                          onChange={(e) => setTypedMissingWord(e.target.value)}
                          placeholder={t('drills.enterMissingPlaceholder', nativeLanguage, {
                            lang: localizeLanguageName(currentDrill.language, nativeLanguage)
                          })}
                          className="flex-1 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={!typedMissingWord.trim()}
                          className="px-5 py-2.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs sm:text-sm border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                        >
                          {t('drills.checkMissing', nativeLanguage)}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Answer Evaluation Feedback */}
              {isAnswerChecked && (
                <div
                  data-testid="drill-feedback-banner"
                  className={`p-4 sm:p-5 rounded-lg border space-y-3 animate-in fade-in ${
                    isCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {t('drills.correctXp', nativeLanguage, {
                              xp:
                                currentDrill.type === 'sentence-ordering'
                                  ? 35
                                  : currentDrill.type === 'guess-missing-word'
                                    ? 30
                                    : 25
                            })}
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>
                            {t('drills.correctAnswerLabel', nativeLanguage)}{' '}
                            <strong className="text-slate-900 dark:text-[#F0F2F5]">
                              {getPrimaryAnswerString(currentDrill.correctAnswer)}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onSaveToVocabDeck({
                          word: getPrimaryAnswerString(currentDrill.correctAnswer),
                          translation: localizedDrill.wordClue || localizedDrill.translation,
                          language: currentDrill.language,
                          cefrLevel: currentDrill.level,
                          contextSentence: currentDrill.prompt,
                          tags: ['AI Drill']
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#232F3F] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <BookPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                      <span>{t('drills.saveToVocab', nativeLanguage)}</span>
                    </button>
                  </div>

                  {accentReminder && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">{accentReminder}</p>
                  )}

                  <p className="text-xs sm:text-sm text-slate-800 dark:text-[#F0F2F5] leading-relaxed">
                    <strong>{t('drills.explanationLabel', nativeLanguage)}</strong>{' '}
                    {localizedDrill.grammarExplanation}
                  </p>

                  {(localizedDrill.sourceFact || localizedDrill.sourceUrl) && (
                    <div
                      data-testid="drill-grounding-context"
                      className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/25 text-xs text-sky-900 dark:text-sky-200 space-y-1"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-sky-800 dark:text-sky-300">
                        <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>{t('drills.groundingContext', nativeLanguage)}</span>
                      </div>
                      {localizedDrill.sourceFact && (
                        <p className="text-sky-800/90 dark:text-sky-200/90 leading-relaxed">
                          {localizedDrill.sourceFact}
                        </p>
                      )}
                      {localizedDrill.sourceUrl && (
                        <a
                          href={localizedDrill.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 underline hover:text-sky-900 dark:hover:text-white font-medium text-[11px] pt-0.5"
                        >
                          <span>
                            {t('common.source', nativeLanguage)}: {localizedDrill.sourceTitle || localizedDrill.sourceUrl}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {isCorrect
                          ? t('drills.wellDone', nativeLanguage)
                          : t('drills.reviewContinue', nativeLanguage)}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={handleNextDrill}
                      className="px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ml-auto"
                    >
                      <span>{t('drills.nextQuestion', nativeLanguage)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Optional Hint + New Sentence Skip */}
              {!isAnswerChecked && (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowHint(!showHint)}
                      className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#9BA6B2] hover:text-amber-700 dark:hover:text-amber-300 font-semibold cursor-pointer transition-colors"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>{showHint ? t('drills.hideHint', nativeLanguage) : t('drills.showHint', nativeLanguage)}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="skip-next-drill-btn"
                      onClick={handleNextDrill}
                      className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] font-semibold cursor-pointer transition-colors"
                    >
                      <span>{t('drills.newQuestion', nativeLanguage)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {showHint && (
                    <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                      {localizedDrill.hint}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isLoadingBatch || isGenerating ? (
            <div
              data-testid="drills-loading-card"
              className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-10 text-center space-y-4 shadow-xs dark:shadow-none"
            >
              <div className="w-11 h-11 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mx-auto">
                <RefreshCw className="w-5 h-5 text-sky-600 dark:text-sky-400 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                  {t('drills.loadingTitle', nativeLanguage, { lang: targetLangDisplay })}
                </p>
                <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                  {t('drills.loadingDesc', nativeLanguage, { lang: targetLangDisplay })}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-8 text-center space-y-3 shadow-xs dark:shadow-none">
              <Sparkles className="w-7 h-7 text-indigo-600 dark:text-[#6485F5] mx-auto" />
              <p className="text-sm text-slate-700 dark:text-[#F0F2F5]">
                {t('drills.emptyReady', nativeLanguage, { lang: targetLangDisplay })}
              </p>
              <button
                type="button"
                onClick={handleGenerateAiDrill}
                className="px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs border border-[#6485F5]/40 cursor-pointer transition-colors"
              >
                {t('drills.generateBtn', nativeLanguage)}
              </button>
            </div>
          )}
      </div>
    </div>
  );
};
