import type { Db } from '../db/client';
import { hashToken } from './crypto';
import { deleteSessionByHash, getSessionByHash, touchSession } from './repo';

export const SESSION_COOKIE_NAME = 'beacon_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CurrentUser {
	id: number;
	email: string;
}

export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
	const result: Record<string, string> = {};
	if (!header) {
		return result;
	}
	for (const part of header.split(';')) {
		const [rawName, ...rawValue] = part.trim().split('=');
		if (!rawName) continue;
		result[rawName] = decodeURIComponent(rawValue.join('='));
	}
	return result;
}

export function createSessionCookie(token: string, expiresAt: number): string {
	return [
		`${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
		'Path=/',
		`Expires=${new Date(expiresAt).toUTCString()}`,
		'HttpOnly',
		'Secure',
		'SameSite=Lax',
	].join('; ');
}

export function clearSessionCookie(): string {
	return [
		`${SESSION_COOKIE_NAME}=`,
		'Path=/',
		'Max-Age=0',
		'HttpOnly',
		'Secure',
		'SameSite=Lax',
	].join('; ');
}

export async function getCurrentUser(
	db: Db,
	cookieHeader: string | null | undefined,
	now = Date.now(),
): Promise<CurrentUser | null> {
	const token = parseCookieHeader(cookieHeader)[SESSION_COOKIE_NAME];
	if (!token) {
		return null;
	}
	const tokenHash = await hashToken(token);
	const row = await getSessionByHash(db, tokenHash);
	if (!row || row.expires_at <= now) {
		await deleteSessionByHash(db, tokenHash);
		return null;
	}
	await touchSession(db, tokenHash, now);
	return { id: row.user_id, email: row.email };
}
