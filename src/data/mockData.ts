import { LanguageInfo, LanguagePartner, LanguageRoom, RoleplayScenario, UserProfile, VocabularyWord } from '../types';
import { createInitialsAvatarDataUri } from './teacherData';
import { initializeRealUserStreak, MINIMUM_DAILY_GOAL_MINUTES } from '../services/streakService';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    popularTopics: ['Phrasal Verbs', 'Idiomatic Expressions', 'C1 Academic Vocabulary', 'Pronunciation Nuances']
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    popularTopics: ['Akkusativ & Dativ Cases', 'Separable Verbs', 'Job Interviews in DACH', 'Berlin Dialect vs Hochdeutsch']
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    popularTopics: ['Subjuntivo Mood', 'Ser vs Estar', 'Por vs Para', 'Latin American vs Castilian Idioms']
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    popularTopics: ['Passé Composé vs Imparfait', 'Nasal Vowels', 'Subjonctif', 'Everyday Parisian Argot']
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    popularTopics: ['Passato Prossimo', 'Congiuntivo', 'Pronomi Combinati', 'Culinary Terminology']
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    popularTopics: ['Keigo (Honorifics)', 'Kanji Compounds', 'Particles (は vs が)', 'Business Etiquette']
  },
  {
    code: 'zh',
    name: 'Mandarin',
    nativeName: '中文',
    flag: '🇨🇳',
    popularTopics: ['Tones & Pinyin', 'HSK 4/5 Vocabulary', 'Ordering Food', 'Business Networking']
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
    popularTopics: ['European vs Brazilian Portuguese', 'Subjuntivo', 'Preterite vs Imperfect', 'Everyday Slang']
  }
];

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'usr_main_992',
  name: 'Alex Rivera',
  email: 'alex.rivera@lernwelt.io',
  avatarUrl: createInitialsAvatarDataUri('Alex Rivera', '#4f46e5'),
  nativeLanguage: 'English',
  targetLanguages: [
    { language: 'German', level: 'B1', goal: 'Pass Goethe-Zertifikat B2 & relocate to Munich' },
    { language: 'Spanish', level: 'A2', goal: 'Conversational fluency for travel in Andalusia' }
  ],
  bio: 'Software engineer passionate about languages and cultural exchange. Learning German and practicing Spanish. Love tech, hiking, coffee, and philosophy.',
  country: 'United States',
  timezone: 'UTC-5 (EST)',
  interests: ['Tech & AI', 'Hiking', 'Coffee Culture', 'Cinema', 'European History'],
  streakDays: 0,
  streak: initializeRealUserStreak({
    streakDays: 0,
    bestStreak: 0,
    totalXp: 0,
    streakFreezesAvailable: 0,
    streakFreezesUsed: 0,
    dailyGoalMinutes: MINIMUM_DAILY_GOAL_MINUTES,
    dailyDrillGoal: 5,
    todayDrillsCompleted: 0,
    todayMinutes: 0,
    todaySeconds: 0,
    todayCompleted: false
  }),
  totalPracticeMinutes: 0,
  totalPracticeSeconds: 0,
  wordsLearned: 0,
  correctionsReceived: 0,
  statsSource: 'real',
  isOnline: true,
  cameraReady: true
};

