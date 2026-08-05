ALTER TABLE `categories` ADD `parent_id` integer REFERENCES categories(id);
