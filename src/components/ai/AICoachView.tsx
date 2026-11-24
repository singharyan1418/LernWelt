import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Send,
  Volume2,
  BookPlus,
  RotateCcw,
  Languages,
  CheckCircle2,
  MessageSquare,
  Mic,
  MicOff,
  Copy,
  Check,
  Sparkles,
  Zap,
  GraduationCap,
  Coffee,
  BookOpen
} from 'lucide-react';
import { CEFRLevel, LanguageInfo, UserProfile, VocabularyWord } from '../../types';
import { AICoachModelId, chatWithAICoachStream } from '../../services/aiService';
import { localizeLanguageName, normalizeNativeLanguage, t } from '../../services/uiLocalization';

interface AICoachViewProps {
  selectedLanguage: LanguageInfo;
  userProfile: UserProfile;
  onSaveToVocabDeck: (item: Partial<VocabularyWord>) => void;
  onCorrectionReceived?: (event: { id: string; count: number }) => void;
}

export type CoachRole =
  | 'all-round'
  | 'grammar-specialist'
  | 'roleplay-native'
  | 'pronunciation-mentor'
  | 'exam-prep'
  | 'instant-translator';

export type GeminiModelChoice = AICoachModelId;

interface CoachMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  modelUsed?: string;
  roleUsed?: string;
}

interface CoachRoleConfig {
  id: CoachRole;
  label: string;
  badge: string;
  tagline: string;
  icon: React.ReactNode;
  placeholder: string;
  initialGreeting: (name: string, lang: string, level: string) => string;
  starters: (lang: string) => string[];
}

