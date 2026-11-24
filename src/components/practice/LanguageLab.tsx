import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Volume2, 
  BookPlus, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Mic, 
  RotateCcw, 
  Languages, 
  Check, 
  Award, 
  Copy
} from 'lucide-react';
import { CEFRLevel, CorrectionResult, LanguageInfo, PracticeDrill, PronunciationResult, UserProfile, UserStreak, VocabularyWord } from '../../types';
import { analyzeSentence } from '../../services/aiService';
import { localizeLanguageName, normalizeNativeLanguage, t } from '../../services/uiLocalization';
import { PracticeDrills } from './PracticeDrills';
import { PronunciationTrainer } from './PronunciationTrainer';

export type LabTab = 'analyzer' | 'practice-drills' | 'pronunciation-trainer';

interface LanguageLabProps {
  selectedLanguage: LanguageInfo;
  onSaveToVocabDeck: (item: Partial<VocabularyWord>) => void;
  defaultSubTab?: LabTab;
  onSubTabChange?: (subTab: LabTab) => void;
  userProfile?: UserProfile;
  userStreak?: UserStreak;
  onDrillCompleted?: (drill: PracticeDrill, xp: number) => void;
  onOpenStreakModal?: () => void;
  onAnalysisCorrection?: (result: CorrectionResult) => void;
  onPronunciationEvaluated?: (result: PronunciationResult, evalId: string) => void;
}