export const MOCK_PARTNERS: LanguagePartner[] = [
  {
    id: 'partner_1',
    name: 'Maximilian Krause',
    avatarUrl: createInitialsAvatarDataUri('Maximilian Krause', '#2563eb'),
    country: 'Germany',
    countryCode: '🇩🇪',
    nativeLanguage: 'German',
    learningLanguage: 'English',
    learningLevel: 'B2',
    rating: 4.96,
    reviewCount: 38,
    sessionsCompleted: 112,
    isOnline: true,
    interests: ['Architecture', 'Philosophy', 'Electronic Music', 'Board Games'],
    bio: 'Hi! Native German from Berlin. I love helping people nail cases (Dativ/Akkusativ) and speak natural, idiomatic Hochdeutsch! Practicing my English.',
    availability: 'Available Now',
    verifiedNative: true
  },
  {
    id: 'partner_2',
    name: 'Elena Morales',
    avatarUrl: createInitialsAvatarDataUri('Elena Morales', '#e11d48'),
    country: 'Spain',
    countryCode: '🇪🇸',
    nativeLanguage: 'Spanish',
    learningLanguage: 'English',
    learningLevel: 'C1',
    rating: 4.98,
    reviewCount: 54,
    sessionsCompleted: 174,
    isOnline: true,
    interests: ['Gastronomy', 'Travel', 'Photography', 'Literature'],
    bio: 'Hola! Born and raised in Madrid. I love friendly chats over video. I will gently fix your subjunctive mistakes and teach you real peninsular Spanish expressions!',
    availability: 'Available Now',
    verifiedNative: true
  },
  {
    id: 'partner_3',
    name: 'Léa Dubois',
    avatarUrl: createInitialsAvatarDataUri('Lea Dubois', '#7c3aed'),
    country: 'France',
    countryCode: '🇫🇷',
    nativeLanguage: 'French',
    learningLanguage: 'German',
    learningLevel: 'A2',
    rating: 4.92,
    reviewCount: 29,
    sessionsCompleted: 78,
    isOnline: true,
    interests: ['Cinema', 'Baking', 'Visual Art', 'Yoga'],
    bio: 'Salut! Parisienne living in Lyon. Patient language tandem partner. Let us practice daily French conversations and pronunciation without fear of making mistakes.',
    availability: 'In 15 mins',
    verifiedNative: true
  },
  {
    id: 'partner_4',
    name: 'Kenji Takahashi',
    avatarUrl: createInitialsAvatarDataUri('Kenji Takahashi', '#0d9488'),
    country: 'Japan',
    countryCode: '🇯🇵',
    nativeLanguage: 'Japanese',
    learningLanguage: 'Spanish',
    learningLevel: 'B1',
    rating: 4.95,
    reviewCount: 42,
    sessionsCompleted: 96,
    isOnline: false,
    interests: ['Anime', 'Coffee Roasting', 'Cycling', 'Software Engineering'],
    bio: 'Konnichiwa! From Kyoto. Can help with polite Japanese (Keigo), everyday colloquial speech, and pitch accent. Studying Spanish for my upcoming trip to Colombia!',
    availability: 'Later Today',
    verifiedNative: true
  },
  {
    id: 'partner_5',
    name: 'Chiara Rossi',
    avatarUrl: createInitialsAvatarDataUri('Chiara Rossi', '#059669'),
    country: 'Italy',
    countryCode: '🇮🇹',
    nativeLanguage: 'Italian',
    learningLanguage: 'German',
    learningLevel: 'B1',
    rating: 4.99,
    reviewCount: 61,
    sessionsCompleted: 145,
    isOnline: true,
    interests: ['Cooking', 'Art History', 'Wine Making', 'Design'],
    bio: 'Ciao a tutti! Florence native. Enthusiastic about language exchanges. We can practice pronunciation, idioms, and natural rhythm.',
    availability: 'Available Now',
    verifiedNative: true
  }
];

