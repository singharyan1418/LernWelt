import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDrillText,
  evaluateFillBlankAnswer,
  evaluateSentenceOrderAnswer,
  evaluateGuessMissingWordAnswer,
  buildMissingWordMask,
  filterDrillsByType,
  scrambleSentenceTokens,
  validateCustomVocabInput,
  normalizeDrillKey,
  selectFreshDrills,
  shuffleFillBlankOptions,
  prepareDrillForDisplay,
  computeSentenceSimilarity,
  areDrillsTooSimilar,
  isDrillWordingDistinct
} from './drillEvaluation';
import { getNonRepeatingDrills, generateProceduralDrills } from './dynamicDrillPool';
import { PracticeDrill } from '../types';

test('evaluateFillBlankAnswer matches case-insensitively and ignores outer punctuation', () => {
  assert.equal(evaluateFillBlankAnswer('paramount', 'paramount'), true);
  assert.equal(evaluateFillBlankAnswer('  Paramount. ', 'paramount'), true);
  assert.equal(evaluateFillBlankAnswer('colossal', 'paramount'), false);
  assert.equal(evaluateFillBlankAnswer('', 'paramount'), false);
});

test('evaluateSentenceOrderAnswer validates rearranged word sequences accurately', () => {
  const target = ['Ich', 'lerne', 'Deutsch,', 'weil', 'ich', 'heute', 'Zeit', 'habe.'];
  assert.equal(
    evaluateSentenceOrderAnswer(
      ['Ich', 'lerne', 'Deutsch,', 'weil', 'ich', 'heute', 'Zeit', 'habe.'],
      target
    ),
    true
  );
  assert.equal(
    evaluateSentenceOrderAnswer(
      ['Ich', 'lerne', 'Deutsch,', 'weil', 'ich', 'habe', 'heute', 'Zeit.'],
      target
    ),
    false
  );
  assert.equal(evaluateSentenceOrderAnswer([], target), false);
});

test('evaluateGuessMissingWordAnswer handles exact, synonym, accent-close, and wrong guesses', () => {
  const exact = evaluateGuessMissingWordAnswer('ubiquitous', 'ubiquitous');
  assert.equal(exact.isCorrect, true);
  assert.equal(exact.accentReminder, undefined);

  const synonym = evaluateGuessMissingWordAnswer('ausgezeichnet', 'hervorragend / ausgezeichnet');
  assert.equal(synonym.isCorrect, true);

  const accentClose = evaluateGuessMissingWordAnswer('uberhaupt', 'überhaupt');
  assert.equal(accentClose.isCorrect, true);
  assert.ok(accentClose.accentReminder?.includes('überhaupt'));

  const wrong = evaluateGuessMissingWordAnswer('table', 'ubiquitous');
  assert.equal(wrong.isCorrect, false);
});

test('buildMissingWordMask reveals progressive prefix letters with letter count', () => {
  assert.equal(buildMissingWordMask('Bahnhof', 0), '_ _ _ _ _ _ _ (7 letters)');
  assert.equal(buildMissingWordMask('Bahnhof', 1), 'B _ _ _ _ _ _ (7 letters)');
  assert.equal(buildMissingWordMask('Bahnhof', 3), 'B a h _ _ _ _ (7 letters)');
});

test('filterDrillsByType strictly filters fill-blank, sentence-ordering, and guess-missing-word', () => {
  const sampleDrills: PracticeDrill[] = [
    {
      id: 'd1',
      type: 'fill-blank',
      language: 'English',
      level: 'B1',
      instruction: 'Fill blank',
      prompt: 'She lived here ___ two years.',
      options: ['for', 'since'],
      correctAnswer: 'for',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'd2',
      type: 'sentence-ordering',
      language: 'English',
      level: 'B1',
      instruction: 'Order words',
      prompt: 'Order the sentence',
      scrambledTokens: ['I', 'agree', 'completely.'],
      correctAnswer: ['I', 'agree', 'completely.'],
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'd3',
      type: 'guess-missing-word',
      language: 'English',
      level: 'B2',
      instruction: 'Guess the missing word',
      prompt: 'Smartphones have become ___ in modern life.',
      correctAnswer: 'ubiquitous',
      wordClue: 'present everywhere',
      hint: '',
      grammarExplanation: '',
      translation: ''
    }
  ];

  assert.equal(filterDrillsByType(sampleDrills, 'all').length, 3);
  assert.equal(filterDrillsByType(sampleDrills, 'fill-blank').length, 1);
  assert.equal(filterDrillsByType(sampleDrills, 'sentence-ordering').length, 1);
  assert.equal(filterDrillsByType(sampleDrills, 'guess-missing-word').length, 1);
  assert.equal(filterDrillsByType(sampleDrills, 'guess-missing-word')[0].id, 'd3');
});

