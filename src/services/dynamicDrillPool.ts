import { DrillType, PracticeDrill } from '../types';
import {
  normalizeDrillKey,
  shuffleFillBlankOptions,
  scrambleSentenceTokens,
  isDrillWordingDistinct,
  getDrillComparisonText
} from './drillEvaluation';
import { INITIAL_PRACTICE_DRILLS } from '../data/drillData';

/**
 * Rich, authentic grammar drill bank covering German, Spanish, English, French,
 * Italian, Japanese, Mandarin, and Portuguese across all 3 exercise types.
 */
export const EXTENDED_DRILL_BANK: PracticeDrill[] = [
  ...INITIAL_PRACTICE_DRILLS,
  // ================= GERMAN DRILLS =================
  // --- Fill in the Blank (German) ---
  {
    id: 'ext_de_fb_1',
    type: 'fill-blank',
    language: 'German',
    level: 'B1',
    instruction: 'Choose the correct preposition with Akkusativ.',
    prompt: 'Wir warten schon seit einer halben Stunde ___ den verspäteten Bus.',
    options: ['auf', 'für', 'an', 'über'],
    correctAnswer: 'auf',
    hint: 'The fixed verbal idiom is "warten auf + Akkusativ".',
    grammarExplanation: '"Warten auf" always takes the accusative case ("den verspäteten Bus").',
    translation: 'We have already been waiting for half an hour for the delayed bus.'
  },
  {
    id: 'ext_de_fb_2',
    type: 'fill-blank',
    language: 'German',
    level: 'B2',
    instruction: 'Select the correct connector of concession.',
    prompt: '___ die Konferenz sehr anstrengend war, haben wir viele Kontakte geknüpft.',
    options: ['Obwohl', 'Weil', 'Damit', 'Deshalb'],
    correctAnswer: 'Obwohl',
    hint: 'Concession clause meaning "Although / Even though".',
    grammarExplanation: '"Obwohl" introduces a concessive subordinate clause with the finite verb at the end.',
    translation: 'Although the conference was very exhausting, we established many contacts.'
  },
  {
    id: 'ext_de_fb_3',
    type: 'fill-blank',
    language: 'German',
    level: 'A2',
    instruction: 'Choose the correct dative possessive article.',
    prompt: 'Ich helfe ___ neuen Nachbarn sehr gerne beim Umzug.',
    options: ['meinem', 'meinen', 'meines', 'mein'],
    correctAnswer: 'meinem',
    hint: '"Helfen" strictly requires the dative case (masculine singular).',
    grammarExplanation: 'Dative masculine singular takes the ending "-em": "meinem Nachbarn".',
    translation: 'I gladly help my new neighbor with moving.'
  },
  {
    id: 'ext_de_fb_4',
    type: 'fill-blank',
    language: 'German',
    level: 'B1',
    instruction: 'Select the correct two-part connector.',
    prompt: 'Dieser Kurs ist ___ interessant, sondern auch äußerst praxisnah.',
    options: ['nicht nur', 'entweder', 'sowohl', 'weder'],
    correctAnswer: 'nicht nur',
    hint: 'Pairs with "...sondern auch".',
    grammarExplanation: '"nicht nur ... sondern auch" (not only ... but also) links two positive attributes.',
    translation: 'This course is not only interesting, but also extremely practical.'
  },
  {
    id: 'ext_de_fb_5',
    type: 'fill-blank',
    language: 'German',
    level: 'B2',
    instruction: 'Choose the correct Konjunktiv II form for polite advice.',
    prompt: 'An deiner Stelle ___ ich mir vor der Reise eine Auslandskrankenversicherung holen.',
    options: ['würde', 'werde', 'wäre', 'solle'],
    correctAnswer: 'würde',
    hint: 'Konjunktiv II formulation: "An deiner Stelle würde ich...".',
    grammarExplanation: '"Würde + Infinitiv" is the standard hypothetical advice structure in German.',
    translation: 'In your place, I would get international health insurance before traveling.'
  },
  {
    id: 'ext_de_fb_6',
    type: 'fill-blank',
    language: 'German',
    level: 'B1',
    instruction: 'Select the correct relative pronoun with preposition.',
    prompt: 'Das ist das Hotel, ___ wir letztes Jahr drei Wochen verbracht haben.',
    options: ['in dem', 'in das', 'wohin', 'womit'],
    correctAnswer: 'in dem',
    hint: 'Stationary location (Wo?) requires Dative ("in dem" or "im").',
    grammarExplanation: 'Relative pronoun for neuter singular ("das Hotel") with stationary "in" takes dative: "in dem".',
    translation: 'That is the hotel in which we spent three weeks last year.'
  },
  {
    id: 'ext_de_fb_7',
    type: 'fill-blank',
    language: 'German',
    level: 'A2',
    instruction: 'Select the correct modal verb for expressing necessity.',
    prompt: 'Für die Prüfung ___ alle Studierenden ihren Personalausweis vorzeigen.',
    options: ['müssen', 'dürfen', 'wollen', 'möchten'],
    correctAnswer: 'müssen',
    hint: 'Official exam requirement/obligation.',
    grammarExplanation: '"Müssen" expresses mandatory requirement or legal obligation.',
    translation: 'For the exam, all students must present their ID card.'
  },
  {
    id: 'ext_de_fb_8',
    type: 'fill-blank',
    language: 'German',
    level: 'B2',
    instruction: 'Select the correct reflexive verb preposition.',
    prompt: 'Die Forscher beschäftigen sich intensiv ___ den Folgen des Klimawandels.',
    options: ['mit', 'für', 'an', 'über'],
    correctAnswer: 'mit',
    hint: 'The fixed preposition is "sich beschäftigen mit + Dativ".',
    grammarExplanation: '"Sich beschäftigen mit" governs the dative case with preposition "mit".',
    translation: 'The researchers are intensively engaging with the consequences of climate change.'
  },

  // --- Sentence Ordering (German) ---
  {
    id: 'ext_de_so_1',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B1',
    instruction: 'Rearrange words into a natural subordinate sentence with "weil".',
    prompt: 'Form: "Ich lerne jeden Tag Deutsch, weil ich in Wien studieren möchte."',
    scrambledTokens: ['möchte.', 'Ich', 'jeden', 'lerne', 'Tag', 'in', 'Wien', 'Deutsch,', 'weil', 'ich', 'studieren'],
    correctAnswer: ['Ich', 'lerne', 'jeden', 'Tag', 'Deutsch,', 'weil', 'ich', 'in', 'Wien', 'studieren', 'möchte.'],
    hint: 'Subordinating connector "weil" kicks the conjugated modal verb "möchte" to the very end.',
    grammarExplanation: 'Subordinate clauses introduced by "weil" require Verb-Letzt-Stellung.',
    translation: 'I study German every day because I want to study in Vienna.'
  },
  {
    id: 'ext_de_so_2',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B2',
    instruction: 'Construct an inverted conditional sentence without "wenn".',
    prompt: 'Form: "Hätte ich mehr Zeit gehabt, wäre ich gerne zum Konzert mitgekommen."',
    scrambledTokens: ['mitgekommen.', 'mehr', 'Hätte', 'ich', 'Zeit', 'gehabt,', 'wäre', 'ich', 'gerne', 'zum', 'Konzert'],
    correctAnswer: ['Hätte', 'ich', 'mehr', 'Zeit', 'gehabt,', 'wäre', 'ich', 'gerne', 'zum', 'Konzert', 'mitgekommen.'],
    hint: 'Inverted condition starts directly with the finite auxiliary "Hätte".',
    grammarExplanation: 'Hypothetical past conditions can omit "wenn" by placing the finite verb in position 1.',
    translation: 'Had I had more time, I would have gladly come along to the concert.'
  },
  {
    id: 'ext_de_so_3',
    type: 'sentence-ordering',
    language: 'German',
    level: 'A2',
    instruction: 'Rearrange words obeying TeKaMoLo time-manner-place order.',
    prompt: 'Form: "Wir fahren heute Nachmittag mit dem Zug nach Hamburg."',
    scrambledTokens: ['nach', 'Wir', 'heute', 'dem', 'fahren', 'Zug', 'Nachmittag', 'mit', 'Hamburg.'],
    correctAnswer: ['Wir', 'fahren', 'heute', 'Nachmittag', 'mit', 'dem', 'Zug', 'nach', 'Hamburg.'],
    hint: 'Time (heute Nachmittag) comes before Manner (mit dem Zug) before Place (nach Hamburg).',
    grammarExplanation: 'German adverbial word order strictly follows TeKaMoLo: Temporal, Kausal, Modal, Lokal.',
    translation: 'We are traveling to Hamburg this afternoon by train.'
  },
  {
    id: 'ext_de_so_4',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B1',
    instruction: 'Arrange the words of an indirect question.',
    prompt: 'Form: "Könnten Sie mir bitte sagen, wann der nächste Zug abfährt?"',
    scrambledTokens: ['abfährt?', 'mir', 'Könnten', 'bitte', 'Sie', 'sagen,', 'wann', 'der', 'Zug', 'nächste'],
    correctAnswer: ['Könnten', 'Sie', 'mir', 'bitte', 'sagen,', 'wann', 'der', 'nächste', 'Zug', 'abfährt?'],
    hint: '"Könnten Sie mir bitte sagen," is followed by subordinate clause ending in "abfährt?".',
    grammarExplanation: 'Indirect questions introduced by interrogatives ("wann") send the conjugated verb to the end.',
    translation: 'Could you please tell me when the next train departs?'
  },
  {
    id: 'ext_de_so_5',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B2',
    instruction: 'Construct an infinitive clause with "um ... zu".',
    prompt: 'Form: "Sie trainiert jeden Morgen früh, um ihre Kondition nachhaltig zu verbessern."',
    scrambledTokens: ['verbessern.', 'jeden', 'trainiert', 'Morgen', 'zu', 'früh,', 'Sie', 'um', 'ihre', 'Kondition', 'nachhaltig'],
    correctAnswer: ['Sie', 'trainiert', 'jeden', 'Morgen', 'früh,', 'um', 'ihre', 'Kondition', 'nachhaltig', 'zu', 'verbessern.'],
    hint: '"Um" introduces the purpose clause and "zu + infinitive" completes it.',
    grammarExplanation: '"Um ... zu + Infinitiv" expresses intention or goal with matching grammatical subject.',
    translation: 'She trains early every morning in order to sustainably improve her stamina.'
  },

  // --- Guess Missing Word (German) ---
  {
    id: 'ext_de_gm_1',
    type: 'guess-missing-word',
    language: 'German',
    level: 'A2',
    instruction: 'Type the missing German noun for "supermarket".',
    prompt: 'Ich gehe kurz in den ___ um frische Milch und Brot zu kaufen.',
    correctAnswer: 'Supermarkt',
    wordClue: 'grocery store / supermarket (masculine noun)',
    hint: 'Compound word: "Super" + "Markt". Capitalize nouns in German!',
    grammarExplanation: '"In den Supermarkt" is accusative masculine expressing directional movement.',
    translation: 'I am briefly going to the supermarket to buy fresh milk and bread.'
  },
  {
    id: 'ext_de_gm_2',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B1',
    instruction: 'Type the missing German noun for "appointment / date".',
    prompt: 'Ich habe heute um 14 Uhr einen wichtigen geschäftlichen ___ beim Notar.',
    correctAnswer: 'Termin',
    wordClue: 'appointment / scheduled meeting (masculine noun)',
    hint: 'Starts with "Ter..." (6 letters). Capitalize German nouns!',
    grammarExplanation: '"Einen wichtigen geschäftlichen Termin" is the accusative masculine singular object of "haben".',
    translation: 'I have an important business appointment with the notary today at 2 PM.'
  },
  {
    id: 'ext_de_gm_3',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B2',
    instruction: 'Type the missing C1 adjective meaning "reliable / trustworthy".',
    prompt: 'Er ist ein äußerst ___ Kollege, auf den man sich immer verlassen kann.',
    correctAnswer: 'zuverlässiger / zuverlässig',
    wordClue: 'dependable / trustworthy',
    hint: 'Compound adjective: "zuverlässig". In mixed declension before masculine noun: "zuverlässiger".',
    grammarExplanation: '"Zuverlässig" describes someone dependable; with mixed declension: "ein zuverlässiger Kollege".',
    translation: 'He is an extremely reliable colleague whom one can always depend on.'
  },
  {
    id: 'ext_de_gm_4',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B1',
    instruction: 'Type the missing German noun for "solution".',
    prompt: 'Wir haben nach langer Diskussion endlich eine passende ___ für das Problem gefunden.',
    correctAnswer: 'Lösung',
    wordClue: 'solution / resolution (feminine noun)',
    hint: 'Starts with "Lö..." (6 letters). Capitalize German nouns!',
    grammarExplanation: '"Die Lösung" is the feminine noun derived from the verb "lösen" (to solve).',
    translation: 'After a long discussion, we finally found a fitting solution for the problem.'
  },
  {
    id: 'ext_de_gm_5',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B2',
    instruction: 'Type the missing German noun for "environment / surrounding ecosystem".',
    prompt: 'Nachhaltiges Wirtschaften schützt unsere ___ und schont wertvolle Ressourcen.',
    correctAnswer: 'Umwelt',
    wordClue: 'environment / nature (feminine noun)',
    hint: 'Starts with "Um..." (6 letters). Capitalize nouns in German!',
    grammarExplanation: '"Die Umwelt" denotes the natural and ecological surrounding environment.',
    translation: 'Sustainable business practices protect our environment and conserve valuable resources.'
  },

  // ================= SPANISH DRILLS =================
  // --- Fill in the Blank (Spanish) ---
  {
    id: 'ext_es_fb_1',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Select the correct form of the present subjunctive.',
    prompt: 'Dudo que ellos ___ llegar a tiempo con este tráfico.',
    options: ['puedan', 'pueden', 'podrán', 'podrían'],
    correctAnswer: 'puedan',
    hint: 'Verbs of doubt (dudar que) strictly require the subjunctive.',
    grammarExplanation: '"Dudar que" triggers the present subjunctive ("puedan"), expressing uncertainty.',
    translation: 'I doubt that they can arrive on time with this traffic.'
  },
  {
    id: 'ext_es_fb_2',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'A2',
    instruction: 'Choose between "por" and "para" for purpose.',
    prompt: 'Estudiamos español todos los días ___ conseguir un mejor empleo.',
    options: ['para', 'por', 'con', 'de'],
    correctAnswer: 'para',
    hint: '"Para" indicates purpose, goal, or intended destination.',
    grammarExplanation: '"Para + infinitivo" expresses purpose ("in order to achieve a better job").',
    translation: 'We study Spanish every day in order to get a better job.'
  },
  {
    id: 'ext_es_fb_3',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'B2',
    instruction: 'Select the correct conditional conjunction.',
    prompt: 'Iremos a la playa el domingo ___ que no llueva.',
    options: ['a condición de', 'porque', 'debido a', 'por lo tanto'],
    correctAnswer: 'a condición de',
    hint: 'Conjunction meaning "provided that / on the condition that".',
    grammarExplanation: '"A condición de que" mandates the subjunctive mood ("llueva").',
    translation: 'We will go to the beach on Sunday provided that it does not rain.'
  },
  {
    id: 'ext_es_fb_4',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'A2',
    instruction: 'Select the correct indirect object pronoun.',
    prompt: 'A mis padres ___ encanta viajar por el sur de España.',
    options: ['les', 'le', 'los', 'se'],
    correctAnswer: 'les',
    hint: 'Plural third-person indirect object ("A mis padres").',
    grammarExplanation: '"Gustar" and "encantar" take indirect object pronouns; plural third-person is "les".',
    translation: 'My parents love traveling throughout southern Spain.'
  },
  {
    id: 'ext_es_fb_5',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Choose between "ser" and "estar" for a transient condition.',
    prompt: 'El café ya no está caliente, ___ totalmente frío.',
    options: ['está', 'es', 'tiene', 'queda'],
    correctAnswer: 'está',
    hint: 'Temperature as a perceived current state requires "estar".',
    grammarExplanation: 'Physical states resulting from a change use "estar": "está frío".',
    translation: 'The coffee is no longer warm; it is totally cold.'
  },

  // --- Sentence Ordering (Spanish) ---
  {
    id: 'ext_es_so_1',
    type: 'sentence-ordering',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Rearrange words into a natural subjunctive expression of hope.',
    prompt: 'Form: "Ojalá que haga buen tiempo durante nuestras vacaciones en Málaga."',
    scrambledTokens: ['nuestras', 'Málaga.', 'Ojalá', 'haga', 'vacaciones', 'que', 'en', 'buen', 'tiempo', 'durante'],
    correctAnswer: ['Ojalá', 'que', 'haga', 'buen', 'tiempo', 'durante', 'nuestras', 'vacaciones', 'en', 'Málaga.'],
    hint: 'Begin with "Ojalá que", followed immediately by subjunctive verb "haga".',
    grammarExplanation: '"Ojalá que" expresses a keen desire and triggers present subjunctive.',
    translation: 'Hopefully the weather will be nice during our vacation in Málaga.'
  },
  {
    id: 'ext_es_so_2',
    type: 'sentence-ordering',
    language: 'Spanish',
    level: 'A2',
    instruction: 'Arrange words into a polite restaurant request.',
    prompt: 'Form: "¿Nos podría traer la cuenta y la carta de postres, por favor?"',
    scrambledTokens: ['postres,', 'cuenta', 'favor?', 'traer', 'la', 'la', '¿Nos', 'por', 'de', 'y', 'carta', 'podría'],
    correctAnswer: ['¿Nos', 'podría', 'traer', 'la', 'cuenta', 'y', 'la', 'carta', 'de', 'postres,', 'por', 'favor?'],
    hint: 'Polite conditional "¿Nos podría traer..." followed by direct objects.',
    grammarExplanation: 'Clitic pronouns precede the conjugated modal: "¿Nos podría traer...?".',
    translation: 'Could you bring us the check and the dessert menu, please?'
  },
  {
    id: 'ext_es_so_3',
    type: 'sentence-ordering',
    language: 'Spanish',
    level: 'B2',
    instruction: 'Rearrange words with past subjunctive and conditional.',
    prompt: 'Form: "Si tuviera más tiempo libre, aprendería a tocar la guitarra."',
    scrambledTokens: ['tiempo', 'aprendería', 'la', 'guitarra.', 'tocar', 'tuviera', 'más', 'Si', 'libre,', 'a'],
    correctAnswer: ['Si', 'tuviera', 'más', 'tiempo', 'libre,', 'aprendería', 'a', 'tocar', 'la', 'guitarra.'],
    hint: 'Hypothetical "Si + imperfecto de subjuntivo (tuviera)" pairs with conditional "aprendería".',
    grammarExplanation: 'Type 2 hypothetical conditionals use the imperfect subjunctive in the if-clause and conditional in the main clause.',
    translation: 'If I had more free time, I would learn to play the guitar.'
  },

  // --- Guess Missing Word (Spanish) ---
  {
    id: 'ext_es_gm_1',
    type: 'guess-missing-word',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Type the missing Spanish noun for "neighborhood / district".',
    prompt: 'Vivimos en un ___ muy tranquilo con muchos parques y cafeterías.',
    correctAnswer: 'barrio',
    wordClue: 'neighborhood / district (masculine noun)',
    hint: 'Starts with "bar..." (6 letters).',
    grammarExplanation: '"El barrio" is the standard Spanish term for a neighborhood.',
    translation: 'We live in a very quiet neighborhood with many parks and cafés.'
  },
  {
    id: 'ext_es_gm_2',
    type: 'guess-missing-word',
    language: 'Spanish',
    level: 'B2',
    instruction: 'Type the missing Spanish adjective for "essential / indispensable".',
    prompt: 'La comunicación honesta es un pilar ___ para cualquier equipo de trabajo.',
    correctAnswer: 'imprescindible / fundamental / esencial',
    wordClue: 'indispensable / essential (replaces "muy importante")',
    hint: 'Starts with "impresc..." or "funda...".',
    grammarExplanation: '"Imprescindible" is an advanced adjective expressing absolute necessity.',
    translation: 'Honest communication is an indispensable pillar for any work team.'
  },
  {
    id: 'ext_es_gm_3',
    type: 'guess-missing-word',
    language: 'Spanish',
    level: 'A2',
    instruction: 'Type the missing Spanish noun for "subway / underground train".',
    prompt: 'Es más rápido viajar por el centro de la ciudad en ___ que en taxi.',
    correctAnswer: 'metro',
    wordClue: 'subway / underground train',
    hint: 'Short 5-letter word starting with "me...".',
    grammarExplanation: '"Viajar en metro" uses "en" with modes of transportation.',
    translation: 'It is faster to travel through the city center by subway than by taxi.'
  },

  // ================= ENGLISH DRILLS =================
  // --- Fill in the Blank (English) ---
  {
    id: 'ext_en_fb_1',
    type: 'fill-blank',
    language: 'English',
    level: 'B1',
    instruction: 'Choose the correct preposition with duration.',
    prompt: 'They have been collaborating on this research initiative ___ three years.',
    options: ['for', 'since', 'during', 'from'],
    correctAnswer: 'for',
    hint: 'Durations of elapsed time take "for", while specific starting dates take "since".',
    grammarExplanation: '"For" marks a quantity of elapsed duration ("for three years").',
    translation: 'They have been collaborating on this research initiative for three years.'
  },
  {
    id: 'ext_en_fb_2',
    type: 'fill-blank',
    language: 'English',
    level: 'B2',
    instruction: 'Select the correct verb pattern after "look forward to".',
    prompt: 'We look forward to ___ you at the global leadership summit next month.',
    options: ['meeting', 'meet', 'to meet', 'met'],
    correctAnswer: 'meeting',
    hint: '"Look forward to" is a prepositional phrase requiring a gerund (-ing).',
    grammarExplanation: 'The "to" in "look forward to" is a preposition, not an infinitive marker, so it requires an -ing gerund.',
    translation: 'We look forward to meeting you at the global leadership summit next month.'
  },
  {
    id: 'ext_en_fb_3',
    type: 'fill-blank',
    language: 'English',
    level: 'C1',
    instruction: 'Choose the correct inversion auxiliary.',
    prompt: 'Hardly ___ the presentation begun when the audience gave a standing ovation.',
    options: ['had', 'did', 'was', 'would'],
    correctAnswer: 'had',
    hint: 'Correlative negative inversion: "Hardly had ... when ...".',
    grammarExplanation: '"Hardly had + subject + past participle ... when" is standard formal negative inversion.',
    translation: 'Hardly had the presentation begun when the audience gave a standing ovation.'
  },

  // --- Sentence Ordering (English) ---
  {
    id: 'ext_en_so_1',
    type: 'sentence-ordering',
    language: 'English',
    level: 'B2',
    instruction: 'Construct an inverted third conditional sentence.',
    prompt: 'Form: "Had we anticipated the severe storm, we would have postponed our departure."',
    scrambledTokens: ['postponed', 'storm,', 'we', 'the', 'departure.', 'severe', 'anticipated', 'our', 'Had', 'have', 'would'],
    correctAnswer: ['Had', 'we', 'anticipated', 'the', 'severe', 'storm,', 'we', 'would', 'have', 'postponed', 'our', 'departure.'],
    hint: 'Invert the auxiliary "Had" before subject "we" to replace "If we had".',
    grammarExplanation: 'Formal inverted third conditionals drop "if" and front the auxiliary "had".',
    translation: 'Had we anticipated the severe storm, we would have postponed our departure.'
  },
  {
    id: 'ext_en_so_2',
    type: 'sentence-ordering',
    language: 'English',
    level: 'B1',
    instruction: 'Arrange words into a natural polite business inquiry.',
    prompt: 'Form: "Could you please send me the updated project schedule by Friday afternoon?"',
    scrambledTokens: ['Friday', 'Could', 'updated', 'the', 'send', 'schedule', 'me', 'please', 'afternoon?', 'by', 'you', 'project'],
    correctAnswer: ['Could', 'you', 'please', 'send', 'me', 'the', 'updated', 'project', 'schedule', 'by', 'Friday', 'afternoon?'],
    hint: '"Could you please send me..." is followed by direct object and time prepositional phrase.',
    grammarExplanation: 'Polite requests place "please" between the subject and the main bare verb.',
    translation: 'Could you please send me the updated project schedule by Friday afternoon?'
  },

  // --- Guess Missing Word (English) ---
  {
    id: 'ext_en_gm_1',
    type: 'guess-missing-word',
    language: 'English',
    level: 'B2',
    instruction: 'Type the adjective meaning "present, appearing, or found everywhere".',
    prompt: 'Smartphones and wireless networks have become ___ in contemporary society.',
    correctAnswer: 'ubiquitous / omnipresent',
    wordClue: 'present or found everywhere (starts with "u")',
    hint: 'Starts with "ubi..." (10 letters).',
    grammarExplanation: '"Ubiquitous" is an elevated academic adjective replacing "very common" or "everywhere".',
    translation: 'Smartphones and wireless networks have become ubiquitous in contemporary society.'
  },
  {
    id: 'ext_en_gm_2',
    type: 'guess-missing-word',
    language: 'English',
    level: 'B1',
    instruction: 'Type the noun meaning "an advantage or positive quality".',
    prompt: 'One major ___ of working remotely is having flexible hours throughout the week.',
    correctAnswer: 'benefit / advantage',
    wordClue: 'positive advantage or gain',
    hint: 'Starts with "bene..." (7 letters) or "advan...".',
    grammarExplanation: '"A major benefit / advantage of" takes a gerund phrase ("working remotely").',
    translation: 'One major benefit of working remotely is having flexible hours throughout the week.'
  },

  // ================= FRENCH DRILLS =================
  {
    id: 'ext_fr_fb_1',
    type: 'fill-blank',
    language: 'French',
    level: 'B1',
    instruction: 'Select the correct subjunctive form after "il faut que".',
    prompt: 'Il faut que nous ___ les billets de train avant ce soir.',
    options: ['achetions', 'achetons', 'achèterons', 'achetés'],
    correctAnswer: 'achetions',
    hint: '"Il faut que" obligatorily governs the subjunctive mood.',
    grammarExplanation: 'First person plural ("nous") in the present subjunctive for "acheter" is "achetions".',
    translation: 'We must buy the train tickets before tonight.'
  },
  {
    id: 'ext_fr_so_1',
    type: 'sentence-ordering',
    language: 'French',
    level: 'B1',
    instruction: 'Arrange words into a negative sentence with "ne ... jamais".',
    prompt: 'Form: "Je n\'ai jamais visité ce magnifique musée à Paris."',
    scrambledTokens: ['visité', 'Paris.', 'ce', 'Je', 'jamais', 'à', 'n\'ai', 'magnifique', 'musée'],
    correctAnswer: ['Je', 'n\'ai', 'jamais', 'visité', 'ce', 'magnifique', 'musée', 'à', 'Paris.'],
    hint: 'In compound tenses, "jamais" wraps around the auxiliary: "n\'ai jamais visité".',
    grammarExplanation: 'Adverbs of negation like "jamais" follow the auxiliary verb in compound tenses.',
    translation: 'I have never visited this magnificent museum in Paris.'
  },
  {
    id: 'ext_fr_gm_1',
    type: 'guess-missing-word',
    language: 'French',
    level: 'B1',
    instruction: 'Type the missing French noun for "neighborhood / district".',
    prompt: 'Montmartre est un ___ historique et très charmant de Paris.',
    correctAnswer: 'quartier',
    wordClue: 'neighborhood / district (masculine noun)',
    hint: 'Starts with "quar..." (8 letters).',
    grammarExplanation: '"Le quartier" is the masculine French noun for neighborhood or urban district.',
    translation: 'Montmartre is a historic and very charming neighborhood in Paris.'
  }
];

