import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: integer({ mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  role: text('role', { enum: ['admin', 'editor', 'author'] }).default('author'),
  isActive: integer({ mode: 'boolean' }).default(true),
  bio: text('bio'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content'),
  featuredImage: text('featured_image'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).default('draft'),
  views: integer('views').default(0),
  isCommentsEnabled: integer({ mode: 'boolean' }).default(true),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  authorId: integer('author_id').notNull().references(() => users.id),
  categoryId: integer('category_id').references(() => categories.id),
})

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#6366f1'),
})

export const postsToTags = sqliteTable('posts_to_tags', {
  postId: integer('post_id').notNull().references(() => posts.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
})
