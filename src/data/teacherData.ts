import { PersonalTeacher } from '../types';

/**
 * Generates a crisp, self-contained SVG data-URI avatar with deterministic palette
 * so every personal teacher and guest learner renders cleanly with zero broken external URLs.
 */
export function createInitialsAvatarDataUri(name: string, accentHex: string = '#1d4ed8'): string {
  const parts = (name || 'Teacher')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0]?.slice(0, 2) || 'LW').toUpperCase();

  const safeColor = /^#[0-9a-fA-F]{6}$/.test(accentHex) ? accentHex : '#1d4ed8';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#eef2ff" />
    <rect x="2" y="2" width="156" height="156" rx="78" fill="none" stroke="${safeColor}" stroke-opacity="0.2" stroke-width="4" />
    <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" fill="${safeColor}" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="700" letter-spacing="1">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_PERSONAL_TEACHERS: PersonalTeacher[] = [
  {
    id: 'teacher_de_hannah',
    name: 'Dr. Hannah Lindner',
    avatarUrl: createInitialsAvatarDataUri('Hannah Lindner', '#4f46e5'),
    country: 'Germany',
    flag: '🇩🇪',
    languageCode: 'de',
    languageName: 'German',
    alsoSpeaks: ['English', 'French'],
    cefrRange: 'A1 – C2',
    specialties: ['Grammar & Writing', 'Exam Preparation', 'Conversation & Fluency'],
    credentials: 'Goethe-Institut Certified Examiner · M.A. DaF Munich',
    yearsExperience: 9,
    rating: 4.99,
    lessonsCompleted: 640,
    availability: 'Available Now',
    nextAvailableSlots: ['Today · 17:00', 'Today · 19:30', 'Tomorrow · 10:00'],
    bio: 'Structured 1-on-1 German coaching tailored to your speaking speed. We untangle cases, word order, and Goethe B1–C1 speaking tasks step by step.',
    lessonFocus: 'Live speaking diagnostics, dative/accusative mastery, and natural DACH phrasing',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_es_mateo',
    name: 'Prof. Mateo Valdés',
    avatarUrl: createInitialsAvatarDataUri('Mateo Valdes', '#0284c7'),
    country: 'Spain',
    flag: '🇪🇸',
    languageCode: 'es',
    languageName: 'Spanish',
    alsoSpeaks: ['English', 'Portuguese'],
    cefrRange: 'A1 – C2',
    specialties: ['Conversation & Fluency', 'Grammar & Writing', 'Exam Preparation'],
    credentials: 'DELE Lead Instructor · Complutense University Madrid',
    yearsExperience: 8,
    rating: 4.98,
    lessonsCompleted: 520,
    availability: 'Available Now',
    nextAvailableSlots: ['Today · 16:30', 'Today · 20:00', 'Tomorrow · 14:00'],
    bio: 'Patient, interactive Spanish lessons focused on real-world fluency, past-tense storytelling, and intuitive subjunctive usage without rote memorization.',
    lessonFocus: 'Subjunctive confidence, rapid listening comprehension, and DELE oral prep',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_en_claire',
    name: 'Claire Bennett',
    avatarUrl: createInitialsAvatarDataUri('Claire Bennett', '#059669'),
    country: 'United Kingdom',
    flag: '🇬🇧',
    languageCode: 'en',
    languageName: 'English',
    alsoSpeaks: ['Spanish', 'German'],
    cefrRange: 'A2 – C2',
    specialties: ['Business & Career', 'Pronunciation & Accent', 'Conversation & Fluency'],
    credentials: 'Cambridge CELTA & DELTA · Executive Communication Coach',
    yearsExperience: 11,
    rating: 4.99,
    lessonsCompleted: 810,
    availability: 'Available Now',
    nextAvailableSlots: ['Today · 15:30', 'Today · 18:00', 'Tomorrow · 09:30'],
    bio: 'Clear, practical 1-on-1 English coaching for interviews, presentations, IELTS/CAE preparation, and nuanced C1–C2 phrasing.',
    lessonFocus: 'Executive fluency, pronunciation clarity, and idiomatic C1 phrasing',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_fr_camille',
    name: 'Camille Moreau',
    avatarUrl: createInitialsAvatarDataUri('Camille Moreau', '#7c3aed'),
    country: 'France',
    flag: '🇫🇷',
    languageCode: 'fr',
    languageName: 'French',
    alsoSpeaks: ['English', 'Italian'],
    cefrRange: 'A1 – C1',
    specialties: ['Pronunciation & Accent', 'Conversation & Fluency', 'Exam Preparation'],
    credentials: 'Alliance Française Certified · Sorbonne FLE Specialist',
    yearsExperience: 7,
    rating: 4.97,
    lessonsCompleted: 430,
    availability: 'Available Now',
    nextAvailableSlots: ['Today · 18:30', 'Tomorrow · 11:00', 'Tomorrow · 17:00'],
    bio: 'Master French rhythm, nasal vowels, and spontaneous conversation in a supportive 1-on-1 classroom with live board corrections.',
    lessonFocus: 'French phonetics, DELF/DALF oral arguments, and everyday Parisian speech',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_ja_kenji',
    name: 'Kenji Takahashi',
    avatarUrl: createInitialsAvatarDataUri('Kenji Takahashi', '#dc2626'),
    country: 'Japan',
    flag: '🇯🇵',
    languageCode: 'ja',
    languageName: 'Japanese',
    alsoSpeaks: ['English'],
    cefrRange: 'A1 – B2',
    specialties: ['Grammar & Writing', 'Conversation & Fluency', 'Business & Career'],
    credentials: 'Certified Japanese Language Educator · JLPT N5–N1 Coach',
    yearsExperience: 6,
    rating: 4.98,
    lessonsCompleted: 385,
    availability: 'Today',
    nextAvailableSlots: ['Today · 21:00', 'Tomorrow · 08:30', 'Tomorrow · 19:00'],
    bio: 'Step-by-step Japanese guidance covering natural particles, pitch accent, polite Keigo for work, and everyday Tokyo conversation.',
    lessonFocus: 'Natural particle intuition, Keigo etiquette, and JLPT reading/speaking',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_it_lorenzo',
    name: 'Lorenzo Conti',
    avatarUrl: createInitialsAvatarDataUri('Lorenzo Conti', '#0d9488'),
    country: 'Italy',
    flag: '🇮🇹',
    languageCode: 'it',
    languageName: 'Italian',
    alsoSpeaks: ['English', 'French'],
    cefrRange: 'A1 – C1',
    specialties: ['Conversation & Fluency', 'Grammar & Writing', 'Pronunciation & Accent'],
    credentials: 'DITALS Level II Certified · University for Foreigners of Siena',
    yearsExperience: 7,
    rating: 4.96,
    lessonsCompleted: 310,
    availability: 'Available Now',
    nextAvailableSlots: ['Today · 17:30', 'Tomorrow · 12:30', 'Tomorrow · 18:00'],
    bio: 'Warm, structured Italian sessions designed to get you speaking full sentences from day one while refining congiuntivo andcombined pronouns.',
    lessonFocus: 'Expressive Italian conversation, verb tenses, and CILS preparation',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_zh_meilin',
    name: 'Mei-Lin Zhou',
    avatarUrl: createInitialsAvatarDataUri('Mei-Lin Zhou', '#d97706'),
    country: 'Taiwan',
    flag: '🇨🇳',
    languageCode: 'zh',
    languageName: 'Mandarin',
    alsoSpeaks: ['English'],
    cefrRange: 'A1 – C1',
    specialties: ['Pronunciation & Accent', 'Exam Preparation', 'Business & Career'],
    credentials: 'CTCSOL Certified Mandarin Teacher · HSK 1–6 Specialist',
    yearsExperience: 8,
    rating: 4.98,
    lessonsCompleted: 465,
    availability: 'Today',
    nextAvailableSlots: ['Today · 20:30', 'Tomorrow · 09:00', 'Tomorrow · 16:00'],
    bio: 'Master the four Mandarin tones with visual pitch feedback, build practical sentence patterns fast, and speak confidently in daily or business settings.',
    lessonFocus: 'Tone pair mastery, HSK sentence structures, and practical speaking',
    accessLabel: '₹999 / Month Pass'
  },
  {
    id: 'teacher_pt_rafael',
    name: 'Rafael Nogueira',
    avatarUrl: createInitialsAvatarDataUri('Rafael Nogueira', '#2563eb'),
    country: 'Portugal',
    flag: '🇵🇹',
    languageCode: 'pt',
    languageName: 'Portuguese',
    alsoSpeaks: ['English', 'Spanish'],
    cefrRange: 'A1 – C1',
    specialties: ['Conversation & Fluency', 'Grammar & Writing', 'Pronunciation & Accent'],
    credentials: 'Camões Institute Certified Tutor · Lisbon & São Paulo Registers',
    yearsExperience: 6,
    rating: 4.97,
    lessonsCompleted: 290,
    availability: 'Available Now',
    nextAvailableSlots: ['Today · 16:00', 'Today · 19:00', 'Tomorrow · 15:00'],
    bio: 'Personalized Portuguese coaching covering both European and Brazilian usage, clear rhythm training, and practical conversation.',
    lessonFocus: 'Natural cadence, subjunctive triggers, and everyday fluency',
    accessLabel: '₹999 / Month Pass'
  }
];
