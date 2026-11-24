import { PracticeDrill, PronunciationTarget } from '../types';
import { shuffleFillBlankOptions } from '../services/drillEvaluation';

export const INITIAL_PRACTICE_DRILLS: PracticeDrill[] = [
  // --- GERMAN DRILLS ---
  {
    id: 'drill_de_1',
    type: 'fill-blank',
    language: 'German',
    level: 'A2',
    instruction: 'Select the correct dative article for expressing condition.',
    prompt: 'Wie geht es ___? Mir geht es sehr gut, danke!',
    options: ['dich', 'dir', 'du', 'dein'],
    correctAnswer: 'dir',
    hint: 'The idiom "Wie geht es..." requires the dative case pronoun.',
    grammarExplanation: '"Wie geht es dir?" uses the 2nd person dative pronoun "dir". "Dich" is accusative and "du" is nominative.',
    translation: 'How are you doing? I am doing very well, thank you!'
  },
  {
    id: 'drill_de_2',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B1',
    instruction: 'Arrange the words in correct subordinate clause word-order (Verb at the end).',
    prompt: 'Form the sentence: "I am learning German because I have time today."',
    scrambledTokens: ['Ich', 'lerne', 'Deutsch,', 'weil', 'ich', 'heute', 'Zeit', 'habe.'],
    correctAnswer: ['Ich', 'lerne', 'Deutsch,', 'weil', 'ich', 'heute', 'Zeit', 'habe.'],
    hint: 'The conjunction "weil" kicks the conjugated verb "habe" to the very end.',
    grammarExplanation: 'Subordinating conjunctions like "weil", "obwohl", and "dass" trigger Verb-Letzt-Stellung (verb in final position).',
    translation: 'I am learning German because I have time today.'
  },
  {
    id: 'drill_de_3',
    type: 'fill-blank',
    language: 'German',
    level: 'B1',
    instruction: 'Choose the correct preposition and case combination for expressing fear.',
    prompt: 'Das kleine Kind hat große Angst ___ dem Hund.',
    options: ['für', 'an', 'vor', 'über'],
    correctAnswer: 'vor',
    hint: 'In German, fear is expressed with "Angst haben vor + Dativ".',
    grammarExplanation: 'The standard fixed construction is "Angst vor + Dativ" (vor dem Hund), not "für".',
    translation: 'The small child is very afraid of the dog.'
  },
  {
    id: 'drill_de_4',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B2',
    instruction: 'Reconstruct the polite indirect question word order.',
    prompt: 'Form: "Könnten Sie mir bitte sagen, wo der Bahnhof ist?"',
    scrambledTokens: ['Könnten', 'Sie', 'mir', 'bitte', 'sagen,', 'wo', 'der', 'Bahnhof', 'ist?'],
    correctAnswer: ['Könnten', 'Sie', 'mir', 'bitte', 'sagen,', 'wo', 'der', 'Bahnhof', 'ist?'],
    hint: 'The modal verb "Könnten" begins the main clause, and "wo" introduces a subordinate clause ending with "ist".',
    grammarExplanation: 'Indirect questions introduced by "wo" require the conjugated verb ("ist") at the clause conclusion.',
    translation: 'Could you please tell me where the train station is?'
  },

  // --- GERMAN GUESS-MISSING-WORD DRILLS ---
  {
    id: 'drill_de_5',
    type: 'guess-missing-word',
    language: 'German',
    level: 'A2',
    instruction: 'Guess and type the missing German noun from the clue and context.',
    prompt: 'Entschuldigung, wie komme ich am schnellsten zum ___?',
    correctAnswer: 'Bahnhof',
    wordClue: 'train station (masculine noun)',
    hint: 'Compound word combining "Bahn" (rail) + "Hof" (yard/station). Capitalize German nouns!',
    grammarExplanation: '"zum" is the contraction of "zu + dem" (Dative masculine), followed by "Bahnhof" (train station).',
    translation: 'Excuse me, what is the fastest way to get to the train station?'
  },
  {
    id: 'drill_de_6',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B2',
    instruction: 'Type the missing C1 German adjective meaning "excellent / outstanding".',
    prompt: 'Deine Präsentation heute Morgen war wirklich ___!',
    correctAnswer: 'hervorragend / ausgezeichnet',
    wordClue: 'outstanding / excellent (replaces "sehr gut")',
    hint: 'Starts with "hervor..." (literally jutting out above the rest) or "ausge...".',
    grammarExplanation: 'Predicate adjectives after "sein" ("war") remain uninflected: "war hervorragend".',
    translation: 'Your presentation this morning was truly outstanding!'
  },

  // --- SPANISH DRILLS ---
  {
    id: 'drill_es_1',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'A2',
    instruction: 'Choose between "ser" and "estar" to express feeling bored right now.',
    prompt: 'Hoy no tengo nada que hacer, ___ muy aburrido.',
    options: ['soy', 'tengo', 'hago', 'estoy'],
    correctAnswer: 'estoy',
    hint: 'Temporary states or feelings use "estar", while "ser" defines permanent character.',
    grammarExplanation: '"Estoy aburrido" means "I feel bored". Saying "Soy aburrido" would mean "I am a boring person"!',
    translation: 'Today I have nothing to do, I am very bored.'
  },
  {
    id: 'drill_es_2',
    type: 'sentence-ordering',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Rearrange the words to make a proper sentence with subjunctive mood.',
    prompt: 'Form: "I hope that you have a good trip to Spain."',
    scrambledTokens: ['viaje', 'Espero', 'España.', 'tengas', 'que', 'buen', 'un', 'a'],
    correctAnswer: ['Espero', 'que', 'tengas', 'un', 'buen', 'viaje', 'a', 'España.'],
    hint: 'Start with "Espero que", followed by the subjunctive form of tener ("tengas").',
    grammarExplanation: 'Verbs of wishing and hoping (esperar que) require the present subjunctive in the subordinate clause.',
    translation: 'I hope that you have a good trip to Spain.'
  },
  {
    id: 'drill_es_3',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Choose "por" vs "para" to express purpose or goal.',
    prompt: 'Compré este libro de gramática ___ mejorar mi fluidez.',
    options: ['por', 'para', 'con', 'de'],
    correctAnswer: 'para',
    hint: '"Para" indicates purpose ("in order to"), whereas "por" indicates cause or motive.',
    grammarExplanation: '"Para + infinitive" indicates the intended goal or purpose ("in order to improve").',
    translation: 'I bought this grammar book in order to improve my fluency.'
  },
  {
    id: 'drill_es_4',
    type: 'guess-missing-word',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Guess the missing Spanish subjunctive verb from context.',
    prompt: 'Ojalá que mañana ___ buen tiempo para nuestra excursión.',
    correctAnswer: 'haga',
    wordClue: 'present subjunctive of "hacer" (weather expression)',
    hint: '"Hacer buen tiempo" in 3rd-person singular present subjunctive starts with "ha...".',
    grammarExplanation: '"Ojalá que" always triggers the subjunctive mood; "hacer" becomes "haga".',
    translation: 'Hopefully the weather will be nice tomorrow for our excursion.'
  },

  // --- ENGLISH DRILLS ---
  {
    id: 'drill_en_1',
    type: 'fill-blank',
    language: 'English',
    level: 'B1',
    instruction: 'Choose between "for" and "since" for continuous duration.',
    prompt: 'Sarah has lived in London ___ five years now.',
    options: ['for', 'since', 'during', 'from'],
    correctAnswer: 'for',
    hint: 'Use "for" with a duration/period of time, and "since" with a specific starting point in the past.',
    grammarExplanation: '"For five years" measures duration. "Since" is reserved for points in time (e.g. "since 2019").',
    translation: 'Sarah has lived in London for five years now.'
  },
  {
    id: 'drill_en_2',
    type: 'sentence-ordering',
    language: 'English',
    level: 'B2',
    instruction: 'Rearrange the words to form a natural English sentence.',
    prompt: 'Form: "I am really looking forward to seeing you again soon."',
    scrambledTokens: ['seeing', 'forward', 'I', 'soon.', 'looking', 'am', 'to', 'really', 'you', 'again'],
    correctAnswer: ['I', 'am', 'really', 'looking', 'forward', 'to', 'seeing', 'you', 'again', 'soon.'],
    hint: '"Look forward to" is followed by a gerund (-ing verb).',
    grammarExplanation: 'In the idiom "look forward to", "to" is a preposition, not an infinitive marker, so it requires the -ing form ("seeing").',
    translation: 'I am really looking forward to seeing you again soon.'
  },
  {
    id: 'drill_en_3',
    type: 'guess-missing-word',
    language: 'English',
    level: 'B2',
    instruction: 'Guess the missing word meaning "found or appearing everywhere".',
    prompt: 'Smartphones have become ___ in modern urban life.',
    correctAnswer: 'ubiquitous / omnipresent',
    wordClue: 'present, appearing, or found everywhere',
    hint: 'Starts with "u" (10 letters: u-b-i-q-...).',
    grammarExplanation: '"Ubiquitous" is a high-frequency B2/C1 adjective describing something seen everywhere at once.',
    translation: 'Smartphones have become ubiquitous in modern urban life.'
  },
  {
    id: 'drill_en_4',
    type: 'fill-blank',
    language: 'English',
    level: 'C1',
    instruction: 'Select the high-register adjective to replace "very important".',
    prompt: 'Clear communication during negotiations is of ___ importance.',
    options: ['paramount', 'huge', 'colossal', 'plenty'],
    correctAnswer: 'paramount',
    hint: 'A C1 formal collocation meaning supremely important.',
    grammarExplanation: '"Of paramount importance" is the idiomatic C1/C2 collocation in business and diplomatic English.',
    translation: 'Clear communication during negotiations is of paramount importance.'
  },
  {
    id: 'drill_en_5',
    type: 'guess-missing-word',
    language: 'English',
    level: 'B1',
    instruction: 'Guess the missing preposition that pairs naturally with "depend".',
    prompt: 'Whether we host the picnic outdoors will depend ___ the weather forecast.',
    correctAnswer: 'on / upon',
    wordClue: 'two-letter preposition used after "depend" or "rely"',
    hint: 'In English we never say "depend of" — we say "depend ___".',
    grammarExplanation: 'Verbs of reliance ("depend", "rely", "count") always take the preposition "on" (or formal "upon").',
    translation: 'Whether we host the picnic outdoors will depend on the weather forecast.'
  },

  // --- FRENCH DRILLS ---
  {
    id: 'drill_fr_1',
    type: 'fill-blank',
    language: 'French',
    level: 'A2',
    instruction: 'Choose the correct auxiliary verb for Passé Composé of movement.',
    prompt: 'Hier soir, nous ___ allés au musée du Louvre.',
    options: ['sommes', 'avons', 'étions', 'faisons'],
    correctAnswer: 'sommes',
    hint: 'Verbs of movement like "aller" use the auxiliary "être" in Passé Composé.',
    grammarExplanation: '"Aller" conjugates with "être": "Nous sommes allés", and the past participle agrees with the plural subject.',
    translation: 'Yesterday evening, we went to the Louvre Museum.'
  },
  {
    id: 'drill_fr_2',
    type: 'sentence-ordering',
    language: 'French',
    level: 'B1',
    instruction: 'Rearrange the words to make a proper French sentence.',
    prompt: 'Form: "You must pay attention in the metro."',
    scrambledTokens: ['attention', 'Il', 'métro.', 'faut', 'tu', 'le', 'que', 'fasses', 'dans'],
    correctAnswer: ['Il', 'faut', 'que', 'tu', 'fasses', 'attention', 'dans', 'le', 'métro.'],
    hint: '"Il faut que" is followed by the subjunctive form of faire ("fasses").',
    grammarExplanation: 'Impersonal obligation expressions like "Il faut que..." require the subjunctive mood.',
    translation: 'You must pay attention in the metro.'
  },
  {
    id: 'drill_fr_3',
    type: 'guess-missing-word',
    language: 'French',
    level: 'B1',
    instruction: 'Guess the missing French adverb meaning "unfortunately".',
    prompt: '___, le train de huit heures a été annulé.',
    correctAnswer: 'Malheureusement',
    wordClue: 'unfortunately (adverb formed from "malheureux")',
    hint: 'Starts with "Malheur..." and ends with "-ment".',
    grammarExplanation: 'French manner adverbs are typically formed from the feminine adjective ("malheureuse") + "-ment".',
    translation: 'Unfortunately, the eight o’clock train was cancelled.'
  },
  {
    id: 'drill_fr_4',
    type: 'fill-blank',
    language: 'French',
    level: 'B2',
    instruction: 'Choose the correct pronoun replacement for a place with "aller".',
    prompt: 'Vas-tu souvent à la bibliothèque? Oui, j’___ vais chaque semaine.',
    options: ['y', 'en', 'lui', 'le'],
    correctAnswer: 'y',
    hint: 'Use the adverbial pronoun "y" to replace prepositional phrases introduced by "à + lieu".',
    grammarExplanation: '"Y" replaces locations introduced by "à", "dans", "chez", or "sur": "j\'y vais".',
    translation: 'Do you go often to the library? Yes, I go there every week.'
  },
  {
    id: 'drill_fr_5',
    type: 'sentence-ordering',
    language: 'French',
    level: 'B2',
    instruction: 'Arrange the words to form a polite hypothesis.',
    prompt: 'Form: "If I had more time, I would travel around the world."',
    scrambledTokens: ['voyagerais', 'plus', 'monde.', 'Si', 'temps,', 'j’avais', 'de', 'je', 'autour', 'du'],
    correctAnswer: ['Si', 'j’avais', 'plus', 'de', 'temps,', 'je', 'voyagerais', 'autour', 'du', 'monde.'],
    hint: '"Si" + imparfait ("avais") followed by conditionnel présent ("voyagerais").',
    grammarExplanation: 'Hypothetical contrary-to-fact sentences use Si + Imparfait -> Conditionnel Présent.',
    translation: 'If I had more time, I would travel around the world.'
  },
  {
    id: 'drill_fr_6',
    type: 'guess-missing-word',
    language: 'French',
    level: 'B2',
    instruction: 'Guess the missing French noun meaning "opportunity / chance".',
    prompt: 'Ce stage à l’étranger est une véritable ___ pour ta carrière.',
    correctAnswer: 'opportunité / occasion',
    wordClue: 'opportunity or lucky chance (feminine noun)',
    hint: 'Starts with "oppor..." or "occa...".',
    grammarExplanation: '"Une véritable opportunité" describes a breakthrough career opening.',
    translation: 'This internship abroad is a real opportunity for your career.'
  },

  // --- ADDITIONAL GERMAN DRILLS ---
  {
    id: 'drill_de_7',
    type: 'fill-blank',
    language: 'German',
    level: 'B1',
    instruction: 'Choose the correct two-part connector to express contrast.',
    prompt: 'Er spricht ___ Deutsch, sondern auch fließend Spanisch.',
    options: ['weder', 'sowohl', 'nicht nur', 'entweder'],
    correctAnswer: 'nicht nur',
    hint: 'The fixed pair is "nicht nur ..., sondern auch ...".',
    grammarExplanation: '"nicht nur ... sondern auch" (not only ... but also) expresses two complementary positive qualities.',
    translation: 'He speaks not only German, but also fluent Spanish.'
  },
  {
    id: 'drill_de_8',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B2',
    instruction: 'Arrange the words with concession connector "obwohl".',
    prompt: 'Form: "Although it was raining heavily, we went for a long walk."',
    scrambledTokens: ['stark', 'wir', 'Obwohl', 'regnete,', 'spazieren.', 'gingen', 'es', 'lange'],
    correctAnswer: ['Obwohl', 'es', 'stark', 'regnete,', 'gingen', 'wir', 'lange', 'spazieren.'],
    hint: '"Obwohl" ends its subclause with "regnete,", then main clause starts with verb "gingen".',
    grammarExplanation: 'Subclause with "obwohl" puts the verb at the end, and the following main clause begins with the finite verb.',
    translation: 'Although it was raining heavily, we went for a long walk.'
  },
  {
    id: 'drill_de_9',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B1',
    instruction: 'Type the missing German noun for "challenge".',
    prompt: 'Dieses neue Software-Projekt ist eine spannende ___.',
    correctAnswer: 'Herausforderung',
    wordClue: 'challenge / demanding task (feminine noun)',
    hint: 'Compound noun: "Heraus" + "forderung" (capitalize nouns!).',
    grammarExplanation: '"Die Herausforderung" is the standard German word for a stimulating challenge.',
    translation: 'This new software project is an exciting challenge.'
  },
  {
    id: 'drill_de_10',
    type: 'fill-blank',
    language: 'German',
    level: 'A2',
    instruction: 'Select the correct modal verb for expressing ability/permission.',
    prompt: 'Entschuldigung, ___ ich mich hier kurz hinsetzen?',
    options: ['muss', 'soll', 'will', 'darf'],
    correctAnswer: 'darf',
    hint: 'Polite request asking for permission uses "dürfen" ("darf ich...").',
    grammarExplanation: '"Darf ich..." politely asks for permission to sit down.',
    translation: 'Excuse me, may I sit down here for a moment?'
  },
  {
    id: 'drill_de_11',
    type: 'sentence-ordering',
    language: 'German',
    level: 'B1',
    instruction: 'Arrange the words with temporal prepositional phrase.',
    prompt: 'Form: "After dinner we always drink an espresso together."',
    scrambledTokens: ['Abendessen', 'trinken', 'Nach', 'dem', 'zusammen.', 'wir', 'immer', 'einen', 'Espresso'],
    correctAnswer: ['Nach', 'dem', 'Abendessen', 'trinken', 'wir', 'immer', 'einen', 'Espresso', 'zusammen.'],
    hint: '"Nach dem Abendessen" is position 1, verb "trinken" must be position 2.',
    grammarExplanation: 'Inversion occurs when an adverbial/prepositional element begins the sentence.',
    translation: 'After dinner we always drink an espresso together.'
  },
  {
    id: 'drill_de_12',
    type: 'guess-missing-word',
    language: 'German',
    level: 'B2',
    instruction: 'Type the missing German noun for "experience / practical knowledge".',
    prompt: 'Für diese Position braucht man mindestens drei Jahre berufliche ___.',
    correctAnswer: 'Erfahrung',
    wordClue: 'experience / practical expertise (feminine noun)',
    hint: 'Starts with "Erfah..." (capitalize German nouns!).',
    grammarExplanation: '"Die Erfahrung" denotes accumulated skill and life/work experience.',
    translation: 'For this position, one needs at least three years of professional experience.'
  },

  // --- ADDITIONAL SPANISH DRILLS ---
  {
    id: 'drill_es_5',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'B2',
    instruction: 'Select the correct subjunctive conjunction of condition.',
    prompt: 'Te prestaré mis apuntes ___ que me los devuelvas mañana.',
    options: ['porque', 'con tal de', 'ya', 'a pesar de'],
    correctAnswer: 'con tal de',
    hint: '"Con tal de que" means "provided that" and mandates the subjunctive.',
    grammarExplanation: '"Con tal de que + subjuntivo" establishes an explicit condition.',
    translation: 'I will lend you my notes provided that you return them to me tomorrow.'
  },
  {
    id: 'drill_es_6',
    type: 'sentence-ordering',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Rearrange words in the Spanish imperfect continuous tense.',
    prompt: 'Form: "We were having dinner when the electricity went out."',
    scrambledTokens: ['se', 'estábamos', 'cenando', 'cuando', 'Nosotros', 'fue', 'la', 'luz.'],
    correctAnswer: ['Nosotros', 'estábamos', 'cenando', 'cuando', 'se', 'fue', 'la', 'luz.'],
    hint: 'Start with "Nosotros estábamos cenando", followed by the interruption with "cuando".',
    grammarExplanation: 'Ongoing background action in past continuous interrupted by preterite ("se fue").',
    translation: 'We were having dinner when the electricity went out.'
  },
  {
    id: 'drill_es_7',
    type: 'guess-missing-word',
    language: 'Spanish',
    level: 'B2',
    instruction: 'Guess the missing Spanish adjective for "essential / indispensable".',
    prompt: 'El agua potable es un recurso ___ para la supervivencia humana.',
    correctAnswer: 'imprescindible / indispensable',
    wordClue: 'essential, vital, cannot do without',
    hint: 'Starts with "imprescin..." or "indispen...".',
    grammarExplanation: '"Imprescindible" describes something fundamentally required.',
    translation: 'Drinking water is an essential resource for human survival.'
  },
  {
    id: 'drill_es_8',
    type: 'fill-blank',
    language: 'Spanish',
    level: 'A2',
    instruction: 'Select the correct indirect object pronoun.',
    prompt: 'A María ___ gusta mucho la música clásica española.',
    options: ['le', 'la', 'se', 'me'],
    correctAnswer: 'le',
    hint: 'Verbs like "gustar" take an indirect object pronoun ("a María le gusta").',
    grammarExplanation: '"Gustar" agrees with the subject ("la música"), while the experiencer receives "le".',
    translation: 'Maria likes Spanish classical music very much.'
  },
  {
    id: 'drill_es_9',
    type: 'sentence-ordering',
    language: 'Spanish',
    level: 'B2',
    instruction: 'Arrange words into a polite conditional request.',
    prompt: 'Form: "Could you bring us the bill when you have a moment?"',
    scrambledTokens: ['traernos', 'cuenta', 'un', '¿Podría', 'tenga', 'la', 'cuando', 'momento?'],
    correctAnswer: ['¿Podría', 'traernos', 'la', 'cuenta', 'cuando', 'tenga', 'un', 'momento?'],
    hint: 'Start with the polite conditional question "¿Podría traernos...".',
    grammarExplanation: 'Polite restaurant requests commonly use conditional "¿Podría...?" + subjunctive "tenga".',
    translation: 'Could you bring us the bill when you have a moment?'
  },
  {
    id: 'drill_es_10',
    type: 'guess-missing-word',
    language: 'Spanish',
    level: 'B1',
    instruction: 'Guess the missing Spanish noun for "environment / nature".',
    prompt: 'Es fundamental proteger el medio ___ para las futuras generaciones.',
    correctAnswer: 'ambiente',
    wordClue: 'environment (pairs with "medio")',
    hint: 'Collocates with "medio": "el medio ___".',
    grammarExplanation: '"El medio ambiente" is the set phrase for the natural environment.',
    translation: 'It is essential to protect the environment for future generations.'
  },

  // --- ADDITIONAL ENGLISH DRILLS ---
  {
    id: 'drill_en_6',
    type: 'fill-blank',
    language: 'English',
    level: 'B2',
    instruction: 'Choose the correct modal verb for past deductions.',
    prompt: 'The streets are soaking wet; it ___ have rained heavily last night.',
    options: ['must', 'should', 'can', 'ought'],
    correctAnswer: 'must',
    hint: 'Use "must have + past participle" to express a logical conclusion based on evidence.',
    grammarExplanation: '"Must have + past participle" indicates certainty about a past event.',
    translation: 'The streets are soaking wet; it must have rained heavily last night.'
  },
  {
    id: 'drill_en_7',
    type: 'sentence-ordering',
    language: 'English',
    level: 'C1',
    instruction: 'Arrange words into negative inversion order for rhetorical emphasis.',
    prompt: 'Form: "Hardly had I arrived when the celebration began."',
    scrambledTokens: ['began.', 'Hardly', 'arrived', 'the', 'had', 'I', 'when', 'celebration'],
    correctAnswer: ['Hardly', 'had', 'I', 'arrived', 'when', 'the', 'celebration', 'began.'],
    hint: 'Negative adverb "Hardly" triggers auxiliary inversion: "Hardly had I arrived...".',
    grammarExplanation: 'Negative limiting adverbs (Hardly, Seldom, Rarely) invert auxiliary and subject.',
    translation: 'Hardly had I arrived when the celebration began.'
  },
  {
    id: 'drill_en_8',
    type: 'guess-missing-word',
    language: 'English',
    level: 'B2',
    instruction: 'Guess the missing noun meaning "the ability to bounce back from adversity".',
    prompt: 'The athlete showed remarkable ___ by recovering quickly after the knee injury.',
    correctAnswer: 'resilience',
    wordClue: 'mental or physical toughness; capacity to recover',
    hint: 'Starts with "re-s-i-l..." (10 letters).',
    grammarExplanation: '"Resilience" describes psychological or physical tenacity and recovery.',
    translation: 'The athlete showed remarkable resilience by recovering quickly after the knee injury.'
  },
  {
    id: 'drill_en_9',
    type: 'fill-blank',
    language: 'English',
    level: 'B1',
    instruction: 'Choose the correct preposition in the phrasal verb meaning "to give up / quit".',
    prompt: 'Never give ___ on your dreams, even when difficulties arise.',
    options: ['up', 'in', 'out', 'away'],
    correctAnswer: 'up',
    hint: '"Give up" means to abandon or surrender.',
    grammarExplanation: 'The idiomatic phrasal verb is "give up on something".',
    translation: 'Never give up on your dreams, even when difficulties arise.'
  },
  {
    id: 'drill_en_10',
    type: 'sentence-ordering',
    language: 'English',
    level: 'B2',
    instruction: 'Arrange words in a standard third-conditional sentence.',
    prompt: 'Form: "If you had informed me earlier, I would have joined you."',
    scrambledTokens: ['earlier,', 'have', 'would', 'I', 'joined', 'If', 'had', 'you', 'informed', 'me', 'you.'],
    correctAnswer: ['If', 'you', 'had', 'informed', 'me', 'earlier,', 'I', 'would', 'have', 'joined', 'you.'],
    hint: '"If" clause takes past perfect ("had informed"), main clause takes "would have + past participle".',
    grammarExplanation: 'Third conditional expresses past unreal situations and their hypothetical outcomes.',
    translation: 'If you had informed me earlier, I would have joined you.'
  },

  // --- ITALIAN DRILLS ---
  {
    id: 'drill_it_1',
    type: 'fill-blank',
    language: 'Italian',
    level: 'A2',
    instruction: 'Select the correct auxiliary verb for Passato Prossimo of movement.',
    prompt: 'Ieri sera noi ___ andati al cinema con gli amici.',
    options: ['siamo', 'abbiamo', 'eravamo', 'siano'],
    correctAnswer: 'siamo',
    hint: 'Verbs of motion like "andare" require "essere" as auxiliary and agree in gender and number.',
    grammarExplanation: 'With "essere", the past participle ends in "-i" to match masculine plural "noi siamo andati".',
    translation: 'Yesterday evening we went to the cinema with friends.'
  },
  {
    id: 'drill_it_2',
    type: 'sentence-ordering',
    language: 'Italian',
    level: 'B1',
    instruction: 'Arrange words to build a natural Italian sentence with subjunctive.',
    prompt: 'Form: "I hope you have a wonderful stay in Florence."',
    scrambledTokens: ['abbia', 'Spero', 'bellissimo', 'Firenze.', 'che', 'a', 'un', 'tu', 'soggiorno'],
    correctAnswer: ['Spero', 'che', 'tu', 'abbia', 'un', 'bellissimo', 'soggiorno', 'a', 'Firenze.'],
    hint: '"Spero che" requires present subjunctive of avere ("abbia").',
    grammarExplanation: 'Verbs of emotion and wishing (sperare che) govern the congiuntivo presente.',
    translation: 'I hope you have a wonderful stay in Florence.'
  },
  {
    id: 'drill_it_3',
    type: 'guess-missing-word',
    language: 'Italian',
    level: 'B1',
    instruction: 'Guess the missing Italian word for "breakfast".',
    prompt: 'Ogni mattina bevo un cappuccino per ___.',
    correctAnswer: 'colazione',
    wordClue: 'morning meal / breakfast (feminine noun)',
    hint: 'The Italian morning meal is "la ___".',
    grammarExplanation: '"Fare colazione" or "per colazione" is the standard phrase for breakfast.',
    translation: 'Every morning I drink a cappuccino for breakfast.'
  },

  // --- JAPANESE DRILLS ---
  {
    id: 'drill_ja_1',
    type: 'fill-blank',
    language: 'Japanese',
    level: 'A2',
    instruction: 'Choose the correct particle for destination of movement.',
    prompt: '明日、友達と一緒に京都___行きます。',
    options: ['へ', 'で', 'を', 'が'],
    correctAnswer: 'へ',
    hint: 'Particle へ (pronounced "e") or に indicates directional destination.',
    grammarExplanation: 'Particle へ marks the direction towards a destination: "京都へ行きます".',
    translation: 'Tomorrow, I will go to Kyoto together with my friend.'
  },
  {
    id: 'drill_ja_2',
    type: 'sentence-ordering',
    language: 'Japanese',
    level: 'B1',
    instruction: 'Arrange words to form: "Please speak a little more slowly."',
    prompt: 'Form: "Please speak a little more slowly."',
    scrambledTokens: ['話して', 'もう少し', 'ください。', 'ゆっくり'],
    correctAnswer: ['もう少し', 'ゆっくり', '話して', 'ください。'],
    hint: '"もう少し" (a little more) + "ゆっくり" (slowly) + "話してください" (please speak).',
    grammarExplanation: 'Adverbs precede the te-form verb + kudasai polite request.',
    translation: 'Please speak a little more slowly.'
  },
  {
    id: 'drill_ja_3',
    type: 'guess-missing-word',
    language: 'Japanese',
    level: 'A2',
    instruction: 'Type the missing Japanese word for "delicious / tasty" in hiragana or romaji.',
    prompt: 'このラーメンはとても___です！',
    correctAnswer: 'おいしい / oishii',
    wordClue: 'delicious / tasty i-adjective',
    hint: 'Starts with "お" (o-i-shi-i).',
    grammarExplanation: 'おいしい (oishii) is the standard adjective for delicious food.',
    translation: 'Thisラーメン is very delicious!'
  },

  // --- MANDARIN DRILLS ---
  {
    id: 'drill_zh_1',
    type: 'fill-blank',
    language: 'Mandarin',
    level: 'A2',
    instruction: 'Select the aspect particle indicating completed action.',
    prompt: '昨天晚上我看了两本书，学___很多新词。',
    options: ['了', '过', '着', '得'],
    correctAnswer: '了',
    hint: 'Aspect particle 了 directly follows the verb to mark completion.',
    grammarExplanation: 'Verb + 了 signals completion or change of state: "学了很多新词".',
    translation: 'Yesterday evening I read two books and learned many new words.'
  },
  {
    id: 'drill_zh_2',
    type: 'sentence-ordering',
    language: 'Mandarin',
    level: 'B1',
    instruction: 'Arrange words to form: "I am very interested in Chinese history."',
    prompt: 'Form: "I am very interested in Chinese history."',
    scrambledTokens: ['很', '中国', '感兴趣。', '我', '对', '历史'],
    correctAnswer: ['我', '对', '中国', '历史', '很', '感兴趣。'],
    hint: 'Pattern: Subject + 对 (duì) + Object + 感兴趣 (gǎn xìngqù).',
    grammarExplanation: 'The standard prepositional structure is "对...感兴趣" (interested in...).',
    translation: 'I am very interested in Chinese history.'
  },
  {
    id: 'drill_zh_3',
    type: 'guess-missing-word',
    language: 'Mandarin',
    level: 'A2',
    instruction: 'Type the missing word for "friend" in pinyin or characters.',
    prompt: '这是我的好___，我们认识五年了。',
    correctAnswer: '朋友 / pengyou',
    wordClue: 'friend (two syllables: péngyou)',
    hint: 'Péngyou: "好___" (good friend).',
    grammarExplanation: '朋友 (péngyou) is the universal word for friend.',
    translation: 'This is my good friend; we have known each other for five years.'
  },

  // --- PORTUGUESE DRILLS ---
  {
    id: 'drill_pt_1',
    type: 'fill-blank',
    language: 'Portuguese',
    level: 'A2',
    instruction: 'Choose between "ser" and "estar" for location or temporary state.',
    prompt: 'Onde ___ a estação de metrô mais próxima?',
    options: ['fica', 'é', 'tem', 'faz'],
    correctAnswer: 'fica',
    hint: 'In Portuguese, the verb "ficar" is universally used for geographical location.',
    grammarExplanation: '"Ficar" is the idiomatic Portuguese verb to ask where a building or place is located.',
    translation: 'Where is the nearest subway station located?'
  },
  {
    id: 'drill_pt_2',
    type: 'sentence-ordering',
    language: 'Portuguese',
    level: 'B1',
    instruction: 'Arrange the words to form: "I hope you have a great weekend."',
    prompt: 'Form: "I hope you have a great weekend."',
    scrambledTokens: ['Espero', 'fim', 'de', 'tenha', 'um', 'que', 'ótimo', 'você', 'semana.'],
    correctAnswer: ['Espero', 'que', 'você', 'tenha', 'um', 'ótimo', 'fim', 'de', 'semana.'],
    hint: '"Espero que" triggers the subjunctive of ter ("tenha").',
    grammarExplanation: 'Verbs of hoping (esperar que) require present subjunctive in the dependent clause.',
    translation: 'I hope you have a great weekend.'
  },
  {
    id: 'drill_pt_3',
    type: 'guess-missing-word',
    language: 'Portuguese',
    level: 'B1',
    instruction: 'Guess the missing Portuguese word for "please".',
    prompt: 'Poderia trazer a conta, por ___?',
    correctAnswer: 'favor',
    wordClue: 'please (pairs with "por")',
    hint: 'The polite formula is "por ___".',
    grammarExplanation: '"Por favor" is the universal polite phrase meaning "please".',
    translation: 'Could you bring the bill, please?'
  }
];

