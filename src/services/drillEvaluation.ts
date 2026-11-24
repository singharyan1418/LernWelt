import { DrillType, PracticeDrill } from '../types';

/**
 * Normalizes a learner's answer or target phrase for fair, deterministic comparison:
 * trims whitespace, collapses internal spaces, removes outer punctuation, and lowercases.
 */
export function normalizeDrillText(raw: string): string {
  return raw
    .trim()
    .replace(/^[.,!?;:"'“”‘’¡¿()[\]]+|[.,!?;:"'“”‘’¡¿()[\]]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Strips diacritical marks so learners typing on standard keyboards can still be recognized
 * with a gentle accent reminder.
 */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extracts the canonical string answer from a PracticeDrill's correctAnswer field.
 */
export function getPrimaryAnswerString(correctAnswer: string | string[]): string {
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.join(' ').trim();
  }
  return String(correctAnswer || '').trim();
}

/**
 * Evaluates a Fill-in-the-Blank selection.
 */
export function evaluateFillBlankAnswer(
  selectedOption: string,
  correctAnswer: string | string[]
): boolean {
  const target = getPrimaryAnswerString(correctAnswer);
  if (!selectedOption.trim() || !target) return false;
  return normalizeDrillText(selectedOption) === normalizeDrillText(target);
}

/**
 * Evaluates a Rearrange-the-Words (sentence ordering) submission.
 */
export function evaluateSentenceOrderAnswer(
  orderedTokens: string[],
  correctAnswer: string | string[]
): boolean {
  if (!orderedTokens || orderedTokens.length === 0) return false;
  const userJoined = orderedTokens.join(' ');
  const targetJoined = getPrimaryAnswerString(correctAnswer);
  return normalizeDrillText(userJoined) === normalizeDrillText(targetJoined);
}

export interface GuessMissingWordEvaluation {
  isCorrect: boolean;
  accentReminder?: string;
  targetWord: string;
}

/**
 * Evaluates a free-text "Guess the Missing Word" submission.
 * Supports exact matches, slash-separated synonyms (e.g. "estoy / me siento"),
 * and accent-insensitive matches with a helpful accent reminder.
 */
export function evaluateGuessMissingWordAnswer(
  typedGuess: string,
  correctAnswer: string | string[]
): GuessMissingWordEvaluation {
  const rawTarget = getPrimaryAnswerString(correctAnswer);
  const candidates = Array.isArray(correctAnswer)
    ? correctAnswer.map(c => c.trim()).filter(Boolean)
    : rawTarget
        .split(/\s*\/\s*/)
        .map(c => c.trim())
        .filter(Boolean);

  const normalizedGuess = normalizeDrillText(typedGuess);
  if (!normalizedGuess || candidates.length === 0) {
    return { isCorrect: false, targetWord: candidates[0] || rawTarget };
  }

  for (const candidate of candidates) {
    const normCandidate = normalizeDrillText(candidate);
    if (normalizedGuess === normCandidate) {
      return { isCorrect: true, targetWord: candidate };
    }
  }

  const guessAscii = stripAccents(normalizedGuess);
  for (const candidate of candidates) {
    const normCandidate = normalizeDrillText(candidate);
    if (guessAscii === stripAccents(normCandidate)) {
      return {
        isCorrect: true,
        accentReminder: `Watch the accent marks: "${candidate}"`,
        targetWord: candidate
      };
    }
  }

  return { isCorrect: false, targetWord: candidates[0] || rawTarget };
}

/**
 * Builds a progressive letter-mask hint for Guess the Missing Word drills.
 * Example: buildMissingWordMask("Bahnhof", 1) -> "B _ _ _ _ _ _ (7 letters)"
 */
export function buildMissingWordMask(answer: string | string[], revealedLetters: number = 0): string {
  const primary = getPrimaryAnswerString(answer).split(/\s*\/\s*/)[0]?.trim() || '';
  if (!primary) return '___';

  const chars = Array.from(primary);
  const safeReveal = Math.max(0, Math.min(revealedLetters, chars.length));
  const letterCount = chars.filter(ch => /\S/.test(ch)).length;

  const masked = chars
    .map((ch, idx) => {
      if (/\s/.test(ch)) return '  ';
      if (idx < safeReveal) return ch;
      return '_';
    })
    .join(' ');

  return `${masked} (${letterCount} letters)`;
}

/**
 * Deterministically filters drills by selected DrillType tab.
 */
export function filterDrillsByType(
  drills: PracticeDrill[],
  activeFilter: 'all' | DrillType
): PracticeDrill[] {
  if (activeFilter === 'all') return drills;
  return drills.filter(drill => drill.type === activeFilter);
}

/**
 * Deterministically shuffles sentence tokens while guaranteeing the initial bank order
 * differs from the solved order whenever 2+ distinct tokens exist.
 */
export function scrambleSentenceTokens(tokens: string[]): string[] {
  if (tokens.length <= 1) return [...tokens];
  const copy = [...tokens];
  // Deterministic Fisher-Yates style rotation + swap seeded by token lengths so UI doesn't flicker
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 7 + copy[i].length * 3) % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  if (copy.join(' ') === tokens.join(' ') && copy.length >= 2) {
    const first = copy[0];
    copy[0] = copy[copy.length - 1];
    copy[copy.length - 1] = first;
  }
  return copy;
}

/**
 * Validates user-submitted custom difficult vocabulary entries so empty inputs never slip through.
 */
export function validateCustomVocabInput(
  word: string,
  meaning: string
): { valid: boolean; error?: string } {
  const cleanWord = word.trim();
  const cleanMeaning = meaning.trim();

  if (!cleanWord) {
    return { valid: false, error: 'Please enter the difficult word or phrase you want to save.' };
  }
  if (!cleanMeaning) {
    return { valid: false, error: 'Please enter the meaning or translation for this word.' };
  }
  return { valid: true };
}

export const SEEN_DRILLS_STORAGE_KEY = 'lernwelt_seen_drills_v2';
export const SEEN_DRILL_PROMPTS_STORAGE_KEY = 'lernwelt_seen_drill_prompts_v2';
const MAX_STORED_SEEN_PROMPTS = 400;

/**
 * Strips instructional wrappers such as `Form: "..."` or `Form the sentence: "..."`
 * so sentence-ordering prompts are compared by their actual linguistic content.
 */
export function stripDrillPromptWrapper(prompt: string): string {
  return String(prompt || '')
    .trim()
    .replace(/^(?:form(?:\s+the\s+sentence)?|rearrange|order)\s*:\s*/i, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim();
}

/**
 * Normalizes a sentence prompt for exact deduplication tracking across sessions.
 */
export function normalizeDrillKey(prompt: string): string {
  return stripDrillPromptWrapper(prompt)
    .toLowerCase()
    .replace(/[___]+/g, '___')
    .replace(/[^\p{L}\p{N}___]/gu, '')
    .trim();
}

/**
 * Retrieves the persisted set of seen sentence prompt keys from localStorage.
 */
export function getSeenDrillKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_DRILLS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((item: unknown) => String(item)));
      }
    }
  } catch {}
  return new Set();
}

