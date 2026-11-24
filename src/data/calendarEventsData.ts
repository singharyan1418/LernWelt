import { CalendarEvent } from '../types';
import { createInitialsAvatarDataUri } from './teacherData';

export const STORAGE_KEY_EVENTS = 'lernwelt_calendar_events_v2';

export function formatDateKey(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeKey(timeStr: string): string {
  return timeStr || '12:00';
}

const today = new Date();
const todayKey = formatDateKey(today);

const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);
const tomorrowKey = formatDateKey(tomorrow);

const inTwoDays = new Date();
inTwoDays.setDate(today.getDate() + 2);
const inTwoDaysKey = formatDateKey(inTwoDays);

const inFiveDays = new Date();
inFiveDays.setDate(today.getDate() + 5);
const inFiveDaysKey = formatDateKey(inFiveDays);

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal-ev-1',
    title: 'Daily German Stammtisch & Coffee Chat',
    description: 'Casual German conversation practice focusing on daily routines, work culture, and current events. Suitable for B1 and above.',
    languageCode: 'de',
    languageName: 'German',
    flag: '🇩🇪',
    category: 'speaking-club',
    cefrLevel: 'B1',
    date: todayKey,
    startTime: '17:00',
    endTime: '18:00',
    durationMinutes: 60,
    hostName: 'Alex Rivera',
    hostAvatar: createInitialsAvatarDataUri('Alex Rivera', '#1d4ed8'),
    hostIsNative: false,
    maxAttendees: 8,
    attendeesCount: 5,
    isUserAttending: true,
    isUserHost: true,
    roomId: 'de-cafe-chat-1',
    topics: ['Daily Routine', 'German Idioms', 'Work Life'],
    colorTheme: 'indigo',
    reminderSet: true,
    meetingUrl: 'https://lernwelt.app/room/de-cafe-chat-1'
  },
  {
    id: 'cal-ev-2',
    title: 'Spanish Subjunctive Deep Dive Masterclass',
    description: 'Master the tricky Spanish subjunctive mood through practical dialogues, interactive sentence building, and immediate feedback.',
    languageCode: 'es',
    languageName: 'Spanish',
    flag: '🇪🇸',
    category: 'grammar-workshop',
    cefrLevel: 'B2',
    date: tomorrowKey,
    startTime: '19:30',
    endTime: '20:30',
    durationMinutes: 60,
    hostName: 'Sofia Martinez',
    hostAvatar: createInitialsAvatarDataUri('Sofia Martinez', '#0f766e'),
    hostIsNative: true,
    maxAttendees: 10,
    attendeesCount: 7,
    isUserAttending: true,
    isUserHost: false,
    roomId: 'es-subjunctive-lab',
    topics: ['Subjunctive Mood', 'Expressing Wishes', 'Common Pitfalls'],
    colorTheme: 'emerald',
    reminderSet: false,
    meetingUrl: 'https://lernwelt.app/room/es-subjunctive-lab'
  },
  {
    id: 'cal-ev-3',
    title: 'Japanese Kanji & Pronunciation Clinic',
    description: 'Interactive clinic breaking down JLPT N4-N3 kanji compounds, pitch accent fundamentals, and natural conversational cadence.',
    languageCode: 'ja',
    languageName: 'Japanese',
    flag: '🇯🇵',
    category: 'speaking-club',
    cefrLevel: 'A2',
    date: inTwoDaysKey,
    startTime: '14:00',
    endTime: '15:00',
    durationMinutes: 60,
    hostName: 'Kenji Takahashi',
    hostAvatar: createInitialsAvatarDataUri('Kenji Takahashi', '#b91c1c'),
    hostIsNative: true,
    maxAttendees: 6,
    attendeesCount: 4,
    isUserAttending: false,
    isUserHost: false,
    roomId: 'ja-pitch-clinic',
    topics: ['Pitch Accent', 'Daily Kanji', 'Honorific Basics'],
    colorTheme: 'rose',
    reminderSet: false,
    meetingUrl: 'https://lernwelt.app/room/ja-pitch-clinic'
  },
  {
    id: 'cal-ev-4',
    title: 'French Cinema & Cultural Critique Session',
    description: 'Analyzing French New Wave cinema excerpts with focus on nuanced descriptive vocabulary and colloquial debates.',
    languageCode: 'fr',
    languageName: 'French',
    flag: '🇫🇷',
    category: 'cultural-night',
    cefrLevel: 'B1',
    date: inFiveDaysKey,
    startTime: '18:00',
    endTime: '19:15',
    durationMinutes: 75,
    hostName: 'Alex Rivera',
    hostAvatar: createInitialsAvatarDataUri('Alex Rivera', '#1d4ed8'),
    hostIsNative: false,
    maxAttendees: 12,
    attendeesCount: 9,
    isUserAttending: true,
    isUserHost: true,
    roomId: 'fr-cinema-circle',
    topics: ['Film Analysis', 'Art Critique', 'French Slang (Verlan)'],
    colorTheme: 'purple',
    reminderSet: true,
    meetingUrl: 'https://lernwelt.app/room/fr-cinema-circle'
  }
];

export function getStoredCalendarEvents(): CalendarEvent[] {
  if (typeof window === 'undefined') {
    return INITIAL_CALENDAR_EVENTS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(INITIAL_CALENDAR_EVENTS));
      return INITIAL_CALENDAR_EVENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_CALENDAR_EVENTS;
  } catch {
    return INITIAL_CALENDAR_EVENTS;
  }
}

export function saveStoredCalendarEvents(events: CalendarEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  } catch (err) {
    console.warn('Failed to save calendar events to localStorage:', err);
  }
}

export function createGoogleCalendarUrl(event: CalendarEvent): string {
  const startDateTime = event.date.replace(/-/g, '') + 'T' + event.startTime.replace(':', '') + '00Z';
  const endDateTime = event.date.replace(/-/g, '') + 'T' + event.endTime.replace(':', '') + '00Z';
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(`${event.description}\n\nLanguage: ${event.languageName} (${event.cefrLevel})\nRoom: ${event.meetingUrl || event.roomId || 'Online'}`);
  const location = encodeURIComponent(event.meetingUrl || 'Lernwelt Interactive Room');
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateTime}/${endDateTime}&details=${details}&location=${location}`;
}

export function downloadIcsFile(event: CalendarEvent): void {
  const dtStart = event.date.replace(/-/g, '') + 'T' + event.startTime.replace(':', '') + '00';
  const dtEnd = event.date.replace(/-/g, '') + 'T' + event.endTime.replace(':', '') + '00';
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lernwelt Language Exchange//Practice Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:lernwelt-${event.id}@lernwelt.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')} - Language: ${event.languageName}`,
    `LOCATION:${event.meetingUrl || 'Lernwelt Live Room'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${event.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
