import { CEFRLevel, DrillType, PracticeDrill } from '../types';
import {
  extractDrillTokens,
  filterDistinctDrills,
  getDrillComparisonText,
  normalizeDrillKey,
  scrambleSentenceTokens,
  shuffleFillBlankOptions,
  stripDrillPromptWrapper
} from './drillEvaluation';

export const DYNAMIC_REAL_WORLD_ANGLES = [
  'neighborhood street markets & seasonal produce',
  'regional rail travel, night trains & station announcements',
  'contemporary architecture & sustainable city neighborhoods',
  'independent cinema, bookshops & cultural festivals',
  'ocean conservation, renewable energy & science breakthroughs',
  'local bakeries, regional coffee culture & culinary traditions',
  'startup teamwork, remote collaboration & creative problem solving',
  'mountain hiking, national parks & weekend outdoor adventures',
  'museum exhibitions, modern art & historical landmarks',
  'music concerts, theater rehearsals & community radio interviews',
  'everyday errands, pharmacies, libraries & post offices',
  'sports clubs, cycling lanes & active urban lifestyles',
  'podcasts, journalism & digital media habits',
  'seasonal weather shifts, agriculture & botanical gardens',
  'cooking recipes, dinner hosting & regional hospitality',
  'university seminars, exchange students & campus life',
  'maritime harbors, coastal towns & ferry crossings',
  'artisan workshops, design studios & sustainable fashion'
];

export const GRAMMAR_SYNTAX_ANGLES = [
  'natural questions, indirect inquiries & polite requests',
  'time-anchored storytelling using past & present contrasts',
  'idiomatic phrasal or prepositional verbs in everyday dialogue',
  'conditional "what-if" scenarios & hypothetical preferences',
  'cause-and-consequence clauses & nuanced connectors',
  'everyday sensory descriptions, adjectives & comparisons',
  'passive or impersonal real-world news phrasing',
  'relative clauses adding vivid background detail',
  'expressing surprise, agreement & polite disagreement',
  'practical imperatives, advice & recommendations'
];

export interface GoogleDrillPromptParams {
  language: string;
  level: CEFRLevel | string;
  nativeLanguage: string;
  drillType: string;
  topic: string;
  count: number;
  seenPrompts: string[];
  requestNonce?: string | number;
  avoidExtraOpenings?: string[];
}

export interface WebSourceRef {
  title: string;
  url: string;
}

/**
 * Extracts readable 3-word sentence openings from already seen drills
 * so Gemini is explicitly instructed not to reuse those openings.
 */
export function extractForbiddenOpenings(prompts: string[], limit = 18): string[] {
  const openings: string[] = [];
  const seenSet = new Set<string>();

  for (let i = prompts.length - 1; i >= 0 && openings.length < limit; i--) {
    const raw = stripDrillPromptWrapper(prompts[i]);
    if (!raw) continue;
    const tokens = extractDrillTokens(raw, false);
    if (tokens.length >= 2) {
      const opening = tokens.slice(0, Math.min(3, tokens.length)).join(' ');
      if (opening && !seenSet.has(opening)) {
        seenSet.add(opening);
        openings.push(opening);
      }
    }
  }
  return openings;
}

/**
 * Builds a randomized, non-repeating Google Search grounded prompt that explores
 * distinct real-world web topics and sentence structures on every single request.
 */
