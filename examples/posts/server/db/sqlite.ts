import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  description: text(),
  isActive: integer({ mode: 'boolean' }).default(true),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text().notNull(),
  avatar: text(),
  role: text({ enum: ['admin', 'editor', 'author'] }).default('author'),
  isActive: integer({ mode: 'boolean' }).default(true),
  bio: text(),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const posts = sqliteTable('posts', {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  slug: text().notNull().unique(),
  excerpt: text(),
  content: text(),
  featuredImage: text(),
  status: text({ enum: ['draft', 'published', 'archived'] }).default('draft'),
  views: integer().default(0),
  isCommentsEnabled: integer({ mode: 'boolean' }).default(true),
  publishedAt: integer({ mode: 'timestamp' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  authorId: integer().notNull().references(() => users.id),
  categoryId: integer().references(() => categories.id),
})

export const tags = sqliteTable('tags', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  color: text().default('#6366f1'),
})

export const postsToTags = sqliteTable('posts_to_tags', {
  postId: integer().notNull().references(() => posts.id),
  tagId: integer().notNull().references(() => tags.id),
})
