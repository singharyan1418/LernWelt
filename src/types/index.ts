export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  popularTopics: string[];
}

export type RoomDirectoryKind =
  | 'builtin'
  | 'create-room'
  | 'personal'
  | 'instant-call'
  | 'random-verified'
  | 'direct-call'
  | 'teacher-classroom'
  | 'adhoc-code';

export interface LanguageRoom {
  id: string;
  languageCode: string;
  languageName: string;
  flag: string;
  title: string;
  subtitle: string;
  currentTopic: string;
  host: LanguagePartner;
  activeLearnersCount: number;
  activeNativesCount: number;
  levelRange: string;
  welcomeMessage: string;
  suggestedPhrases: string[];
  roomKind?: RoomDirectoryKind;
}

export type MediaJoinMode = 'not-started' | 'audio-only' | 'video-and-audio' | 'text-only';

export interface StreakDayRecord {
  date: string;
  dayName: string;
  completed: boolean;
  xpEarned: number;
  minutesPracticed: number;
}

export interface StreakMilestone {
  days: number;
  title: string;
  reward: string;
  icon: string;
  unlocked: boolean;
}

export interface UserStreak {
  streakDays: number;
  bestStreak: number;
  lastCheckInDate: string;
  todayCompleted: boolean;
  streakFreezesAvailable: number;
  streakFreezesUsed: number;
  currentMultiplier: string;
  totalXp: number;
  todayMinutes: number;
  todaySeconds?: number;
  dailyGoalMinutes: number;
  todayDrillsCompleted?: number;
  dailyDrillGoal?: number;
  dailyBadgeUnlocked?: boolean;
  weeklyHistory: StreakDayRecord[];
  milestones: StreakMilestone[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  nativeLanguage: string;
  targetLanguages: {
    language: string;
    level: CEFRLevel;
    goal: string;
  }[];
  bio: string;
  country: string;
  timezone: string;
  interests: string[];
  streakDays: number;
  streak?: UserStreak;
  totalPracticeMinutes: number;
  totalPracticeSeconds?: number;
  wordsLearned: number;
  correctionsReceived: number;
  statsSource?: 'real';
  isOnline: boolean;
  cameraReady: boolean;
  isVerified?: boolean;
  verifiedId?: string;
  verifiedAt?: number;
}

export interface LanguagePartner {
  id: string;
  name: string;
  avatarUrl: string;
  country: string;
  countryCode: string;
  nativeLanguage: string;
  learningLanguage: string;
  learningLevel: CEFRLevel;
  rating: number;
  reviewCount: number;
  sessionsCompleted: number;
  isOnline: boolean;
  interests: string[];
  bio: string;
  availability: 'Available Now' | 'In 15 mins' | 'Later Today';
  verifiedNative: boolean;
}

export interface MistakeDetail {
  wrongPart: string;
  suggestion: string;
  type: 'grammar' | 'spelling' | 'vocabulary' | 'word-order' | 'preposition' | 'tone';
  explanation: string;
  ruleReference?: string;
}

export interface BetterWordSuggestion {
  originalWord: string;
  betterWord: string;
  formality: 'casual' | 'standard' | 'advanced / C1-C2' | 'idiomatic';
  whyBetter: string;
  exampleSentence: string;
}

export interface CorrectionResult {
  id: string;
  originalText: string;
  correctedText: string;
  targetLanguage: string;
  hasErrors: boolean;
  overallFeedback: string;
  mistakes: MistakeDetail[];
  betterWords: BetterWordSuggestion[];
  cefrLevelEstimated: CEFRLevel;
  nativeNuanceTip: string;
  timestamp: number;
}

export interface ChatReplyContext {
  id: string;
  senderName: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  senderId?: string;
  sender?: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: number | string;
  isSelf?: boolean;
  isDirect?: boolean;
  targetPeerId?: string;
  correction?: CorrectionResult;
  replyTo?: ChatReplyContext;
  isAnalyzing?: boolean;
}

export interface RoleplayScenario {
  id: string;
  title: string;
  category?: string;
  description: string;
  userRole: string;
  partnerRole: string;
  suggestedOpening?: string;
  goal?: string;
  cefrLevel?: CEFRLevel;
  level?: CEFRLevel | string;
  language?: string;
  vocabularyTips?: string[];
  keyPhrases?: string[];
  suggestedQuestions?: string[];
}

export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  language: string;
  level?: CEFRLevel;
  cefrLevel?: CEFRLevel;
  tags?: string[];
  contextSentence: string;
  notes?: string;
  mastered: boolean;
  savedAt?: number;
  nextReviewDate?: number | string;
}