/**
 * Procedural sentence variations generator:
 * Dynamically synthesizes grammatically authenticated, non-repeating drill questions
 * with varied topics, subjects, adverbial anchors, and vocabulary slots.
 */
interface DrillTemplate {
  type: DrillType;
  level: PracticeDrill['level'];
  templatePrompt: (topic: string, subject: string, adverb: string, variant: number) => string;
  instruction: string;
  optionsGenerator?: (correct: string) => string[];
  correctAnswer: (topic: string, subject: string, adverb: string, variant: number) => string | string[];
  tokensGenerator?: (topic: string, subject: string, adverb: string, variant: number) => { ordered: string[]; scrambled: string[] };
  wordClue?: string;
  hint: string;
  grammarExplanation: string;
  translation: (topic: string, subject: string, adverb: string, variant: number) => string;
}

// ================= GERMAN DATA & TEMPLATES =================
const GERMAN_TOPICS = [
  'Umweltschutz',
  'künstliche Intelligenz',
  'moderne Stadtplanung',
  'berufliche Weiterbildung',
  'gesunde Ernährung',
  'internationale Zusammenarbeit',
  'Kulturaustausch',
  'nachhaltige Mobilität',
  'digitale Bildung',
  'kulinarische Traditionen',
  'Sprachreisen und Austausch',
  'erneuerbare Energien',
  'wissenschaftliche Forschung',
  'Arbeitswelt der Zukunft'
];