/**
 * Retrieves the persisted list of readable seen drill sentences from localStorage
 * so similarity checks always compare real tokenized words across page reloads.
 */
export function getSeenDrillPrompts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEEN_DRILL_PROMPTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown) => String(item).trim()).filter(Boolean);
      }
    }
  } catch {}
  return [];
}

/**
 * Persists a newly seen sentence prompt key (and readable prompt text) to localStorage.
 */
export function recordDrillSeen(
  prompt: string,
  existingSet?: Set<string>,
  targetSentence?: string
): Set<string> {
  const key = normalizeDrillKey(prompt);
  if (!key) return existingSet || new Set();
  const next = new Set(existingSet || getSeenDrillKeys());
  next.add(key);

  const readable = stripDrillPromptWrapper(targetSentence || prompt);
  if (targetSentence) {
    const targetKey = normalizeDrillKey(targetSentence);
    if (targetKey) next.add(targetKey);
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEEN_DRILLS_STORAGE_KEY, JSON.stringify(Array.from(next).slice(-MAX_STORED_SEEN_PROMPTS)));
      if (readable) {
        const existingPrompts = getSeenDrillPrompts();
        const deduped = existingPrompts.filter(
          (p) => normalizeDrillKey(p) !== key && (!targetSentence || normalizeDrillKey(p) !== normalizeDrillKey(targetSentence))
        );
        deduped.push(readable);
        localStorage.setItem(
          SEEN_DRILL_PROMPTS_STORAGE_KEY,
          JSON.stringify(deduped.slice(-MAX_STORED_SEEN_PROMPTS))
        );
      }
    } catch {}
  }
  return next;
}