export const LanguageLab: React.FC<LanguageLabProps> = ({
  selectedLanguage,
  onSaveToVocabDeck,
  defaultSubTab = 'analyzer',
  onSubTabChange,
  userProfile,
  userStreak,
  onDrillCompleted,
  onOpenStreakModal,
  onAnalysisCorrection,
  onPronunciationEvaluated
}) => {
  const userLevel: CEFRLevel =
    userProfile?.targetLanguages?.find(
      (t) => t.language.toLowerCase() === selectedLanguage.name.toLowerCase()
    )?.level ||
    userProfile?.targetLanguages?.[0]?.level ||
    'B1';
  const nativeLanguage = normalizeNativeLanguage(userProfile?.nativeLanguage);
  const targetLangDisplay = localizeLanguageName(selectedLanguage.name, nativeLanguage);

  const [activeTab, setActiveTab] = useState<LabTab>(defaultSubTab);
  const handleSwitchSubTab = (next: LabTab) => {
    setActiveTab(next);
    onSubTabChange?.(next);
  };
  const [inputText, setInputText] = useState(
    selectedLanguage.code === 'en'
      ? 'Hello, I am living here since two years and this meeting is very important for our project.'
      : selectedLanguage.code === 'de'
      ? 'Hallo, ich bin gut heute und ich habe angst vor der Hund.'
      : 'Hola, yo querer aprender español porque soy aburrido en casa.'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [copiedBetter, setCopiedBetter] = useState(false);

  // Run Grammar & Phrasing Analysis
  const handleAnalyze = async (textToTest?: string) => {
    const text = (textToTest ?? inputText).trim();
    if (!text) return;

    setIsLoading(true);
    setCopiedBetter(false);
    try {
      const res = await analyzeSentence(text, selectedLanguage.name, userLevel, nativeLanguage);
      setResult(res);
      onAnalysisCorrection?.(res);
    } catch (e) {
      console.error('Analysis error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Text to Speech using Web Speech API
  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage.code === 'de' ? 'de-DE' : selectedLanguage.code === 'es' ? 'es-ES' : 'en-US';
    utterance.rate = 0.9;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (no window.alert)
  const handleSpeechInput = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice(t('lab.voiceNotSupported', nativeLanguage));
      setTimeout(() => setVoiceNotice(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = selectedLanguage.code === 'de' ? 'de-DE' : selectedLanguage.code === 'es' ? 'es-ES' : 'en-US';
      recognition.continuous = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        handleAnalyze(transcript);
      };
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-7">
      {activeTab === 'practice-drills' && (
        <PracticeDrills
          selectedLanguage={selectedLanguage}
          onSaveToVocabDeck={onSaveToVocabDeck}
          userProfile={userProfile}
          userStreak={userStreak}
          onDrillCompleted={onDrillCompleted}
          onOpenStreakModal={onOpenStreakModal}
        />
      )}

      {activeTab === 'pronunciation-trainer' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t('lab.pronunciationHeader', nativeLanguage)}
            </p>
            <button
              type="button"
              onClick={() => handleSwitchSubTab('analyzer')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] cursor-pointer whitespace-nowrap transition-colors"
            >
              {t('lab.backToAnalyzer', nativeLanguage)}
            </button>
          </div>
          <PronunciationTrainer
            selectedLanguage={selectedLanguage}
            userProfile={userProfile}
            onPronunciationEvaluated={onPronunciationEvaluated}
          />
        </div>
      )}

      {activeTab === 'analyzer' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Hero Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-8 shadow-xs dark:shadow-none">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                {t('lab.heroTitle', nativeLanguage, { lang: targetLangDisplay })}
              </h1>
            </div>
          </div>

      {/* Input Workbench */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-4 shadow-xs dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="grammar-lab-sentence-input"
            className="text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] flex items-center gap-2"
          >
            <Languages className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
            <span>{t('lab.writeSentenceLabel', nativeLanguage, { lang: targetLangDisplay })}</span>
          </label>
          <div className="flex items-center gap-3 text-xs">
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setResult(null);
                }}
                className="text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] font-medium cursor-pointer transition-colors"
              >
                {t('common.clear', nativeLanguage)}
              </button>
            )}
            <span className="text-slate-500 dark:text-[#9BA6B2] font-mono tabular-nums">
              {t('lab.chars', nativeLanguage, { count: inputText.length })}
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            id="grammar-lab-sentence-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={3}
            placeholder={t('lab.inputPlaceholder', nativeLanguage, { lang: targetLangDisplay })}
            className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg p-4 text-sm sm:text-base text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors resize-none"
          />
        </div>

        {voiceNotice && (
          <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {voiceNotice}
          </p>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSpeechInput}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                isRecording
                  ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-100 dark:bg-[#1B2430] border-slate-300 dark:border-[#293342] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5]'
              }`}
              title={t('lab.voiceDictation', nativeLanguage)}
            >
              <Mic className="w-4 h-4" />
              <span>{isRecording ? t('lab.listening', nativeLanguage) : t('lab.voiceDictation', nativeLanguage)}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSpeak(inputText)}
              disabled={!inputText.trim()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5] disabled:opacity-40 cursor-pointer whitespace-nowrap transition-colors"
              title={t('common.pronounce', nativeLanguage)}
            >
              <Volume2 className={`w-4 h-4 ${isSpeaking ? 'text-indigo-600 dark:text-[#6485F5]' : ''}`} />
              <span>{t('common.pronounce', nativeLanguage)}</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="grammar-analyze-btn"
            onClick={() => handleAnalyze()}
            disabled={isLoading || !inputText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs sm:text-sm border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>{t('lab.checkingMistakes', nativeLanguage)}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>{t('lab.analyzeBtn', nativeLanguage)}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results View */}
      {result && (
        <div data-testid="grammar-analysis-results" className="space-y-6 animate-in fade-in duration-300">
          {/* Side by Side Comparison Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Input */}
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-3 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#9BA6B2] font-medium">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {t('lab.originalSentence', nativeLanguage)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-[#9BA6B2]">{t('lab.asWritten', nativeLanguage)}</span>
              </div>
              <p className="text-base text-slate-800 dark:text-[#F0F2F5] leading-relaxed font-medium">
                {result.originalText}
              </p>
            </div>

            {/* AI Suggested Better Version */}
            <div className="bg-white dark:bg-[#161D27] border border-emerald-500/35 rounded-xl p-6 space-y-3 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium gap-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {t('lab.suggestedBetter', nativeLanguage)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(result.correctedText).catch(() => {});
                      setCopiedBetter(true);
                      setTimeout(() => setCopiedBetter(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    {copiedBetter ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBetter ? t('common.copied', nativeLanguage) : t('common.copy', nativeLanguage)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpeak(result.correctedText)}
                    className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                    title={t('common.listen', nativeLanguage)}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{t('common.listen', nativeLanguage)}</span>
                  </button>
                </div>
              </div>
              <p
                data-testid="grammar-suggested-sentence"
                className="text-base text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed"
              >
                {result.correctedText}
              </p>
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-[#9BA6B2]">
                <Award className="w-3.5 h-3.5 text-slate-700 dark:text-[#F0F2F5]" />
                <span>
                  {t('lab.estimatedLevel', nativeLanguage)}{' '}
                  <strong className="text-slate-900 dark:text-[#F0F2F5] font-semibold">CEFR {result.cefrLevelEstimated}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>{result.overallFeedback}</span>
              </div>
            </div>
          </div>

          {/* Grammar Mistakes & Explanations */}
          {result.mistakes.length > 0 && (
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-4 shadow-xs dark:shadow-none">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-[#F0F2F5]">
                  {t('lab.identifiedIssues', nativeLanguage, { count: result.mistakes.length })}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.mistakes.map((mistake, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-[#10151D] border border-rose-500/25 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="line-through text-rose-600 dark:text-rose-400 font-semibold">{mistake.wrongPart}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2]" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{mistake.suggestion}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold uppercase">
                        {mistake.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                      {mistake.explanation}
                    </p>
                    {mistake.ruleReference && (
                      <div className="pt-1 border-t border-slate-200 dark:border-[#293342] text-[10px] font-mono text-slate-600 dark:text-[#9BA6B2]">
                        {t('lab.ruleLabel', nativeLanguage)} {mistake.ruleReference}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vocabulary Level-Up Recommendations */}
          {result.betterWords.length > 0 && (
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-4 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-[#6485F5]" />
                  <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-[#F0F2F5]">
                    {t('lab.vocabLevelUp', nativeLanguage)}
                  </h3>
                </div>
                <span className="text-xs text-slate-600 dark:text-[#9BA6B2] font-medium hidden sm:inline">
                  {t('lab.soundNative', nativeLanguage)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.betterWords.map((item, idx) => {
                  const saveKey = `${item.betterWord}_${idx}`;
                  const isSaved = savedKeys.has(saveKey);

                  return (
                    <div key={idx} className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                            {t('lab.insteadOf', nativeLanguage)}{' '}
                            <code className="text-rose-700 dark:text-rose-300 font-medium">"{item.originalWord}"</code>:
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] font-medium">
                            {item.formality}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-emerald-700 dark:text-emerald-300 tracking-tight">
                          {item.betterWord}
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-[#F0F2F5] mt-1 leading-relaxed">
                          {item.whyBetter}
                        </p>
                        {item.exampleSentence && (
                          <div className="mt-2.5 p-2 rounded-lg bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] text-xs text-slate-700 dark:text-[#F0F2F5] italic">
                            "{item.exampleSentence}"
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-[#293342] flex items-center justify-between">
                        <button
                          onClick={() => handleSpeak(item.betterWord)}
                          className="flex items-center gap-1 text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] text-xs transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{t('common.pronounce', nativeLanguage)}</span>
                        </button>

                        <button
                          onClick={() => {
                            onSaveToVocabDeck({
                              word: item.betterWord,
                              translation: item.whyBetter,
                              language: selectedLanguage.name,
                              cefrLevel: 'B2',
                              contextSentence: item.exampleSentence
                            });
                            setSavedKeys(prev => new Set(prev).add(saveKey));
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isSaved
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-[#6485F5] hover:bg-[#7593F7] text-white border border-[#6485F5]/40'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{t('lab.addedToDeck', nativeLanguage)}</span>
                            </>
                          ) : (
                            <>
                              <BookPlus className="w-3.5 h-3.5" />
                              <span>{t('lab.addToDeck', nativeLanguage)}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cultural & Linguistic Nuance Tip */}
          {result.nativeNuanceTip && (
            <div className="bg-white dark:bg-[#161D27] border border-amber-500/30 rounded-xl p-5 flex items-start gap-3 shadow-xs dark:shadow-none">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-xs text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                  {t('lab.culturalInsight', nativeLanguage)}
                </h4>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-[#F0F2F5] leading-relaxed">
                  {result.nativeNuanceTip}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    )}
    </div>
  );
};
