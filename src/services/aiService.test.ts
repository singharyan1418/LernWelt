import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTextWithRules } from './aiService';

test('German: detects "ich bin gut" and suggests "Mir geht es gut"', () => {
  const result = analyzeTextWithRules('Hallo, ich bin gut heute', 'German');
  assert.equal(result.hasErrors, true);
  assert.ok(result.mistakes.some(m => m.wrongPart.toLowerCase().includes('ich bin gut')));
  assert.ok(result.mistakes.some(m => m.suggestion.includes('Mir geht es gut')));
});

test('German: detects "weil ich habe" word-order error', () => {
  const result = analyzeTextWithRules('Ich lerne Deutsch, weil ich habe Zeit.', 'German');
  assert.equal(result.hasErrors, true);
  assert.ok(result.mistakes.some(m => m.type === 'word-order'));
});

test('Spanish: detects "soy aburrido" instead of "estoy aburrido"', () => {
  const result = analyzeTextWithRules('Hoy soy aburrido en casa.', 'Spanish');
  assert.equal(result.hasErrors, true);
  assert.ok(result.mistakes.some(m => m.suggestion.includes('estoy aburrido')));
});

test('English: detects "since two years" duration error', () => {
  const result = analyzeTextWithRules('I am living here since two years.', 'English');
  assert.equal(result.hasErrors, true);
  assert.ok(result.mistakes.some(m => m.suggestion.includes('for')));
});

test('Vocabulary Elevation: suggests native upgrade for "sehr gut"', () => {
  const result = analyzeTextWithRules('Das Projekt ist sehr gut gelaufen.', 'German');
  assert.ok(result.betterWords.length > 0);
  assert.ok(result.betterWords.some(bw => bw.betterWord.includes('hervorragend')));
});

test('Practice Drills: verify initial drills have valid schemas and answers', async () => {
  const { INITIAL_PRACTICE_DRILLS } = await import('../data/drillData');
  assert.ok(INITIAL_PRACTICE_DRILLS.length >= 8);
  for (const drill of INITIAL_PRACTICE_DRILLS) {
    assert.ok(drill.id);
    assert.ok(drill.language);
    assert.ok(drill.prompt);
    assert.ok(drill.correctAnswer);
    if (drill.type === 'fill-blank') {
      assert.ok(Array.isArray(drill.options) && drill.options.length > 0);
      assert.ok(typeof drill.correctAnswer === 'string');
      assert.ok(drill.options.includes(drill.correctAnswer));
    } else if (drill.type === 'sentence-ordering') {
      assert.ok(Array.isArray(drill.scrambledTokens) && drill.scrambledTokens.length > 0);
      assert.ok(Array.isArray(drill.correctAnswer));
      assert.equal(drill.scrambledTokens.length, drill.correctAnswer.length);
    }
  }
});

test('Pronunciation Targets: verify phonetic IPA and coaching tips', async () => {
  const { INITIAL_PRONUNCIATION_TARGETS } = await import('../data/drillData');
  assert.ok(INITIAL_PRONUNCIATION_TARGETS.length >= 6);
  for (const item of INITIAL_PRONUNCIATION_TARGETS) {
    assert.ok(item.phrase);
    assert.ok(item.language);
    assert.ok(item.phoneticIpa);
    assert.ok(item.difficultSounds.length > 0);
    assert.ok(item.tip);
  }
});