/**
 * Common stop words / grammatical particles across supported languages
 * to allow accurate focus on distinctive lexical and structural tokens.
 */
const COMMON_STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'it', 'that', 'this', 'very',
  // German
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'in', 'im', 'an', 'am', 'auf', 'für', 'mit', 'von', 'zu', 'ist', 'sind', 'war', 'waren', 'es', 'dass', 'sehr',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'en', 'de', 'del', 'a', 'al', 'con', 'por', 'para', 'es', 'son', 'fue', 'fueron', 'que', 'muy',
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'en', 'dans', 'de', 'du', 'par', 'pour', 'avec', 'est', 'sont', 'que', 'qui', 'très',
  // Italian
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'e', 'o', 'in', 'a', 'da', 'di', 'del', 'della', 'per', 'con', 'su', 'è', 'sono', 'che', 'molto',
  // Portuguese
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'em', 'de', 'do', 'da', 'para', 'com', 'por', 'é', 'são', 'que', 'muito'
]);

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;

/**
 * Extracts normalized tokens from a drill prompt, stripping punctuation, wrappers, and blanks.
 * For CJK scripts (Japanese/Mandarin), extracts overlapping character bigrams so similarity
 * comparison remains accurate without whitespace word boundaries.
 */
export function extractDrillTokens(prompt: string, filterStopwords = false): string[] {
  const unwrapped = stripDrillPromptWrapper(prompt);
  const clean = unwrapped
    .toLowerCase()
    .replace(/[___]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  if (CJK_REGEX.test(clean)) {
    const compact = clean.replace(/\s+/g, '');
    const grams: string[] = [];
    const chars = Array.from(compact);
    for (let i = 0; i < chars.length - 1; i++) {
      grams.push(chars[i] + chars[i + 1]);
    }
    return grams.length > 0 ? grams : chars;
  }

  const rawTokens = clean.split(/\s+/).filter(Boolean);
  if (!filterStopwords) return rawTokens;
  return rawTokens.filter(t => t.length > 2 && !COMMON_STOP_WORDS.has(t));
}

/**
 * Calculates lexical Jaccard similarity between two sentence prompts.
 * Range: 0 (completely different words) to 1 (identical set of words).
 */
export function computeSentenceSimilarity(promptA: string, promptB: string): number {
  if (!promptA || !promptB) return 0;
  if (normalizeDrillKey(promptA) === normalizeDrillKey(promptB)) return 1.0;

  const tokensA = extractDrillTokens(promptA, true);
  const tokensB = extractDrillTokens(promptB, true);

  if (tokensA.length === 0 || tokensB.length === 0) {
    const rawA = extractDrillTokens(promptA, false);
    const rawB = extractDrillTokens(promptB, false);
    if (rawA.length === 0 || rawB.length === 0) return 0;
    const setA = new Set(rawA);
    const setB = new Set(rawB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculates stemmed-prefix similarity (first 5 characters of longer content words)
 * to catch verb conjugation / declension / inflection variations of the same sentence.
 */
function computeStemmedSimilarity(promptA: string, promptB: string): number {
  const stemsA = extractDrillTokens(promptA, true).map(t => (t.length >= 5 ? t.slice(0, 5) : t));
  const stemsB = extractDrillTokens(promptB, true).map(t => (t.length >= 5 ? t.slice(0, 5) : t));
  if (stemsA.length < 3 || stemsB.length < 3) return 0;
  const setA = new Set(stemsA);
  const setB = new Set(stemsB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Checks if two drill sentences share an identical contiguous sequence of words (n-gram).
 */
export function hasContiguousPhraseOverlap(promptA: string, promptB: string, minWords = 4): boolean {
  const tokensA = extractDrillTokens(promptA, false);
  const tokensB = extractDrillTokens(promptB, false);

  if (tokensA.length < minWords || tokensB.length < minWords) return false;

  const ngramsA = new Set<string>();
  for (let i = 0; i <= tokensA.length - minWords; i++) {
    ngramsA.add(tokensA.slice(i, i + minWords).join(' '));
  }

  for (let j = 0; j <= tokensB.length - minWords; j++) {
    const gramB = tokensB.slice(j, j + minWords).join(' ');
    if (ngramsA.has(gramB)) return true;
  }
  return false;
}

/**
 * Checks if two prompts share a contiguous 3-word phrase containing at least two non-stopword tokens
 * (catches template skeletons like "bezug auf die", "indispensable que el", etc.).
 */
function hasMeaningfulTrigramOverlap(promptA: string, promptB: string): boolean {
  const tokensA = extractDrillTokens(promptA, false);
  const tokensB = extractDrillTokens(promptB, false);
  if (tokensA.length < 3 || tokensB.length < 3) return false;

  const trigramsA = new Set<string>();
  for (let i = 0; i <= tokensA.length - 3; i++) {
    const slice = tokensA.slice(i, i + 3);
    const meaningfulCount = slice.filter(t => t.length > 2 && !COMMON_STOP_WORDS.has(t)).length;
    if (meaningfulCount >= 2) {
      trigramsA.add(slice.join(' '));
    }
  }
  if (trigramsA.size === 0) return false;

  for (let j = 0; j <= tokensB.length - 3; j++) {
    const gram = tokensB.slice(j, j + 3).join(' ');
    if (trigramsA.has(gram)) return true;
  }
  return false;
}

/**
 * Determines whether two drill questions are "too similar in wording".
 * Rejects exact matches, high content/stem overlap, template openings, and shared phrase blocks.
 */
export function areDrillsTooSimilar(promptA: string, promptB: string, threshold = 0.34): boolean {
  const keyA = normalizeDrillKey(promptA);
  const keyB = normalizeDrillKey(promptB);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  // Content word Jaccard similarity (including CJK bigrams)
  const sim = computeSentenceSimilarity(promptA, promptB);
  if (sim >= threshold) return true;

  // Conjugation / declension stem overlap
  if (computeStemmedSimilarity(promptA, promptB) >= 0.38) return true;

  // Contiguous phrase overlap (4 raw words, or 3 meaningful words)
  if (hasContiguousPhraseOverlap(promptA, promptB, 4)) return true;
  if (hasMeaningfulTrigramOverlap(promptA, promptB)) return true;

  // Identical 3-word raw sentence opening (catches "In Bezug auf...", "Es indispensable que...", "Könnten Sie mir...")
  const rawA = extractDrillTokens(promptA, false);
  const rawB = extractDrillTokens(promptB, false);
  if (rawA.length >= 4 && rawB.length >= 4) {
    if (rawA.slice(0, 3).join(' ') === rawB.slice(0, 3).join(' ')) {
      return true;
    }
  }

  // Identical opening 2 content words (catches template re-skins with swapped endings)
  const contentA = extractDrillTokens(promptA, true);
  const contentB = extractDrillTokens(promptB, true);
  if (contentA.length >= 3 && contentB.length >= 3) {
    if (contentA.slice(0, 2).join(' ') === contentB.slice(0, 2).join(' ')) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the canonical sentence text for a drill so similarity checking compares
 * target sentences directly (especially for sentence-ordering drills).
 */
export function getDrillComparisonText(
  drill: Pick<PracticeDrill, 'prompt' | 'type' | 'correctAnswer'>
): string {
  if (drill.type === 'sentence-ordering') {
    const answerText = Array.isArray(drill.correctAnswer)
      ? drill.correctAnswer.join(' ').trim()
      : String(drill.correctAnswer || '').trim();
    if (answerText.length >= 8) {
      return answerText;
    }
  }
  return stripDrillPromptWrapper(drill.prompt);
}

/**
 * Tests a candidate prompt against an array or Set of already seen / queued prompts.
 * Returns true if the candidate is unique and NOT similar to any of them.
 */
export function isDrillWordingDistinct(candidatePrompt: string, existingPrompts: Iterable<string>): boolean {
  const candKey = normalizeDrillKey(candidatePrompt);
  if (!candKey) return false;
  for (const existing of existingPrompts) {
    if (!existing) continue;
    if (normalizeDrillKey(existing) === candKey) return false;
    if (areDrillsTooSimilar(candidatePrompt, existing)) return false;
  }
  return true;
}

/**
 * Filters candidate drills against existing seen/queued texts AND against earlier accepted
 * candidates within the same batch so no two returned drills have similar wording.
 */
export function filterDistinctDrills<
  T extends Pick<PracticeDrill, 'prompt' | 'type' | 'correctAnswer'>
>(candidates: T[], existingTexts: Iterable<string> = []): T[] {
  const accepted: T[] = [];
  const comparisonCorpus: string[] = [];
  const seenKeySet = new Set<string>();
  const batchAnswerKeys = new Set<string>();

  for (const item of existingTexts) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    comparisonCorpus.push(raw);
    const key = normalizeDrillKey(raw);
    if (key) seenKeySet.add(key);
  }

  for (const cand of candidates) {
    const promptText = stripDrillPromptWrapper(cand.prompt);
    const targetText = getDrillComparisonText(cand);
    const promptKey = normalizeDrillKey(cand.prompt);
    const targetKey = normalizeDrillKey(targetText);

    if (!promptKey && !targetKey) continue;
    if (seenKeySet.has(promptKey) || (targetKey && seenKeySet.has(targetKey))) {
      continue;
    }

    if (cand.type === 'fill-blank' || cand.type === 'guess-missing-word') {
      const answerKey = normalizeDrillKey(getPrimaryAnswerString(cand.correctAnswer));
      if (answerKey && batchAnswerKeys.has(answerKey)) {
        continue;
      }
    }

    const promptDistinct = isDrillWordingDistinct(promptText, comparisonCorpus);
    const targetDistinct =
      targetText === promptText || isDrillWordingDistinct(targetText, comparisonCorpus);

    if (!promptDistinct || !targetDistinct) {
      continue;
    }

    accepted.push(cand);
    if (cand.type === 'fill-blank' || cand.type === 'guess-missing-word') {
      const answerKey = normalizeDrillKey(getPrimaryAnswerString(cand.correctAnswer));
      if (answerKey) batchAnswerKeys.add(answerKey);
    }
    if (promptText) comparisonCorpus.push(promptText);
    if (targetText && targetText !== promptText) comparisonCorpus.push(targetText);
    if (promptKey) seenKeySet.add(promptKey);
    if (targetKey) seenKeySet.add(targetKey);
  }

  return accepted;
}

export interface ShuffleOptionsConfig {
  seed?: string | number;
  avoidIndex?: number;
}

/**
 * Shuffles an array of choices for a Fill-in-the-Blank drill.
 * Ensures options are randomized each time, the correct answer is positioned randomly
 * across all available option slots, and when `avoidIndex` is specified, guarantees
 * that the correct answer does NOT repeat in the same option position as the previous question.
 */
export function shuffleFillBlankOptions(
  options: string[] | undefined,
  correctAnswer?: string | string[],
  configOrSeed?: ShuffleOptionsConfig | string | number
): string[] {
  if (!Array.isArray(options) || options.length <= 1) {
    return options ? [...options] : [];
  }
  const copy = [...options];

  let seed: string | number | undefined;
  let avoidIndex: number | undefined;

  if (configOrSeed !== null && typeof configOrSeed === 'object') {
    seed = configOrSeed.seed;
    avoidIndex = configOrSeed.avoidIndex;
  } else {
    seed = configOrSeed;
  }

  // Fisher-Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    let j: number;
    if (seed !== undefined) {
      const seedNum =
        typeof seed === 'number'
          ? seed
          : String(seed)
              .split('')
              .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      j = Math.floor(Math.abs(Math.sin(seedNum + i * 29)) * (i + 1));
    } else {
      j = Math.floor(Math.random() * (i + 1));
    }
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  // If correct answer is provided, place it in a truly randomized option slot,
  // guaranteeing that it does not repeat the avoidIndex (previous question's correct answer option)
  if (correctAnswer && copy.length > 1) {
    const target = getPrimaryAnswerString(correctAnswer).toLowerCase();
    const currentIdx = copy.findIndex(opt => opt.toLowerCase() === target);

    if (currentIdx !== -1) {
      let targetSlot: number;
      if (avoidIndex !== undefined && avoidIndex >= 0 && avoidIndex < copy.length && copy.length > 1) {
        // Exclude the avoidIndex to guarantee the correct answer doesn't repeat the same option position
        const candidateSlots = Array.from({ length: copy.length }, (_, k) => k).filter(k => k !== avoidIndex);
        targetSlot = candidateSlots[Math.floor(Math.random() * candidateSlots.length)];
      } else {
        // Distribute uniformly across all slots (0, 1, ..., length - 1)
        targetSlot = Math.floor(Math.random() * copy.length);
      }

      if (currentIdx !== targetSlot) {
        const temp = copy[currentIdx];
        copy[currentIdx] = copy[targetSlot];
        copy[targetSlot] = temp;
      }
    }
  }

  return copy;
}

/**
 * Prepares a PracticeDrill for display:
 * - Shuffles fill-blank options across all available slots so the answer isn't only in option 1.
 * - Scrambles sentence tokens for sentence-ordering drills.
 */
export function prepareDrillForDisplay(drill: PracticeDrill, avoidIndex?: number): PracticeDrill {
  if (!drill) return drill;
  const prepared: PracticeDrill = { ...drill };
  if (drill.type === 'fill-blank' && Array.isArray(drill.options)) {
    prepared.options = shuffleFillBlankOptions(drill.options, drill.correctAnswer, { avoidIndex });
  }
  if (drill.type === 'sentence-ordering') {
    const tokens =
      Array.isArray(drill.scrambledTokens) && drill.scrambledTokens.length > 0
        ? drill.scrambledTokens
        : Array.isArray(drill.correctAnswer)
          ? drill.correctAnswer
          : typeof drill.correctAnswer === 'string'
            ? drill.correctAnswer.trim().split(/\s+/)
            : [];
    prepared.scrambledTokens = scrambleSentenceTokens(tokens);
  }
  return prepared;
}

/**
 * Selects fresh, non-repeating drills for Fill in the Blanks, Rearrange Words,
 * and Guess the Missing Word whenever a user enters AI Drills.
 * Guarantees that previously seen sentences are excluded and options are shuffled.
 */
export function selectFreshDrills(
  pool: PracticeDrill[],
  seenKeys: Set<string>,
  languageName: string,
  countPerType: number = 2
): { freshDrills: PracticeDrill[]; updatedSeen: Set<string>; isFreshCycle: boolean } {
  const langLower = languageName.toLowerCase();
  const langPool = pool.filter(d => d.language.toLowerCase() === langLower);
  const targetPool = langPool.length > 0 ? langPool : pool;

  const types: DrillType[] = ['fill-blank', 'sentence-ordering', 'guess-missing-word'];
  const freshList: PracticeDrill[] = [];
  const nextSeen = new Set(seenKeys);
  let isFreshCycle = false;

  types.forEach(type => {
    const ofType = targetPool.filter(d => d.type === type);
    if (ofType.length === 0) return;

    // Filter out previously seen sentences
    let unseen = ofType.filter(d => !nextSeen.has(normalizeDrillKey(d.prompt)));

    // If all items of this type have been seen in this limited pool, recycle for this type
    if (unseen.length === 0) {
      isFreshCycle = true;
      ofType.forEach(d => nextSeen.delete(normalizeDrillKey(d.prompt)));
      unseen = [...ofType];
    }

    // Shuffle unseen candidates pseudo-randomly
    const shuffled = [...unseen].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, countPerType);

    chosen.forEach(d => {
      const prepared = prepareDrillForDisplay(d);
      freshList.push(prepared);
      nextSeen.add(normalizeDrillKey(d.prompt));
    });
  });

  // Interleave the chosen drills so types alternate naturally
  freshList.sort(() => Math.random() - 0.5);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEEN_DRILLS_STORAGE_KEY, JSON.stringify(Array.from(nextSeen)));
    } catch {}
  }

  return { freshDrills: freshList, updatedSeen: nextSeen, isFreshCycle };
}