/**
 * Generates fresh contextual fallback drills covering all 3 requested drill types
 * (fill-blank, sentence-ordering, guess-missing-word) when offline or without an external key.
 */
export function buildGeneratedFallbackDrills(
  language: string = 'English',
  level: PracticeDrill['level'] = 'B1',
  requestedType: string = 'all',
  topic: string = 'Daily Conversation'
): PracticeDrill[] {
  const stamp = Date.now().toString(36);
  const langLower = language.toLowerCase();

  let pool: PracticeDrill[];
  if (langLower === 'german') {
    pool = [
      {
        id: `gen_de_fb_${stamp}`,
        type: 'fill-blank',
        language: 'German',
        level,
        instruction: `Fill in the blank (${topic}): Select the correct preposition with Dative.`,
        prompt: 'Ich interessiere mich sehr ___ moderne Architektur und Kultur.',
        options: ['für', 'über', 'auf', 'mit'],
        correctAnswer: 'für',
        hint: 'The reflexive verb is "sich interessieren für + Akkusativ".',
        grammarExplanation: '"Sich interessieren für" always governs the accusative preposition "für".',
        translation: 'I am very interested in modern architecture and culture.'
      },
      {
        id: `gen_de_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'German',
        level,
        instruction: `Rearrange the words (${topic}): Build a natural V2 main clause.`,
        prompt: 'Form: "Tomorrow morning we are traveling together to Munich."',
        scrambledTokens: ['nach', 'Morgen', 'wir', 'gemeinsam', 'früh', 'München.', 'fahren'],
        correctAnswer: ['Morgen', 'früh', 'fahren', 'wir', 'gemeinsam', 'nach', 'München.'],
        hint: 'Time expression "Morgen früh" occupies position 1, so the verb "fahren" must come second.',
        grammarExplanation: 'German main clauses obey Verb-Zweit-Stellung (conjugated verb in second position).',
        translation: 'Tomorrow morning we are traveling together to Munich.'
      },
      {
        id: `gen_de_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'German',
        level,
        instruction: `Guess the missing word (${topic}): Type the German word for "opportunity / chance".`,
        prompt: 'Dieses Praktikum ist eine großartige ___, meine Sprachkenntnisse zu verbessern.',
        correctAnswer: 'Gelegenheit / Möglichkeit',
        wordClue: 'opportunity / chance (feminine noun)',
        hint: 'Starts with "Gelegen..." or "Möglich...".',
        grammarExplanation: '"Eine großartige Gelegenheit" uses an "um...zu" / infinitive clause to express purpose.',
        translation: 'This internship is a wonderful opportunity to improve my language skills.'
      }
    ];
  } else if (langLower === 'spanish') {
    pool = [
      {
        id: `gen_es_fb_${stamp}`,
        type: 'fill-blank',
        language: 'Spanish',
        level,
        instruction: `Fill in the blank (${topic}): Select the natural idiomatic verb.`,
        prompt: 'Tenemos que ___ de acuerdo antes de firmar el contrato.',
        options: ['ponernos', 'hacernos', 'darnos', 'salirnos'],
        correctAnswer: 'ponernos',
        hint: 'The Spanish idiom for "to reach an agreement" uses the reflexive verb "ponerse".',
        grammarExplanation: '"Ponerse de acuerdo" means to come to an agreement.',
        translation: 'We need to reach an agreement before signing the contract.'
      },
      {
        id: `gen_es_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'Spanish',
        level,
        instruction: `Rearrange the words (${topic}): Construct a polite restaurant request.`,
        prompt: 'Form: "Could you bring us the menu when you have a moment?"',
        scrambledTokens: ['¿Podría', 'la', 'tenga', 'traernos', 'cuando', 'un', 'carta', 'momento?'],
        correctAnswer: ['¿Podría', 'traernos', 'la', 'carta', 'cuando', 'tenga', 'un', 'momento?'],
        hint: 'Start with "¿Podría traernos..." and use subjunctive "tenga" after future "cuando".',
        grammarExplanation: '"Cuando" referring to a future action triggers the present subjunctive ("tenga").',
        translation: 'Could you bring us the menu when you have a moment?'
      },
      {
        id: `gen_es_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'Spanish',
        level,
        instruction: `Guess the missing word (${topic}): Type the Spanish adjective meaning "essential / indispensable".`,
        prompt: 'Practicar todos los días es ___ para hablar con fluidez.',
        correctAnswer: 'imprescindible / esencial / fundamental',
        wordClue: 'indispensable / essential',
        hint: 'Starts with "impresc..." (14 letters) or "esenc...".',
        grammarExplanation: '"Resultar / ser imprescindible" elevates basic "muy importante" to natural C1 Spanish.',
        translation: 'Practicing every day is indispensable for speaking fluently.'
      }
    ];
  } else if (langLower === 'french') {
    pool = [
      {
        id: `gen_fr_fb_${stamp}`,
        type: 'fill-blank',
        language: 'French',
        level,
        instruction: `Fill in the blank (${topic}): Select the correct subjunctive form.`,
        prompt: 'Il faut absolument que nous ___ une solution avant la fin de la semaine.',
        options: ['trouvions', 'trouvons', 'trouverons', 'trouverions'],
        correctAnswer: 'trouvions',
        hint: '"Il faut que..." requires the subjunctive mood (nous ending: -ions).',
        grammarExplanation: '"Il faut que + subjonctif" is mandatory for impersonal necessity.',
        translation: 'It is absolutely necessary that we find a solution before the end of the week.'
      },
      {
        id: `gen_fr_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'French',
        level,
        instruction: `Rearrange the words (${topic}): Place pronouns before the conjugated verb.`,
        prompt: 'Form: "Je vous remercie chaleureusement pour votre accueil exceptionnel."',
        scrambledTokens: ['chaleureusement', 'remercie', 'votre', 'Je', 'accueil', 'vous', 'pour', 'exceptionnel.'],
        correctAnswer: ['Je', 'vous', 'remercie', 'chaleureusement', 'pour', 'votre', 'accueil', 'exceptionnel.'],
        hint: 'Object pronoun "vous" precedes the verb "remercie".',
        grammarExplanation: 'In French, conjunctive object pronouns precede the finite verb.',
        translation: 'I warmly thank you for your exceptional welcome.'
      },
      {
        id: `gen_fr_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'French',
        level,
        instruction: `Guess the missing word (${topic}): Type the French adjective meaning "indispensable / essential".`,
        prompt: 'La régularité quotidienne est ___ pour progresser rapidement en langue.',
        correctAnswer: 'indispensable / essentielle / primordiale',
        wordClue: 'indispensable / essential',
        hint: 'Starts with "indispen..." or "essent...".',
        grammarExplanation: '"Indispensable" or "primordiale" expresses vital necessity.',
        translation: 'Daily regularity is indispensable for making rapid progress in a language.'
      }
    ];
  } else if (langLower === 'italian') {
    pool = [
      {
        id: `gen_it_fb_${stamp}`,
        type: 'fill-blank',
        language: 'Italian',
        level,
        instruction: `Fill in the blank (${topic}): Select the correct present subjunctive form.`,
        prompt: 'Penso che questo progetto ___ un ottimo successo.',
        options: ['abbia', 'ha', 'avrà', 'avrebbe'],
        correctAnswer: 'abbia',
        hint: 'Verbs of opinion ("Penso che...") trigger the present subjunctive.',
        grammarExplanation: '"Pensare che" governs the congiuntivo presente ("abbia").',
        translation: 'I think that this project has great success.'
      },
      {
        id: `gen_it_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'Italian',
        level,
        instruction: `Rearrange the words (${topic}): Form a polite suggestion.`,
        prompt: 'Form: "Potremmo fare una pausa prima della prossima riunione."',
        scrambledTokens: ['riunione.', 'della', 'pausa', 'Potremmo', 'prima', 'prossima', 'una', 'fare'],
        correctAnswer: ['Potremmo', 'fare', 'una', 'pausa', 'prima', 'della', 'prossima', 'riunione.'],
        hint: 'Start with conditional modal "Potremmo fare...".',
        grammarExplanation: 'Conditional modal "potremmo" softens requests politely.',
        translation: 'We could take a break before the next meeting.'
      },
      {
        id: `gen_it_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'Italian',
        level,
        instruction: `Guess the missing word (${topic}): Type the Italian adjective for "fundamental / indispensable".`,
        prompt: 'La motivazione è ___ per raggiungere qualsiasi obiettivo importante.',
        correctAnswer: 'fondamentale / indispensabile / essenziale',
        wordClue: 'fundamental / essential',
        hint: 'Starts with "fonda..." or "indisp...".',
        grammarExplanation: '"Fondamentale" characterizes an indispensable foundation.',
        translation: 'Motivation is fundamental to achieve any important goal.'
      }
    ];
  } else if (langLower === 'japanese') {
    pool = [
      {
        id: `gen_ja_fb_${stamp}`,
        type: 'fill-blank',
        language: 'Japanese',
        level,
        instruction: `Fill in the blank (${topic}): Choose the correct case particle.`,
        prompt: '毎朝、駅の前で友達 ___ 会います。',
        options: ['に', 'を', 'で', 'へ'],
        correctAnswer: 'に',
        hint: 'Meeting a person takes the particle "に" (人と会う).',
        grammarExplanation: 'In Japanese, "X に会う" takes "に" for meeting a person.',
        translation: 'Every morning, I meet my friend in front of the station.'
      },
      {
        id: `gen_ja_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'Japanese',
        level,
        instruction: `Rearrange words (${topic}): Build a polite invitation.`,
        prompt: 'Form: "一緒に美味しいお茶を飲みませんか。"',
        scrambledTokens: ['飲みませんか。', 'お茶を', '美味しい', '一緒に'],
        correctAnswer: ['一緒に', '美味しい', 'お茶を', '飲みませんか。'],
        hint: 'Start with adverb "一緒に" and end with negative polite invitation "〜ませんか".',
        grammarExplanation: '"〜ませんか" forms a polite, friendly invitation.',
        translation: 'Won\'t you drink delicious tea together with me?'
      },
      {
        id: `gen_ja_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'Japanese',
        level,
        instruction: `Guess the missing word (${topic}): Type the Japanese word meaning "convenient / handy".`,
        prompt: 'このスマートフォンのアプリはとても ___ です。',
        options: ['便利', '元気', '静か', '有名'],
        correctAnswer: '便利 / べんり',
        wordClue: 'convenient / useful (na-adjective)',
        hint: 'Kanji "便利" or hiragana "べんり".',
        grammarExplanation: '"便利 (benri)" is the standard na-adjective for convenient/handy.',
        translation: 'This smartphone application is very convenient.'
      }
    ];
  } else if (langLower === 'mandarin' || langLower === 'chinese') {
    pool = [
      {
        id: `gen_zh_fb_${stamp}`,
        type: 'fill-blank',
        language: 'Mandarin',
        level,
        instruction: `Fill in the blank (${topic}): Choose the correct experiential aspect particle.`,
        prompt: '我以前去 ___ 北京，那里的风景很优美。',
        options: ['过', '了', '着', '得'],
        correctAnswer: '过',
        hint: 'Expresses past experience ("have been to before").',
        grammarExplanation: 'Aspect particle "过 (guò)" denotes past experiential action.',
        translation: 'I have been to Beijing before; the scenery there is very beautiful.'
      },
      {
        id: `gen_zh_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'Mandarin',
        level,
        instruction: `Rearrange words (${topic}): Place time and location before the verb.`,
        prompt: 'Form: "我们明天下午在图书馆一起复习汉语。"',
        scrambledTokens: ['一起', '在图书馆', '复习汉语。', '明天下午', '我们'],
        correctAnswer: ['我们', '明天下午', '在图书馆', '一起', '复习汉语。'],
        hint: 'Subject + Time expression + Location preposition + Adverb + Verb phrase.',
        grammarExplanation: 'Chinese canonical word order places Time and Place before the action.',
        translation: 'We will review Chinese together at the library tomorrow afternoon.'
      },
      {
        id: `gen_zh_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'Mandarin',
        level,
        instruction: `Guess the missing word (${topic}): Type the Mandarin word for "effort / hard work".`,
        prompt: '只要大家一起 ___ ，就一定能克服这个困难。',
        correctAnswer: '努力 / 奋斗',
        wordClue: 'hard work / effort (nǔlì)',
        hint: 'Pinyin: "nǔlì" (努力).',
        grammarExplanation: '"努力" means to make diligent efforts.',
        translation: 'As long as everyone works hard together, we will surely overcome this difficulty.'
      }
    ];
  } else if (langLower === 'portuguese') {
    pool = [
      {
        id: `gen_pt_fb_${stamp}`,
        type: 'fill-blank',
        language: 'Portuguese',
        level,
        instruction: `Fill in the blank (${topic}): Select the correct present subjunctive form.`,
        prompt: 'É essencial que você ___ os documentos antes de assinar.',
        options: ['leia', 'lê', 'lerá', 'leria'],
        correctAnswer: 'leia',
        hint: 'Impersonal clause ("É essencial que...") triggers the subjunctive of "ler".',
        grammarExplanation: '"É essencial que + presente do subjuntivo" is standard across Portuguese.',
        translation: 'It is essential that you read the documents before signing.'
      },
      {
        id: `gen_pt_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'Portuguese',
        level,
        instruction: `Rearrange the words (${topic}): Express future plan with conditional courtesy.`,
        prompt: 'Form: "Gostaria de agendar uma reunião com você amanhã à tarde."',
        scrambledTokens: ['à tarde.', 'Gostaria', 'reunião', 'de', 'com você', 'agendar', 'amanhã', 'uma'],
        correctAnswer: ['Gostaria', 'de', 'agendar', 'uma', 'reunião', 'com você', 'amanhã', 'à tarde.'],
        hint: 'Begin with polite conditional "Gostaria de agendar...".',
        grammarExplanation: '"Gostaria de" politely softens professional scheduling.',
        translation: 'I would like to schedule a meeting with you tomorrow afternoon.'
      },
      {
        id: `gen_pt_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'Portuguese',
        level,
        instruction: `Guess the missing word (${topic}): Type the Portuguese adjective meaning "essential / indispensable".`,
        prompt: 'A dedicação diária é ___ para alcançar a fluência em um novo idioma.',
        correctAnswer: 'indispensável / essencial / fundamental',
        wordClue: 'indispensable / essential',
        hint: 'Starts with "indispen..." or "essenc...".',
        grammarExplanation: '"Indispensável" expresses absolute necessity.',
        translation: 'Daily dedication is indispensable to reach fluency in a new language.'
      }
    ];
  } else {
    pool = [
      {
        id: `gen_en_fb_${stamp}`,
        type: 'fill-blank',
        language: 'English',
        level,
        instruction: `Fill in the blank (${topic}): Choose the natural verb form after "suggest".`,
        prompt: 'Our mentor suggested ___ the presentation with a compelling story.',
        options: ['opening', 'to open', 'open', 'opened'],
        correctAnswer: 'opening',
        hint: 'In English, "suggest" is followed directly by a gerund (-ing) or a "that"-clause, never "to + infinitive".',
        grammarExplanation: '"Suggest + gerund" ("suggested opening") is standard idiomatic English.',
        translation: 'Our mentor suggested opening the presentation with a compelling story.'
      },
      {
        id: `gen_en_so_${stamp}`,
        type: 'sentence-ordering',
        language: 'English',
        level,
        instruction: `Rearrange the words (${topic}): Form a grammatically proper inverted conditional.`,
        prompt: 'Form: "Had I known about the traffic, I would have left earlier."',
        scrambledTokens: ['left', 'Had', 'earlier.', 'traffic,', 'I', 'known', 'have', 'the', 'would', 'about', 'I'],
        correctAnswer: ['Had', 'I', 'known', 'about', 'the', 'traffic,', 'I', 'would', 'have', 'left', 'earlier.'],
        hint: 'Formal C1 third conditional begins with "Had I known..." instead of "If I had known...".',
        grammarExplanation: 'Inverted past unreal conditionals omit "if" and invert "had" before the subject.',
        translation: 'Had I known about the traffic, I would have left earlier.'
      },
      {
        id: `gen_en_gm_${stamp}`,
        type: 'guess-missing-word',
        language: 'English',
        level,
        instruction: `Guess the missing word (${topic}): Type the adjective meaning "clear, fluent, and persuasive in speaking".`,
        prompt: 'She gave such an ___ speech that everyone in the auditorium applauded.',
        correctAnswer: 'eloquent / articulate',
        wordClue: 'fluent, expressive, and persuasive in speaking',
        hint: 'Starts with "eloq..." (8 letters). Note "an ___" requires a vowel sound!',
        grammarExplanation: '"Eloquent" (or "articulate") describes vivid, persuasive expression and pairs with "an".',
        translation: 'She gave such an eloquent speech that everyone in the auditorium applauded.'
      }
    ];
  }

  const preparedPool = pool.map(d => {
    if (d.type === 'fill-blank' && Array.isArray(d.options)) {
      return { ...d, options: shuffleFillBlankOptions(d.options, d.correctAnswer) };
    }
    return d;
  });

  if (requestedType && requestedType !== 'all') {
    const matching = preparedPool.filter(d => d.type === requestedType);
    if (matching.length > 0) return matching;
  }

  return preparedPool;
}

