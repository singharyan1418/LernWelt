import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export interface UserProfileDbPreferences {
  nativeLanguage?: string;
  targetLanguageCode?: string;
  cefrLevel?: string;
  targetLanguagesJson?: string;
  bio?: string;
  country?: string;
  timezone?: string;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  prefs?: UserProfileDbPreferences
) {
  try {
    const cleanPrefs: Record<string, any> = {};
    if (prefs?.nativeLanguage) cleanPrefs.nativeLanguage = prefs.nativeLanguage;
    if (prefs?.targetLanguageCode) cleanPrefs.targetLanguageCode = prefs.targetLanguageCode;
    if (prefs?.cefrLevel) cleanPrefs.cefrLevel = prefs.cefrLevel;
    if (prefs?.targetLanguagesJson) cleanPrefs.targetLanguagesJson = prefs.targetLanguagesJson;
    if (prefs?.bio !== undefined) cleanPrefs.bio = prefs.bio;
    if (prefs?.country) cleanPrefs.country = prefs.country;
    if (prefs?.timezone) cleanPrefs.timezone = prefs.timezone;

    const result = await db
      .insert(users)
      .values({
        uid,
        email: email.toLowerCase(),
        displayName: displayName || null,
        ...cleanPrefs,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email.toLowerCase(),
          ...(displayName ? { displayName } : {}),
          ...cleanPrefs,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account. Please try again later.', { cause: error });
  }
}

export async function getUserProfileFromDbByEmail(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.warn('Database user lookup by email failed:', error);
    return null;
  }
}

export async function upsertAppUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string;
  nativeLanguage?: string;
  targetLanguageCode?: string;
  cefrLevel?: string;
  targetLanguagesJson?: string;
  bio?: string;
  country?: string;
  timezone?: string;
}) {
  try {
    return await getOrCreateUser(params.uid, params.email, params.displayName, {
      nativeLanguage: params.nativeLanguage,
      targetLanguageCode: params.targetLanguageCode,
      cefrLevel: params.cefrLevel,
      targetLanguagesJson: params.targetLanguagesJson,
      bio: params.bio,
      country: params.country,
      timezone: params.timezone,
    });
  } catch (error) {
    console.warn('Non-blocking database profile sync warning:', error);
    return null;
  }
}
