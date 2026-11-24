import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PracticeDrill } from '../types';
import {
  getHtmlLangCode,
  getLocalizedCalendarWeekdays,
  getStoredNativeLanguage,
  getUiDictionary,
  localizeAvailability,
  localizeDayName,
  localizeDrillChrome,
  localizeLanguageName,
  localizeMilestone,
  localizePracticedDuration,
  localizeSlotLabel,
  localizeTeacherAccessLabel,
  NATIVE_LANGUAGE_OPTIONS,
  normalizeNativeLanguage,
  persistStoredNativeLanguage,
  t,
  UiTranslationKey
} from './uiLocalization';

describe('uiLocalization', () => {
  it('normalizes native language aliases accurately', () => {
    assert.equal(normalizeNativeLanguage('German'), 'German');
    assert.equal(normalizeNativeLanguage('deutsch'), 'German');
    assert.equal(normalizeNativeLanguage('de-DE'), 'German');
    assert.equal(normalizeNativeLanguage('Español'), 'Spanish');
    assert.equal(normalizeNativeLanguage('français'), 'French');
    assert.equal(normalizeNativeLanguage('日本語'), 'Japanese');
    assert.equal(normalizeNativeLanguage(''), 'English');
  });

  it('returns correct HTML lang codes and localized language names in German', () => {
    assert.equal(getHtmlLangCode('German'), 'de');
    assert.equal(getHtmlLangCode('Deutsch'), 'de');
    assert.equal(getHtmlLangCode('Spanish'), 'es');
    assert.equal(localizeLanguageName('Spanish', 'German'), 'Spanisch');
    assert.equal(localizeLanguageName('English', 'German'), 'Englisch');
    assert.equal(localizeLanguageName('German', 'German'), 'Deutsch');
    assert.equal(localizeLanguageName('French', 'German'), 'Französisch');
  });

  it('has 100% key parity between English and German dictionaries with no missing German UI strings', () => {
    const en = getUiDictionary('English');
    const de = getUiDictionary('German');
    const enKeys = Object.keys(en) as UiTranslationKey[];
    const missingOrEmpty = enKeys.filter((k) => !de[k] || !de[k].trim());
    assert.deepEqual(missingOrEmpty, []);
    assert.ok(enKeys.length >= 180, 'Expected comprehensive UI translation dictionary');
  });

  it('interpolates dynamic variables cleanly in German UI translations', () => {
    const label = t('drills.loadingTitle', 'German', { lang: 'Spanisch' });
    assert.ok(label.includes('Spanisch'));
    assert.ok(!label.includes('{lang}'));
    assert.equal(t('nav.rooms', 'German'), 'Chaträume');
    assert.equal(t('profile.saveProfile', 'German'), 'Profil speichern');
  });

  it('localizes weekday names, calendar headers, practiced durations, and milestones into German', () => {
    assert.equal(localizeDayName('Mon', 'German'), 'Mo');
    assert.equal(localizeDayName('Wed', 'German'), 'Mi');
    assert.equal(localizeDayName('Sun', 'German'), 'So');
    assert.equal(localizeDayName('Wed', 'English'), 'Wed');

    assert.deepEqual(getLocalizedCalendarWeekdays('German'), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    assert.deepEqual(getLocalizedCalendarWeekdays('English'), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

    const zeroDuration = localizePracticedDuration({ valueLabel: '0 min', detailLabel: 'base' }, 0, 0, 'German');
    assert.equal(zeroDuration.valueLabel, '0 Min.');

    const secsDuration = localizePracticedDuration({ valueLabel: '45s', detailLabel: 'base' }, 0, 45, 'German');
    assert.equal(secsDuration.valueLabel, '45 Sek.');

    const minsDuration = localizePracticedDuration({ valueLabel: '12 min', detailLabel: 'base' }, 12, 740, 'German');
    assert.equal(minsDuration.valueLabel, '12 Min.');
    assert.ok(minsDuration.detailLabel.includes('12 Min. 20 Sek.'));

    const milestone = localizeMilestone(7, 'Habit Builder', '+250 XP', 'German');
    assert.equal(milestone.title, 'Gewohnheits-Profi');
    assert.ok(milestone.reward.includes('EP'));
  });

  it('handles storage helpers safely without browser globals', () => {
    assert.equal(getStoredNativeLanguage(), null);
    assert.equal(persistStoredNativeLanguage('deutsch'), 'German');
    assert.equal(persistStoredNativeLanguage(''), 'English');
  });

  it('preserves learning-language question prompt, options, answers, and tokens while localizing drill chrome into German', () => {
    const spanishDrill: PracticeDrill = {
      id: 'drill_es_1',
      type: 'fill-blank',
      language: 'Spanish',
      level: 'B1',
      instruction: 'Select the most natural word to complete the sentence.',
      prompt: 'Mañana por la tarde ___ al mercado central con mis amigos.',
      options: ['iremos', 'fuimos', 'íbamos', 'vayamos'],
      correctAnswer: 'iremos',
      hint: 'Look at the meaning cue: "Tomorrow afternoon we will go"',
      grammarExplanation: '"iremos" fits the grammar and meaning naturally in Spanish.',
      translation: 'Morgen Nachmittag gehen wir zusammen auf den Markt.'
    };

    const localized = localizeDrillChrome(spanishDrill, 'German');

    // Practice sentence & choices MUST stay strictly in Spanish!
    assert.equal(localized.prompt, spanishDrill.prompt);
    assert.deepEqual(localized.options, spanishDrill.options);
    assert.equal(localized.correctAnswer, spanishDrill.correctAnswer);
    assert.equal(localized.language, 'Spanish');

    // UI metadata MUST be localized into German!
    assert.notEqual(localized.instruction, spanishDrill.instruction);
    assert.ok(localized.instruction.includes('Wähle'));
    assert.ok(localized.hint.includes('Bedeutungshinweis'));
    assert.ok(localized.grammarExplanation.includes('passt grammatikalisch'));
  });

  it('preserves scrambledTokens and orderedTokens for sentence-ordering drills in the learning language', () => {
    const frenchOrderDrill: PracticeDrill = {
      id: 'drill_fr_order',
      type: 'sentence-ordering',
      language: 'French',
      level: 'B1',
      instruction: 'Arrange the words into a natural sentence.',
      prompt: 'Forme: Wir besuchen morgen das Museum.',
      correctAnswer: ['Nous', 'visitons', 'le', 'musée', 'demain.'],
      orderedTokens: ['Nous', 'visitons', 'le', 'musée', 'demain.'],
      scrambledTokens: ['demain.', 'musée', 'Nous', 'le', 'visitons'],
      hint: 'Think about how natural word order works.',
      grammarExplanation: 'Natural spoken and written structure in French.',
      translation: 'Wir besuchen morgen das Museum.'
    };

    const localized = localizeDrillChrome(frenchOrderDrill, 'German');
    assert.deepEqual(localized.orderedTokens, frenchOrderDrill.orderedTokens);
    assert.deepEqual(localized.scrambledTokens, frenchOrderDrill.scrambledTokens);
    assert.deepEqual(localized.correctAnswer, frenchOrderDrill.correctAnswer);
    assert.equal(localized.instruction, 'Ordne die Wörter zu einem natürlichen Satz.');
  });

  it('exposes complete canonical native language selector options including German', () => {
    const germanOption = NATIVE_LANGUAGE_OPTIONS.find((o) => o.value === 'German');
    assert.ok(germanOption);
    assert.equal(germanOption?.nativeLabel, 'Deutsch');
    assert.equal(germanOption?.code, 'de');
  });

  it('localizes teacher availability, slot labels, and open access labels into German', () => {
    assert.equal(localizeAvailability('Available Now', 'German'), 'Sofort verfügbar');
    assert.equal(localizeAvailability('Today', 'German'), 'Heute');
    assert.equal(localizeAvailability('Available Now', 'English'), 'Available Now');

    assert.equal(localizeSlotLabel('Today · 19:30', 'German'), 'Heute · 19:30');
    assert.equal(localizeSlotLabel('Tomorrow · 10:00', 'German'), 'Morgen · 10:00');
    assert.equal(localizeSlotLabel('Today · Flexible', 'German'), 'Heute · Flexibel');

    assert.equal(localizeTeacherAccessLabel('Open 1-on-1 Access', 'German'), 'Direkter 1:1-Zugang');
    assert.equal(localizeTeacherAccessLabel('Open 1-on-1 Access', 'English'), 'Open 1-on-1 Access');
  });
});