export function buildGoogleDrillPrompt(params: GoogleDrillPromptParams): {
  prompt: string;
  searchAngle: string;
  grammarAngle: string;
  searchQuerySeed: string;
} {
  const {
    language,
    level,
    nativeLanguage,
    drillType,
    topic,
    count,
    seenPrompts,
    requestNonce = Date.now(),
    avoidExtraOpenings = []
  } = params;

  const seedHash = String(requestNonce)
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 7), 0);

  const angleIdx = (seedHash + seenPrompts.length) % DYNAMIC_REAL_WORLD_ANGLES.length;
  const secondAngleIdx = (angleIdx + 7) % DYNAMIC_REAL_WORLD_ANGLES.length;
  const grammarIdx = (seedHash * 3 + seenPrompts.length) % GRAMMAR_SYNTAX_ANGLES.length;

  const searchAngle = DYNAMIC_REAL_WORLD_ANGLES[angleIdx];
  const secondaryAngle = DYNAMIC_REAL_WORLD_ANGLES[secondAngleIdx];
  const grammarAngle = GRAMMAR_SYNTAX_ANGLES[grammarIdx];

  const cleanTopic = topic?.trim() || 'authentic real-world communication';
  const searchQuerySeed = `${language} real-world expressions ${cleanTopic} ${searchAngle}`;

  const typeDirective =
    drillType && drillType !== 'all'
      ? `Generate ${count} drills STRICTLY of type "${drillType}".`
      : `Generate ${count} drills balanced across "fill-blank", "sentence-ordering", and "guess-missing-word" (at least 1 of each type).`;

  const readableSeen = seenPrompts
    .map((p) => stripDrillPromptWrapper(String(p)))
    .filter((p) => p.length > 4)
    .slice(-45);

  const forbiddenOpenings = Array.from(
    new Set([...extractForbiddenOpenings(readableSeen, 16), ...avoidExtraOpenings])
  ).slice(0, 20);

  const avoidanceSection =
    readableSeen.length > 0 || forbiddenOpenings.length > 0
      ? `\nCRITICAL ANTI-REPETITION & ANTI-SIMILARITY RULES:
- The learner has ALREADY practiced these sentences (DO NOT repeat or reword any of them):
${readableSeen.slice(-24).map((s) => `  * "${s.slice(0, 110)}"`).join('\n')}
${forbiddenOpenings.length > 0 ? `- FORBIDDEN SENTENCE OPENINGS (never start any drill with these words): ${forbiddenOpenings.map((o) => `"${o}"`).join(', ')}` : ''}
- Every drill in this batch MUST use a completely different scenario, grammatical construction, subject, verb, and opening phrase from every other drill in this batch AND from the seen list above.
- NEVER use repetitive template scaffolding (no recycled "In Bezug auf...", "Es indispensable que...", or identical subject + blank templates).`
      : `\nDIVERSITY RULE: Every drill in this batch MUST have a unique opening, subject, verb, and real-world scenario.`;

  const prompt = `Use Google Search to discover fresh, current real-world articles, cultural discussions, or everyday dialogues in "${language}" around:
- Primary focus: "${cleanTopic}" blended with "${searchAngle}" and "${secondaryAngle}"
- Grammar spotlight: "${grammarAngle}"
- Search seed: "${searchQuerySeed}" (variation #${seedHash % 9973})

TARGET LEARNER PROFILE:
- Target Language (STRICT): ${language}
- Learner CEFR Level: ${level}
- Learner Native Language (for hint/explanation/translation ONLY): ${nativeLanguage}

STRICT LANGUAGE & FORMAT RULES:
1. All target drill sentences, blanks, multiple-choice options, ordering tokens, and answers MUST be 100% natural, authentic "${language}" — NEVER leak words from another target language.
2. Make every sentence genuinely novel, vivid, and grounded in real-world usage you found via Google Search. Vary perspectives (1st person, questions, observations, news/cultural facts, dialogue quotes).
3. ${typeDirective}${avoidanceSection}

TYPE SPECIFICATIONS:
- "fill-blank": "prompt" is a natural ${language} sentence containing exactly one "___" placeholder; "options" has 4 distinct plausible ${language} choices including "correctAnswer".
- "sentence-ordering": "prompt" describes the meaning in ${nativeLanguage} (e.g. Form: "..."), "orderedTokens" is the array of natural ${language} words in exact solved order (5 to 12 words), "scrambledTokens" is the shuffled array of the exact same words.
- "guess-missing-word": "prompt" is a natural ${language} sentence containing exactly one "___" placeholder; "wordClue" is a concise clue in ${nativeLanguage}; "correctAnswer" is the single missing word in ${language}.

Return ONLY valid JSON matching this schema (no markdown commentary outside JSON):
{
  "drills": [
    {
      "type": "fill-blank" | "sentence-ordering" | "guess-missing-word",
      "instruction": "short clear instruction in ${nativeLanguage}",
      "prompt": "sentence with ___ (for fill-blank/guess-missing-word) OR meaning description (for sentence-ordering)",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": "...",
      "orderedTokens": ["..."],
      "scrambledTokens": ["..."],
      "wordClue": "...",
      "hint": "concise hint in ${nativeLanguage}",
      "grammarExplanation": "concise grammatical rule in ${nativeLanguage}",
      "translation": "natural translation in ${nativeLanguage}",
      "sourceFact": "1-sentence summary in ${nativeLanguage} of the real-world article/topic found via Google Search"
    }
  ]
}`;

  return { prompt, searchAngle, grammarAngle, searchQuerySeed };
}

const ENGLISH_ONLY_MARKERS = new Set([
  'the',
  'would',
  'could',
  'should',
  'these',
  'those',
  'their',
  'there',
  'because',
  'however',
  'between',
  'through',
  'without',
  'always',
  'never'
]);

const JAPANESE_SCRIPT_REGEX = /[\u3040-\u30ff]/;
const CJK_HANZI_REGEX = /[\u4e00-\u9fff]/;