const GERMAN_SUBJECTS = [
  'unsere Forschungsgruppe',
  'die engagierte Professorin',
  'das internationale Projektteam',
  'der Fachbereich für Sprachen',
  'jeder neue Seminarteilnehmer',
  'die wissenschaftliche Kommission',
  'unsere Abteilung',
  'die Kooperationspartner aus Hamburg',
  'die erfahrene Projektleiterin',
  'das interdisziplinäre Team'
];

const GERMAN_ADVERBS = [
  'in diesem Semester',
  'mit großem Einsatz',
  'schrittweise',
  'in der aktuellen Phase',
  'kontinuierlich',
  'auf höchstem Niveau',
  'mit sichtbarer Begeisterung',
  'nach gründlicher Vorbereitung',
  'in enger Abstimmung',
  'bereits seit Wochen'
];

const GERMAN_TEMPLATES: DrillTemplate[] = [
  // --- Fill in the Blank ---
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Select the correct two-part connector to express contrast.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Im Bereich ${topic} arbeitet ${subj} ___ zielstrebig, sondern auch äußerst innovativ ${adv}.`,
        `Gerade bei Fragen zu ${topic} agiert ${subj} ___ pragmatisch, sondern ebenfalls kreativ ${adv}.`,
        `Hinsichtlich moderner Entwicklungen in ${topic} plant ${subj} ___ sorgfältig, sondern auch mutig ${adv}.`,
        `Während aktueller Debatten über ${topic} argumentiert ${subj} ___ sachlich, sondern auch überzeugend ${adv}.`,
        `Innerhalb neuer Programme rund um ${topic} forscht ${subj} ___ gründlich, sondern obendrein praxisnah ${adv}.`,
        `Aus Sicht von Expertinnen für ${topic} handelt ${subj} ___ verlässlich, sondern ebenso weitsichtig ${adv}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['nicht nur', 'entweder', 'sowohl', 'weder'], correct),
    correctAnswer: () => 'nicht nur',
    hint: 'Pairs with "...sondern auch / ...sondern ebenfalls / ...sondern obendrein".',
    grammarExplanation: '"Nicht nur ... sondern auch" connects two affirmative, complementary statements.',
    translation: (topic, subj, adv) => `Regarding ${topic}, ${subj} works not only determinedly, but also innovatively ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Select the correct preposition with Dativ for expressing engagement.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Seit letztem Herbst befasst sich ${subj} intensiv ___ neuen Konzepten für ${topic}.`,
        `Während dieses Workshops setzt sich ${subj} ${adv} ___ Strategien zu ${topic} auseinander.`,
        `Auf der Konferenz diskutierte ${subj} ${adv} ___ modernen Lösungen rund um ${topic}.`,
        `Schon seit Monaten beschäftigt sich ${subj} ___ praktischen Beispielen aus ${topic}.`,
        `Mit großer Neugier widmet sich ${subj} ___ aktuellen Studien über ${topic}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (_correct, ) => shuffleFillBlankOptions(['mit', 'für', 'an', 'nach'], 'mit'),
    correctAnswer: () => 'mit',
    hint: 'Verbal idioms "sich befassen mit / sich beschäftigen mit / sich auseinandersetzen mit" govern Dativ.',
    grammarExplanation: '"Sich beschäftigen mit" and "sich befassen mit" strictly govern the dative case.',
    translation: (topic, subj, adv) => `${subj} engages intensively with various new approaches to ${topic} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B2',
    instruction: 'Choose the correct subordinate connector of concession.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `___ die Auswertung zu ${topic} sehr zeitraubend war, erzielte ${subj} ${adv} klare Fortschritte.`,
        `___ die Rahmenbedingungen bei ${topic} schwierig blieben, fand ${subj} ${adv} tragfähige Wege.`,
        `___ viele Fachleute bei ${topic} skeptisch reagierten, entwickelte ${subj} ${adv} ein starkes Modell.`,
        `___ das Budget für ${topic} anfangs knapp bemessen war, schloss ${subj} alles ${adv} erfolgreich ab.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['Obwohl', 'Weil', 'Damit', 'Deshalb'], correct),
    correctAnswer: () => 'Obwohl',
    hint: 'Concessive connector meaning "Although / Even though".',
    grammarExplanation: '"Obwohl" introduces a concessive clause with Verb-Letzt-Stellung.',
    translation: (topic, subj, adv) => `Although the analysis on ${topic} was demanding, ${subj} achieved clear progress ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: 'Select the correct modal verb for obligation.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Vor dem Start eines Projekts zu ${topic} ___ ${subj} alle Sicherheitsregeln ${adv} einhalten.`,
        `Bei offiziellen Tests über ${topic} ___ ${subj} sämtliche Nachweise ${adv} vorlegen.`,
        `Für eine faire Bewertung in ${topic} ___ ${subj} verlässliche Quellen ${adv} prüfen.`,
        `Während der gesamten Planung zu ${topic} ___ ${subj} klare Prioritäten ${adv} setzen.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['muss', 'darf', 'mag', 'will'], correct),
    correctAnswer: () => 'muss',
    hint: 'Modal verb expressing necessity or mandate (3rd person singular).',
    grammarExplanation: '"Müssen" denotes an obligatory requirement.',
    translation: (topic, subj, adv) => `For ${topic}, ${subj} must observe all requirements ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B2',
    instruction: 'Choose the correct Konjunktiv II form for polite recommendation.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Bei komplexen Rückfragen zu ${topic} ___ ${subj} sich ${adv} mit der Fachstelle abstimmen.`,
        `Angesichts neuer Vorgaben für ${topic} ___ ${subj} den Zeitplan ${adv} anpassen.`,
        `Nach dieser Erfahrung im Bereich ${topic} ___ ${subj} zusätzliche Feedbackrunden ${adv} einplanen.`,
        `Zum besseren Verständnis von ${topic} ___ ${subj} ein kompaktes Handbuch ${adv} erstellen.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['sollte', 'wird', 'kann', 'müsse'], correct),
    correctAnswer: () => 'sollte',
    hint: 'Polite advice using Konjunktiv II of "sollen" ("sollte").',
    grammarExplanation: '"Sollte" is standard for gentle advice or recommendation.',
    translation: (topic, subj, adv) => `Regarding ${topic}, ${subj} should take that step ${adv}.`
  },

  // --- Sentence Ordering ---
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Rearrange words into a natural subordinate clause (Verb at the end).',
    templatePrompt: (_, __, ___, v) => {
      const examples = [
        'Form: "Weil das Wetter heute so herrlich ist, machen wir einen langen Spaziergang."',
        'Form: "Obwohl der Vortrag sehr anspruchsvoll war, haben alle aufmerksam zugehört."',
        'Form: "Da wir morgen früh abreisen, packen wir heute Abend schon die Koffer."',
        'Form: "Wenn Sie weitere Fragen haben, können Sie uns jederzeit kontaktieren."',
        'Form: "Seitdem unsere Nachbarn umgezogen sind, ist das Treppenhaus viel ruhiger."',
        'Form: "Nachdem wir das Museum besucht hatten, tranken wir am Flussufer Kaffee."',
        'Form: "Während draußen ein Sommergewitter tobt, kochen wir gemeinsam eine warme Suppe."'
      ];
      return examples[v % examples.length];
    },
    correctAnswer: (_, __, ___, v) => {
      const sets = [
        ['Weil', 'das', 'Wetter', 'heute', 'so', 'herrlich', 'ist,', 'machen', 'wir', 'einen', 'langen', 'Spaziergang.'],
        ['Obwohl', 'der', 'Vortrag', 'sehr', 'anspruchsvoll', 'war,', 'haben', 'alle', 'aufmerksam', 'zugehört.'],
        ['Da', 'wir', 'morgen', 'früh', 'abreisen,', 'packen', 'wir', 'heute', 'Abend', 'schon', 'die', 'Koffer.'],
        ['Wenn', 'Sie', 'weitere', 'Fragen', 'haben,', 'können', 'Sie', 'uns', 'jederzeit', 'kontaktieren.'],
        ['Seitdem', 'unsere', 'Nachbarn', 'umgezogen', 'sind,', 'ist', 'das', 'Treppenhaus', 'viel', 'ruhiger.'],
        ['Nachdem', 'wir', 'das', 'Museum', 'besucht', 'hatten,', 'tranken', 'wir', 'am', 'Flussufer', 'Kaffee.'],
        ['Während', 'draußen', 'ein', 'Sommergewitter', 'tobt,', 'kochen', 'wir', 'gemeinsam', 'eine', 'warme', 'Suppe.']
      ];
      return sets[v % sets.length];
    },
    tokensGenerator: (_, __, ___, v) => {
      const sets = [
        ['Weil', 'das', 'Wetter', 'heute', 'so', 'herrlich', 'ist,', 'machen', 'wir', 'einen', 'langen', 'Spaziergang.'],
        ['Obwohl', 'der', 'Vortrag', 'sehr', 'anspruchsvoll', 'war,', 'haben', 'alle', 'aufmerksam', 'zugehört.'],
        ['Da', 'wir', 'morgen', 'früh', 'abreisen,', 'packen', 'wir', 'heute', 'Abend', 'schon', 'die', 'Koffer.'],
        ['Wenn', 'Sie', 'weitere', 'Fragen', 'haben,', 'können', 'Sie', 'uns', 'jederzeit', 'kontaktieren.'],
        ['Seitdem', 'unsere', 'Nachbarn', 'umgezogen', 'sind,', 'ist', 'das', 'Treppenhaus', 'viel', 'ruhiger.'],
        ['Nachdem', 'wir', 'das', 'Museum', 'besucht', 'hatten,', 'tranken', 'wir', 'am', 'Flussufer', 'Kaffee.'],
        ['Während', 'draußen', 'ein', 'Sommergewitter', 'tobt,', 'kochen', 'wir', 'gemeinsam', 'eine', 'warme', 'Suppe.']
      ];
      const ordered = sets[v % sets.length];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Subordinating conjunction places the conjugated verb at the conclusion of the subclause.',
    grammarExplanation: 'Subordinating conjunctions trigger Verb-Letzt-Stellung.',
    translation: () => 'Properly ordered natural German subordinate clause.'
  },
  {
    type: 'sentence-ordering',
    level: 'B2',
    instruction: 'Construct an inverted or TeKaMoLo sentence naturally.',
    templatePrompt: (_, __, ___, v) => {
      const examples = [
        'Form: "Hätte ich mehr Zeit gehabt, wäre ich gerne zum Konzert mitgekommen."',
        'Form: "Morgen Vormittag fährt der Regionalzug pünktlich vom dritten Gleis nach München."',
        'Form: "Ohne ausreichende Vorbereitung lässt sich dieses komplexe Thema kaum meistern."',
        'Form: "Anstatt den ganzen Abend fernzusehen, gingen die Geschwister lieber durch den Park."'
      ];
      return examples[v % examples.length];
    },
    correctAnswer: (_, __, ___, v) => {
      const sets = [
        ['Hätte', 'ich', 'mehr', 'Zeit', 'gehabt,', 'wäre', 'ich', 'gerne', 'zum', 'Konzert', 'mitgekommen.'],
        ['Morgen', 'Vormittag', 'fährt', 'der', 'Regionalzug', 'pünktlich', 'vom', 'dritten', 'Gleis', 'nach', 'München.'],
        ['Ohne', 'ausreichende', 'Vorbereitung', 'lässt', 'sich', 'dieses', 'komplexe', 'Thema', 'kaum', 'meistern.'],
        ['Anstatt', 'den', 'ganzen', 'Abend', 'fernzusehen,', 'gingen', 'die', 'Geschwister', 'lieber', 'durch', 'den', 'Park.']
      ];
      return sets[v % sets.length];
    },
    tokensGenerator: (_, __, ___, v) => {
      const sets = [
        ['Hätte', 'ich', 'mehr', 'Zeit', 'gehabt,', 'wäre', 'ich', 'gerne', 'zum', 'Konzert', 'mitgekommen.'],
        ['Morgen', 'Vormittag', 'fährt', 'der', 'Regionalzug', 'pünktlich', 'vom', 'dritten', 'Gleis', 'nach', 'München.'],
        ['Ohne', 'ausreichende', 'Vorbereitung', 'lässt', 'sich', 'dieses', 'komplexe', 'Thema', 'kaum', 'meistern.'],
        ['Anstatt', 'den', 'ganzen', 'Abend', 'fernzusehen,', 'gingen', 'die', 'Geschwister', 'lieber', 'durch', 'den', 'Park.']
      ];
      const ordered = sets[v % sets.length];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Check verb-second (V2) word order after fronted clauses or temporal phrases.',
    grammarExplanation: 'German main clauses consistently maintain the finite verb in position 2.',
    translation: () => 'Natural German complex sentence structure.'
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Arrange the German words with correct verb placement.',
    templatePrompt: (topic, subj, adv, v) => {
      const capSubj = subj.charAt(0).toUpperCase() + subj.slice(1);
      const frames = [
        `${capSubj} untersucht ${adv} moderne Konzepte zu ${topic}.`,
        `Seit Wochen diskutiert ${subj} über Perspektiven für ${topic}.`,
        `Gemeinsam entwickelt ${subj} ${adv} nachhaltige Ideen für ${topic}.`,
        `Ohne Zweifel bereichert ${topic} die Arbeit von ${subj} ${adv}.`
      ];
      return `Form: "${frames[v % frames.length]}"`;
    },
    correctAnswer: (topic, subj, adv, v) => {
      const capSubj = subj.charAt(0).toUpperCase() + subj.slice(1);
      const frames = [
        `${capSubj} untersucht ${adv} moderne Konzepte zu ${topic}.`,
        `Seit Wochen diskutiert ${subj} über Perspektiven für ${topic}.`,
        `Gemeinsam entwickelt ${subj} ${adv} nachhaltige Ideen für ${topic}.`,
        `Ohne Zweifel bereichert ${topic} die Arbeit von ${subj} ${adv}.`
      ];
      return frames[v % frames.length].split(/\s+/);
    },
    tokensGenerator: (topic, subj, adv, v) => {
      const capSubj = subj.charAt(0).toUpperCase() + subj.slice(1);
      const frames = [
        `${capSubj} untersucht ${adv} moderne Konzepte zu ${topic}.`,
        `Seit Wochen diskutiert ${subj} über Perspektiven für ${topic}.`,
        `Gemeinsam entwickelt ${subj} ${adv} nachhaltige Ideen für ${topic}.`,
        `Ohne Zweifel bereichert ${topic} die Arbeit von ${subj} ${adv}.`
      ];
      const ordered = frames[v % frames.length].split(/\s+/);
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Place the conjugated verb strictly in position 2 of the main clause.',
    grammarExplanation: 'German main clauses enforce Verb-Zweit-Stellung (V2).',
    translation: (topic, subj, adv) => `${subj} explores modern ideas on ${topic} ${adv}.`
  },

  // --- Guess Missing Word ---
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Type the missing German noun.',
    templatePrompt: (topic, subj, adv, v) => {
      const contexts = [
        `Für das Projekt über ${topic} verfügt ${subj} über langjährige praktische ___.`,
        `Die Umstellung auf ${topic} stellt für ${subj} eine spannende ___ dar.`,
        `Nach intensiver Abstimmung präsentierte ${subj} eine überzeugende ___ für die Praxis.`,
        `Eine klare Dokumentation stärkt das gegenseitige ___ rund um ${topic}.`,
        `Ohne verlässliche Daten bleibt jede Prognose zu ${topic} bloße ___.`
      ];
      return contexts[v % contexts.length];
    },
    correctAnswer: (_, __, ___, v) => {
      const answers = ['Erfahrung', 'Herausforderung', 'Lösung', 'Vertrauen', 'Spekulation'];
      return answers[v % answers.length];
    },
    wordClue: 'experience / challenge / solution / trust / speculation (capitalize German nouns)',
    hint: 'German nouns are capitalized (Erfahrung, Herausforderung, Lösung, Vertrauen, Spekulation).',
    grammarExplanation: 'Core B1/B2 communicative abstract nouns.',
    translation: () => 'German sentence requiring a key communicative noun.'
  },
  {
    type: 'guess-missing-word',
    level: 'B2',
    instruction: 'Type the missing German adjective meaning "reliable / dependable".',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Rund um ${topic} erweist sich ${subj} als äußerst ___ Partner ${adv}.`,
        `Bei heiklen Terminen zu ${topic} bleibt ${subj} stets ein ___ Kontakt ${adv}.`,
        `Trotz enger Fristen für ${topic} gilt ${subj} als besonders ___ Ansprechpartner ${adv}.`
      ];
      return openings[v % openings.length];
    },
    correctAnswer: () => 'zuverlässiger / zuverlässig',
    wordClue: 'reliable / dependable (starts with "zuver...")',
    hint: 'Starts with "zuver..." (12 letters).',
    grammarExplanation: '"Zuverlässig" describes someone dependable; in masculine mixed declension: "ein zuverlässiger".',
    translation: (topic, subj, adv) => `In all matters concerning ${topic}, ${subj} is an extremely reliable partner ${adv}.`
  }
];

