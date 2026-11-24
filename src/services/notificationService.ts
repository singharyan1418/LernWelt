import { TeacherLessonBooking, VocabularyWord, PersonalTeacher } from '../types';
import { createInitialsAvatarDataUri } from '../data/teacherData';

export type NotificationCategory = 'all' | 'lesson' | 'vocab' | 'partner';

export interface AppNotification {
  id: string;
  category: 'lesson' | 'vocab' | 'partner';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  priority?: 'high' | 'normal';
  actionLabel?: string;
  actionPayload?: {
    type: 'open-tab' | 'join-room' | 'call-partner' | 'mark-vocab-mastered' | 'direct-call';
    tab?: string;
    roomId?: string;
    partnerId?: string;
    partnerName?: string;
    teacherId?: string;
    vocabId?: string;
    teacherName?: string;
  };
  metadata?: {
    teacherName?: string;
    teacherAvatar?: string;
    slotLabel?: string;
    word?: string;
    translation?: string;
    partnerName?: string;
    partnerAvatar?: string;
    partnerCountry?: string;
    partnerLanguage?: string;
  };
}

export interface PartnerConnectionRequest {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  nativeLanguage: string;
  learningLanguage: string;
  country: string;
  message: string;
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined';
}

export const INITIAL_PARTNER_REQUESTS: PartnerConnectionRequest[] = [
  {
    id: 'req_elena_1',
    partnerId: 'partner_es_1',
    partnerName: 'Elena Morales',
    partnerAvatar: createInitialsAvatarDataUri('Elena Morales', '#e11d48'),
    nativeLanguage: 'Spanish',
    learningLanguage: 'English',
    country: 'Spain',
    message: 'Hola! I saw you are learning Spanish. Would you like to do a 20-min tandem exchange today?',
    createdAt: Date.now() - 1000 * 60 * 35,
    status: 'pending'
  },
  {
    id: 'req_kenji_2',
    partnerId: 'partner_ja_1',
    partnerName: 'Kenji Takahashi',
    partnerAvatar: createInitialsAvatarDataUri('Kenji Takahashi', '#0d9488'),
    nativeLanguage: 'Japanese',
    learningLanguage: 'German',
    country: 'Japan',
    message: 'Hi Alex! Looking for a conversation partner for everyday conversation and Keigo practice.',
    createdAt: Date.now() - 1000 * 60 * 120,
    status: 'pending'
  }
];

/**
 * Derives notification items from teacher bookings
 */
export function deriveUpcomingLessonNotifications(
  bookings: TeacherLessonBooking[],
  teachers: PersonalTeacher[]
): AppNotification[] {
  const active = bookings.filter((b) => b.status === 'confirmed');

  return active.map((booking) => {
    const teacher = teachers.find((t) => t.id === booking.teacherId);
    const teacherName = booking.teacherName || teacher?.name || 'Your Personal Teacher';

    return {
      id: `notif_lesson_${booking.id}`,
      category: 'lesson',
      title: `Upcoming Lesson with ${teacherName}`,
      description: `${booking.slotLabel} · Focus: ${booking.focusArea || '1-on-1 Practice'}. Prepare your questions!`,
      timestamp: booking.slotLabel.includes('Today') ? 'Today' : 'Upcoming',
      isRead: false,
      priority: 'high',
      actionLabel: 'Join Lesson Room',
      actionPayload: {
        type: 'join-room',
        roomId: booking.roomId || `teacher_room_${booking.teacherId}`,
        teacherId: booking.teacherId,
        teacherName
      },
      metadata: {
        teacherName,
        teacherAvatar: booking.teacherAvatar || teacher?.avatarUrl,
        slotLabel: booking.slotLabel
      }
    };
  });
}

/**
 * Derives notifications for vocabulary review due
 */
export function deriveVocabReviewNotifications(
  vocabulary: VocabularyWord[]
): AppNotification[] {
  const needsReview = vocabulary.filter((w) => !w.mastered);
  if (needsReview.length === 0) return [];

  const topDue = needsReview.slice(0, 3);
  const notifications: AppNotification[] = [];

  // Summary reminder
  notifications.push({
    id: 'notif_vocab_due_summary',
    category: 'vocab',
    title: `${needsReview.length} Vocabulary Words Due for Review`,
    description: `Strengthen recall with spaced repetition for "${topDue[0].word}" and ${needsReview.length - 1} other words.`,
    timestamp: 'Today',
    isRead: false,
    priority: needsReview.length >= 5 ? 'high' : 'normal',
    actionLabel: 'Review Vocabulary Bank',
    actionPayload: {
      type: 'open-tab',
      tab: 'vocab-deck'
    }
  });

  // Individual highlight for the top tricky word
  if (topDue.length > 0) {
    const word = topDue[0];
    notifications.push({
      id: `notif_vocab_word_${word.id}`,
      category: 'vocab',
      title: `Daily Word Recall: "${word.word}"`,
      description: `${word.translation} (${word.language} · ${word.cefrLevel || 'B1'}). Test your memory!`,
      timestamp: 'Spaced Repetition',
      isRead: false,
      priority: 'normal',
      actionLabel: 'Open in Vocab Deck',
      actionPayload: {
        type: 'open-tab',
        tab: 'vocab-deck',
        vocabId: word.id
      },
      metadata: {
        word: word.word,
        translation: word.translation
      }
    });
  }

  return notifications;
}

/**
 * Derives notifications for partner connection requests
 */
export function derivePartnerRequestNotifications(
  requests: PartnerConnectionRequest[]
): AppNotification[] {
  return requests
    .filter((r) => r.status === 'pending')
    .map((req) => ({
      id: `notif_partner_${req.id}`,
      category: 'partner',
      title: `Partner Request: ${req.partnerName}`,
      description: `${req.nativeLanguage} Native (${req.country}) · "${req.message}"`,
      timestamp: formatRelativeTime(req.createdAt),
      isRead: false,
      priority: 'high',
      actionLabel: 'Accept & Call',
      actionPayload: {
        type: 'call-partner',
        partnerId: req.partnerId,
        tab: 'chat-room'
      },
      metadata: {
        partnerName: req.partnerName,
        partnerAvatar: req.partnerAvatar,
        partnerCountry: req.country,
        partnerLanguage: req.nativeLanguage
      }
    }));
}

export function aggregateAllNotifications(
  bookings: TeacherLessonBooking[],
  teachers: PersonalTeacher[],
  vocabulary: VocabularyWord[],
  partnerRequests: PartnerConnectionRequest[],
  readIds: Set<string>,
  dismissedIds: Set<string>
): AppNotification[] {
  const lessonNotifs = deriveUpcomingLessonNotifications(bookings, teachers);
  const vocabNotifs = deriveVocabReviewNotifications(vocabulary);
  const partnerNotifs = derivePartnerRequestNotifications(partnerRequests);

  const combined = [...partnerNotifs, ...lessonNotifs, ...vocabNotifs];

  return combined
    .filter((n) => !dismissedIds.has(n.id))
    .map((n) => ({
      ...n,
      isRead: readIds.has(n.id) || n.isRead
    }));
}

export function filterNotificationsByCategory(
  notifications: AppNotification[],
  category: NotificationCategory
): AppNotification[] {
  if (category === 'all') return notifications;
  return notifications.filter((n) => n.category === category);
}

export function countUnreadNotifications(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