export const LANGUAGE_ROOMS: LanguageRoom[] = [
  {
    id: 'room-en',
    languageCode: 'en',
    languageName: 'English',
    flag: '🇬🇧',
    title: 'Global English Lounge',
    subtitle: 'London & New York Conversation Exchange',
    currentTopic: 'Idioms, Phrasal Verbs & Professional C1 Fluency',
    host: {
      id: 'partner_en_host',
      name: 'Sarah Jenkins',
      avatarUrl: createInitialsAvatarDataUri('Sarah Jenkins', '#0284c7'),
      country: 'United Kingdom',
      countryCode: '🇬🇧',
      nativeLanguage: 'English',
      learningLanguage: 'German & Spanish',
      learningLevel: 'B2',
      rating: 4.98,
      reviewCount: 72,
      sessionsCompleted: 194,
      isOnline: true,
      interests: ['Literature', 'Podcasts', 'Business Communications', 'Cinema'],
      bio: 'Hello! Native English speaker and language tutor from London. I help learners master natural idioms, reduce speaking anxiety, and upgrade to advanced C1/C2 vocabulary.',
      availability: 'Available Now',
      verifiedNative: true
    },
    activeLearnersCount: 26,
    activeNativesCount: 9,
    levelRange: 'A2 – C2',
    welcomeMessage: 'Hello and welcome to the Global English Lounge! Join our exchange session. Turn on audio or video whenever you feel comfortable, or start typing in chat with AI feedback.',
    suggestedPhrases: [
      'I am living here since two years...',
      'She don\'t understand...',
      'This meeting is very important...'
    ]
  },
  {
    id: 'room-de',
    languageCode: 'de',
    languageName: 'German',
    flag: '🇩🇪',
    title: 'Deutscher Sprachraum',
    subtitle: 'Berlin & DACH Exchange Hub',
    currentTopic: 'Akkusativ vs Dativ in Everyday Speech & Job Interviews',
    host: MOCK_PARTNERS[0], // Maximilian Krause
    activeLearnersCount: 14,
    activeNativesCount: 4,
    levelRange: 'A2 – C1',
    welcomeMessage: 'Hallo und herzlich willkommen! Tritt unserem Sprachraum bei. Schalte Audio oder Video ein, wenn du sprechen möchtest, oder nutze den Chat mit KI-Korrektur.',
    suggestedPhrases: [
      'Ich bin gut heute...',
      'weil ich habe Zeit...',
      'Ich helfe dich...'
    ]
  },
  {
    id: 'room-es',
    languageCode: 'es',
    languageName: 'Spanish',
    flag: '🇪🇸',
    title: 'Salón Hispano',
    subtitle: 'Madrid & Latin America Exchange',
    currentTopic: 'Subjuntivo, Ser vs Estar & Everyday Tapas Banter',
    host: MOCK_PARTNERS[1], // Elena Morales
    activeLearnersCount: 19,
    activeNativesCount: 6,
    levelRange: 'A1 – B2',
    welcomeMessage: '¡Hola a todos! Bienvenidos al Salón Hispano. Conéctate con audio o video para practicar pronunciación y expresiones coloquiales con nosotros.',
    suggestedPhrases: [
      'Yo querer aprender...',
      'Hoy soy aburrido...',
      'Espero que viene...'
    ]
  },
  {
    id: 'room-fr',
    languageCode: 'fr',
    languageName: 'French',
    flag: '🇫🇷',
    title: 'Salon Français',
    subtitle: 'Paris & Lyon Conversation Café',
    currentTopic: 'Passé Composé vs Imparfait & Café Ordering',
    host: MOCK_PARTNERS[2], // Léa Dubois
    activeLearnersCount: 11,
    activeNativesCount: 3,
    levelRange: 'A2 – B2',
    welcomeMessage: 'Bienvenue au Salon Français ! Rejoignez-nous en audio ou vidéo dès que vous êtes prêt(e) à converser.',
    suggestedPhrases: [
      'Je suis allé hier...',
      'Il faut que je viens...',
      'C\'est très bon...'
    ]
  },
  {
    id: 'room-it',
    languageCode: 'it',
    languageName: 'Italian',
    flag: '🇮🇹',
    title: 'Salotto Italiano',
    subtitle: 'Firenze & Roma Language Lounge',
    currentTopic: 'Congiuntivo, Culinary Terms & Italian Rhythm',
    host: MOCK_PARTNERS[4], // Chiara Rossi
    activeLearnersCount: 8,
    activeNativesCount: 3,
    levelRange: 'A1 – B1',
    welcomeMessage: 'Ciao a tutti! Benvenuti nel nostro Salotto Italiano. Avvia audio o video quando preferisci per conversare in tutta tranquillità.',
    suggestedPhrases: [
      'Voglio che tu vieni...',
      'Ho fame di pizza...',
      'Molto bello...'
    ]
  },
  {
    id: 'room-ja',
    languageCode: 'ja',
    languageName: 'Japanese',
    flag: '🇯🇵',
    title: '日本語ルーム (Nihongo Room)',
    subtitle: 'Kyoto & Tokyo Cultural Tandem',
    currentTopic: 'Everyday Keigo, Particles (は vs が) & Anime Discussion',
    host: MOCK_PARTNERS[3], // Kenji Takahashi
    activeLearnersCount: 16,
    activeNativesCount: 5,
    levelRange: 'A2 – N3/N2',
    welcomeMessage: '皆さん、こんにちは！日本語ルームへようこそ。音声やビデオで会話練習を始めましょう。',
    suggestedPhrases: [
      'こんにちは、元氣ですか？',
      '日本語を勉強したいです。'
    ]
  },
  {
    id: 'room-zh',
    languageCode: 'zh',
    languageName: 'Mandarin',
    flag: '🇨🇳',
    title: '汉语角 (Chinese Language Corner)',
    subtitle: 'Beijing & Shanghai Conversation Lounge',
    currentTopic: 'Tones, Food Ordering & Everyday Colloquial Expressions',
    host: {
      id: 'partner_zh_host',
      name: 'Lin Wei',
      avatarUrl: createInitialsAvatarDataUri('Lin Wei', '#dc2626'),
      country: 'China',
      countryCode: '🇨🇳',
      nativeLanguage: 'Mandarin',
      learningLanguage: 'English',
      learningLevel: 'B2',
      rating: 4.97,
      reviewCount: 51,
      sessionsCompleted: 130,
      isOnline: true,
      interests: ['Tea Culture', 'Calligraphy', 'Tech', 'Culinary Arts'],
      bio: '你好！From Shanghai. I love helping students conquer Chinese tones, measure words, and speak authentic Putonghua.',
      availability: 'Available Now',
      verifiedNative: true
    },
    activeLearnersCount: 22,
    activeNativesCount: 7,
    levelRange: 'HSK 1 – HSK 5',
    welcomeMessage: '欢迎来到中文角！欢迎开启语音或视频，与我们一起练习中文。',
    suggestedPhrases: [
      '你好，很高兴认识你！',
      '请问这个用中文怎么说？'
    ]
  },
  {
    id: 'room-pt',
    languageCode: 'pt',
    languageName: 'Portuguese',
    flag: '🇵🇹',
    title: 'Sala Lusófona',
    subtitle: 'Lisbon & Rio de Janeiro Exchange',
    currentTopic: 'Preterite vs Imperfect, Subjuntivo & Coastal Travel Talk',
    host: {
      id: 'partner_pt_host',
      name: 'Mateus Silva',
      avatarUrl: createInitialsAvatarDataUri('Mateus Silva', '#d97706'),
      country: 'Portugal',
      countryCode: '🇵🇹',
      nativeLanguage: 'Portuguese',
      learningLanguage: 'German',
      learningLevel: 'B1',
      rating: 4.96,
      reviewCount: 39,
      sessionsCompleted: 88,
      isOnline: true,
      interests: ['Surfing', 'Music', 'Gastronomy', 'History'],
      bio: 'Olá amigos! Born in Porto, living in Lisbon. Let\'s practice Portuguese pronunciation, idioms, and natural expressions.',
      availability: 'Available Now',
      verifiedNative: true
    },
    activeLearnersCount: 15,
    activeNativesCount: 4,
    levelRange: 'A1 – C1',
    welcomeMessage: 'Bem-vindos à Sala Lusófona! Junte-se a nós com áudio ou vídeo para praticar conversação.',
    suggestedPhrases: [
      'Olá, tudo bem com você?',
      'Gostaria de praticar meu português.'
    ]
  }
];