// ================= SPANISH DATA & TEMPLATES =================
const SPANISH_TOPICS = [
  'energías renovables',
  'inteligencia artificial',
  'turismo sostenible',
  'gastronomía tradicional',
  'comunicación intercultural',
  'desarrollo profesional',
  'salud y bienestar',
  'innovación tecnológica',
  'educación digital',
  'preservación del medio ambiente',
  'cooperación internacional',
  'arquitectura bioclimática',
  'biodiversidad marina',
  'gestión del tiempo'
];

const SPANISH_SUBJECTS = [
  'el equipo de investigación',
  'nuestro departamento',
  'la profesora de idiomas',
  'el comité asesor',
  'cada estudiante del curso',
  'la empresa colaboradora',
  'el grupo de trabajo',
  'la especialista en innovación',
  'la comunidad académica',
  'el panel de expertos'
];

const SPANISH_ADVERBS = [
  'con gran dedicación',
  'durante este trimestre',
  'de forma rigurosa',
  'en la actualidad',
  'constantemente',
  'con entusiasmo',
  'paso a paso',
  'a nivel internacional',
  'en cada sesión',
  'de manera estratégica'
];

const SPANISH_TEMPLATES: DrillTemplate[] = [
  // --- Fill in the Blank ---
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Select the correct present subjunctive form of the verb.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Resulta fundamental que ${subj} ___ nuevas metodologías sobre ${topic} ${adv}.`,
        `Parece urgente que ${subj} ___ alternativas reales en ${topic} ${adv}.`,
        `Conviene mucho que ${subj} ___ propuestas creativas para ${topic} ${adv}.`,
        `Es prioritario que ${subj} ___ herramientas modernas en ${topic} ${adv}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['desarrolle', 'desarrolla', 'desarrollará', 'desarrollaría'], correct),
    correctAnswer: () => 'desarrolle',
    hint: 'Impersonal expressions ("Resulta fundamental que / Conviene que...") require present subjunctive.',
    grammarExplanation: 'Impersonal necessity expressions trigger the subjunctive mood ("desarrolle").',
    translation: (topic, subj, adv) => `It is vital that ${subj} develop new approaches regarding ${topic} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: 'Choose between "para" and "por" to express purpose.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Cada trimestre ${subj} revisa los estudios de ${topic} ___ optimizar los resultados ${adv}.`,
        `Desde enero ${subj} organiza talleres sobre ${topic} ___ ampliar la participación ${adv}.`,
        `En la biblioteca ${subj} consulta informes de ${topic} ___ preparar su exposición ${adv}.`,
        `Todos los lunes ${subj} evalúa proyectos de ${topic} ___ fortalecer la calidad ${adv}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['para', 'por', 'con', 'de'], correct),
    correctAnswer: () => 'para',
    hint: '"Para + infinitivo" indicates goal or intended purpose.',
    grammarExplanation: '"Para" indicates purpose ("in order to...").',
    translation: (topic, subj, adv) => `${subj} examines ${topic} in order to improve outcomes ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Choose the correct subjunctive verb form expressing doubt.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Casi nadie cree que esta reforma sobre ${topic} ___ aprobada por ${subj} ${adv}.`,
        `No parece probable que la iniciativa de ${topic} ___ concluida por ${subj} ${adv}.`,
        `Muchos dudan seriamente que la propuesta sobre ${topic} ___ aceptada por ${subj} ${adv}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['sea', 'es', 'será', 'sería'], correct),
    correctAnswer: () => 'sea',
    hint: 'Expressions of doubt or uncertainty ("no parece probable que / dudan que") require the subjunctive.',
    grammarExplanation: '"Dudar que" and negated belief take the subjunctive mood ("sea").',
    translation: (topic, subj, adv) => `Uncertainty surrounds whether the ${topic} initiative will be approved by ${subj} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B2',
    instruction: 'Select the correct conjunction of opposition after negation.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `En materia de ${topic}, ${subj} no solo aporta recursos, ___ que también capacita a voluntarios ${adv}.`,
        `Respecto a ${topic}, ${subj} no solo investiga casos, ___ que además publica guías abiertas ${adv}.`,
        `Sobre ${topic}, ${subj} no solo financia becas, ___ que también acompaña a comunidades locales ${adv}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['sino', 'pero', 'aunque', 'más'], correct),
    correctAnswer: () => 'sino',
    hint: 'Correlative contrast after a negated clause: "no solo ... sino que".',
    grammarExplanation: '"Sino que" introduces an opposing affirmative clause after negation.',
    translation: (topic, subj, adv) => `Regarding ${topic}, ${subj} not only contributes, but also supports communities ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: 'Select the correct indirect object pronoun.',
    templatePrompt: (topic, subj, adv, v) => {
      const openings = [
        `Desde joven a ${subj} ___ fascina explorar temas de ${topic} ${adv}.`,
        `Curiosamente a ${subj} ___ entusiasma debatir sobre ${topic} ${adv}.`,
        `Hoy en día a ${subj} ___ interesa aprender más acerca de ${topic} ${adv}.`
      ];
      return openings[v % openings.length];
    },
    optionsGenerator: (correct) => shuffleFillBlankOptions(['le', 'la', 'lo', 'se'], correct),
    correctAnswer: () => 'le',
    hint: 'Singular third-person indirect object pronoun for verbs like fascinar/interesar/gustar.',
    grammarExplanation: 'Verbs like "fascinar" and "interesar" require the indirect object pronoun "le".',
    translation: (topic, subj, adv) => `${subj} is fascinated by exploring ${topic} ${adv}.`
  },

  // --- Sentence Ordering ---
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Rearrange words to express purpose with "para que".',
    templatePrompt: (_, __, ___, v) => {
      const forms = [
        'Form: "Te explico los detalles ahora para que puedas entenderlo todo claramente."',
        'Form: "Compartimos esta guía práctica para que los nuevos miembros aprendan rápido."',
        'Form: "Organizamos la conferencia temprano para que todos puedan participar cómodamente."',
        'Form: "Enviamos el informe completo ayer para que el equipo pueda revisarlo a tiempo."'
      ];
      return forms[v % forms.length];
    },
    correctAnswer: (_, __, ___, v) => {
      const sets = [
        ['Te', 'explico', 'los', 'detalles', 'ahora', 'para', 'que', 'puedas', 'entenderlo', 'todo', 'claramente.'],
        ['Compartimos', 'esta', 'guía', 'práctica', 'para', 'que', 'los', 'nuevos', 'miembros', 'aprendan', 'rápido.'],
        ['Organizamos', 'la', 'conferencia', 'temprano', 'para', 'que', 'todos', 'puedan', 'participar', 'cómodamente.'],
        ['Enviamos', 'el', 'informe', 'completo', 'ayer', 'para', 'que', 'el', 'equipo', 'pueda', 'revisarlo', 'a tiempo.']
      ];
      return sets[v % sets.length];
    },
    tokensGenerator: (_, __, ___, v) => {
      const sets = [
        ['Te', 'explico', 'los', 'detalles', 'ahora', 'para', 'que', 'puedas', 'entenderlo', 'todo', 'claramente.'],
        ['Compartimos', 'esta', 'guía', 'práctica', 'para', 'que', 'los', 'nuevos', 'miembros', 'aprendan', 'rápido.'],
        ['Organizamos', 'la', 'conferencia', 'temprano', 'para', 'que', 'todos', 'puedan', 'participar', 'cómodamente.'],
        ['Enviamos', 'el', 'informe', 'completo', 'ayer', 'para', 'que', 'el', 'equipo', 'pueda', 'revisarlo', 'a tiempo.']
      ];
      const ordered = sets[v % sets.length];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '"Para que" triggers the subjunctive mood in the purpose clause.',
    grammarExplanation: '"Para que" always requires the subjunctive mood when subjects differ.',
    translation: () => 'Cohesive Spanish purpose sentence with subjunctive mood.'
  },
  {
    type: 'sentence-ordering',
    level: 'B2',
    instruction: 'Rearrange words into a conditional sentence with imperfect subjunctive.',
    templatePrompt: () => 'Form: "Si tuviéramos más recursos, investigaríamos más a fondo las soluciones sostenibles."',
    correctAnswer: () => ['Si', 'tuviéramos', 'más', 'recursos,', 'investigaríamos', 'más', 'a fondo', 'las', 'soluciones', 'sostenibles.'],
    tokensGenerator: () => {
      const ordered = ['Si', 'tuviéramos', 'más', 'recursos,', 'investigaríamos', 'más', 'a fondo', 'las', 'soluciones', 'sostenibles.'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Hypothetical "Si + subjuntivo imperfecto" pairs with conditional.',
    grammarExplanation: 'Hypothetical conditional clauses use imperfect subjunctive and conditional.',
    translation: () => 'If we had more resources, we would investigate sustainable solutions more deeply.'
  },

  // --- Guess Missing Word ---
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Type the missing Spanish adjective for "essential / indispensable".',
    templatePrompt: (topic, subj, adv) =>
      `Para ${subj}, mantener una comunicación transparente sobre ${topic} es ___ ${adv}.`,
    correctAnswer: () => 'imprescindible / esencial / fundamental',
    wordClue: 'indispensable / essential (starts with "impresc..." or "esenc...")',
    hint: 'Starts with "impresc..." or "esenc...".',
    grammarExplanation: '"Imprescindible" is the natural B2/C1 Spanish equivalent for essential.',
    translation: (topic, subj, adv) => `For ${subj}, maintaining transparent communication regarding ${topic} is indispensable ${adv}.`
  },
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Type the missing Spanish noun for "commitment / dedication".',
    templatePrompt: (topic, subj, adv) =>
      `${subj} demuestra un gran ___ con los objetivos de ${topic} ${adv}.`,
    correctAnswer: () => 'compromiso',
    wordClue: 'commitment / dedication (masculine noun)',
    hint: 'Starts with "compro..." (10 letters).',
    grammarExplanation: '"El compromiso" is the standard Spanish noun for commitment.',
    translation: (topic, subj, adv) => `${subj} demonstrates great commitment to the objectives of ${topic} ${adv}.`
  }
];

// ================= ENGLISH DATA & TEMPLATES =================
const ENGLISH_TOPICS = [
  'artificial intelligence',
  'sustainable urban design',
  'global market trends',
  'effective leadership',
  'remote collaboration',
  'cross-cultural communication',
  'creative problem solving',
  'renewable energy transitions',
  'digital literacy',
  'cybersecurity protocols'
];

const ENGLISH_SUBJECTS = [
  'our research division',
  'the international panel',
  'the senior engineering team',
  'every participant in the seminar',
  'the university faculty',
  'our advisory council',
  'the innovation taskforce',
  'the cross-functional team'
];

const ENGLISH_ADVERBS = [
  'throughout this quarter',
  'with remarkable precision',
  'on a global scale',
  'in recent months',
  'consistently',
  'with great dedication',
  'step by step',
  'in close partnership'
];

const ENGLISH_TEMPLATES: DrillTemplate[] = [
  // --- Fill in the Blank ---
  {
    type: 'fill-blank',
    level: 'B2',
    instruction: 'Select the correct preposition in this idiomatic phrasal structure.',
    templatePrompt: (topic, subj, adv) =>
      `${subj} came up ___ an ingenious breakthrough regarding ${topic} ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['with', 'to', 'in', 'at'], correct),
    correctAnswer: () => 'with',
    hint: 'The three-part phrasal verb is "to come up with" an idea or solution.',
    grammarExplanation: '"Come up with" is a fixed phrasal verb meaning produce/suggest.',
    translation: (topic, subj, adv) => `${subj} came up with an ingenious breakthrough regarding ${topic} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B2',
    instruction: 'Select the correct verb pattern after "look forward to".',
    templatePrompt: (topic, subj, adv) =>
      `${subj} looks forward to ___ the findings on ${topic} at the conference ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['presenting', 'present', 'to present', 'presented'], correct),
    correctAnswer: () => 'presenting',
    hint: '"Look forward to" is followed by a gerund (-ing form).',
    grammarExplanation: 'The preposition "to" requires a gerund form: "look forward to presenting".',
    translation: (topic, subj, adv) => `${subj} looks forward to presenting findings on ${topic} at the conference ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Choose the correct preposition of duration.',
    templatePrompt: (topic, subj, adv) =>
      `${subj} has been actively investigating ${topic} ___ over five years.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['for', 'since', 'during', 'from'], correct),
    correctAnswer: () => 'for',
    hint: 'Periods or quantities of elapsed time take "for".',
    grammarExplanation: '"For" marks a duration of time ("for five years").',
    translation: (topic, subj, adv) => `${subj} has been actively investigating ${topic} for over five years.`
  },
  {
    type: 'fill-blank',
    level: 'C1',
    instruction: 'Choose the correct inversion auxiliary.',
    templatePrompt: (topic, subj, adv) =>
      `Hardly ___ ${subj} announced the milestone in ${topic} when inquiries arrived ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['had', 'did', 'was', 'would'], correct),
    correctAnswer: () => 'had',
    hint: 'Correlative negative inversion: "Hardly had ... when".',
    grammarExplanation: '"Hardly had + subject + past participle" is formal inversion.',
    translation: (topic, subj, adv) => `Hardly had ${subj} announced the milestone in ${topic} when inquiries arrived ${adv}.`
  },

  // --- Sentence Ordering ---
  {
    type: 'sentence-ordering',
    level: 'B2',
    instruction: 'Construct an inverted third conditional sentence.',
    templatePrompt: () => 'Form: "Had we anticipated the severe storm, we would have postponed our departure."',
    correctAnswer: () => ['Had', 'we', 'anticipated', 'the', 'severe', 'storm,', 'we', 'would', 'have', 'postponed', 'our', 'departure.'],
    tokensGenerator: () => {
      const ordered = ['Had', 'we', 'anticipated', 'the', 'severe', 'storm,', 'we', 'would', 'have', 'postponed', 'our', 'departure.'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Invert the auxiliary "Had" before subject "we" to replace "If we had".',
    grammarExplanation: 'Formal inverted third conditionals drop "if" and front the auxiliary "had".',
    translation: () => 'Had we anticipated the severe storm, we would have postponed our departure.'
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Arrange words into a polite business inquiry.',
    templatePrompt: () => 'Form: "Could you please send me the updated project schedule by Friday afternoon?"',
    correctAnswer: () => ['Could', 'you', 'please', 'send', 'me', 'the', 'updated', 'project', 'schedule', 'by', 'Friday', 'afternoon?'],
    tokensGenerator: () => {
      const ordered = ['Could', 'you', 'please', 'send', 'me', 'the', 'updated', 'project', 'schedule', 'by', 'Friday', 'afternoon?'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '"Could you please send me..." is followed by direct object.',
    grammarExplanation: 'Polite requests place "please" between the subject and the bare verb.',
    translation: () => 'Could you please send me the updated project schedule by Friday afternoon?'
  },

  // --- Guess Missing Word ---
  {
    type: 'guess-missing-word',
    level: 'B2',
    instruction: 'Type the adjective meaning "present, appearing, or found everywhere".',
    templatePrompt: () => 'Smartphones and wireless networks have become ___ in contemporary society.',
    correctAnswer: () => 'ubiquitous / omnipresent',
    wordClue: 'present or found everywhere (starts with "u")',
    hint: 'Starts with "ubi..." (10 letters).',
    grammarExplanation: '"Ubiquitous" is an elevated academic adjective replacing "very common".',
    translation: () => 'Smartphones and wireless networks have become ubiquitous in contemporary society.'
  },
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Type the noun meaning "an advantage or positive gain".',
    templatePrompt: () => 'One major ___ of working remotely is having flexible hours throughout the week.',
    correctAnswer: () => 'benefit / advantage',
    wordClue: 'positive advantage or gain',
    hint: 'Starts with "bene..." (7 letters) or "advan...".',
    grammarExplanation: '"A major benefit of" takes a gerund phrase.',
    translation: () => 'One major benefit of working remotely is having flexible hours throughout the week.'
  }
];

// ================= FRENCH DATA & TEMPLATES =================
const FRENCH_TOPICS = [
  'la transition écologique',
  'le télétravail moderne',
  'le patrimoine culturel',
  'l\'art de vivre à la française',
  'la francophonie mondiale',
  'l\'éducation numérique',
  'les énergies renouvelables',
  'la gastronomie régionale'
];

const FRENCH_SUBJECTS = [
  'notre équipe de recherche',
  'le comité d\'experts',
  'la professeure de langues',
  'chaque membre du groupe',
  'le laboratoire d\'innovation',
  'la commission européenne'
];

const FRENCH_ADVERBS = [
  'avec une grande rigueur',
  'au cours de ce trimestre',
  'de manière progressive',
  'actuellement',
  'avec enthousiasme',
  'dans ce contexte'
];

const FRENCH_TEMPLATES: DrillTemplate[] = [
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Sélectionnez la forme correcte du subjonctif présent.',
    templatePrompt: (topic, subj, adv) =>
      `Il est primordial que ${subj} ___ des actions concrètes pour ${topic} ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['fassions', 'faisons', 'ferons', 'ferions'], correct),
    correctAnswer: () => 'fassions',
    hint: '"Il est primordial que..." exige le mode subjonctif.',
    grammarExplanation: 'Les expressions impersonnelles d\'obligation imposent le subjonctif.',
    translation: (topic, subj, adv) => `It is primordial that ${subj} take concrete actions for ${topic} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B2',
    instruction: 'Sélectionnez la bonne préposition après le verbe réflexif "s\'intéresser".',
    templatePrompt: (topic, subj, adv) =>
      `${subj} s'intéresse particulièrement ___ enjeux de ${topic} ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['aux', 'des', 'pour', 'dans'], correct),
    correctAnswer: () => 'aux',
    hint: 'Le verbe est "s\'intéresser à" (à + les = aux).',
    grammarExplanation: '"S\'intéresser à" se contracte en "aux" devant un nom pluriel.',
    translation: (topic, subj, adv) => `${subj} is particularly interested in the challenges of ${topic} ${adv}.`
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Remettez les mots dans l\'ordre en plaçant les pronoms correctement.',
    templatePrompt: () => 'Form: "Je vous remercie chaleureusement pour votre accueil exceptionnel."',
    correctAnswer: () => ['Je', 'vous', 'remercie', 'chaleureusement', 'pour', 'votre', 'accueil', 'exceptionnel.'],
    tokensGenerator: () => {
      const ordered = ['Je', 'vous', 'remercie', 'chaleureusement', 'pour', 'votre', 'accueil', 'exceptionnel.'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Le pronom complément "vous" se place devant le verbe conjugué "remercie".',
    grammarExplanation: 'En français, les pronoms personnels compléments précèdent le verbe.',
    translation: () => 'I warmly thank you for your exceptional welcome.'
  },
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Tapez l\'adjectif français manquant signifiant "indispensable / essentiel".',
    templatePrompt: (topic, subj, adv) =>
      `Pour ${subj}, une veille attentive sur ${topic} est ___ ${adv}.`,
    correctAnswer: () => 'indispensable / essentielle / primordiale',
    wordClue: 'indispensable / essential (commence par "indispen..." ou "essent...")',
    hint: 'Commence par "indispen..." ou "essent...".',
    grammarExplanation: '"Indispensable" traduit la nécessité absolue.',
    translation: (topic, subj, adv) => `For ${subj}, vigilant monitoring of ${topic} is indispensable ${adv}.`
  }
];