export const INITIAL_PRONUNCIATION_TARGETS: PronunciationTarget[] = [
  // German
  {
    id: 'pron_de_1',
    phrase: 'Ich hätte gerne eine Tasse Kaffee',
    translation: 'I would like a cup of coffee',
    language: 'German',
    level: 'A2',
    phoneticIpa: '[ɪç ˈhɛtə ˈɡɛʁnə ˈaɪnə ˈtasə ˈkafeː]',
    difficultSounds: ['ç (Ich-Laut)', 'ɛ (ä)', 'ʁ (uvular r)'],
    tip: 'For the "ch" in "Ich", whisper the sound with your tongue flat against the hard palate, like a gentle hiss.'
  },
  {
    id: 'pron_de_2',
    phrase: 'Fünfhundertfünfundfünfzig',
    translation: 'Five hundred fifty-five',
    language: 'German',
    level: 'B1',
    phoneticIpa: '[ˈfʏnfˌhʊndɐtˌfʏnfʔʊntˈfʏnftsɪç]',
    difficultSounds: ['ʏ (ü short)', 'pf (affricate)', 'ts (z)'],
    tip: 'Round your lips tightly as if whistling while trying to pronounce the vowel sound "i" to produce the native "ü".'
  },
  {
    id: 'pron_de_3',
    phrase: 'Übung macht den Meister',
    translation: 'Practice makes perfect',
    language: 'German',
    level: 'B2',
    phoneticIpa: '[ˈyːbʊŋ maxt deːn ˈmaɪstɐ]',
    difficultSounds: ['yː (long ü)', 'x (Ach-Laut)', 'ɐ (vocalic r)'],
    tip: 'The "ch" in "macht" is deep in the throat (Ach-Laut) after the back vowel "a", distinct from the softer Ich-Laut.'
  },

  // Spanish
  {
    id: 'pron_es_1',
    phrase: 'El ferrocarril corre muy rápido',
    translation: 'The railway runs very fast',
    language: 'Spanish',
    level: 'B1',
    phoneticIpa: '[el fe.ro.kaˈril ˈko.re mwi ˈra.pi.ðo]',
    difficultSounds: ['rr (rolled r)', 'd intervocalic [ð]'],
    tip: 'Place the tip of your tongue against the alveolar ridge and let air vibration flutter the tip 2-3 times.'
  },
  {
    id: 'pron_es_2',
    phrase: 'Quisiera pedir la cuenta, por favor',
    translation: 'I would like to ask for the check, please',
    language: 'Spanish',
    level: 'A2',
    phoneticIpa: '[kiˈsje.ɾa peˈðiɾ la ˈkwen.ta poɾ faˈβoɾ]',
    difficultSounds: ['ɾ (single tap r)', 'β (soft b/v)'],
    tip: 'Keep the vowels crisp and short (a, e, i, o, u) without the English diphthong glide.'
  },

  // English
  {
    id: 'pron_en_1',
    phrase: 'I look forward to collaborating with your team',
    translation: 'I look forward to collaborating with your team',
    language: 'English',
    level: 'B2',
    phoneticIpa: '[aɪ lʊk ˈfɔːwəd tu kəˈlæbəreɪtɪŋ wɪð jɔː tiːm]',
    difficultSounds: ['ð (voiced th)', 'æ (short a)', 'ʊ (short oo)'],
    tip: 'Place the tip of your tongue between your upper and lower front teeth and activate your vocal cords for "with".'
  },
  {
    id: 'pron_en_2',
    phrase: 'Thoughtful people think through thoroughly',
    translation: 'Thoughtful people think through thoroughly',
    language: 'English',
    level: 'C1',
    phoneticIpa: '[ˈθɔːtfəl ˈpiːpəl θɪŋk θruː ˈθʌrəli]',
    difficultSounds: ['θ (unvoiced th)', 'ʌ (strut vowel)'],
    tip: 'Do not substitute "s" or "f" for "th". Let unvoiced air pass gently over the tongue tip placed right beneath your teeth.'
  },

  // French
  {
    id: 'pron_fr_1',
    phrase: "C'est une opportunité vraiment exceptionnelle",
    translation: 'It is a truly exceptional opportunity',
    language: 'French',
    level: 'B2',
    phoneticIpa: '[sɛt yn ɔpɔʁtynite vʁɛmɑ̃ ɛksɛpsjɔnɛl]',
    difficultSounds: ['y (French u)', 'ɑ̃ (nasal an)', 'ʁ (uvular r)'],
    tip: 'Make liaison between "c\'est" and "une" ([sɛt yn]), and direct air through the nasal cavity for "-ment".'
  }
];
