import type { Db } from '../db/client';

export interface UserRow extends Record<string, unknown> {
	id: number;
	email: string;
	created_at: number;
	last_login_at: number | null;
}

export interface MagicLinkRow extends Record<string, unknown> {
	id: number;
	email: string;
	token_hash: string;
	expires_at: number;
	used_at: number | null;
	created_at: number;
}

export interface SessionWithUserRow extends Record<string, unknown> {
	id: number;
	user_id: number;
	email: string;
	token_hash: string;
	expires_at: number;
	created_at: number;
	last_seen_at: number | null;
}

export async function insertMagicLink(
	db: Db,
	input: { email: string; tokenHash: string; expiresAt: number; createdAt: number },
): Promise<void> {
	await db.run(
		`INSERT INTO auth_magic_links (email, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
		input.email,
		input.tokenHash,
		input.expiresAt,
		input.createdAt,
	);
}

export async function getMagicLinkByHash(
	db: Db,
	tokenHash: string,
): Promise<MagicLinkRow | null> {
	return db.first<MagicLinkRow>(
		`SELECT * FROM auth_magic_links WHERE token_hash = ? LIMIT 1`,
		tokenHash,
	);
}

export async function markMagicLinkUsed(
	db: Db,
	input: { tokenHash: string; usedAt: number },
): Promise<boolean> {
	const result = await db.run(
		`UPDATE auth_magic_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL`,
		input.usedAt,
		input.tokenHash,
	);
	return (result.meta.changes ?? 0) > 0;
}

export async function upsertUserByEmail(
	db: Db,
	input: { email: string; now: number },
): Promise<UserRow> {
	await db.run(
		`INSERT INTO users (email, created_at, last_login_at)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET last_login_at = excluded.last_login_at`,
		input.email,
		input.now,
		input.now,
	);
	const user = await db.first<UserRow>(`SELECT * FROM users WHERE email = ? LIMIT 1`, input.email);
	if (!user) {
		throw new Error('User upsert failed');
	}
	return user;
}

export async function insertSession(
	db: Db,
	input: { userId: number; tokenHash: string; expiresAt: number; createdAt: number },
): Promise<void> {
	await db.run(
		`INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
		input.userId,
		input.tokenHash,
		input.expiresAt,
		input.createdAt,
		input.createdAt,
	);
}

export async function getSessionByHash(
	db: Db,
	tokenHash: string,
): Promise<SessionWithUserRow | null> {
	return db.first<SessionWithUserRow>(
		`SELECT s.*, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
     LIMIT 1`,
		tokenHash,
	);
}

export async function touchSession(db: Db, tokenHash: string, lastSeenAt: number): Promise<void> {
	await db.run(
		`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?`,
		lastSeenAt,
		tokenHash,
	);
}

export async function deleteSessionByHash(db: Db, tokenHash: string): Promise<void> {
	await db.run(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash);
}
