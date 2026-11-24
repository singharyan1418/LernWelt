import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { studyTasks, users } from './schema.ts';

export interface CreateStudyTaskInput {
  userId: number;
  googleTaskId?: string | null;
  googleTaskListId?: string | null;
  title: string;
  notes?: string | null;
  targetLanguage?: string | null;
  dueDate?: string | null;
  status?: 'needsAction' | 'completed';
  syncedToGoogle?: boolean;
}

export interface UpdateStudyTaskInput {
  title?: string;
  notes?: string | null;
  targetLanguage?: string | null;
  dueDate?: string | null;
  status?: 'needsAction' | 'completed';
  googleTaskId?: string | null;
  googleTaskListId?: string | null;
  syncedToGoogle?: boolean;
}

export async function listStudyTasksByUid(uid: string) {
  try {
    return await db
      .select({
        id: studyTasks.id,
        userId: studyTasks.userId,
        googleTaskId: studyTasks.googleTaskId,
        googleTaskListId: studyTasks.googleTaskListId,
        title: studyTasks.title,
        notes: studyTasks.notes,
        targetLanguage: studyTasks.targetLanguage,
        dueDate: studyTasks.dueDate,
        status: studyTasks.status,
        syncedToGoogle: studyTasks.syncedToGoogle,
        createdAt: studyTasks.createdAt,
        updatedAt: studyTasks.updatedAt,
      })
      .from(studyTasks)
      .innerJoin(users, eq(studyTasks.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(studyTasks.createdAt));
  } catch (error) {
    console.error('Database query failed listing study tasks:', error);
    throw new Error('Failed to retrieve study tasks. Please try again later.', { cause: error });
  }
}

export async function createStudyTask(input: CreateStudyTaskInput) {
  try {
    const inserted = await db
      .insert(studyTasks)
      .values({
        userId: input.userId,
        googleTaskId: input.googleTaskId ?? null,
        googleTaskListId: input.googleTaskListId ?? null,
        title: input.title,
        notes: input.notes ?? null,
        targetLanguage: input.targetLanguage ?? null,
        dueDate: input.dueDate ?? null,
        status: input.status ?? 'needsAction',
        syncedToGoogle: input.syncedToGoogle ?? false,
        updatedAt: new Date(),
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database insert failed creating study task:', error);
    throw new Error('Failed to save study task. Please try again later.', { cause: error });
  }
}

export async function updateStudyTaskForUser(
  taskId: number,
  userId: number,
  updates: UpdateStudyTaskInput
) {
  try {
    const updated = await db
      .update(studyTasks)
      .set({
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        ...(updates.targetLanguage !== undefined ? { targetLanguage: updates.targetLanguage } : {}),
        ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.googleTaskId !== undefined ? { googleTaskId: updates.googleTaskId } : {}),
        ...(updates.googleTaskListId !== undefined
          ? { googleTaskListId: updates.googleTaskListId }
          : {}),
        ...(updates.syncedToGoogle !== undefined ? { syncedToGoogle: updates.syncedToGoogle } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
      .returning();

    return updated[0] || null;
  } catch (error) {
    console.error('Database update failed for study task:', error);
    throw new Error('Failed to update study task. Please try again later.', { cause: error });
  }
}

export async function deleteStudyTaskForUser(taskId: number, userId: number) {
  try {
    const deleted = await db
      .delete(studyTasks)
      .where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
      .returning();

    return deleted[0] || null;
  } catch (error) {
    console.error('Database delete failed for study task:', error);
    throw new Error('Failed to delete study task. Please try again later.', { cause: error });
  }
}