const COACH_ROLES: CoachRoleConfig[] = [
  {
    id: 'all-round',
    label: 'All-Round Coach',
    badge: 'Lerni Mentor',
    tagline: 'Warm polyglot guide for conversation, grammar, idioms & culture',
    icon: <Bot className="w-4 h-4 text-emerald-400" />,
    placeholder: 'Ask any question, grammar rule, word meaning, or start a chat...',
    initialGreeting: (name, lang, level) =>
      `Hello ${name.split(' ')[0]}! I am Lerni, your all-round AI Language & Knowledge Coach for ${lang} (${level}). Ask me any question—translations, grammar rules, vocabulary, sentence checks, or natural conversation practice—and I'll guide you step by step.`,
    starters: (lang) => [
      `How do I say "I have been looking forward to this" naturally in ${lang}?`,
      `Give me 4 natural idioms natives in ${lang} use every single day`,
      lang === 'Spanish'
        ? 'What is the subtle difference between ser and estar?'
        : lang === 'German'
          ? 'Explain the difference between kennen and wissen with examples'
          : `What are the most common conversational habits in ${lang}?`
    ]
  },
  {
    id: 'grammar-specialist',
    label: 'Grammar Specialist',
    badge: 'Strict & Analytical',
    tagline: 'Deep breakdown of cases, tenses, subjunctive, prepositions & word order',
    icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
    placeholder: 'Type a sentence to check or ask about any grammar rule...',
    initialGreeting: (name, lang, level) =>
      `Welcome ${name.split(' ')[0]}. I am your Grammar Specialist for ${lang} (${level}). Send me any sentence you wrote, and I will dissect the sentence structure, cases, verb conjugations, and prepositions with complete linguistic precision.`,
    starters: (lang) =>
      lang === 'German'
        ? [
            'Check: Ich helfe dich heute und ich gebe den Buch.',
            'Explain Akkusativ vs Dativ with 3 contrasting sentences',
            'Why does "weil" kick the verb to the end of the clause?'
          ]
        : lang === 'Spanish'
          ? [
              'Check: Hoy soy muy aburrido y espero que viene mañana.',
              'When do I use the Subjunctive vs Indicative mood?',
              'Explain the difference between Por vs Para with clear rules'
            ]
          : [
              'Check: I am living in this city since two years.',
              `Explain the conditional tense rules in ${lang}`,
              `Break down preposition cases in ${lang}`
            ]
  },
  {
    id: 'roleplay-native',
    label: 'Roleplay & Slang',
    badge: 'Real-Life Immersion',
    tagline: 'Authentic everyday scenarios, local street slang, and casual banter',
    icon: <Coffee className="w-4 h-4 text-amber-400" />,
    placeholder: 'Reply in the roleplay or propose a real-life scenario...',
    initialGreeting: (name, lang, level) =>
      `Hey ${name.split(' ')[0]}! Ready for real immersion? I am your Native Conversation Partner in ${lang} (${level}). We can roleplay ordering at a café, checking in at a hotel, haggling at a flea market, or chatting about the weekend like locals. Where should we start?`,
    starters: (lang) => [
      `Let's roleplay ordering coffee and pastries at a local café in ${lang}`,
      `Teach me 4 current slang phrases young native speakers use in casual chat`,
      `Roleplay a friendly job interview introduction in ${lang}`
    ]
  },
  {
    id: 'pronunciation-mentor',
    label: 'Pronunciation & Accent',
    badge: 'Phonetics Coach',
    tagline: 'Mouth mechanics, minimal pairs, stress cadence & pitch/tone mastery',
    icon: <Volume2 className="w-4 h-4 text-cyan-400" />,
    placeholder: 'Ask about any sound, syllable stress, or pronunciation trick...',
    initialGreeting: (name, lang, level) =>
      `Hi ${name.split(' ')[0]}! I am your Pronunciation & Phonetics Mentor for ${lang} (${level}). I'll help you master tricky sounds, mouth positioning, syllable stress, and intonation so you sound clear and natural.`,
    starters: (lang) =>
      lang === 'German'
        ? [
            'How do I position my tongue to pronounce the "ch" sound in "ich" vs "ach"?',
            'Give me minimal pairs to practice German "ö" vs "o"',
            'Explain the glottal stop (Knacklaut) in spoken German'
          ]
        : lang === 'Spanish'
          ? [
              'How do I train my tongue to roll the Spanish "rr" (erre)?',
              'What is the difference between "b" and "v" in natural Spanish?',
              'Give me practice sentences for Spanish syllable stress'
            ]
          : lang === 'Mandarin'
            ? [
                'Explain how to distinguish Tone 2 (rising) from Tone 3 (dipping)',
                'Give me minimal pair pinyin words for practice',
                'Tips for pronouncing "zh", "ch", "sh", and "r"'
              ]
            : [
                `What are the most challenging sounds for learners in ${lang}?`,
                `Give me 5 minimal pairs in ${lang} with audio practice tips`,
                `How does sentence rhythm and intonation work in ${lang}?`
              ]
  },
  {
    id: 'exam-prep',
    label: 'CEFR Exam Prep',
    badge: 'Certification & C1',
    tagline: 'Formal exam evaluation, C1 phrase upgrades, and oral test simulations',
    icon: <GraduationCap className="w-4 h-4 text-purple-400" />,
    placeholder: 'Write an exam response or ask for a test simulation...',
    initialGreeting: (name, lang, level) =>
      `Greetings ${name.split(' ')[0]}. I am your CEFR Exam Preparation Coach for ${lang} (${level}). We will train formal transition phrases, oral argument structure, and high-scoring vocabulary for official certifications (Goethe, DELE, DELF, IELTS, HSK, JLPT).`,
    starters: (lang) => [
      `Simulate a formal B2/C1 oral exam speaking prompt for ${lang}`,
      `Upgrade this basic sentence into a sophisticated C1 argumentative phrase`,
      `Give me the top 6 connector words for writing essays in ${lang}`
    ]
  },
  {
    id: 'instant-translator',
    label: 'Nuanced Translator',
    badge: 'Contextual & Idiomatic',
    tagline: 'Idiomatic translations with cultural notes, polite forms & romanization',
    icon: <BookOpen className="w-4 h-4 text-rose-400" />,
    placeholder: 'Paste or type anything to translate with full context...',
    initialGreeting: (name, lang, level) =>
      `Hello ${name.split(' ')[0]}! I am your Nuanced Translator for ${lang} (${level}). I provide natural translations with formal vs. informal variations, key vocabulary breakdowns, and cultural context.`,
    starters: (lang) => [
      `How do I translate "I will get back to you as soon as possible" formally in ${lang}?`,
      `Translate: "Excuse me, could you point me in the direction of the station?"`,
      `What is the cultural difference between formal and informal greetings in ${lang}?`
    ]
  }
];

