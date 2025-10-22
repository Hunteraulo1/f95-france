import { sql } from 'drizzle-orm';
import { datetime, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const user = mysqlTable('user', {
	id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
	username: varchar('username', { length: 32 }).notNull().unique(),
  avatar: varchar('avatar', { length: 255 }).notNull(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull().default('user'),
  theme: varchar('theme', { length: 255 }).notNull().default('light'),
  devUserId: varchar('dev_user_id', { length: 255 }),
  gameAdd: int('game_add').notNull().default(0),
  gameEdit: int('game_edit').notNull().default(0),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const session = mysqlTable('session', {
	id: varchar('id', { length: 255 }).primaryKey(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	expiresAt: datetime('expires_at').notNull()
});

export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