test('scrambleSentenceTokens never leaves a multi-word sentence in solved order', () => {
  const solved = ['Könnten', 'Sie', 'mir', 'bitte', 'helfen?'];
  const scrambled = scrambleSentenceTokens(solved);
  assert.equal(scrambled.length, solved.length);
  assert.notEqual(scrambled.join(' '), solved.join(' '));
  assert.equal(normalizeDrillText(scrambled.slice().sort().join(' ')), normalizeDrillText(solved.slice().sort().join(' ')));
});

test('validateCustomVocabInput enforces required word and meaning fields', () => {
  assert.equal(validateCustomVocabInput('', 'present everywhere').valid, false);
  assert.equal(validateCustomVocabInput('   ', 'present everywhere').valid, false);
  assert.equal(validateCustomVocabInput('ubiquitous', '   ').valid, false);
  assert.equal(validateCustomVocabInput('ubiquitous', 'present everywhere').valid, true);
});

test('normalizeDrillKey normalizes prompts consistently for deduplication', () => {
  const k1 = normalizeDrillKey('Wie geht es ___? Mir geht es sehr gut, danke!');
  const k2 = normalizeDrillKey('Wie geht es ___! mir geht es sehr gut, danke.');
  assert.equal(k1, k2);
});

test('selectFreshDrills guarantees non-repeating sentences across fill-blank, rearrange, and guess-missing-word', () => {
  const pool: PracticeDrill[] = [
    {
      id: 'fb_1',
      type: 'fill-blank',
      language: 'German',
      level: 'A2',
      instruction: 'Fill',
      prompt: 'Sentence A ___ one',
      options: ['a', 'b'],
      correctAnswer: 'a',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'fb_2',
      type: 'fill-blank',
      language: 'German',
      level: 'A2',
      instruction: 'Fill',
      prompt: 'Sentence B ___ two',
      options: ['a', 'b'],
      correctAnswer: 'b',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'so_1',
      type: 'sentence-ordering',
      language: 'German',
      level: 'B1',
      instruction: 'Order',
      prompt: 'Sentence C three',
      scrambledTokens: ['Sentence', 'C', 'three'],
      correctAnswer: ['Sentence', 'C', 'three'],
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'so_2',
      type: 'sentence-ordering',
      language: 'German',
      level: 'B1',
      instruction: 'Order',
      prompt: 'Sentence D four',
      scrambledTokens: ['Sentence', 'D', 'four'],
      correctAnswer: ['Sentence', 'D', 'four'],
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'gm_1',
      type: 'guess-missing-word',
      language: 'German',
      level: 'A2',
      instruction: 'Guess',
      prompt: 'Sentence E ___ five',
      correctAnswer: 'five',
      wordClue: 'number five',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'gm_2',
      type: 'guess-missing-word',
      language: 'German',
      level: 'A2',
      instruction: 'Guess',
      prompt: 'Sentence F ___ six',
      correctAnswer: 'six',
      wordClue: 'number six',
      hint: '',
      grammarExplanation: '',
      translation: ''
    }
  ];

  // First visit: initial seen is empty, countPerType = 1
  const firstVisit = selectFreshDrills(pool, new Set(), 'German', 1);
  assert.equal(firstVisit.freshDrills.length, 3);
  const firstPrompts = firstVisit.freshDrills.map(d => d.prompt);

  // Second visit: pass the updatedSeen from first visit
  const secondVisit = selectFreshDrills(pool, firstVisit.updatedSeen, 'German', 1);
  assert.equal(secondVisit.freshDrills.length, 3);
  const secondPrompts = secondVisit.freshDrills.map(d => d.prompt);

  // Absolutely NO overlap between first and second visit
  for (const p of secondPrompts) {
    assert.equal(firstPrompts.includes(p), false, `Prompt "${p}" was repeated!`);
  }
});

