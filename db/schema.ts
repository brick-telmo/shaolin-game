import {sqliteTable, text, integer, index} from 'drizzle-orm/sqlite-core';
export const players = sqliteTable('online_players', {
  id: text('id').primaryKey(), client: text('client').notNull(),
  form: text('form').notNull(), status: text('status').notNull(),
  matchId: text('match_id'), protocol: text('protocol').notNull(),
  joined: integer('joined').notNull(), seen: integer('seen').notNull()
}, table => [index('online_queue').on(table.status, table.protocol, table.joined)]);
export const matches = sqliteTable('online_matches', {
  id: text('id').primaryKey(), p0: text('p0').notNull(), p1: text('p1').notNull(),
  state: text('state').notNull(), version: integer('version').notNull().default(0),
  updated: integer('updated').notNull()
}, table => [index('online_match_age').on(table.updated)]);
