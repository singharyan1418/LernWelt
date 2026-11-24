import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleDrillPrompt,
  extractForbiddenOpenings,
  isDrillTargetLanguageValid,
  parseGeneratedDrillsJson,
  validateAndFilterGeneratedDrills
} from './drillGroundingHelpers';

test('buildGoogleDrillPrompt varies search angles and forbids previously seen openings', () => {
  const seen = [
    'Gestern besuchten wir eine spannende Fotoausstellung im Zentrum.',
    'In einem kleinen Café am Hafen probierten wir frisches Gebäck.'
  ];

  const r1 = buildGoogleDrillPrompt({
    language: 'German',
    level: 'B1',
    nativeLanguage: 'English',
    drillType: 'all',
    topic: 'Culture',
    count: 5,
    seenPrompts: seen,
    requestNonce: 'nonce_1'
  });

  const r2 = buildGoogleDrillPrompt({
    language: 'German',
    level: 'B1',
    nativeLanguage: 'English',
    drillType: 'all',
    topic: 'Culture',
    count: 5,
    seenPrompts: seen,
    requestNonce: 'nonce_2049'
  });

  assert.notEqual(r1.searchQuerySeed, r2.searchQuerySeed, 'Consecutive requests should diversify Google Search queries');
  assert.ok(r1.prompt.includes('Gestern besuchten wir'));
  assert.ok(r1.prompt.includes('FORBIDDEN SENTENCE OPENINGS'));
  assert.ok(r1.prompt.includes('Strict') || r1.prompt.includes('STRICT'));
});

test('extractForbiddenOpenings strips Form wrappers and extracts readable prefixes', () => {
  const openings = extractForbiddenOpenings([
    'Form: "Könnten Sie mir bitte den Weg zeigen?"',
    'Morgen früh fahren wir mit dem Zug ans Meer.'
  ]);
  assert.ok(openings.includes('könnten sie mir'));
  assert.ok(openings.includes('morgen früh fahren'));
});

test('isDrillTargetLanguageValid enforces target script and blocks leaked English sentences', () => {
  assert.equal(
    isDrillTargetLanguageValid(
      {
        type: 'fill-blank',
        prompt: '京都の古いお寺を___見学しました。',
        correctAnswer: 'ゆっくり'
      },
      'Japanese'
    ),
    true
  );

  assert.equal(
    isDrillTargetLanguageValid(
      {
        type: 'fill-blank',
        prompt: 'Yesterday we visited the ___ temple in Kyoto.',
        correctAnswer: 'ancient'
      },
      'Japanese'
    ),
    false
  );

  assert.equal(
    isDrillTargetLanguageValid(
      {
        type: 'fill-blank',
        prompt: 'Because they would never go there without the ___ ticket.',
        correctAnswer: 'valid'
      },
      'German'
    ),
    false
  );

  assert.equal(
    isDrillTargetLanguageValid(
      {
        type: 'fill-blank',
        prompt: 'Am Wochenende wanderten wir ___ einen ruhigen Waldweg.',
        correctAnswer: 'entlang'
      },
      'German'
    ),
    true
  );
});

test('parseGeneratedDrillsJson parses raw JSON, fenced blocks, and embedded payloads', () => {
  const fenced = 'Here is the output:\n```json\n{"drills":[{"type":"fill-blank","prompt":"Test ___"}]}\n```';
  const parsed = parseGeneratedDrillsJson(fenced);
  assert.equal(parsed?.drills?.length, 1);
  assert.equal(parsed.drills[0].prompt, 'Test ___');
});