export const INITIAL_VOCABULARY: VocabularyWord[] = [
  {
    id: 'voc_1',
    word: 'Feierabend (der)',
    translation: 'Closing time / end of the work day / leisure time after work',
    language: 'German',
    cefrLevel: 'B1',
    contextSentence: 'Ich mache jetzt Feierabend und treffe mich mit Freunden.',
    mastered: true,
    nextReviewDate: '2026-11-02',
    tags: ['Culture', 'Work-Life', 'Idiom']
  },
  {
    id: 'voc_2',
    word: 'Vorfreude (die)',
    translation: 'Joyful anticipation / excitement for a future event',
    language: 'German',
    cefrLevel: 'B2',
    contextSentence: 'Die Vorfreude auf meinen Urlaub in den Alpen ist riesig!',
    mastered: false,
    nextReviewDate: '2026-10-30',
    tags: ['Emotion', 'Untranslatable words']
  },
  {
    id: 'voc_3',
    word: 'Sobremesa (la)',
    translation: 'The time spent lingering around the table after a meal conversing',
    language: 'Spanish',
    cefrLevel: 'B1',
    contextSentence: 'Tuvimos una sobremesa maravillosa después del almuerzo en familia.',
    mastered: false,
    nextReviewDate: '2026-10-30',
    tags: ['Culture', 'Dining', 'Social']
  },
  {
    id: 'voc_4',
    word: 'Estar en las nubes',
    translation: 'To be daydreaming / to have one’s head in the clouds',
    language: 'Spanish',
    cefrLevel: 'B1',
    contextSentence: 'Perdona, ¿qué dijiste? Estaba en las nubes.',
    mastered: true,
    nextReviewDate: '2026-11-05',
    tags: ['Idiom', 'Conversational']
  },
  {
    id: 'voc_5',
    word: 'Kummerspeck (der)',
    translation: 'Grief bacon / excess weight gained from emotional overeating',
    language: 'German',
    cefrLevel: 'C1',
    contextSentence: 'Nach der stressigen Prüfungswoche habe ich etwas Kummerspeck angesetzt.',
    mastered: false,
    nextReviewDate: '2026-10-31',
    tags: ['Humorous', 'Compound noun']
  }
];

