CREATE TABLE `autoadmin_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
	`action` text NOT NULL,
	`model_key` text NOT NULL,
	`lookup_value` text,
	`actor_id` text,
	`actor_role` text,
	`actor_label` text,
	`changes` text,
	`meta` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "name", "description", "is_active", "created_at") SELECT "id", "name", "description", "is_active", "created_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`excerpt` text,
	`content` text,
	`featured_image` text,
	`status` text DEFAULT 'draft',
	`views` integer DEFAULT 0,
	`is_comments_enabled` integer DEFAULT true,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
	`author_id` integer NOT NULL,
	`category_id` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_posts`("id", "title", "slug", "excerpt", "content", "featured_image", "status", "views", "is_comments_enabled", "published_at", "created_at", "updated_at", "author_id", "category_id") SELECT "id", "title", "slug", "excerpt", "content", "featured_image", "status", "views", "is_comments_enabled", "published_at", "created_at", "updated_at", "author_id", "category_id" FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1'
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "name", "color") SELECT "id", "name", "color" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`role` text DEFAULT 'author',
	`is_active` integer DEFAULT true,
	`bio` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "avatar", "role", "is_active", "bio", "created_at") SELECT "id", "email", "name", "avatar", "role", "is_active", "bio", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);