import { boolean, date, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'author'])
export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived'])

export const categories = pgTable('categories', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  description: text(),
  isActive: boolean().default(true),
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  name: text().notNull(),
  avatar: text(),
  role: userRoleEnum().default('author'),
  isActive: boolean().default(true),
  bio: text(),
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const posts = pgTable('posts', {
  id: serial().primaryKey(),
  title: text().notNull(),
  slug: text().notNull().unique(),
  excerpt: text(),
  content: text(),
  featuredImage: text(),
  status: postStatusEnum().default('draft'),
  views: integer().default(0),
  isCommentsEnabled: boolean().default(true),
  publishedAt: date({ mode: 'date' }),
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  authorId: integer().notNull().references(() => users.id),
  categoryId: integer().references(() => categories.id),
})

export const tags = pgTable('tags', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  color: text().default('#6366f1'),
})

export const postsToTags = pgTable('posts_to_tags', {
  postId: integer().notNull().references(() => posts.id),
  tagId: integer().notNull().references(() => tags.id),
})