export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    id: 'scen_de_cafe',
    title: 'Ordering at a Traditional Viennese Coffeehouse',
    language: 'German',
    level: 'A2',
    description: 'Practice ordering specialty coffees (Melange, Einspänner) and pastries while using courteous modal verbs (hätte gerne, könnten Sie...).',
    partnerRole: 'Waiter (Herr Ober) at Café Central',
    userRole: 'Visitor exploring Vienna',
    keyPhrases: [
      'Ich hätte gerne eine Wiener Melange, bitte.',
      'Was können Sie mir als Nachspeise empfehlen?',
      'Zusammen oder getrennt? Wir würden gerne getrennt zahlen.'
    ],
    suggestedQuestions: [
      'Haben Sie auch Hafermilch?',
      'Können wir mit Karte zahlen?'
    ]
  },
  {
    id: 'scen_de_interview',
    title: 'Software Developer Job Interview in Berlin',
    language: 'German',
    level: 'B2',
    description: 'Present your background, explain technical problem-solving approaches, and discuss salary expectations politely.',
    partnerRole: 'Tech Lead / Hiring Manager',
    userRole: 'Candidate applying for Senior Full-Stack role',
    keyPhrases: [
      'In meinem letzten Projekt war ich für die WebRTC-Architektur zuständig.',
      'Meiner Ansicht nach ist saubere Dokumentation genauso wichtig wie Code.',
      'Wie sieht die Einarbeitungsphase in Ihrem Team aus?'
    ],
    suggestedQuestions: [
      'Welche Entwicklungsmöglichkeiten bietet das Unternehmen?',
      'Wie handhaben Sie Remote-Arbeit und Weiterbildung?'
    ]
  },
  {
    id: 'scen_es_tapas',
    title: 'Ordering Tapas & Drinks in Seville',
    language: 'Spanish',
    level: 'A2',
    description: 'Ask for local specialties, dietary restrictions, and engage in friendly banter with the tabernero.',
    partnerRole: 'Bartender at a bustling bar in Barrio Santa Cruz',
    userRole: 'Hungry traveler eager to try authentic Andalusian food',
    keyPhrases: [
      '¿Qué tapa del día nos recomiendas?',
      'Ponme una caña bien fría y una ración de jamón ibérico.',
      '¿La cuenta cuando puedas, por favor?'
    ],
    suggestedQuestions: [
      '¿Tienen opciones vegetarianas o sin gluten?',
      '¿Cuál es la especialidad de la casa?'
    ]
  },
  {
    id: 'scen_es_rent',
    title: 'Apartment Viewing in Barcelona',
    language: 'Spanish',
    level: 'B1',
    description: 'Inquire about utility bills, deposit (fianza), neighborhood amenities, and lease conditions.',
    partnerRole: 'Landlord / Real estate agent',
    userRole: 'Prospective tenant moving to the city',
    keyPhrases: [
      '¿Los gastos de luz, agua e internet están incluidos en el alquiler?',
      '¿Cuánto se pide de fianza y comisión de agencia?',
      '¿Hay mucha luz natural por las mañanas?'
    ],
    suggestedQuestions: [
      '¿Está permitido tener mascotas?',
      '¿Qué tal la conexión con el transporte público?'
    ]
  }
];
