import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Languages, 
  Headphones, 
  HelpCircle, 
  TrendingUp, 
  Award,
  Sliders,
  Check
} from 'lucide-react';
import { LanguageInfo, PronunciationResult, PronunciationTarget, UserProfile } from '../../types';
import { INITIAL_PRONUNCIATION_TARGETS } from '../../data/drillData';
import { evaluatePronunciation } from '../../services/aiService';
import { localizeLanguageName, normalizeNativeLanguage, t } from '../../services/uiLocalization';

interface PronunciationTrainerProps {
  selectedLanguage: LanguageInfo;
  userProfile?: UserProfile;
  onPronunciationEvaluated?: (result: PronunciationResult, evalId: string) => void;
}

export const PronunciationTrainer: React.FC<PronunciationTrainerProps> = ({
  selectedLanguage,
  userProfile,
  onPronunciationEvaluated
}) => {
  const [targets, setTargets] = useState<PronunciationTarget[]>(() => {
    const matched = INITIAL_PRONUNCIATION_TARGETS.filter(
      t => t.language.toLowerCase() === selectedLanguage.name.toLowerCase()
    );
    return matched.length > 0 ? matched : INITIAL_PRONUNCIATION_TARGETS;
  });

  const [selectedTarget, setSelectedTarget] = useState<PronunciationTarget>(targets[0] || INITIAL_PRONUNCIATION_TARGETS[0]);
  const [customPhrase, setCustomPhrase] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.9);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [userAudioBase64, setUserAudioBase64] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationResult | null>(null);
  const uiLang = normalizeNativeLanguage(userProfile?.nativeLanguage);
  const targetLangDisplay = localizeLanguageName(selectedLanguage.name, uiLang);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const [transcript, setTranscript] = useState<string>('');

  // Update target phrases when language changes
  useEffect(() => {
    const matched = INITIAL_PRONUNCIATION_TARGETS.filter(
      t => t.language.toLowerCase() === selectedLanguage.name.toLowerCase()
    );
    const newTargets = matched.length > 0 ? matched : INITIAL_PRONUNCIATION_TARGETS;
    setTargets(newTargets);
    setSelectedTarget(newTargets[0]);
    resetSession();
  }, [selectedLanguage]);

  const resetSession = () => {
    setUserAudioUrl(null);
    setUserAudioBase64(null);
    setPronunciationResult(null);
    setTranscript('');
    setRecordSeconds(0);
    setMicError(null);
  };

  // Web Speech API text-to-speech for native audio sample
  const handlePlayNativeAudio = (text: string, speed = playbackSpeed) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 
      selectedLanguage.code === 'de' ? 'de-DE' : 
      selectedLanguage.code === 'es' ? 'es-ES' : 
      selectedLanguage.code === 'fr' ? 'fr-FR' : 
      selectedLanguage.code === 'it' ? 'it-IT' : 
      selectedLanguage.code === 'ja' ? 'ja-JP' : 
      selectedLanguage.code === 'zh' ? 'zh-CN' : 
      selectedLanguage.code === 'pt' ? 'pt-PT' : 'en-US';
    utterance.rate = speed;

    window.speechSynthesis.speak(utterance);
  };

  // Start microphone recording with Web Audio API level monitoring
  const handleStartRecording = async () => {
    resetSession();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Audio analysis for live mic visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setMicVolume(Math.min(100, Math.round(avg * 1.5)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // MediaRecorder for capturing audio blob
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setUserAudioUrl(audioUrl);

        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string)?.split(',')[1];
          setUserAudioBase64(base64String || null);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        setMicVolume(0);
      };

      // Optional browser speech recognition for transcript alignment
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 
            selectedLanguage.code === 'de' ? 'de-DE' : 
            selectedLanguage.code === 'es' ? 'es-ES' : 
            selectedLanguage.code === 'fr' ? 'fr-FR' : 'en-US';
          rec.onresult = (e: any) => {
            const detected = e.results[0][0].transcript;
            setTranscript(detected);
          };
          rec.start();
          speechRecognitionRef.current = rec;
        } catch {
          // ignore speech rec error
        }
      }

      mediaRecorder.start();
      setIsRecording(true);

      // Start duration counter
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone permission denied or error:', err);
      setMicError(t('pron.micDeniedError', uiLang));
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
    }
  };

  // Trigger AI Pronunciation Evaluation
  const handleEvaluate = async () => {
    const phrase = customPhrase.trim() || selectedTarget.phrase;
    setIsEvaluating(true);

    try {
      const result = await evaluatePronunciation(
        phrase,
        selectedLanguage.name,
        userAudioBase64 || undefined,
        transcript || undefined,
        userProfile?.nativeLanguage || 'English'
      );
      setPronunciationResult(result);
      onPronunciationEvaluated?.(result, `pron_${Date.now()}_${phrase.slice(0, 24)}`);
    } catch (err) {
      console.error('Pronunciation eval error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const activePhrase = customPhrase.trim() || selectedTarget.phrase;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] shadow-xs dark:shadow-none rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <Mic className="w-3.5 h-3.5" />
            <span>{t('pron.badge', uiLang)}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            {t('pron.title', uiLang, { flag: selectedLanguage.flag, lang: targetLangDisplay })}
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#9BA6B2] max-w-2xl">
            {t('pron.subtitle', uiLang)}
          </p>
        </div>

        {/* Speed adjustment pills */}
        <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] p-3 rounded-lg space-y-1.5">
          <span className="text-[10px] text-slate-600 dark:text-[#9BA6B2] uppercase font-semibold tracking-wider block">
            {t('pron.speedLabel', uiLang)}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {[1.0, 0.85, 0.65].map(spd => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-[#6485F5] text-white'
                    : 'bg-white dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                }`}
              >
                {spd}x{' '}
                {spd === 1.0
                  ? t('pron.speedNormal', uiLang)
                  : spd === 0.85
                    ? t('pron.speedSlow', uiLang)
                    : t('pron.speedVerySlow', uiLang)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Target Phrase Selection & Custom Phrase */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] shadow-xs dark:shadow-none rounded-xl p-6 sm:p-8 space-y-6">
        
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider block mb-3">
            {t('pron.selectChallenge', uiLang)}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {targets.map(tItem => {
              const isSelected = selectedTarget.id === tItem.id && !customPhrase;
              return (
                <button
                  key={tItem.id}
                  onClick={() => {
                    setSelectedTarget(tItem);
                    setCustomPhrase('');
                    resetSession();
                  }}
                  className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#6485F5]/10 dark:bg-[#6485F5]/15 border-[#6485F5] text-slate-900 dark:text-[#F0F2F5]'
                      : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] hover:bg-slate-100 dark:hover:bg-[#1B2430] text-slate-700 dark:text-[#F0F2F5]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-[#6485F5]/15 dark:bg-[#6485F5]/20 text-indigo-700 dark:text-[#6485F5] font-mono text-[10px] font-semibold">
                      {tItem.level}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />}
                  </div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-[#F0F2F5] line-clamp-1">{tItem.phrase}</div>
                  <div className="text-xs text-slate-600 dark:text-[#9BA6B2] line-clamp-1 mt-0.5">{tItem.translation}</div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-300/80 font-mono mt-1">
                    {t('pron.focus', uiLang)} {tItem.difficultSounds.join(', ')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Or Type Custom Phrase */}
        <div className="pt-2 border-t border-slate-200 dark:border-[#293342] space-y-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-[#9BA6B2] uppercase tracking-wider block">
            {t('pron.customPhraseLabel', uiLang)}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPhrase}
              onChange={(e) => {
                setCustomPhrase(e.target.value);
                resetSession();
              }}
              placeholder={targets[0]?.phrase || 'Ich lerne fleißig Deutsch mit LernWelt...'}
              className="flex-1 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
            {customPhrase && (
              <button
                onClick={() => {
                  setCustomPhrase('');
                  resetSession();
                }}
                className="px-3 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-xs text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer transition-colors"
              >
                {t('common.clear', uiLang)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Phrase Studio: Native Audio vs Your Recording */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] shadow-xs dark:shadow-none rounded-xl p-6 sm:p-8 space-y-6">
        
        {/* Phrase Display Card */}
        <div className="p-6 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-center space-y-2 relative overflow-hidden">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            "{activePhrase}"
          </div>

          <div className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2] font-mono">
            {t('pron.ipaLabel', uiLang)} {selectedTarget.phoneticIpa}
          </div>

          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            {t('pron.translationLabel', uiLang)} {selectedTarget.translation}
          </div>

          <p className="text-xs text-slate-600 dark:text-[#9BA6B2] max-w-xl mx-auto pt-1">
            💡 <strong>{t('pron.soundTipLabel', uiLang)}</strong> {selectedTarget.tip}
          </p>
        </div>

        {/* Dual Audio Track Workbench */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* TRACK 1: Reference Native Audio Sample */}
          <div className="p-5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-[#F0F2F5]">
              <span className="flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                {t('pron.nativeAudioTitle', uiLang)}
              </span>
              <span className="text-indigo-600 dark:text-[#6485F5] font-mono tabular-nums">
                {t('pron.speedTag', uiLang, { speed: playbackSpeed })}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
              {t('pron.listenDesc', uiLang)}
            </p>

            <button
              onClick={() => handlePlayNativeAudio(activePhrase)}
              className="w-full py-2.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] flex items-center justify-center gap-2 transition-colors active:scale-[0.99] cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>{t('pron.playSample', uiLang)}</span>
            </button>
          </div>

          {/* TRACK 2: User Voice Recording */}
          <div className="p-5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-[#F0F2F5]">
              <span className="flex items-center gap-1.5">
                <Mic className={`w-4 h-4 ${isRecording ? 'text-rose-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`} />
                {t('pron.yourRecording', uiLang)}
              </span>
              <span className="text-slate-600 dark:text-[#9BA6B2] font-mono tabular-nums">
                {isRecording
                  ? t('pron.recordingSec', uiLang, { sec: recordSeconds })
                  : userAudioUrl
                    ? t('pron.audioReady', uiLang)
                    : t('pron.notRecorded', uiLang)}
              </span>
            </div>

            {/* Live Mic Volume Waveform Visualizer */}
            <div className="h-3.5 bg-slate-200 dark:bg-[#1B2430] rounded-full overflow-hidden border border-slate-300 dark:border-[#293342] flex items-center px-1">
              <div 
                className={`h-1.5 rounded-full transition-all duration-75 ${
                  isRecording 
                    ? 'bg-emerald-500' 
                    : 'bg-slate-400 dark:bg-[#293342]'
                }`}
                style={{ width: `${isRecording ? Math.max(8, micVolume) : 0}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.99] cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>{userAudioUrl ? t('pron.reRecord', uiLang) : t('pron.recordVoice', uiLang)}</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.99] animate-pulse cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>{t('pron.stopRecording', uiLang, { sec: recordSeconds })}</span>
                </button>
              )}

              {userAudioUrl && !isRecording && (
                <audio
                  src={userAudioUrl}
                  controls
                  className="h-10 rounded-lg max-w-[150px] sm:max-w-[200px]"
                />
              )}
            </div>

            {micError && (
              <p role="alert" className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {micError}
              </p>
            )}
          </div>

        </div>

        {/* Evaluate Button */}
        <div className="pt-2 text-center">
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating || isRecording}
            className="w-full sm:w-auto px-7 py-3 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-sm border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors active:scale-[0.99] disabled:opacity-40 cursor-pointer"
          >
            {isEvaluating ? (
              <span className="flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>{t('pron.evaluating', uiLang)}</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span>{t('pron.analyzeBtn', uiLang)}</span>
              </span>
            )}
          </button>
          <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] mt-2">
            {userAudioUrl ? t('pron.recordedHint', uiLang) : t('pron.unrecordedHint', uiLang)}
          </p>
        </div>

      </div>

      {/* AI PRONUNCIATION EVALUATION RESULTS CARD */}
      {pronunciationResult && (
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] shadow-xs dark:shadow-none rounded-xl p-6 sm:p-8 space-y-6 animate-in fade-in">
          
          {/* Header & Overall Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#293342] pb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('pron.reportBadge', uiLang)}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                {t('pron.analysisComplete', uiLang)}
              </h3>
              <p className="text-xs text-slate-700 dark:text-[#F0F2F5]">
                {pronunciationResult.overallAssessment}
              </p>
            </div>

            {/* Score Ring / Pill */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-[#10151D] p-3.5 rounded-lg border border-slate-200 dark:border-[#293342]">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {pronunciationResult.accuracyScore}%
                </div>
                <div className="text-[10px] uppercase font-semibold text-slate-600 dark:text-[#9BA6B2]">{t('pron.accuracy', uiLang)}</div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-[#293342]" />
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600 dark:text-[#6485F5] tabular-nums">
                  {pronunciationResult.fluencyScore}%
                </div>
                <div className="text-[10px] uppercase font-semibold text-slate-600 dark:text-[#9BA6B2]">{t('pron.fluency', uiLang)}</div>
              </div>
            </div>
          </div>

          {/* Word-by-Word Breakdown Badges */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] uppercase tracking-wider block">
              {t('pron.wordBreakdown', uiLang)}
            </span>
            <div className="flex flex-wrap gap-2.5">
              {pronunciationResult.words?.map((w, idx) => {
                const isGreat = w.score >= 85 || w.status === 'excellent';
                const isMid = w.score >= 70 && !isGreat;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      isGreat
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : isMid
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <span>{w.word}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] tabular-nums">
                      {w.score}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Guidance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Phonetic Analysis */}
            <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-indigo-600 dark:text-[#6485F5] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>{t('pron.phoneticClarity', uiLang)}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                {pronunciationResult.phoneticAnalysis}
              </p>
            </div>

            {/* Tongue & Mouth Placement */}
            <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                <span>{t('pron.mouthPlacement', uiLang)}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                {pronunciationResult.mouthPositionTip}
              </p>
            </div>

            {/* Intonation & Rhythm */}
            <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                <span>{t('pron.sentenceIntonation', uiLang)}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                {pronunciationResult.intonationFeedback}
              </p>
            </div>

          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-600 dark:text-[#9BA6B2]">
              <strong>
                {pronunciationResult.accuracyScore >= 80
                  ? t('pron.passedBenchmark', uiLang)
                  : t('pron.needsPolishing', uiLang)}
              </strong>
            </span>

            <button
              onClick={() => {
                resetSession();
                handlePlayNativeAudio(activePhrase);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('pron.practiceAgain', uiLang)}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
