# AutoAdmin Documentation

AutoAdmin automatically creates admin interfaces from Drizzle ORM models in your Nuxt project. Currently, SQLite (and variants like Cloudflare D1) is supported. PostgreSQL and MySQL/MariaDB support is coming soon.

*Requirements: A Nuxt Project with Drizzle configured with a SQLite Schema*

## Installation

Configure `NUXT_DATABASE_URL` environment variable with your database connection url.

Use autoadmin as a layer in your nuxt project. You can add the following to your nuxt.config.ts

```ts
export default defineNuxtConfig({
  extends: [
    ['github:awecode/autoadmin', { install: true }],
  ],
})
```

Or you can download the project inside layers directory in your nuxt project.

```bash
npx -y giget gh:awecode/autoadmin layers/autoadmin
rm -rf layers/autoadmin/examples
npx -y nypm add @awecode/autoadmin@file:layers/autoadmin
npx -y nypm install
```

## Usage

<!-- AutoAdmin uses Nuxt UI. Make sure you wrap your pages with Nuxt UI's [`<UApp>`](https://ui.nuxt.com/components/app) component in `app.vue` or your layout file. -->

Here is an example schema for SQLite demonstrating various column types.

```ts
// server/db/schema.ts
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// An enum-like definition for the 'status' column
export const postStatusEnum = ['Draft', 'Published', 'Archived'] as const

export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull().unique(),
})

export const posts = sqliteTable('posts', {
  id: integer().primaryKey({ autoIncrement: true }),
  // Text field
  title: text().notNull(),
  content: text(),
  featuredImage: text(),
  attachment: text(),
  // Number field
  views: integer().default(0),
  // Boolean field
  isPublished: integer({ mode: 'boolean' }).default(false),
  // Date field (as timestamp for sqlite)
  publishedOn: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  // Datetime field (as timestamp_ms for sqlite)
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  // Enum field
  status: text({ enum: postStatusEnum }).default('Draft'),
  // Foreign key relationship
  authorId: integer().references(() => users.id),
})
```

Register your Drizzle schemas in a Nuxt plugin.

```ts
// plugins/admin.server.ts
import { posts, users } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()
  registry.register(users)
  registry.register(posts)
})
```

Run the project and open `/admin` to access the admin interfaces for users and posts tables.

## Specifying Custom Field Types

While AutoAdmin infers types from your Drizzle schema, you can override them for more control over the UI. For example, you may want to change a text field to a textarea, a rich-text editor, or an image uploader. Use the fields option during registration.

```ts
// plugins/admin.server.ts
import { posts, users } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()
  registry.register(users)

  registry.register(posts, {
    fields: [
      {
        name: 'content',
        type: 'rich-text',
      },
      {
        name: 'featuredImage',
        type: 'image',
      },
      {
        name: 'attachment',
        type: 'file',
      },
      // other fields will be auto-inferred
    ]
  })
})
```

## Table/Model Registration Options