test('validateAndFilterGeneratedDrills rejects repeats, similar wordings, invalid schemas, and attaches Google grounding', () => {
  const existingCorpus = [
    'Am Sonntag kochte unsere Familie eine leckere Gemüsesuppe.'
  ];

  const rawDrills = [
    // 1. Too similar to existingCorpus
    {
      type: 'fill-blank',
      prompt: 'Am Sonntag kochte unsere Familie ___ frische Nudeln.',
      options: ['gemeinsam', 'schnell', 'morgen', 'leise'],
      correctAnswer: 'gemeinsam',
      hint: 'Together',
      grammarExplanation: 'Adverb',
      translation: 'On Sunday our family cooked fresh noodles together.'
    },
    // 2. Valid fresh fill-blank
    {
      type: 'fill-blank',
      prompt: 'Seit dem letzten Frühjahr ___ immer mehr Pendler auf das E-Bike um.',
      options: ['steigen', 'fliegen', 'schlafen', 'rennen'],
      correctAnswer: 'steigen',
      hint: 'Separable verb: umsteigen',
      grammarExplanation: 'auf etwas umsteigen = switch to',
      translation: 'Since last spring, more and more commuters are switching to e-bikes.',
      sourceFact: 'German commuter cycling report 2026'
    },
    // 3. Intra-batch clone of #2 (should be rejected!)
    {
      type: 'fill-blank',
      prompt: 'Seit dem letzten Frühjahr steigen immer mehr Pendler auf die ___ um.',
      options: ['Bahn', 'Wiese', 'Wolke', 'Lampe'],
      correctAnswer: 'Bahn',
      hint: 'Train',
      grammarExplanation: 'Noun',
      translation: 'Since last spring, more and more commuters are switching to the train.'
    },
    // 4. Valid sentence ordering
    {
      type: 'sentence-ordering',
      prompt: 'Form: "After the storm, volunteers cleaned up the coastal beach."',
      orderedTokens: ['Nach', 'dem', 'Sturm', 'räumten', 'Freiwillige', 'den', 'Strand', 'auf.'],
      scrambledTokens: ['Nach', 'dem', 'Sturm', 'räumten', 'Freiwillige', 'den', 'Strand', 'auf.'],
      hint: 'V2 word order',
      grammarExplanation: 'Inversion after temporal phrase',
      translation: 'After the storm, volunteers cleaned up the coastal beach.',
      sourceFact: 'Baltic coast cleanup initiative'
    },
    // 5. Wrong language leak (English sentence when German requested -> rejected!)
    {
      type: 'guess-missing-word',
      prompt: 'They would never leave without their ___ because it could rain there.',
      correctAnswer: 'umbrella',
      wordClue: 'rain gear',
      hint: '',
      grammarExplanation: '',
      translation: ''
    }
  ];

  const accepted = validateAndFilterGeneratedDrills({
    rawDrills,
    language: 'German',
    level: 'B1',
    requestedType: 'all',
    existingCorpus,
    webSources: [{ title: 'Tagesschau Mobilität', url: 'https://www.tagesschau.de/wirtschaft/mobilitaet' }],
    searchQueryUsed: 'German commuter cycling'
  });

  assert.equal(accepted.length, 2, 'Only the 2 truly distinct, valid German drills should pass');
  assert.equal(accepted[0].type, 'fill-blank');
  assert.equal(accepted[0].groundedByGoogle, true);
  assert.equal(accepted[0].sourceTitle, 'Tagesschau Mobilität');
  assert.equal(accepted[0].sourceUrl, 'https://www.tagesschau.de/wirtschaft/mobilitaet');
  assert.equal(accepted[1].type, 'sentence-ordering');
  assert.notEqual(
    accepted[1].scrambledTokens?.join(' '),
    accepted[1].orderedTokens?.join(' '),
    'Sentence-ordering tokens must be scrambled'
  );
});

test('validateAndFilterGeneratedDrills normalizes blank variants and accepts 3-token CJK sentence ordering', () => {
  const accepted = validateAndFilterGeneratedDrills({
    rawDrills: [
      {
        type: 'fill-blank',
        prompt: 'Morgen früh fahren wir mit dem [___] nach Berlin.',
        options: ['Zug', 'Tisch', 'Lampe', 'Wolke'],
        correctAnswer: 'Zug',
        hint: 'Rail transport',
        grammarExplanation: 'mit dem Zug',
        translation: 'Tomorrow morning we travel by train to Berlin.'
      },
      {
        type: 'guess-missing-word',
        prompt: 'Nach dem Konzert gingen alle Gäste zufrieden nach ( ____ ).',
        correctAnswer: 'Hause',
        wordClue: 'home',
        hint: 'nach Hause',
        grammarExplanation: 'Fixed idiomatic phrase',
        translation: 'After the concert all guests went home happily.'
      },
      {
        type: 'sentence-ordering',
        prompt: 'Form: "Jeden Samstag kaufen wir frisches Obst auf dem Markt."',
        orderedTokens: ['Jeden', 'Samstag', 'kaufen', 'wir', 'frisches', 'Obst', 'auf', 'dem', 'Markt.'],
        scrambledTokens: ['Jeden', 'Samstag', 'kaufen', 'wir', 'frisches', 'Obst', 'auf', 'dem', 'Markt.'],
        translation: 'Every Saturday we buy fresh fruit at the market.'
      }
    ],
    language: 'German',
    level: 'B1',
    requestedType: 'all',
    existingCorpus: []
  });

  assert.equal(accepted.length, 3);
  assert.ok(accepted[0].prompt.includes('___'));
  assert.ok(accepted[1].prompt.includes('___'));

  const jpAccepted = validateAndFilterGeneratedDrills({
    rawDrills: [
      {
        type: 'sentence-ordering',
        prompt: 'Form: "一緒に 日本茶を 飲みませんか。"',
        orderedTokens: ['一緒に', '日本茶を', '飲みませんか。'],
        scrambledTokens: ['一緒に', '日本茶を', '飲みませんか。'],
        translation: 'Shall we drink Japanese tea together?'
      }
    ],
    language: 'Japanese',
    level: 'A2',
    requestedType: 'sentence-ordering',
    existingCorpus: []
  });
  assert.equal(jpAccepted.length, 1);
  assert.equal(jpAccepted[0].orderedTokens?.length, 3);
});