/**
 * Verifies that a generated drill actually belongs to the requested target language
 * (e.g. Japanese contains Kana, Mandarin contains Hanzi, non-English drills don't leak pure English sentences).
 */
export function isDrillTargetLanguageValid(
  drill: Pick<PracticeDrill, 'type' | 'prompt' | 'correctAnswer' | 'options' | 'orderedTokens'>,
  targetLanguage: string
): boolean {
  const langLower = targetLanguage.trim().toLowerCase();
  const sampleText =
    drill.type === 'sentence-ordering'
      ? Array.isArray(drill.orderedTokens) && drill.orderedTokens.length > 0
        ? drill.orderedTokens.join(' ')
        : Array.isArray(drill.correctAnswer)
          ? drill.correctAnswer.join(' ')
          : String(drill.correctAnswer || '')
      : `${drill.prompt} ${Array.isArray(drill.correctAnswer) ? drill.correctAnswer.join(' ') : drill.correctAnswer || ''}`;

  const cleanSample = sampleText.replace(/[___]+/g, ' ').trim();
  if (!cleanSample) return false;

  if (langLower === 'japanese' || langLower === 'ja') {
    return JAPANESE_SCRIPT_REGEX.test(cleanSample) || CJK_HANZI_REGEX.test(cleanSample);
  }

  if (langLower === 'mandarin' || langLower === 'chinese' || langLower === 'zh') {
    return CJK_HANZI_REGEX.test(cleanSample);
  }

  if (langLower !== 'english' && langLower !== 'en') {
    const tokens = extractDrillTokens(cleanSample, false);
    if (tokens.length >= 4) {
      const englishMarkerHits = tokens.filter((t) => ENGLISH_ONLY_MARKERS.has(t)).length;
      if (englishMarkerHits / tokens.length >= 0.45) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Extracts a JSON payload from raw Gemini output (supporting plain JSON, fenced ```json blocks, or embedded objects).
 */
export function parseGeneratedDrillsJson(rawText: string): any | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {}

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

/**
 * Normalizes, schema-validates, language-checks, and anti-similarity-filters raw Gemini drill candidates
 * against all client seen prompts, server rolling history, and intra-batch siblings.
 */
export function validateAndFilterGeneratedDrills(params: {
  rawDrills: any[];
  language: string;
  level: CEFRLevel;
  requestedType: string;
  existingCorpus: Iterable<string>;
  webSources?: WebSourceRef[];
  searchQueryUsed?: string;
}): PracticeDrill[] {
  const {
    rawDrills,
    language,
    level,
    requestedType,
    existingCorpus,
    webSources = [],
    searchQueryUsed
  } = params;

  if (!Array.isArray(rawDrills) || rawDrills.length === 0) return [];
  const primarySource = webSources[0];
  const normalizedCandidates: PracticeDrill[] = [];

  for (let idx = 0; idx < rawDrills.length; idx++) {
    const d = rawDrills[idx];
    if (!d || typeof d !== 'object') continue;

    const rawType = String(d.type || '').trim().toLowerCase();
    let validType: DrillType =
      rawType === 'sentence-ordering' || rawType === 'guess-missing-word' || rawType === 'fill-blank'
        ? (rawType as DrillType)
        : 'fill-blank';

    if (requestedType && requestedType !== 'all' && validType !== requestedType) {
      // Honor requested filter strictly if candidate can satisfy it, otherwise skip
      continue;
    }

    const rawPrompt = String(d.prompt || '')
      .trim()
      .replace(/_{2,}|\[_+?\]|\(\s*_+?\s*\)|\[blank\]|\(blank\)/gi, '___');

    if (validType === 'fill-blank') {
      if (!rawPrompt.includes('___')) continue;
      const rawCorrect = String(
        Array.isArray(d.correctAnswer) ? d.correctAnswer[0] || '' : d.correctAnswer || ''
      ).trim();
      if (!rawCorrect) continue;

      const rawOptions = Array.isArray(d.options)
        ? d.options.map((o: any) => String(o || '').trim()).filter(Boolean)
        : [];
      const uniqueOptions: string[] = [];
      const optSeen = new Set<string>();
      for (const opt of [rawCorrect, ...rawOptions]) {
        const lower = opt.toLowerCase();
        if (!optSeen.has(lower)) {
          optSeen.add(lower);
          uniqueOptions.push(opt);
        }
      }
      if (uniqueOptions.length < 3) continue;

      const finalOptions = shuffleFillBlankOptions(uniqueOptions.slice(0, 4), rawCorrect);
      const drill: PracticeDrill = {
        id: `ai_google_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'fill-blank',
        language,
        level,
        instruction: String(d.instruction || 'Select the most natural word to complete the sentence.').trim(),
        prompt: rawPrompt,
        options: finalOptions,
        correctAnswer: rawCorrect,
        hint: String(d.hint || '').trim(),
        grammarExplanation: String(d.grammarExplanation || '').trim(),
        translation: String(d.translation || '').trim(),
        groundedByGoogle: Boolean(primarySource || searchQueryUsed),
        sourceTitle: primarySource?.title || (searchQueryUsed ? 'Google Search Grounded' : 'Gemini Language Engine'),
        sourceUrl: primarySource?.url,
        sourceFact: d.sourceFact ? String(d.sourceFact).trim() : undefined
      };

      if (!isDrillTargetLanguageValid(drill, language)) continue;
      normalizedCandidates.push(drill);
    } else if (validType === 'sentence-ordering') {
      const ordered =
        Array.isArray(d.orderedTokens) && d.orderedTokens.length >= 3
          ? d.orderedTokens.map((t: any) => String(t || '').trim()).filter(Boolean)
          : typeof d.correctAnswer === 'string'
            ? d.correctAnswer.trim().split(/\s+/).filter(Boolean)
            : Array.isArray(d.correctAnswer)
              ? d.correctAnswer.map((t: any) => String(t || '').trim()).filter(Boolean)
              : [];

      if (ordered.length < 3) continue;
      const scrambled = scrambleSentenceTokens(ordered);
      const displayPrompt =
        rawPrompt && normalizeDrillKey(rawPrompt) !== normalizeDrillKey(ordered.join(' '))
          ? rawPrompt
          : `Form: "${String(d.translation || ordered.join(' ')).trim()}"`;

      const drill: PracticeDrill = {
        id: `ai_google_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'sentence-ordering',
        language,
        level,
        instruction: String(d.instruction || 'Arrange the words into a natural sentence.').trim(),
        prompt: displayPrompt,
        correctAnswer: ordered,
        orderedTokens: ordered,
        scrambledTokens: scrambled,
        hint: String(d.hint || '').trim(),
        grammarExplanation: String(d.grammarExplanation || '').trim(),
        translation: String(d.translation || ordered.join(' ')).trim(),
        groundedByGoogle: Boolean(primarySource || searchQueryUsed),
        sourceTitle: primarySource?.title || (searchQueryUsed ? 'Google Search Grounded' : 'Gemini Language Engine'),
        sourceUrl: primarySource?.url,
        sourceFact: d.sourceFact ? String(d.sourceFact).trim() : undefined
      };

      if (!isDrillTargetLanguageValid(drill, language)) continue;
      normalizedCandidates.push(drill);
    } else if (validType === 'guess-missing-word') {
      if (!rawPrompt.includes('___')) continue;
      const rawCorrect = String(
        Array.isArray(d.correctAnswer) ? d.correctAnswer[0] || '' : d.correctAnswer || ''
      ).trim();
      if (!rawCorrect) continue;

      const drill: PracticeDrill = {
        id: `ai_google_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'guess-missing-word',
        language,
        level,
        instruction: String(d.instruction || 'Type the missing word from context and clue.').trim(),
        prompt: rawPrompt,
        correctAnswer: rawCorrect,
        wordClue: d.wordClue ? String(d.wordClue).trim() : String(d.hint || 'Context vocabulary').trim(),
        hint: String(d.hint || '').trim(),
        grammarExplanation: String(d.grammarExplanation || '').trim(),
        translation: String(d.translation || '').trim(),
        groundedByGoogle: Boolean(primarySource || searchQueryUsed),
        sourceTitle: primarySource?.title || (searchQueryUsed ? 'Google Search Grounded' : 'Gemini Language Engine'),
        sourceUrl: primarySource?.url,
        sourceFact: d.sourceFact ? String(d.sourceFact).trim() : undefined
      };

      if (!isDrillTargetLanguageValid(drill, language)) continue;
      normalizedCandidates.push(drill);
    }
  }

  return filterDistinctDrills(normalizedCandidates, existingCorpus);
}

/**
 * Extracts canonical comparison strings from generated drills for history persistence.
 */
export function extractDrillHistoryStrings(drills: PracticeDrill[]): string[] {
  const strings: string[] = [];
  for (const d of drills) {
    const promptClean = stripDrillPromptWrapper(d.prompt);
    const comparison = getDrillComparisonText(d);
    if (promptClean) strings.push(promptClean);
    if (comparison && comparison !== promptClean) strings.push(comparison);
  }
  return strings;
}