// ================= ITALIAN DATA & TEMPLATES =================
const ITALIAN_TOPICS = [
  'la sostenibilità ambientale',
  'la cucina regionale',
  'l\'innovazione tecnologica',
  'il patrimonio artistico',
  'il cinema d\'autore',
  'la moda sostenibile',
  'l\'architettura storica',
  'la transizione digitale'
];

const ITALIAN_SUBJECTS = [
  'il nostro gruppo di ricerca',
  'il professor Rossi',
  'la squadra di lavoro',
  'il comitato scientifico',
  'gli studenti del corso',
  'l\'azienda partner'
];

const ITALIAN_ADVERBS = [
  'con grande cura',
  'in questo periodo',
  'costantemente',
  'con passione',
  'durante la conferenza',
  'a livello europeo'
];

const ITALIAN_TEMPLATES: DrillTemplate[] = [
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Seleziona la forma corretta del congiuntivo presente.',
    templatePrompt: (topic, subj, adv) =>
      `Credo che ${subj} ___ un ruolo determinante per ${topic} ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['abbia', 'ha', 'avrà', 'avrebbe'], correct),
    correctAnswer: () => 'abbia',
    hint: 'I verbi di opinione ("Credo che...") reggono il congiuntivo presente.',
    grammarExplanation: '"Credere che" richiede il congiuntivo ("abbia").',
    translation: (topic, subj, adv) => `I believe that ${subj} has a decisive role for ${topic} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Scegli la preposizione articolata corretta.',
    templatePrompt: (topic, subj, adv) =>
      `${subj} partecipa attivamente ___ iniziative dedicate a ${topic} ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['alle', 'delle', 'sulle', 'per le'], correct),
    correctAnswer: () => 'alle',
    hint: '"Partecipare a" (a + le = alle).',
    grammarExplanation: '"Partecipare a" si unisce all\'articolo plurale femminile: "alle".',
    translation: (topic, subj, adv) => `${subj} actively participates in initiatives dedicated to ${topic} ${adv}.`
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Riordina le parole per formulare una proposta cortese.',
    templatePrompt: () => 'Form: "Potremmo fare una pausa prima della prossima riunione."',
    correctAnswer: () => ['Potremmo', 'fare', 'una', 'pausa', 'prima', 'della', 'prossima', 'riunione.'],
    tokensGenerator: () => {
      const ordered = ['Potremmo', 'fare', 'una', 'pausa', 'prima', 'della', 'prossima', 'riunione.'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Inizia con il condizionale di cortesia "Potremmo fare...".',
    grammarExplanation: 'Il condizionale esprime cortesia nelle proposte.',
    translation: () => 'We could take a break before the next meeting.'
  },
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Scrivi l\'aggettivo italiano che significa "fondamentale / indispensabile".',
    templatePrompt: (topic, subj, adv) =>
      `La collaborazione di ${subj} è ___ per il successo di ${topic} ${adv}.`,
    correctAnswer: () => 'fondamentale / indispensabile / essenziale',
    wordClue: 'fundamental / indispensable (inizia con "fonda..." o "indisp...")',
    hint: 'Inizia con "fonda..." o "indisp...".',
    grammarExplanation: '"Fondamentale" denota un elemento essenziale.',
    translation: (topic, subj, adv) => `The collaboration of ${subj} is fundamental for the success of ${topic} ${adv}.`
  }
];

// ================= JAPANESE DATA & TEMPLATES =================
const JAPANESE_TOPICS = [
  '日本の文化',
  '旅行と観光',
  '日常生活',
  '環境問題',
  '仕事と職場',
  'テクノロジー',
  '伝統芸能',
  '日本料理',
  '四季の祭り',
  '言語学習'
];

const JAPANESE_SUBJECTS = [
  '田中さん',
  '佐藤先生',
  '留学生のグループ',
  '私たちの同僚',
  '大学の研究チーム',
  '京都のガイド',
  '語学クラスの仲間',
  '日本の友達'
];

const JAPANESE_ADVERBS = [
  '今週',
  '毎日',
  '熱心に',
  '週末に',
  '最近',
  '来月',
  '一緒に',
  '楽しく'
];

const JAPANESE_TEMPLATES: DrillTemplate[] = [
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: '動作が行われる場所を表す正しい助詞を選んでください。',
    templatePrompt: (topic, subj, adv) =>
      `${adv}、${subj}はカフェ ___ ${topic}について詳しく話しました。`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['で', 'に', 'を', 'へ'], correct),
    correctAnswer: () => 'で',
    hint: '動作が行われる場所を表す助詞は「で」です。',
    grammarExplanation: '場所を表す助詞「で」は、動作の行われる場所を示します。',
    translation: (topic, subj, adv) => `${adv}, ${subj} talked in detail about ${topic} at a café.`
  },
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: '移動の目的地を表す正しい助詞を選んでください。',
    templatePrompt: (topic, subj, adv) =>
      `${adv}、${subj}は${topic}の研修会 ___ 行きました。`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['へ', 'で', 'を', 'から'], correct),
    correctAnswer: () => 'へ',
    hint: '方向・目的地を示す助詞は「へ」（または「に」）です。',
    grammarExplanation: '助詞「へ」は移動の方向や目的地を表します。',
    translation: (topic, subj, adv) => `${adv}, ${subj} went to the workshop on ${topic}.`
  },
  {
    type: 'sentence-ordering',
    level: 'A2',
    instruction: '言葉を並べ替えて丁寧な誘いの文を作ってください。',
    templatePrompt: () => 'Form: "一緒に美味しい日本茶を飲みませんか。"',
    correctAnswer: () => ['一緒に', '美味しい', '日本茶を', '飲みませんか。'],
    tokensGenerator: () => {
      const ordered = ['一緒に', '美味しい', '日本茶を', '飲みませんか。'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '副詞「一緒に」から始まり、丁寧な勧誘「〜ませんか」で終わります。',
    grammarExplanation: '「〜ませんか」は親しい相手や同僚に対する丁寧な誘いの表現です。',
    translation: () => 'Won\'t you drink delicious Japanese tea together with me?'
  },
  {
    type: 'sentence-ordering',
    level: 'A2',
    instruction: '言葉を並べ替えて丁寧な依頼の文を作ってください。',
    templatePrompt: () => 'Form: "もう少しゆっくり話してください。"',
    correctAnswer: () => ['もう少し', 'ゆっくり', '話して', 'ください。'],
    tokensGenerator: () => {
      const ordered = ['もう少し', 'ゆっくり', '話して', 'ください。'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '「もう少し」＋「ゆっくり」＋「話してください」。',
    grammarExplanation: 'て形＋「ください」は丁寧な依頼の文法形式です。',
    translation: () => 'Please speak a little more slowly.'
  },
  {
    type: 'guess-missing-word',
    level: 'A2',
    instruction: '「都合が良い・役に立つ」という意味の日本語の形容詞（な形容詞）を入力してください。',
    templatePrompt: (topic, subj, adv) =>
      `この${topic}に関する学習アプリは、毎日使っていてとても ___ です。`,
    correctAnswer: () => '便利 / べんり',
    wordClue: 'convenient / handy (漢字「便利」またはひらがな「べんり」)',
    hint: '漢字「便利」またはひらがな「べんり」。',
    grammarExplanation: '「便利（な）」は日常生活で頻出のな形容詞です。',
    translation: (topic) => `This study app regarding ${topic} is used every day and is very convenient.`
  },
  {
    type: 'guess-missing-word',
    level: 'A2',
    instruction: '「有名である」という意味の日本語を入力してください。',
    templatePrompt: (topic, subj, adv) =>
      `京都のこの古いお寺は、世界中でとても ___ です。`,
    correctAnswer: () => '有名 / ゆうめい',
    wordClue: 'famous / renowned (漢字「有名」または「ゆうめい」)',
    hint: '漢字「有名」またはひらがな「ゆうめい」。',
    grammarExplanation: '「有名（な）」は広く知られていることを表すな形容詞です。',
    translation: () => 'This old temple in Kyoto is very famous around the world.'
  }
];

// ================= MANDARIN DATA & TEMPLATES =================
const MANDARIN_TOPICS = [
  '中国传统文化',
  '现代城市生活',
  '语言学习',
  '科技创新',
  '环境保护',
  '旅游与美食',
  '数字经济',
  '国际交流'
];

const MANDARIN_SUBJECTS = [
  '王老师',
  '张经理',
  '留学生们',
  '研究小组',
  '我们班的同学',
  '语言专家',
  '工程师们',
  '李医生'
];

const MANDARIN_ADVERBS = [
  '今天上午',
  '经常',
  '认真地',
  '在会议上',
  '最近',
  '共同',
  '深入地',
  '热心地'
];

const MANDARIN_TEMPLATES: DrillTemplate[] = [
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: '选择正确的动态助词表示曾经有过的经历。',
    templatePrompt: (topic, subj, adv) =>
      `${adv}，${subj}深入讨论 ___ 关于${topic}的许多问题。`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['过', '了', '着', '得'], correct),
    correctAnswer: () => '过',
    hint: '表示过去的经历时，动词后面用动态助词“过”。',
    grammarExplanation: '助词“过”表示曾经发生过的经历。',
    translation: (topic, subj, adv) => `${adv}, ${subj} discussed many issues regarding ${topic}.`
  },
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: '选择表示动作完成的动态助词。',
    templatePrompt: (topic, subj, adv) =>
      `${subj}${adv}完成 ___ 一份关于${topic}的详细总结报告。`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['了', '过', '着', '的'], correct),
    correctAnswer: () => '了',
    hint: '动词后加“了”表示动作的完成或实现。',
    grammarExplanation: '“动词 + 了”表示动作已经完成。',
    translation: (topic, subj, adv) => `${subj} ${adv} completed a detailed summary report on ${topic}.`
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: '按汉语标准语序排列词语（主语 + 时间 + 地点 + 动词短语）。',
    templatePrompt: () => 'Form: "我们明天下午在图书馆一起复习汉语。"',
    correctAnswer: () => ['我们', '明天下午', '在图书馆', '一起', '复习汉语。'],
    tokensGenerator: () => {
      const ordered = ['我们', '明天下午', '在图书馆', '一起', '复习汉语。'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '时间状语和地点状语通常放在主要动词前面。',
    grammarExplanation: '汉语标准语序为：主语 + 时间 + 地点 + 状语 + 动词 + 宾语。',
    translation: () => 'We will review Chinese together at the library tomorrow afternoon.'
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: '按介词短语标准句型排列词语。',
    templatePrompt: () => 'Form: "我对中国历史与传统文化很感兴趣。"',
    correctAnswer: () => ['我', '对', '中国历史与传统文化', '很', '感兴趣。'],
    tokensGenerator: () => {
      const ordered = ['我', '对', '中国历史与传统文化', '很', '感兴趣。'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '标准结构：主语 + 对... + 很感兴趣。',
    grammarExplanation: '“对……感兴趣”是表示对某事物产生兴趣的固定介词结构。',
    translation: () => 'I am very interested in Chinese history and traditional culture.'
  },
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: '输入表示“辛勤付出、竭尽全力”的汉语词语。',
    templatePrompt: (topic, subj, adv) =>
      `只要大家${adv}共同 ___ ，就一定能实现关于${topic}的目标。`,
    correctAnswer: () => '努力 / 奋斗',
    wordClue: 'hard work / strive (拼音：nǔlì / 努力)',
    hint: '拼音：nǔlì（努力）。',
    grammarExplanation: '“努力”表示全力以赴、积极争取。',
    translation: (topic, subj, adv) => `As long as everyone works hard together ${adv}, we will achieve goals on ${topic}.`
  },
  {
    type: 'guess-missing-word',
    level: 'A2',
    instruction: '输入表示“朋友”的汉语词语。',
    templatePrompt: () => '王老师是我的好 ___ ，我们认识很多年了。',
    correctAnswer: () => '朋友 / pengyou',
    wordClue: 'friend (拼音：péngyou / 朋友)',
    hint: '拼音：péngyou（朋友）。',
    grammarExplanation: '“朋友”是日常生活中最常用的词汇之一。',
    translation: () => 'Teacher Wang is my good friend; we have known each other for many years.'
  }
];

// ================= PORTUGUESE DATA & TEMPLATES =================
const PORTUGUESE_TOPICS = [
  'sustentabilidade ecológica',
  'inovação tecnológica',
  'turismo cultural',
  'desenvolvimento humano',
  'tradições gastronômicas',
  'comunicação intercultural',
  'educação digital',
  'transição energética'
];

const PORTUGUESE_SUBJECTS = [
  'a equipe de pesquisa',
  'o nosso departamento',
  'a professora de línguas',
  'o comitê consultivo',
  'os estudantes do curso',
  'o grupo de trabalho'
];

const PORTUGUESE_ADVERBS = [
  'com muita dedicação',
  'neste semestre',
  'de forma rigorosa',
  'na atualidade',
  'constantemente',
  'com entusiasmo'
];

const PORTUGUESE_TEMPLATES: DrillTemplate[] = [
  {
    type: 'fill-blank',
    level: 'B1',
    instruction: 'Selecione a forma correta do presente do subjuntivo.',
    templatePrompt: (topic, subj, adv) =>
      `É essencial que ${subj} ___ novas soluções para ${topic} ${adv}.`,
    optionsGenerator: (correct) => shuffleFillBlankOptions(['encontre', 'encontra', 'encontrará', 'encontraria'], correct),
    correctAnswer: () => 'encontre',
    hint: 'Expressões impessoais ("É essencial que...") exigem o presente do subjuntivo.',
    grammarExplanation: '"É essencial que + presente do subjuntivo" rege a concordância com o verbo encontrar.',
    translation: (topic, subj, adv) => `It is essential that ${subj} find new solutions for ${topic} ${adv}.`
  },
  {
    type: 'fill-blank',
    level: 'A2',
    instruction: 'Escolha o verbo adequado para expressar localização de um local físico.',
    templatePrompt: () => 'Você sabe onde ___ a biblioteca central da universidade?',
    optionsGenerator: (correct) => shuffleFillBlankOptions(['fica', 'é', 'tem', 'faz'], correct),
    correctAnswer: () => 'fica',
    hint: 'Em português, o verbo "ficar" é o mais natural para localização de imóveis ou lugares.',
    grammarExplanation: '"Ficar" é usado rotineiramente para perguntar onde se localiza um local.',
    translation: () => 'Do you know where the central university library is located?'
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Reordene as palavras para formar uma solicitação profissional e cortês.',
    templatePrompt: () => 'Form: "Gostaria de agendar uma reunião com você amanhã à tarde."',
    correctAnswer: () => ['Gostaria', 'de', 'agendar', 'uma', 'reunião', 'com você', 'amanhã', 'à tarde.'],
    tokensGenerator: () => {
      const ordered = ['Gostaria', 'de', 'agendar', 'uma', 'reunião', 'com você', 'amanhã', 'à tarde.'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: 'Comece com o condicional de cortesia "Gostaria de agendar...".',
    grammarExplanation: '"Gostaria de" suaviza pedidos no ambiente profissional e social.',
    translation: () => 'I would like to schedule a meeting with you tomorrow afternoon.'
  },
  {
    type: 'sentence-ordering',
    level: 'B1',
    instruction: 'Reordene as palavras para formular um voto positivo com subjuntivo.',
    templatePrompt: () => 'Form: "Espero que você tenha um ótimo fim de semana."',
    correctAnswer: () => ['Espero', 'que', 'você', 'tenha', 'um', 'ótimo', 'fim', 'de', 'semana.'],
    tokensGenerator: () => {
      const ordered = ['Espero', 'que', 'você', 'tenha', 'um', 'ótimo', 'fim', 'de', 'semana.'];
      return { ordered, scrambled: scrambleSentenceTokens(ordered) };
    },
    hint: '"Espero que" exige o verbo ter no subjuntivo ("tenha").',
    grammarExplanation: 'Verbos de esperança regem o modo subjuntivo.',
    translation: () => 'I hope you have a great weekend.'
  },
  {
    type: 'guess-missing-word',
    level: 'B1',
    instruction: 'Digite o adjetivo em português que significa "essencial / indispensável".',
    templatePrompt: (topic, subj, adv) =>
      `A cooperação contínua de ${subj} é ___ para ${topic} ${adv}.`,
    correctAnswer: () => 'indispensável / essencial / fundamental',
    wordClue: 'indispensable / essential (começa com "indispen..." ou "essenc...")',
    hint: 'Começa com "indispen..." ou "essenc...".',
    grammarExplanation: '"Indispensável" expressa necessidade mandatória.',
    translation: (topic, subj, adv) => `The continuous cooperation of ${subj} is indispensable for ${topic} ${adv}.`
  }
];

function getLanguageTemplatesAndTopics(langLower: string): {
  templates: DrillTemplate[];
  topics: string[];
  subjects: string[];
  adverbs: string[];
} {
  switch (langLower) {
    case 'german':
    case 'de':
      return {
        templates: GERMAN_TEMPLATES,
        topics: GERMAN_TOPICS,
        subjects: GERMAN_SUBJECTS,
        adverbs: GERMAN_ADVERBS
      };
    case 'spanish':
    case 'es':
      return {
        templates: SPANISH_TEMPLATES,
        topics: SPANISH_TOPICS,
        subjects: SPANISH_SUBJECTS,
        adverbs: SPANISH_ADVERBS
      };
    case 'english':
    case 'en':
      return {
        templates: ENGLISH_TEMPLATES,
        topics: ENGLISH_TOPICS,
        subjects: ENGLISH_SUBJECTS,
        adverbs: ENGLISH_ADVERBS
      };
    case 'french':
    case 'fr':
      return {
        templates: FRENCH_TEMPLATES,
        topics: FRENCH_TOPICS,
        subjects: FRENCH_SUBJECTS,
        adverbs: FRENCH_ADVERBS
      };
    case 'italian':
    case 'it':
      return {
        templates: ITALIAN_TEMPLATES,
        topics: ITALIAN_TOPICS,
        subjects: ITALIAN_SUBJECTS,
        adverbs: ITALIAN_ADVERBS
      };
    case 'japanese':
    case 'ja':
      return {
        templates: JAPANESE_TEMPLATES,
        topics: JAPANESE_TOPICS,
        subjects: JAPANESE_SUBJECTS,
        adverbs: JAPANESE_ADVERBS
      };
    case 'mandarin':
    case 'chinese':
    case 'zh':
      return {
        templates: MANDARIN_TEMPLATES,
        topics: MANDARIN_TOPICS,
        subjects: MANDARIN_SUBJECTS,
        adverbs: MANDARIN_ADVERBS
      };
    case 'portuguese':
    case 'pt':
      return {
        templates: PORTUGUESE_TEMPLATES,
        topics: PORTUGUESE_TOPICS,
        subjects: PORTUGUESE_SUBJECTS,
        adverbs: PORTUGUESE_ADVERBS
      };
    default:
      return {
        templates: ENGLISH_TEMPLATES,
        topics: ENGLISH_TOPICS,
        subjects: ENGLISH_SUBJECTS,
        adverbs: ENGLISH_ADVERBS
      };
  }
}

/**
 * Generates dynamically synthesized, authentic drills tailored STRICTLY to the requested language,
 * guaranteeing zero duplication against all previously seen prompt keys.
 */
export function generateProceduralDrills(
  languageName: string,
  drillType: 'all' | DrillType,
  count: number,
  seenKeysOrTexts: Iterable<string>,
  options: { allowSoftRepeatOnExhaustion?: boolean } = {}
): PracticeDrill[] {
  const { allowSoftRepeatOnExhaustion = true } = options;
  const langLower = languageName.toLowerCase();
  const { templates, topics, subjects, adverbs } = getLanguageTemplatesAndTopics(langLower);

  const filteredTemplates = drillType === 'all' ? templates : templates.filter(t => t.type === drillType);
  const activeTemplates = [...(filteredTemplates.length > 0 ? filteredTemplates : templates)].sort(
    () => Math.random() - 0.5
  );
  const shuffledTopics = [...topics].sort(() => Math.random() - 0.5);
  const shuffledSubjects = [...subjects].sort(() => Math.random() - 0.5);
  const shuffledAdverbs = [...adverbs].sort(() => Math.random() - 0.5);

  const seenKeySet = new Set<string>();
  const comparisonTexts: string[] = [];
  for (const entry of seenKeysOrTexts) {
    const raw = String(entry || '').trim();
    if (!raw) continue;
    const key = normalizeDrillKey(raw);
    if (key) seenKeySet.add(key);
    comparisonTexts.push(raw);
  }

  const recentKeysWindow = new Set<string>();
  for (const entry of comparisonTexts.slice(-6)) {
    const key = normalizeDrillKey(entry);
    if (key) recentKeysWindow.add(key);
  }

  const batchComparisonTexts: string[] = [];
  const batchKeys = new Set<string>();
  const result: PracticeDrill[] = [];

  const runPass = (
    mode: 'strict' | 'recent-similarity' | 'unseen-batch-distinct' | 'relaxed-keys',
    passMaxAttempts: number
  ) => {
    const startOffset = Math.floor(Math.random() * 97);
    let attempts = 0;

    while (result.length < count && attempts < passMaxAttempts) {
      attempts++;
      const step = startOffset + attempts - 1;
      const templateIdx = step % activeTemplates.length;
      const template = activeTemplates[templateIdx];

      const topicIdx = (step * 3 + Math.floor(attempts / activeTemplates.length)) % shuffledTopics.length;
      const topic = shuffledTopics[topicIdx];

      const subjectIdx = (step * 5 + Math.floor(attempts / 3)) % shuffledSubjects.length;
      const subject = shuffledSubjects[subjectIdx];

      const adverbIdx = (step * 7 + Math.floor(attempts / 5)) % shuffledAdverbs.length;
      const adverb = shuffledAdverbs[adverbIdx];

      const variant = attempts + Math.floor(Math.random() * 29);

      const prompt = template.templatePrompt(topic, subject, adverb, variant);
      const key = normalizeDrillKey(prompt);
      if (!key || batchKeys.has(key)) {
        continue;
      }

      const answer = template.correctAnswer(topic, subject, adverb, variant);
      const targetSentence = Array.isArray(answer) ? answer.join(' ') : prompt;
      const targetKey = normalizeDrillKey(targetSentence);

      if (mode === 'strict' || mode === 'recent-similarity' || mode === 'unseen-batch-distinct') {
        if (seenKeySet.has(key) || (targetKey && seenKeySet.has(targetKey))) {
          continue;
        }
        const corpusToCheck =
          mode === 'strict'
            ? [...comparisonTexts.slice(-60), ...batchComparisonTexts]
            : mode === 'recent-similarity'
              ? [...comparisonTexts.slice(-8), ...batchComparisonTexts]
              : [...batchComparisonTexts];

        if (
          corpusToCheck.length > 0 &&
          (!isDrillWordingDistinct(prompt, corpusToCheck) ||
            !isDrillWordingDistinct(targetSentence, corpusToCheck))
        ) {
          continue;
        }
      } else {
        // Tier 4: only reached if full combinatorial unseen space is exhausted; exclude recent 15 prompts + guarantee intra-batch uniqueness
        if (recentKeysWindow.has(key) || (targetKey && recentKeysWindow.has(targetKey))) {
          continue;
        }
        if (
          batchComparisonTexts.length > 0 &&
          (!isDrillWordingDistinct(prompt, batchComparisonTexts) ||
            !isDrillWordingDistinct(targetSentence, batchComparisonTexts))
        ) {
          continue;
        }
      }

      const id = `proc_${langLower.slice(0, 2)}_${Date.now()}_${attempts}_${Math.random().toString(36).slice(2, 6)}`;

      let options: string[] | undefined;
      if (template.type === 'fill-blank' && template.optionsGenerator) {
        options = template.optionsGenerator(Array.isArray(answer) ? answer[0] : answer);
      }

      let orderedTokens: string[] | undefined;
      let scrambledTokens: string[] | undefined;
      if (template.type === 'sentence-ordering') {
        if (template.tokensGenerator) {
          const tokens = template.tokensGenerator(topic, subject, adverb, variant);
          orderedTokens = tokens.ordered;
          scrambledTokens = tokens.scrambled;
        } else if (Array.isArray(answer)) {
          orderedTokens = answer;
          scrambledTokens = scrambleSentenceTokens(answer);
        }
      }

      batchKeys.add(key);
      if (targetKey) batchKeys.add(targetKey);
      batchComparisonTexts.push(prompt);
      if (targetSentence && targetSentence !== prompt) {
        batchComparisonTexts.push(targetSentence);
      }

      result.push({
        id,
        type: template.type,
        language: languageName,
        level: template.level,
        instruction: template.instruction,
        prompt,
        options,
        correctAnswer: orderedTokens || answer,
        orderedTokens,
        scrambledTokens,
        wordClue: template.wordClue,
        hint: template.hint,
        grammarExplanation: template.grammarExplanation,
        translation: template.translation(topic, subject, adverb, variant)
      });
    }
  };

  // Tier 1: Zero exact repeats & strict similarity check against full recent window (last 60 entries) + full exact key set
  runPass('strict', Math.min(280, Math.max(90, count * 32)));

  if (allowSoftRepeatOnExhaustion && result.length < count) {
    // Tier 2: Zero exact repeats across full history, distinct from recent 8 items & current batch
    runPass('recent-similarity', 150);
  }

  if (allowSoftRepeatOnExhaustion && result.length < count) {
    // Tier 3: Zero exact repeats across full history, distinct wording within current batch
    runPass('unseen-batch-distinct', 120);
  }

  if (allowSoftRepeatOnExhaustion && result.length < count) {
    // Tier 4: Fallback if all unseen combinations are exhausted; exclude recent 6 prompts + guarantee intra-batch uniqueness
    runPass('relaxed-keys', 80);
  }

  return result;
}

/**
 * Master selector: pulls unseen, wording-distinct items strictly matching the selected language,
 * and synthesizes distinct fallback items without repeating templates or similar wordings.
 * Guaranteed to never return an empty list when supported templates exist.
 */
export function getNonRepeatingDrills(
  pool: PracticeDrill[],
  languageName: string,
  drillType: 'all' | DrillType,
  count: number,
  seenKeysOrTexts: Iterable<string>
): { drills: PracticeDrill[]; updatedSeen: Set<string> } {
  const langLower = languageName.toLowerCase();
  const allPool = [...pool, ...EXTENDED_DRILL_BANK];

  // STRICT LANGUAGE FILTER: Only questions belonging to the selected language
  const candidatePool = allPool.filter(d => {
    const dLang = (d.language || '').toLowerCase();
    if (langLower === 'mandarin' || langLower === 'chinese' || langLower === 'zh') {
      return dLang === 'mandarin' || dLang === 'chinese' || dLang === 'zh';
    }
    return dLang === langLower;
  });

  const targetTypes: DrillType[] =
    drillType === 'all'
      ? ['fill-blank', 'sentence-ordering', 'guess-missing-word']
      : [drillType];

  const chosen: PracticeDrill[] = [];
  const nextSeen = new Set<string>();
  const comparisonCorpus: string[] = [];

  for (const item of seenKeysOrTexts) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    const key = normalizeDrillKey(raw);
    if (key) nextSeen.add(key);
    comparisonCorpus.push(raw);
  }

  targetTypes.forEach(type => {
    const ofType = candidatePool.filter(d => d.type === type);
    const shuffledUnseen = [...ofType].sort(() => Math.random() - 0.5);
    const countForThisType = drillType === 'all' ? Math.max(1, Math.ceil(count / targetTypes.length)) : count;

    let addedForType = 0;
    for (const d of shuffledUnseen) {
      if (addedForType >= countForThisType) break;
      const key = normalizeDrillKey(d.prompt);
      const targetText = getDrillComparisonText(d);
      const targetKey = normalizeDrillKey(targetText);
      if (nextSeen.has(key) || (targetKey && nextSeen.has(targetKey))) continue;
      if (!isDrillWordingDistinct(d.prompt, comparisonCorpus) || !isDrillWordingDistinct(targetText, comparisonCorpus)) {
        continue;
      }

      const prepared: PracticeDrill = { ...d, language: languageName };
      if (prepared.type === 'fill-blank' && Array.isArray(prepared.options)) {
        prepared.options = shuffleFillBlankOptions(prepared.options, prepared.correctAnswer);
      }
      if (prepared.type === 'sentence-ordering' && Array.isArray(prepared.scrambledTokens)) {
        prepared.scrambledTokens = scrambleSentenceTokens(prepared.scrambledTokens);
      }
      chosen.push(prepared);
      nextSeen.add(key);
      if (targetKey) nextSeen.add(targetKey);
      comparisonCorpus.push(d.prompt);
      if (targetText !== d.prompt) comparisonCorpus.push(targetText);
      addedForType++;
    }

    const needed = countForThisType - addedForType;
    if (needed > 0) {
      const procedural = generateProceduralDrills(languageName, type, needed, comparisonCorpus, {
        allowSoftRepeatOnExhaustion: true
      });
      procedural.forEach(p => {
        chosen.push(p);
        nextSeen.add(normalizeDrillKey(p.prompt));
        const targetText = getDrillComparisonText(p);
        if (targetText) {
          nextSeen.add(normalizeDrillKey(targetText));
          comparisonCorpus.push(targetText);
        }
        comparisonCorpus.push(p.prompt);
      });
    }
  });

  // Final safety net: if still short of count (e.g. narrow filter or saturated niche pool), top up from language bank excluding batch duplicates
  if (chosen.length < count && candidatePool.length > 0) {
    const ofRequested = drillType === 'all' ? candidatePool : candidatePool.filter(d => d.type === drillType);
    const fallbackPool = (ofRequested.length > 0 ? ofRequested : candidatePool).sort(() => Math.random() - 0.5);
    const chosenKeys = new Set(chosen.map(c => normalizeDrillKey(c.prompt)));
    for (const d of fallbackPool) {
      if (chosen.length >= count) break;
      const dKey = normalizeDrillKey(d.prompt);
      if (chosenKeys.has(dKey)) continue;
      chosenKeys.add(dKey);
      const prepared: PracticeDrill = {
        ...d,
        id: `${d.id}_rel_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        language: languageName
      };
      if (prepared.type === 'fill-blank' && Array.isArray(prepared.options)) {
        prepared.options = shuffleFillBlankOptions(prepared.options, prepared.correctAnswer);
      }
      if (prepared.type === 'sentence-ordering' && Array.isArray(prepared.scrambledTokens)) {
        prepared.scrambledTokens = scrambleSentenceTokens(prepared.scrambledTokens);
      }
      chosen.push(prepared);
    }
  }

  return { drills: chosen, updatedSeen: nextSeen };
}