export const AICoachView: React.FC<AICoachViewProps> = ({
  selectedLanguage,
  userProfile,
  onSaveToVocabDeck,
  onCorrectionReceived
}) => {
  const uiLang = userProfile.nativeLanguage || 'English';
  const uiLangKey = normalizeNativeLanguage(uiLang);
  const localizedTargetLang = localizeLanguageName(selectedLanguage.name, uiLang);

  const userLevel: CEFRLevel =
    userProfile.targetLanguages.find(
      (t) => t.language.toLowerCase() === selectedLanguage.name.toLowerCase()
    )?.level || 'B1';

  const [activeRole, setActiveRole] = useState<CoachRole>('all-round');
  const [selectedModel] = useState<GeminiModelChoice>('gemini-4-hydrogen');

  const currentRoleConfig =
    COACH_ROLES.find((r) => r.id === activeRole) || COACH_ROLES[0];

  const [messages, setMessages] = useState<CoachMessage[]>(() => [
    {
      id: 'ai_init_welcome',
      sender: 'ai',
      text:
        uiLangKey === 'German'
          ? `Hallo ${userProfile.name?.split(' ')[0] || 'Lernende/r'}! Ich bin Lerni, dein KI-Sprach- & Wissenscoach für ${selectedLanguage.flag} ${localizedTargetLang} (${userLevel}). Stelle mir jede Frage – zu Grammatik, Wortschatz, Satzkorrekturen oder Alltagsgesprächen auf ${localizedTargetLang}!`
          : currentRoleConfig.initialGreeting(
              userProfile.name || 'Learner',
              `${selectedLanguage.flag} ${selectedLanguage.name}`,
              userLevel
            ),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      roleUsed: 'all-round'
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedMsgIds, setSavedMsgIds] = useState<Record<string, boolean>>({});
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>(() =>
    currentRoleConfig.starters(selectedLanguage.name)
  );

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Update suggestions when role or language changes
  useEffect(() => {
    setQuickSuggestions(currentRoleConfig.starters(selectedLanguage.name));
  }, [activeRole, selectedLanguage.name]);

  // Smooth scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleRoleChange = (newRole: CoachRole) => {
    setActiveRole(newRole);
    const newConfig = COACH_ROLES.find((r) => r.id === newRole) || COACH_ROLES[0];
    const roleGreeting: CoachMessage = {
      id: `ai_role_switch_${Date.now()}`,
      sender: 'ai',
      text: newConfig.initialGreeting(
        userProfile.name || 'Learner',
        `${selectedLanguage.flag} ${selectedLanguage.name}`,
        userLevel
      ),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: selectedModel,
      roleUsed: newRole
    };
    setMessages((prev) => [...prev, roleGreeting]);
  };

  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  const sendMessageToAi = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) return;

    const userMsg: CoachMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextHistory = [...messages, userMsg];
    const aiReplyId = `ai_${Date.now()}`;
    setMessages(nextHistory);
    setInputText('');
    setIsSending(true);
    setStreamingMsgId(null);

    try {
      const response = await chatWithAICoachStream({
        messages: nextHistory.map((m) => ({
          sender: m.sender === 'user' ? 'user' : 'ai',
          text: m.text
        })),
        targetLanguage: selectedLanguage.name,
        userLevel,
        nativeLanguage: userProfile.nativeLanguage || 'English',
        currentTopic: currentRoleConfig.tagline,
        coachRole: activeRole,
        model: selectedModel,
        onChunk: (accumulatedText) => {
          setStreamingMsgId(aiReplyId);
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === aiReplyId);
            if (exists) {
              return prev.map((m) => (m.id === aiReplyId ? { ...m, text: accumulatedText } : m));
            }
            return [
              ...prev,
              {
                id: aiReplyId,
                sender: 'ai',
                text: accumulatedText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                modelUsed: selectedModel,
                roleUsed: activeRole
              }
            ];
          });
        }
      });

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === aiReplyId);
        const finalMsg: CoachMessage = {
          id: aiReplyId,
          sender: 'ai',
          text: response.replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: response.modelUsed || selectedModel,
          roleUsed: activeRole
        };
        return exists
          ? prev.map((m) => (m.id === aiReplyId ? finalMsg : m))
          : [...prev, finalMsg];
      });
      if (response.suggestions && response.suggestions.length > 0) {
        setQuickSuggestions(response.suggestions.slice(0, 3));
      }
      const replyLines = response.replyText.split('\n');
      const explicitCrossCount = replyLines.filter(
        (line) => line.includes('❌') || /^\s*\*{0,2}(incorrect|mistake)\s*:/i.test(line)
      ).length;
      const hasCorrectionBlock =
        explicitCrossCount > 0
          ? explicitCrossCount
          : /(\*\*correction\*\*|^\s*correction:|should be:|instead of\s+["'`])/im.test(response.replyText)
            ? 1
            : 0;
      if (hasCorrectionBlock > 0) {
        onCorrectionReceived?.({ id: aiReplyId, count: hasCorrectionBlock });
      }
    } finally {
      setIsSending(false);
      setStreamingMsgId(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageToAi(inputText);
  };

  const handleCopyText = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  const handleSpeakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleaned = text
        .replace(/[*#_`]/g, '')
        .replace(/❌[^:]+:/g, '')
        .replace(/✅[^:]+:/g, '')
        .slice(0, 300);

      const utterance = new SpeechSynthesisUtterance(cleaned);
      const langLocaleMap: Record<string, string> = {
        en: 'en-US',
        de: 'de-DE',
        es: 'es-ES',
        fr: 'fr-FR',
        it: 'it-IT',
        ja: 'ja-JP',
        zh: 'zh-CN',
        pt: 'pt-PT'
      };
      utterance.lang = langLocaleMap[selectedLanguage.code] || 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors in restricted runtimes
    }
  };

  const handleToggleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = selectedLanguage.code === 'de' ? 'de-DE' : selectedLanguage.code === 'es' ? 'es-ES' : 'en-US';
      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `ai_reset_${Date.now()}`,
        sender: 'ai',
        text:
          uiLangKey === 'German'
            ? `Hallo ${userProfile.name?.split(' ')[0] || 'Lernende/r'}! Ich bin Lerni, dein KI-Sprach- & Wissenscoach für ${selectedLanguage.flag} ${localizedTargetLang} (${userLevel}). Stelle mir jede Frage – zu Grammatik, Wortschatz, Satzkorrekturen oder Alltagsgesprächen auf ${localizedTargetLang}!`
            : currentRoleConfig.initialGreeting(
                userProfile.name || 'Learner',
                `${selectedLanguage.flag} ${selectedLanguage.name}`,
                userLevel
              ),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        roleUsed: activeRole
      }
    ]);
    setQuickSuggestions(currentRoleConfig.starters(selectedLanguage.name));
  };

  const renderFormattedAiText = (raw: string) => {
    return raw.split('\n').map((line, i) => {
      // Empty line spacer
      if (!line.trim()) {
        return <div key={i} className="h-2" />;
      }

      // Highlighting for Incorrect vs Correct
      const isIncorrectLine = line.includes('❌') || line.toLowerCase().startsWith('incorrect');
      const isCorrectLine = line.includes('✅') || line.toLowerCase().startsWith('correct') || line.toLowerCase().startsWith('natural');

      const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

      return (
        <div
          key={i}
          className={`leading-relaxed ${
            isIncorrectLine
              ? 'text-rose-700 dark:text-rose-300 font-mono text-xs bg-rose-500/10 dark:bg-rose-950/20 px-2.5 py-1 rounded-lg border border-rose-500/25 dark:border-rose-900/30 my-1'
              : isCorrectLine
                ? 'text-emerald-700 dark:text-emerald-300 font-mono text-xs bg-emerald-500/10 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-500/25 dark:border-emerald-900/30 my-1 font-semibold'
                : ''
          }`}
        >
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={j} className="font-bold text-slate-900 dark:text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={j} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/[0.08] text-amber-800 dark:text-amber-300 font-mono text-xs">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return <React.Fragment key={j}>{part}</React.Fragment>;
          })}
        </div>
      );
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 w-full">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#293342] mb-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] flex items-center justify-center shrink-0">
            {currentRoleConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                {t('coach.activeBadge', uiLang)}
              </span>
              <span className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                {selectedLanguage.flag} {localizedTargetLang} · {uiLangKey === 'German' ? 'Niveau' : 'Level'} {userLevel}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
              {t('coach.headerTitle', uiLang)}
            </h1>
          </div>
        </div>

        {/* Controls: New Chat */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">

          <button
            type="button"
            onClick={handleResetChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer whitespace-nowrap"
            title={t('coach.newChat', uiLang)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('coach.newChat', uiLang)}</span>
          </button>
        </div>
      </div>

      {/* Main Conversational Workspace */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl flex flex-col h-[600px] overflow-hidden shadow-xs dark:shadow-none">
        {/* Messages Feed */}
        <div
          data-testid="ai-coach-messages"
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSaved = Boolean(savedMsgIds[msg.id]);
            const isCopied = copiedId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-xl px-4 py-3.5 text-sm ${
                    isUser
                      ? 'bg-[#6485F5]/15 text-slate-900 dark:text-[#F0F2F5] border border-[#6485F5]/35 rounded-tr-sm'
                      : 'bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {!isUser && <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      <span className={isUser ? 'font-semibold text-slate-900 dark:text-[#F0F2F5]' : 'font-semibold text-slate-700 dark:text-[#F0F2F5]'}>
                        {isUser ? userProfile.name : 'Lerni · AI Coach'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#9BA6B2] tabular-nums">
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs sm:text-sm">
                    {isUser ? <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p> : renderFormattedAiText(msg.text)}
                  </div>

                  {/* Actions for AI responses */}
                  {!isUser && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-[#293342] flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSpeakText(msg.text)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer whitespace-nowrap"
                          title={t('common.listen', uiLang)}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{t('common.listen', uiLang)}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer whitespace-nowrap"
                          title={t('common.copy', uiLang)}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400">{t('common.copied', uiLang)}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{t('common.copy', uiLang)}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const firstLine = msg.text.split('\n')[0].replace(/[*•#]/g, '').slice(0, 60).trim();
                          onSaveToVocabDeck({
                            word: firstLine || `${selectedLanguage.name} Phrase`,
                            translation: `AI Coach Note (${selectedLanguage.name})`,
                            language: selectedLanguage.name,
                            cefrLevel: userLevel,
                            contextSentence: msg.text.slice(0, 180),
                            tags: ['AI Coach', currentRoleConfig.label]
                          });
                          setSavedMsgIds((prev) => ({ ...prev, [msg.id]: true }));
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-[#9BA6B2] hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
                        title={t('coach.saveWord', uiLang)}
                      >
                        {isSaved ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400">{t('coach.savedBonus', uiLang)}</span>
                          </>
                        ) : (
                          <>
                            <BookPlus className="w-3.5 h-3.5" />
                            <span>{t('coach.saveWord', uiLang)}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {isSending && !streamingMsgId && (
            <div className="flex justify-start">
              <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-[#F0F2F5] flex items-center gap-2.5">
                <Languages className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <span>
                  {t('coach.thinking', uiLang)}
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Starter / Quick Prompt Chips */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#10151D] border-t border-slate-200 dark:border-[#293342] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <MessageSquare className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-[#9BA6B2] shrink-0 font-medium">{t('coach.suggestions', uiLang)}</span>
          {quickSuggestions.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSending}
              onClick={() => sendMessageToAi(prompt)}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-xs text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Input Form */}
        <form
          onSubmit={handleFormSubmit}
          className="p-3 sm:p-4 bg-slate-50 dark:bg-[#10151D] border-t border-slate-200 dark:border-[#293342] flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleToggleVoiceInput}
            aria-label={isListening ? t('lab.listening', uiLang) : t('lab.voiceDictation', uiLang)}
            title={isListening ? t('lab.listening', uiLang) : t('lab.voiceDictation', uiLang)}
            className={`p-2.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-600/20 border-rose-500 text-rose-700 dark:text-rose-300 animate-pulse'
                : 'bg-white dark:bg-[#1B2430] border-slate-300 dark:border-[#293342] text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            aria-label={t('coach.headerTitle', uiLang)}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('coach.inputPlaceholder', uiLang, {
              lang: localizedTargetLang,
              native: localizeLanguageName(uiLang, uiLang)
            })}
            className="flex-1 bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none transition-colors min-w-0"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-4 py-2.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] disabled:opacity-40 text-white font-semibold text-xs sm:text-sm border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.99]"
          >
            <span>{t('coach.send', uiLang)}</span>
            <Send className="w-4 h-4 shrink-0" />
          </button>
        </form>
      </div>
    </div>
  );
};