test('shuffleFillBlankOptions shuffles choices so correct answer is NOT restricted to first option', () => {
  const originalOptions = ['dir', 'dich', 'du', 'dein'];
  const correctAnswer = 'dir';

  // Run 60 trials to verify stochastic distribution
  const indexCounts = [0, 0, 0, 0];
  for (let i = 0; i < 60; i++) {
    const shuffled = shuffleFillBlankOptions(originalOptions, correctAnswer);
    assert.equal(shuffled.length, 4);
    assert.deepEqual(shuffled.slice().sort(), originalOptions.slice().sort());

    const answerIdx = shuffled.indexOf(correctAnswer);
    assert.ok(answerIdx >= 0 && answerIdx < 4);
    indexCounts[answerIdx]++;
  }

  // Ensure answer appears in non-zero positions (index 1, 2, or 3) frequently,
  // proving it is NOT only in the first position!
  const nonZeroCount = indexCounts[1] + indexCounts[2] + indexCounts[3];
  assert.ok(nonZeroCount > 30, `Expected answer to appear in non-zero positions, but count was ${nonZeroCount}`);
});

test('shuffleFillBlankOptions never repeats the previous question correct answer option index', () => {
  const options = ['Option Alpha', 'Option Beta', 'Option Gamma', 'Option Delta'];
  const correctAnswer = 'Option Beta';

  let lastIndex = -1;
  // Test across 50 consecutive questions
  for (let q = 0; q < 50; q++) {
    const shuffled = shuffleFillBlankOptions(options, correctAnswer, {
      avoidIndex: lastIndex >= 0 ? lastIndex : undefined
    });

    const currentIndex = shuffled.indexOf(correctAnswer);
    assert.ok(currentIndex >= 0 && currentIndex < 4, 'Correct answer must be present in options');

    if (lastIndex >= 0) {
      assert.notEqual(
        currentIndex,
        lastIndex,
        `Question ${q + 1} repeated correct answer at option index ${currentIndex}!`
      );
    }
    lastIndex = currentIndex;
  }
});

test('prepareDrillForDisplay ensures fill-blank options are randomized', () => {
  const drill: PracticeDrill = {
    id: 'test_1',
    type: 'fill-blank',
    language: 'German',
    level: 'A2',
    instruction: 'Fill',
    prompt: 'Wie geht es ___?',
    options: ['dir', 'dich', 'du', 'dein'],
    correctAnswer: 'dir',
    hint: '',
    grammarExplanation: '',
    translation: ''
  };

  const prepared = prepareDrillForDisplay(drill);
  assert.equal(prepared.options?.length, 4);
  assert.ok(prepared.options?.includes('dir'));
});

test('getNonRepeatingDrills provides fresh non-repeating questions across multiple iterations', () => {
  let seen = new Set<string>();
  const collectedPrompts = new Set<string>();

  // Fetch 3 sequential batches of German drills across all 3 exercises
  for (let batch = 0; batch < 3; batch++) {
    const result = getNonRepeatingDrills([], 'German', 'all', 3, seen);
    assert.ok(result.drills.length >= 3, `Expected at least 3 drills in batch ${batch}`);

    for (const d of result.drills) {
      const key = normalizeDrillKey(d.prompt);
      assert.equal(
        collectedPrompts.has(key),
        false,
        `Question with prompt "${d.prompt}" was repeated in batch ${batch}!`
      );
      collectedPrompts.add(key);
    }

    seen = result.updatedSeen;
  }

  assert.ok(collectedPrompts.size >= 9, 'Expected at least 9 distinct questions across 3 batches');
});

test('getNonRepeatingDrills strictly returns questions in the selected language only', () => {
  const languagesToTest = ['French', 'Spanish', 'Japanese', 'German', 'Mandarin', 'Italian', 'Portuguese'];

  for (const lang of languagesToTest) {
    const result = getNonRepeatingDrills([], lang, 'all', 3, new Set());
    assert.ok(result.drills.length >= 3, `Expected at least 3 drills for ${lang}`);
    for (const d of result.drills) {
      assert.equal(
        d.language.toLowerCase(),
        lang.toLowerCase(),
        `Expected drill to be in ${lang}, but got ${d.language} (prompt: ${d.prompt})`
      );
    }
  }
});

test('getNonRepeatingDrills provides infinite non-repeating questions across 10 sequential rounds', () => {
  let seen = new Set<string>();
  const allPrompts = new Set<string>();

  for (let round = 0; round < 10; round++) {
    const { drills, updatedSeen } = getNonRepeatingDrills([], 'Spanish', 'fill-blank', 3, seen);
    assert.equal(drills.length, 3, `Round ${round} should yield 3 drills`);

    for (const d of drills) {
      const key = normalizeDrillKey(d.prompt);
      assert.equal(allPrompts.has(key), false, `Prompt "${d.prompt}" was repeated in round ${round}!`);
      assert.equal(d.language, 'Spanish', 'Language must remain strictly Spanish');
      allPrompts.add(key);
    }
    seen = updatedSeen;
  }

  assert.equal(allPrompts.size, 30, 'All 30 questions generated across 10 rounds must be completely unique');
});