This is the main configuration object passed to `registry.register(model, options)`. All options are optional.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `label` | `string` | Table name | Display name for the model (e.g., in the sidebar). |
| `key` | `string` | tableName | Unique identifier for the model. Used in URLs and API endpoints. Pass if you have two models with the same table name. |
| `icon` | `string` | `undefined` | Iconify icon name. Auto-detected for common names. |
| `labelColumnName` | `string` | `name`, `title`, etc. | Column used for display labels in relationships and select options. |
| `lookupColumnName` | `string` | `id` | The primary or unique key used to fetch single records. |
| `slugFields` | `Record<string, string[]>` | `undefined` | Auto-generate URL-friendly slugs from other fields. [Reference ↗](#automatic-slug-generation-slugfields) |
| `warnOnUnsavedChanges` | `boolean` | `false` | Prompt user before leaving a form with unsaved changes. |
| `list` | `Partial<ListOptions>` | `{}` | Configuration for the list/table view. [Reference ↗](#list-view-configuration) |
| `create` | `Partial<CreateOptions>` | `{}` | Create form configuration. [Reference ↗](#form-configuration-create-update-formfields) |
| `update` | `Partial<UpdateOptions>` | `{}` | Edit form configuration. [Reference ↗](#form-configuration-create-update-formfields) |
| `delete` | `Partial<DeleteOptions>` | `{}` | Configuration for the delete action. [Reference ↗](#delete-configuration-delete) |
| `fields` | `FieldSpec[]` | `undefined` | Overwrite how columns are handled in the UI. [Reference ↗](#overriding-field-behavior-with-fields) |
| `formFields` | `(string \| FieldSpec)[]` | `undefined` | Form field configuration. [Reference ↗](#form-configuration-create-update-formfields) |
| `m2m` | `Record<string, Table>` | `undefined` | Defines many-to-many relationships to enable on form and detail view. [Reference ↗](#many-to-many-m2m) |
| `o2m` | `Record<string, Table>` | `undefined` | Defines one-to-many relationships to enable on form and detail view. [Reference ↗](#one-to-many-o2m) |

## Overriding Field Behavior with `fields`

The `fields` option allows you to customize the appearance and behavior of a model's columns across the entire admin interface, affecting list, detail, and form views, wherever applicable. It takes an array of `FieldSpec` objects.

If a column from your schema is not included in this array, its settings will be inferred automatically.

Example:

```ts
registry.register(posts, {
  fields: [
  // Customize the 'content' field to use a rich-text editor
    {
      name: 'content',
      type: 'rich-text',
      label: 'Post Body',
      inputAttrs: {
        placeholder: 'Start writing your masterpiece...'
      }
    },
    // Customize the 'featuredImage' to be an image uploader
    {
      name: 'featuredImage',
      type: 'image',
      help: 'Upload an image with a 16:9 aspect ratio.',
      fileConfig: {
        prefix: 'post-images/', // Subdirectory in your storage bucket
        accept: ['.jpeg', '.png'],
        maxSize: 5 * 1024 * 1024 // 5MB
      },
      fieldAttrs: {
        class: 'w-1/2' // uses half width in forms
      }
    }
  ]
})
```

### `fields` object definition (`FieldSpec`)

```ts
type FieldType = 'text' | 'email' | 'number' | 'boolean' | 'date' | 'datetime-local' | 'select' | 'json' | 'file' | 'blob' | 'image'

interface FieldSpec {
  // The column name from your Drizzle schema
  name: string
  // The display label for the field. Defaults to a capitalized version of the name
  label?: string
  // The UI component type to use for this field
  type: FieldType
  // HTML attributes to apply to the field's wrapper element (Nuxt UI's UFormField)
  fieldAttrs?: Record<string, any>
  // HTML attributes to apply directly to the form input element (Nuxt UI's UInput, UCheckbox, etc.)
  inputAttrs?: Record<string, any>
  // Help text displayed below the input.
  help?: string
  // Description for form field
  description?: string
  // Hint for form field
  hint?: string
  // Configuration for file or image uploads.
  fileConfig?: {
    // Storage path prefix for object storage bucket
    prefix?: string
    // Allowed file extensions as array of strings starting with a period `.` - client-side only validation
    accept?: `.${string}`[]
    // Maximum file size in bytes - client-side only validation
    maxSize?: number
  }
  // Automatically inferred using drizzle-zod, if not specified; defines if the field is required
  required?: boolean
  // Automatically inferred using drizzle-zod; defines the validation rules for the field
  rules?: Record<string, unknown>
  // Automatically inferred for enums and relations; defines the options for the field
  options?: (string | number | { label?: string, value: string | number, count?: number })[]
}
```

### Field Types

The `type` property in `FieldSpec` determines which form input component is rendered.

**Field Types:**

- `text`: Standard text input. Auto-inferred for `text` type database columns.
- `number`: A number input. Auto-inferred for `integer`, `real`, `numeric`, `bigint` type database columns.
- `boolean`: A checkbox. Auto-inferred for `boolean` type database columns.
- `select`: A dropdown menu. Auto-inferred for enums.
- `date`: A date picker. Auto-inferred for sqlite integer with mode `timestamp`.
- `datetime-local`: A date and time picker. Auto-inferred for sqlite `integer` with mode `timestamp_ms`.
- `json`: A text area for JSON input. Auto-inferred for sqlite `text` with mode `json`.
- `textarea`: A multi-line text input.
- `rich-text`: A WYSIWYG editor with tiptap editor.
- `image`: An image uploader with preview. Text with path to the image in object storage is saved to the database.
- `file`: A generic file uploader. Text with path to the file in object storage is saved to the database.
- `blob`: A binary data uploader saved to the database.

#### File & Image Uploads (fileConfig)

When using the `image` or `file` field type, you can optionally provide a `fileConfig` object to specify upload constraints.

By default, `image` type fields accept files with extensions - `.jpg`, `.jpeg`, `.png`, `.svg`.

By default,`file` type fields accept files with all extensions.

A preview dialog is implemented for images, and files with extensions - `.pdf`, `.txt`, `.md`.

```
// Example for an image field
{
  name: 'featuredImage',
  type: 'image',
  help: 'Upload a JPG or PNG, max 2MB.',
  fileConfig: {
    // A prefix for the storage path in your bucket
    prefix: 'post-images/',
    // List of allowed file extensions
    accept: ['.jpg', '.svg'],
    // Maximum file size in bytes
    maxSize: 2 * 1024 * 1024 // 2MB
  }
}
```

When using file and image uploads, you need to configure object storage as described in the [Object Storage Configuration](#object-storage-configuration) section.

## List View Configuration

The `list` option allows you to customize the data table view for a model. If neither `fields` nor `columns` are defined in `list` option, fields are automatically inferred. Automatic inference includes all fields except primary autoincrement columns, timestamp columns with default values, and foreign keys.

```ts
const popularity = async (db: AdminDbType, obj: typeof posts.$inferSelect) => {
  return `${obj.views} views`
}

const isArchived = async (db: AdminDbType, obj: typeof posts.$inferSelect) => {
  return obj.status === 'Archived'
}

registry.register(posts, {
  list: {
    // Only show these specific columns in the table
    fields: [
      'title',
      // Access a related field from the 'users' table
      'authorId.email',
      // Column with custom labels
      {
        field: 'isPublished',
        label: 'Published?'
      },
      // A custom function
      {
        field: isArchived,
        type: 'boolean',
      },
      // A custom function with sort key
      {
        field: popularity,
        sortKey: 'views',
      },
      // Related column with sorting on foreign table
      {
        field: 'authorId.name',
        // label is auto inferred as `Author Name`
        sortKey: 'authorId.email',
      }
    ],

    // Search by title and author's email, else automatically searches on `title` as inferred `lookupColumnName`
    searchFields: ['title', 'authorId.email'],

    // Filter by publication status and author, foreign key relations are automatically detected
    filterFields: ['isPublished', 'authorId'],

    // Add a custom action to perform on selected rows
    bulkActions: [{
      label: 'Publish Selected',
      icon: 'i-lucide-check-circle',
      action: async (db, rowIds) => {
        await db.update(posts).set({ isPublished: true }).where(inArray(posts.id, rowIds as number[]))
        return { message: `${rowIds.length} posts published.`, refresh: true }
      },
    }],

    // Customize the search bar placeholder
    searchPlaceholder: 'Search by title or author email...'
  }
})
```

### `list` options

**`fields: (string | function | ListFieldDef)[]`** -
An array defining the columns to display. An item can be:
- A string representing a column name (e.g., 'title').
- A dot-notation string for a related field (e.g., 'authorId.email').
- A function that returns a value for the column in list view. See `isArchived` example above.
- An object (ListFieldDef) for more control, allowing you to set a custom label, type hint, sortKey, or a custom rendering field function. See examples above. `field` value in this object can be a string (column name or dot-notation relation string), or a function.

**`enableSearch: boolean`** (Default: `true`) -
Toggles search functionality.

**`enableSort: boolean`** (Default: `true`) -
Toggles sorting functionality. See [List Sorting](#list-sorting) for more details.

**`searchFields: string[]`** (Default: `[labelColumnName]`) -
An array of column names (including relational fields in dot-notation) to search against.

**`searchPlaceholder: string`** (Default: 'Search ...') -
Placeholder text for the search input.

**`enableFilter: boolean`** (Default: `true`) -
Toggles the visibility of the filter controls. Setting to false disables default filters as well.

**`filterFields: (string | FilterFieldDef)[]`** -
An array of fields to generate filters for. If not specified, filters are automatically generated for enums, date fields (as date ranges), and boolean fields unless `enableFilter` is false. You can also define custom filters. See [List Filters](#list-filters) for more details.

**`bulkActions: object[]`** -
See [List Bulk Actions](#list-bulk-actions) for more details.

**`showCreateButton: boolean`** (Default: `true`) -
Toggles the visibility of the "Create New" button on the list page.

**`title: string`** (Default: Table Name as Title Case) -
Page heading and document title for list page.

## Form Configuration (create, update, formFields)

Control the fields and behavior of create and update forms using the `create`, `update`, and `formFields` options.

The `create` and `update` objects allow you to enable/disable forms or specify a unique set of fields for each.

- **`create: Partial<CreateOptions>`** - Configuration for the "Create New" form.
- **`update: Partial<UpdateOptions>`** - Configuration for the "Edit" form.

Both options share these properties:
- **`enabled: boolean`** (Default: `true`) - Toggles the create/update functionality.
- **`warnOnUnsavedChanges: boolean`** (Default: `false`) - Prompts the user before navigating away from a form with unsaved changes. Top-level `warnOnUnsavedChanges` configuration can be used instead of defining separately for `create` and `update`
- **`formFields: (string | FieldSpec)[]`** - An array defining the specific fields for that form.

The top-level `formFields` option is a convenient shortcut to apply the same field configuration to both create and update forms.

`formFields` is an array of field spec as defined in [Overriding Field Behavior with fields](#overriding-field-behavior-with-fields).

## Automatic Slug Generation (`slugFields`)

The `slugFields` option enables automatic generation of URL-friendly slugs from other form fields. This is particularly useful for creating SEO-friendly URLs from titles, names, or other text fields.

```ts
registry.register(posts, {
  slugFields: {
    slug: ['title', 'publishedOn'] // You can also use a single field like `'slug': ['title']`
  }
})
```

## Relationship Configuration

### Foreign Keys

Foreign keys are automatically detected and a dropdown selection is provided.

```ts
export const posts = sqliteTable('posts', {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  // Foreign key relationship
  authorId: integer().references(() => users.id),
})
```

When the `posts` model is registered, a dropdown selection of users will be provided in form for selecting an author.

### Many-to-Many (`m2m`)

A many-to-many relationship requires a third "join" table that connects two other tables. To configure it, you provide the `m2m` option with an object where the key is the label for the related model and the value is the Drizzle schema for the join table.

```ts
// server/db/schema.ts

// Posts table (already defined)
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  // ... other fields
})

// Tags table
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
})

// Join table connecting posts and tags
export const postsToTags = sqliteTable('posts_to_tags', {
  postId: integer('post_id').notNull().references(() => posts.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
})
```

When registering the `posts` model, use the `m2m` option to declare its relationship with `tags`.

```ts
// plugins/admin.ts
import { posts, postsToTags, tags } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()
  registry.register(tags)
  registry.register(posts, {
    m2m: {
      // 'tags' is the form label, postsToTags is the join/junction table schema
      tags: postsToTags
    }
  })
})
```

This will render a multi-select component on the `posts` form, allowing you to associate multiple tags with a post.

### One-to-Many (`o2m`)

While this is not usually required, autoadmin allows rendering one to many relation in a form, a reverse relation of foreign keys.

```ts
// server/db/schema.ts
export const users = sqliteTable('users', {
  id: integer().primaryKey(),
  email: text().notNull().unique(),
})

export const posts = sqliteTable('posts', {
  id: integer().primaryKey(),
  title: text().notNull(),
  // Foreign key linking each post to a user
  authorId: integer().references(() => users.id),
})
```

When registering the `users` model, use the `o2m` option to declare that a user can have many posts.

```ts
// plugins/admin.ts
import { posts, users } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()
  registry.register(users, {
    o2m: {
      posts
      // Or to pass custom label - 'Authored Posts' will be the label allowing to select posts from dropdown. Or simpl
      // authoredPosts: posts
    }
  })
})
```

This will add a dropdown selection of posts on users form.

## Delete Configuration (`delete`)

The `delete` option controls the deletion functionality for a model's records. By default, deletion is enabled.

To disable the delete action for a model, set the `enabled` property to `false`. This will remove delete functionality, including delete button on list row and bulk delete from list data table.

```ts
// plugins/admin.ts
import { users } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()

  // Disable the delete action for the 'users' model.
  registry.register(users, {
    delete: {
      enabled: false
    }
  })
})
```

## List Sorting

Sorting is enabled by default but can be controlled through the `list.enableSort` option. Sorting can be done by clicking on a column header. Sorting is persisted in the URL just like filtering and searching.

```ts
const displayTitle = async (db: AdminDbType, obj: typeof posts.$inferSelect) => {
  return `-> ${obj.title}`
}

registry.register(posts, {
  list: {
    enableSort: true, // Enable/disable sorting (default: true)
    fields: [
      // Custom sort key
      {
        field: displayTitle,
        sortKey: 'title' // Sort by 'name' column when clicking 'displayName'
      },

      // Simple column with automatically inferred sorting
      'views',

      // Relation sorting
      {
        field: 'authorId.email',
        sortKey: 'authorId.name' // Sort by author name when clicking email
      },

      // // Disable sorting for specific field
      {
        field: 'status',
        sortKey: false // No sorting available
      }
    ]
  }
})
```

### Sort Key Options

The `sortKey` property determines how a column can be sorted:

#### Direct Column Sorting
Sort by the same column that's displayed:

```
{
  field: 'createdAt',
  sortKey: 'createdAt' // or just omit sortKey, defaults to field name
}
```

#### Custom Sort Key
Sort by a different column than what's displayed:

```
{
  field: popularity, // Custom function showing view count
  sortKey: 'views' // Sort by the actual views column
}
```

#### Relation Sorting
Sort by columns in related tables using dot notation:

```
{
  field: 'authorId.email',
  sortKey: 'authorId.name' // Sort by author name, not email
}
```

#### Disable Sorting
Prevent sorting on specific columns:

```
{
  field: 'status',
  sortKey: false // No sorting for status
}
```

### Automatic Sort Key Detection

When using simple field definitions, sort keys are automatically assigned:

```ts
registry.register(posts, {
  list: {
    fields: [
      'title', // Automatically gets sortKey: 'title'
      'authorId.name', // Automatically gets sortKey: 'authorId.name'
    ]
  }
})
```

## List Filters

You can filter data in list using a table column, a relation column, or a custom filter.

- `enableFilter`: Enable/disable filtering (default: `true`)
- `filterFields`: Array of filter definitions (optional - auto-detected if not provided)

```ts
registry.register(posts, {
  list: {
    enableFilter: true, // Enable filtering functionality, is true by default
    // if filterFields is not passed, filters are automatically generated for enums, date fields (with date range), and boolean fields
    filterFields: [
      // Simple column filter
      'isPublished',
      // Relation column filter, automatically detected as foreign key relation
      'authorId',
      // Detailed filter configuration
      {
        field: 'status',
        type: 'select',
        options: [ // if not provided, a dropdown is rendered from enum or relation
          { label: 'Draft', value: 'Draft' },
          { label: 'Published', value: 'Published' }
        ]
      },

      // Custom filter with filter for m2m relation
      {
        parameterName: 'tags',
        label: 'Tags',
        type: 'select',
        options: async (db, query) => {
          const allTags = await db.select().from(tags)
          return allTags.map(tag => ({
            label: tag.name,
            value: tag.id
          }))
        },
        queryConditions: async (db, value) => {
          const postIds = await db
            .select({ postId: postsToTags.postId })
            .from(postsToTags)
            .where(eq(postsToTags.tagId, value))

          return [
            // Filter posts by matching post IDs
            inArray(posts.id, postIds.map(p => p.postId))
          ]
        }
      },
      // Another custom filter with boolean type
      {
        parameterName: 'hasViews',
        label: 'Has Views',
        type: 'boolean',
        queryConditions: async (db, value) => {
          if (value) {
            return [
              gt(posts.views, 0)
            ]
          } else {
            return [
              lte(posts.views, 0)
            ]
          }
        }
      }

    ]
  }
})
```

### Filter Types

#### Boolean Filters
Automatically created for boolean columns. Provides Yes/No/All options.

```
{
  field: 'isPublished',
  type: 'boolean'
}
```

#### Text Filters
For string columns. You can provide a list of options for the filter. If not provided, the filter will be a dropdown with all unique values for the column in the database.

```
{
  field: 'status',
  type: 'text',
  options: [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ]
}
```

#### Date Filters
Support single date or date range filtering. By default, if not provided, the filter will be a date range picker.

```
{
  field: 'createdAt',
  type: 'date' // Single date picker
}

{
  field: 'createdAt',
  type: 'daterange' // Date range picker
}
```

#### Relation Filters
For foreign key relationships. Automatically provides choices from the related table.

```
{
  field: 'categoryId',
  type: 'relation',
}
```

### Custom Filters

Create advanced filters with custom logic:

```ts
export const postEngagementFilter: CustomFilter = {
  label: 'Post Engagement',
  parameterName: 'post_engagement_filter',

  options: async () => [
    'High Engagement',
    'Published but No Views',
    'Draft with Views',
    'Archived Posts',
    // { label: 'High Engagement', value: 'high_engagement' },
    // { label: 'Published but No Views', value: 'published_no_views' },
    // { label: 'Draft with Views', value: 'draft_with_views' },
    // { label: 'Archived Posts', value: 'archived_posts' },
  ],

  queryConditions: async (db: any, value: any): Promise<SQL<unknown>[]> => {
    switch (value) {
      case 'High Engagement':
        return [
          eq(posts.status, 'published'),
          gte(posts.views, 100),
        ]

      case 'Published but No Views':
        return [
          eq(posts.status, 'published'),
          eq(posts.views, 0),
        ]

      case 'Draft with Views':
        return [
          eq(posts.status, 'draft'),
          gt(posts.views, 0),
        ]

      case 'Archived Posts':
        return [eq(posts.status, 'archived')]

      default:
        return []
    }
  },
}

// Registration
registry.register(posts, {
  list: {
    filterFields: [
      postEngagementFilter
    ]
  }
})
```

See [List Filters](#list-filters) for more examples.

### Automatic Filter Detection

If no `filterFields` are specified, the system automatically creates filters for:

- **Boolean columns**: Yes/No filters
- **Enum/Select columns**: Dropdown with available options
- **Date columns**: Date range filters

### Filter Field Definition Types

```ts
type FilterFieldDef<T extends Table>
  = | ColField<T> // Simple column name
    | {
      field: ColField<T>
      label?: string
      type?: FilterType
      options?: { label?: string, value: string | number }[]
      choicesEndpoint?: string
    }
    | CustomFilter // Advanced custom filter
```

## List Bulk Actions

You can add bulk actions to the list view which show up in the top right corner of the list view when one or more rows are selected.

`bulkActions` in `list` option is an array of actions that can be performed on selected rows. Each action object needs a label, an optional icon, and an action function that receives an array of selected rowIds on the server side using a REST API request. The function should return an object with an optional message string and `refresh` boolean. `message` is shown on toast and `refresh` instructs if the list view is to be refreshed after successful action completion. An example:

```ts
registry.register(platforms, {
  list: {
    bulkActions: [{
      label: 'Email',
      icon: 'i-lucide-mail',
      action: async (db: AdminDbType, rowIds: string[] | number[]) => {
        const emails = await db.select({ email: users.email }).from(users).where(inArray(users.id, rowIds))
        // send email logic here
        return { message: `Emails sent to ${emails.map(e => e.email).join(', ')}` }
      },
    }],
    bulkActions: [{
      label: 'Something else',
      icon: 'i-lucide-check',
      action: async (db: AdminDbType, rowIds: string[] | number[]) => {
        // Do something with the selected rows
        return { message: `Something else done`, refresh: true }
        // refresh: true instructs the list view to be refreshed after successful action completion
      },
    }],
  }
})
```

If `delete.enabled` is not set to `false` in registration option, a bulk action for delete is automatically added to the list view.

## Custom Selections

Custom selections allow you to define custom SQL expressions that are computed and displayed in the list view. These can be used for calculated fields, concatenated values, or aggregate statistics.

```ts
registry.register(posts, {
  list: {
    customSelections: {
      // Simple computed field
      slugWithId: {
        sql: sql<string>`(${posts.slug} || '-' || ${posts.id})`,
        label: 'Slug w/ ID',
      },

      // Aggregate that shows in statistics cards
      totalViews: {
        sql: sql<number>`sum(${posts.views}) OVER ()`,
        isAggregate: true,
      },

      // Another aggregate example
      avgRating: {
        sql: sql<number>`avg(${posts.rating}) OVER ()`,
        isAggregate: true,
        label: 'Average Rating',
      },
    }
  }
})
```

### Custom Selection Properties

**`sql: SQL`** (Required) -
The SQL expression using Drizzle's `sql` template literal.

**`isAggregate?: boolean`** (Default: `false`) -
When `true`, the selection is treated as an aggregate statistic and displayed in the statistics cards below the table. Non-aggregate selections can be included in table columns using the `fields` or `columns` configuration.

**`label?: string`** (Default: Capitalized key name) -
Display label for the custom selection.

## Aggregates

Aggregates provide built-in statistical functions that are automatically computed and displayed in cards below the data table. This is a simpler alternative to custom selections for common aggregate operations.

```ts
registry.register(posts, {
  list: {
    aggregates: {
      totalViews: {
        function: 'sum',
        column: 'views',
      },
      averageView: {
        function: 'avg',
        column: 'views',
      },
      postsWithViews: {
        function: 'count',
        column: 'views', // counts non-null values
        label: 'Posts with Views',
      },
      minView: {
        function: 'min',
        column: 'views',
        label: 'Minimum View in a Post',
      },
      maxView: {
        function: 'max',
        column: 'views',
        label: 'Maximum View in a Post',
      },
    }
  }
})
```

### Aggregate Properties

**`function: 'sum' | 'avg' | 'count' | 'min' | 'max'`** (Required) -
The aggregate function to apply. `count` counts truthy values for a column using `CASE WHEN` expression.

**`column: string`** (Required) -
The column name to aggregate over.

**`label?: string`** (Default: Capitalized key name) -
Display label for the aggregate statistic.

## Runtime Config

AutoAdmin can be configured using environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_DATABASE_URL` | Database Connection Url (e.g. `file:server/db/db.sqlite`) | undefined |
| `NUXT_PUBLIC_AUTOADMIN_TITLE` | The title displayed in the admin interface | `AutoAdmin` |
| `NUXT_PUBLIC_AUTOADMIN_URL_PREFIX` | The URL prefix for the admin interface | `/admin` |
| `NUXT_PUBLIC_PAGINATION_DEFAULT_SIZE` | The default page size for the list view | `20` |
| `NUXT_PUBLIC_PAGINATION_MAX_SIZE` | The maximum page size for the list view | `200` |

### Object Storage Configuration

AutoAdmin can use any S3-compatible object storage (supported by `awsfetch`) to store files and images. You can configure the object storage with environment variables.

```ini
NUXT_S3_ACCESS_KEY=<your-access-key>
NUXT_S3_SECRET_KEY=<your-secret-key>
NUXT_S3_BUCKET_NAME=<your-bucket-name>
NUXT_S3_REGION=<your-region>
NUXT_S3_ENDPOINT_URL=<your-endpoint-url>
NUXT_S3_PUBLIC_URL=<your-public-url>
```

## Example

Example Nuxt Project - https://github.com/awecode/autoadmin/tree/main/examples/posts

SQlite Schema - https://github.com/awecode/autoadmin/blob/main/examples/posts/server/db/sqlite.ts

Plugin for Registering Models - https://github.com/awecode/autoadmin/blob/main/examples/posts/app/plugins/admin.ts

You can also use list, create, update, delete service in your own API routes by passing the model config to the service. See [Example API Routes](https://github.com/awecode/autoadmin/tree/main/examples/posts/server/api) for more details.

You can also customize how cells are rendered on table list by defining a cell function using a client side composable `useAdminClient`. See [Example Plugin](https://github.com/awecode/autoadmin/blob/main/examples/posts/app/plugins/admin.ts).

## Roadmap

- [x] Integrate Auth Layer - Can use any auth layer like [https://github.com/awecode/nuxt-better-auth-layer](https://github.com/awecode/nuxt-better-auth-layer)
- [x] Aggregate Support in List View
- [ ] Image Uploads in WYSIWYG Editor
- [ ] Detail View
- [ ] PostgreSQL Dialect Support
- [ ] MySQL Dialect Support
- [ ] Hooks/Signals
- [ ] Audit Logs

## Known Issues

- Tailwind classes not working correctly - https://github.com/tailwindlabs/tailwindcss/discussions/18273
  - Solution: Use layer locally instead of using GitHub source.

## Stack

- [Nuxt](https://nuxt.com/)
- [Drizzle](https://orm.drizzle.team/)
- [Nuxt UI](https://ui.nuxt.com/)
- [Zod](https://zod.dev/)

## License

MIT
