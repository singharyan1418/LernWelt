import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  nativeLanguage: text('native_language'),
  targetLanguageCode: text('target_language_code'),
  cefrLevel: text('cefr_level'),
  targetLanguagesJson: text('target_languages_json'),
  bio: text('bio'),
  country: text('country'),
  timezone: text('timezone'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const studyTasks = pgTable('study_tasks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  googleTaskId: text('google_task_id'),
  googleTaskListId: text('google_task_list_id'),
  title: text('title').notNull(),
  notes: text('notes'),
  targetLanguage: text('target_language'),
  dueDate: text('due_date'),
  status: text('status').notNull().default('needsAction'),
  syncedToGoogle: boolean('synced_to_google').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  studyTasks: many(studyTasks),
}));

export const studyTasksRelations = relations(studyTasks, ({ one }) => ({
  author: one(users, {
    fields: [studyTasks.userId],
    references: [users.id],
  }),
}));