test('computeSentenceSimilarity calculates lexical token overlap accurately', () => {
  // Identical content words
  const simIdentical = computeSentenceSimilarity(
    'El tren hacia Barcelona sale a las ocho.',
    'El tren hacia Barcelona sale a las ocho.'
  );
  assert.equal(simIdentical, 1);

  // Template clone with only one word difference
  const simHigh = computeSentenceSimilarity(
    'El tren hacia Madrid sale a las diez.',
    'El tren hacia Valencia sale a las diez.'
  );
  assert.ok(simHigh >= 0.5, `Expected high similarity for template clone, got ${simHigh}`);

  // Completely distinct topics
  const simLow = computeSentenceSimilarity(
    'El tren hacia Madrid sale a las diez.',
    'Necesito comprar ingredientes frescos para la cena.'
  );
  assert.ok(simLow < 0.2, `Expected low similarity for distinct sentences, got ${simLow}`);
});

test('areDrillsTooSimilar detects and rejects similar wordings and template re-skins', () => {
  // Common template pattern: same opening 3 words and high overlap
  const similar1 = areDrillsTooSimilar(
    'Könnten Sie mir bitte das Salz geben?',
    'Könnten Sie mir bitte das Pfeffer geben?'
  );
  assert.equal(similar1, true, 'Should reject sentences that share the exact same opening 4-gram and structure');

  // Exact 4-word identical phrase overlap
  const similar2 = areDrillsTooSimilar(
    'Nous devons prendre le premier vol pour Paris demain matin.',
    'Demain matin nous devons prendre le premier rendez-vous.'
  );
  assert.equal(similar2, true, 'Should detect 4-word identical contiguous block "nous devons prendre le"');

  // Completely distinct questions
  const distinct = areDrillsTooSimilar(
    'Könnten Sie mir bitte das Salz geben?',
    'Gestern habe ich einen faszinierenden Dokumentarfilm über Meeresbiologie gesehen.'
  );
  assert.equal(distinct, false, 'Completely different sentences must not be marked similar');
});

test('isDrillWordingDistinct filters candidate against pool of seen and queued drills', () => {
  const existingPrompts = [
    '¿Dónde está la estación de tren más cercana?',
    'Me gustaría pedir un café con leche y una tostada.'
  ];

  // Exact duplicate
  assert.equal(isDrillWordingDistinct('¿Dónde está la estación de tren más cercana?', existingPrompts), false);

  // Slightly modified wording with same template skeleton
  assert.equal(isDrillWordingDistinct('¿Dónde está la estación de autobuses más cercana?', existingPrompts), false);

  // Completely new real-world sentence
  assert.equal(
    isDrillWordingDistinct('El museo arqueológico ofrece visitas guiadas gratuitas todos los domingos.', existingPrompts),
    true
  );
});

test('areDrillsTooSimilar detects template opening clones and CJK character bigram overlap', () => {
  // Template opening clone in German ("In Bezug auf..." with different middle nouns)
  assert.equal(
    areDrillsTooSimilar(
      'In Bezug auf erneuerbare Energien arbeitet unser Forschungsteam ___ effizient.',
      'In Bezug auf nachhaltige Städteplanung forscht jede Abteilung ___ täglich.'
    ),
    true,
    'Should reject drills sharing the same 3-word opening template ("In Bezug auf")'
  );

  // CJK Japanese similar sentences
  assert.equal(
    areDrillsTooSimilar(
      '明日、友達と一緒に京都___行きます。',
      '明日、友達と一緒に大阪___行きます。'
    ),
    true,
    'Should detect high CJK bigram similarity for minimally swapped Japanese sentences'
  );

  // Genuinely different Japanese sentences should remain distinct
  assert.equal(
    areDrillsTooSimilar(
      '明日、友達と一緒に京都へ行く予定です。',
      '図書館で静かに新しい歴史の本を読みました。'
    ),
    false,
    'Unrelated Japanese sentences should not be rejected as similar'
  );
});