export type DrillType = 'fill-blank' | 'sentence-ordering' | 'guess-missing-word' | 'vocab-match';

export interface PracticeDrill {
  id: string;
  type: DrillType;
  language: string;
  level: CEFRLevel;
  instruction: string;
  prompt: string;
  options?: string[];
  correctAnswer: string | string[];
  orderedTokens?: string[];
  scrambledTokens?: string[];
  wordClue?: string;
  hint: string;
  grammarExplanation: string;
  translation: string;
  groundedByGoogle?: boolean;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceFact?: string;
}

export interface PronunciationTarget {
  id: string;
  phrase: string;
  translation: string;
  language: string;
  level: CEFRLevel;
  phoneticIpa: string;
  audioGuideUrl?: string;
  difficultSounds: string[];
  tip: string;
}

export interface WordPronunciationFeedback {
  word: string;
  score: number;
  status: 'excellent' | 'acceptable' | 'needs-work';
  phoneticNote?: string;
}

export interface PronunciationResult {
  accuracyScore: number;
  fluencyScore: number;
  overallAssessment: string;
  words: WordPronunciationFeedback[];
  detectedText?: string;
  phoneticAnalysis: string;
  mouthPositionTip: string;
  intonationFeedback: string;
}

export type ActiveTab =
  | 'chat-room'
  | 'random-connect'
  | 'ai-coach'
  | 'teachers'
  | 'ai-drills'
  | 'grammar-lab'
  | 'language-lab'
  | 'vocab-deck'
  | 'events-calendar'
  | 'events-games'
  | 'gmail'
  | 'tasks'
  | 'classroom'
  | 'profile';

export type TeacherSpecialty =
  | 'Conversation & Fluency'
  | 'Grammar & Writing'
  | 'Exam Preparation'
  | 'Business & Career'
  | 'Pronunciation & Accent';

export interface PersonalTeacher {
  id: string;
  name: string;
  avatarUrl: string;
  country: string;
  flag: string;
  languageCode: string;
  languageName: string;
  alsoSpeaks: string[];
  cefrRange: string;
  specialties: TeacherSpecialty[];
  credentials: string;
  yearsExperience: number;
  rating: number;
  lessonsCompleted: number;
  availability: 'Available Now' | 'Today' | 'This Week';
  nextAvailableSlots: string[];
  bio: string;
  lessonFocus: string;
  accessLabel: string;
  isCommunityTeacher?: boolean;
}

export interface TeacherLessonBooking {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar: string;
  languageCode: string;
  languageName: string;
  flag: string;
  studentId: string;
  studentName: string;
  slotLabel: string;
  learningGoal: string;
  focusArea: TeacherSpecialty;
  roomId: string;
  status: 'confirmed' | 'cancelled';
  createdAt: number;
}

export type TeacherPaymentMethod = 'upi' | 'card' | 'netbanking';

export interface TeacherAccessPass {
  id: string;
  userId: string;
  teacherId: string;
  teacherName?: string;
  userName?: string;
  userEmail?: string;
  amountInr: number;
  currency: 'INR';
  paymentMethod: TeacherPaymentMethod;
  paymentSummary: string;
  paidAt: number;
  expiresAt: number;
}

export interface TeacherAccessStatus {
  hasActiveAccess: boolean;
  isExpired: boolean;
  amountInr: number;
  teacherId: string | null;
  paidAt: number | null;
  expiresAt: number | null;
  remainingDays: number;
  pass: TeacherAccessPass | null;
}

export type EventCategory = 
  | 'speaking-club'
  | '1-on-1-exchange'
  | 'grammar-workshop'
  | 'cultural-night'
  | 'exam-prep'
  | 'trivia-games'
  | 'Conversation Club'
  | 'Grammar Workshop'
  | 'Pronunciation Clinic'
  | 'Cultural Exchange';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  languageCode: string;
  languageName: string;
  flag: string;
  category: EventCategory;
  cefrLevel: CEFRLevel | 'All Levels';
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  hostName: string;
  hostAvatar: string;
  hostIsNative: boolean;
  maxAttendees: number;
  attendeesCount: number;
  isUserAttending?: boolean;
  isUserHost?: boolean;
  roomId?: string;
  topics: string[];
  colorTheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
  reminderSet?: boolean;
  meetingUrl?: string;
}