test('filterDistinctDrills removes repeats, history-similar wordings, and intra-batch clones', async () => {
  const { filterDistinctDrills } = await import('./drillEvaluation');
  const seenHistory = [
    'Ich warte schon seit einer halben Stunde auf den Zug.',
    'Form: "Si tuviéramos más tiempo, visitaríamos el museo."'
  ];

  const batch: PracticeDrill[] = [
    {
      id: 'b1',
      type: 'fill-blank',
      language: 'German',
      level: 'B1',
      instruction: 'Fill',
      prompt: 'Ich warte schon seit einer halben Stunde ___ den Bus.',
      options: ['auf', 'für', 'an', 'mit'],
      correctAnswer: 'auf',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'b2',
      type: 'fill-blank',
      language: 'German',
      level: 'B1',
      instruction: 'Fill',
      prompt: 'Der neue Fahrradweg entlang des Flusses wird nächsten Monat ___ eröffnet.',
      options: ['offiziell', 'heimlich', 'selten', 'kaum'],
      correctAnswer: 'offiziell',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'b3',
      type: 'fill-blank',
      language: 'German',
      level: 'B1',
      instruction: 'Fill',
      prompt: 'Der neue Fahrradweg entlang des Flusses wird im Sommer ___ fertig.',
      options: ['endlich', 'nie', 'dort', 'warum'],
      correctAnswer: 'endlich',
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'b4',
      type: 'sentence-ordering',
      language: 'Spanish',
      level: 'B2',
      instruction: 'Order',
      prompt: 'Form: "If we had more time, we would visit the museum."',
      scrambledTokens: ['tiempo,', 'más', 'Si', 'el', 'tuviéramos', 'museo.', 'visitaríamos'],
      correctAnswer: ['Si', 'tuviéramos', 'más', 'tiempo,', 'visitaríamos', 'el', 'museo.'],
      hint: '',
      grammarExplanation: '',
      translation: ''
    },
    {
      id: 'b5',
      type: 'guess-missing-word',
      language: 'German',
      level: 'B2',
      instruction: 'Guess',
      prompt: 'Nach dem intensiven Theaterstück diskutierte das Publikum lange über die ___.',
      correctAnswer: 'Handlung',
      wordClue: 'plot / storyline',
      hint: '',
      grammarExplanation: '',
      translation: ''
    }
  ];

  const filtered = filterDistinctDrills(batch, seenHistory);
  const ids = filtered.map(d => d.id);
  assert.deepEqual(ids, ['b2', 'b5']);
});

test('getNonRepeatingDrills never appends [2] cycle tags and enforces distinct wordings', () => {
  const result = getNonRepeatingDrills([], 'German', 'all', 6, []);
  assert.ok(result.drills.length >= 3);
  for (const d of result.drills) {
    assert.equal(/\s\[\d+\]$/.test(d.prompt), false, `Unexpected cycle suffix in "${d.prompt}"`);
  }
  for (let i = 0; i < result.drills.length; i++) {
    for (let j = i + 1; j < result.drills.length; j++) {
      assert.equal(
        areDrillsTooSimilar(result.drills[i].prompt, result.drills[j].prompt),
        false,
        `Fallback batch contained similar prompts: "${result.drills[i].prompt}" vs "${result.drills[j].prompt}"`
      );
    }
  }
});

test('getNonRepeatingDrills never runs dry across 20 sequential batches or saturated history for all 3 drill types', () => {
  const drillTypes: Array<'all' | 'fill-blank' | 'sentence-ordering' | 'guess-missing-word'> = [
    'all',
    'fill-blank',
    'sentence-ordering',
    'guess-missing-word'
  ];

  for (const dType of drillTypes) {
    let seen = new Set<string>();
    for (let round = 0; round < 20; round++) {
      const res = getNonRepeatingDrills([], 'German', dType, 5, seen);
      assert.ok(
        res.drills.length >= 3,
        `Expected at least 3 drills in round ${round} for German (${dType}), got ${res.drills.length}`
      );

      // Zero duplicate prompts inside the returned batch
      const batchKeys = new Set(res.drills.map((d) => normalizeDrillKey(d.prompt)));
      assert.equal(batchKeys.size, res.drills.length, `Duplicate prompt within batch in round ${round} (${dType})`);

      if (dType !== 'all') {
        for (const d of res.drills) {
          assert.equal(d.type, dType, `Expected type ${dType}, got ${d.type}`);
        }
      }
      seen = res.updatedSeen;
    }
  }
});



