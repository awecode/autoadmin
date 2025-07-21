# AutoAdmin Documentation

AutoAdmin automatically creates admin interfaces from Drizzle ORM models in your Nuxt project.

## Installation

Use autoadmin as a layer in your nuxt project. You can add the following to your nuxt.config.ts

```typescript
export default defineNuxtConfig({
  extends: ['../autoadmin/.playground'],
})
```

Or you can clone the project inside layers directory in your nuxt project.

## Usage

Here is an example schema for SQLite demonstrating various column types.

```typescript
// server/db/schema.ts
import { sql } from 'drizzle-orm'
import { boolean, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// An enum-like definition for the 'status' column
export const postStatusEnum = ['Draft', 'Published', 'Archived'] as const

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  // Text field
  title: text('title').notNull(),
  content: text('content'),
  featuredImage: text('featured_image'),
  attachment: text('attachment'),
  // Number field
  views: integer('views').default(0),
  // Boolean field
  isPublished: boolean('is_published').default(false),
  // Date field (as timestamp for sqlite)
  publishedOn: integer('published_on', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  // Datetime field (as timestamp_ms for sqlite)
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  // Enum field
  status: text('status', { enum: postStatusEnum }).default('Draft'),
  // Foreign key relationship
  authorId: integer('author_id').references(() => users.id),
})
```

Register your Drizzle schemas in a Nuxt plugin.

```typescript
// plugins/admin.ts
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

```typescript
// plugins/admin.ts
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

This is the main configuration object passed to `registry.register(model, options)`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `label` | `string` | Table name | Display name for the model (e.g., in the sidebar). |
| `icon` | `string` | `undefined` | Iconify icon name. Auto-detected for common names. |
| `labelColumnName` | `string` | `name`, `title`, etc. | Column used for display labels in relationships and select options. |
| `lookupColumnName` | `string` | `id` | The primary or unique key used to fetch single records. |
| `warnOnUnsavedChanges` | `boolean` | `false` | Prompt user before leaving a form with unsaved changes. |
| `list` | `Partial<ListOptions>` | `{}` | Configuration for the list/table view. |
| `create` | `Partial<CreateOptions>` | `{}` | Create form configuration. |
| `update` | `Partial<UpdateOptions>` | `{}` | Edit form configuration. |
| `delete` | `Partial<DeleteOptions>` | `{}` | Configuration for the delete action. |
| `fields` | `FieldSpec[]` | `undefined` | Overwrite how columns are handled in the UI. |
| `formFields` | `(string \| FieldSpec)[]` | `undefined` | Form field configuration. |
| `m2m` | `Record<string, Table>` | `undefined` | Defines many-to-many relationships to enable on form and detail view. |
| `o2m` | `Record<string, Table>` | `undefined` | Defines one-to-many relationships to enable on form and detail view. |

## Overriding Field Behavior with fields

The `fields` option allows you to customize the appearance and behavior of a model's columns across the entire admin interface, affecting list, detail, and form views, wherever applicable. It takes an array of `FieldSpec` objects.

If a column from your schema is not included in this array, its settings will be inferred automatically.

Example:

```typescript
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
        accept: ['.jpeg', '.png'],
        prefix: 'post-images/', // Subdirectory in your storage bucket
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

```typescript
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
    // Allowed file extensions as array of strings starting with a period `.`
    accept?: `.${string}`[]
    // Storage path prefix for object storage bucket
    prefix?: string
    // Maximum file size in bytes
    maxSize?: number
  }
  // Automatically inferred using drizzle-zod, if not specified - defines if the field is required
  required?: boolean
  // Automatically inferred using drizzle-zod - defines the validation rules for the field
  rules?: Record<string, unknown>
  // Automatically inferred for enums and relations - defines the options for the field
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

```typescript
// Example for an image field
{
  name: 'featuredImage',
  type: 'image',
  help: 'Upload a JPG or PNG, max 2MB.',
  fileConfig: {
    // List of allowed file extensions
    accept: ['.jpg', '.svg'],
    // A prefix for the storage path in your bucket
    prefix: 'post-images/',
    // Maximum file size in bytes
    maxSize: 2 * 1024 * 1024 // 2MB
  }
}
```

When using file and image uploads, you need to configure object storage as described in the [Object Storage Configuration](#object-storage-configuration) section.

## List View Configuration (list)

The `list` option allows you to customize the data table view for a model. If neither `fields` nor `columns` are defined in `list` option, fields are automatically inferred. Automatic inference includes all fields except primary autoincrement columns, timestamp columns with default values, and foreign keys.

```typescript
const popularity = (obj: typeof posts.$inferSelect) => {
  return `${post.views} views`
}

const isNotPublished = (obj: typeof posts.$inferSelect) => {
  return obj.status === 'Draft' || obj.status === 'Archived'
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
      isNotPublished,
      // A custom function with additional configuration
      {
        field: popularity,
        sortKey: 'views'
      },
      // Related column with sorting on foreign table
      {
        field: 'authorId.name',
        // label is auto inferred as `Author Name`
        sortKey: 'authorId.email'
      }
    ],

    // Search by title and author's email, else automatically searches on `title` as inferred `lookupColumnName`
    searchFields: ['title', 'authorId.email'],

    // Filter by publication status and author
    filterFields: ['isPublished', 'authorId'],

    // Add a custom action to perform on selected rows
    bulkActions: [{
      label: 'Publish Selected',
      icon: 'i-lucide-check-circle',
      action: async (rowIds) => {
        // Database call to update the selected posts
        console.log('Publishing posts with IDs:', rowIds)
        return { message: `${rowIds.length} posts published.`, refresh: true }
      },
    }],

    // Customize the search bar placeholder
    searchPlaceholder: 'Search by title or author email...'
  }
})
```

### `list` options

**`fields: (string | function | ListFieldDef)[]`**
An array defining the columns to display. An item can be:
- A string representing a column name (e.g., 'title').
- A dot-notation string for a related field (e.g., 'authorId.email').
- A function that returns a value for the column in list view. See `isNotPublished` example above.
- An object (ListFieldDef) for more control, allowing you to set a custom label, type hint, sortKey, or a custom rendering field function. See examples above. `field` value in this object can be a string (column name or dot-notation relation string), or a function.

**`columns: ListColumnDef[]`**
An alternative to `fields` that enables you to directly specify Nuxt UI Table columns. Additional to Nuxt UI column config, each column takes `type` (as `FieldType`), `header` (as string), and `sortKey` attributes. This overwrites any `fields` configuration in `list` for top-level configuration.

**`enableSearch: boolean`** (Default: `true`)
Toggles search functionality.

**`searchFields: string[]`** (Default: `[labelColumnName]`)
An array of column names (including relational fields in dot-notation) to search against.

**`searchPlaceholder: string`** (Default: 'Search ...')
Placeholder text for the search input.

**`enableFilter: boolean`** (Default: `true`)
Toggles the visibility of the filter controls. Setting to false disables default filters as well.

**`filterFields: (string | FilterFieldDef)[]`**
An array of fields to generate filters for. If not specified, filters are automatically generated for enums, date fields (as date ranges), and boolean fields unless `enableFilter` is false. You can also define custom filters. See [List Filters](#list-filters) for more details.

**`bulkActions: object[]`**
See [List Bulk Actions](#list-bulk-actions) for more details.

**`showCreateButton: boolean`** (Default: `true`)
Toggles the visibility of the "Create New" button on the list page.

**`title: string`** (Default: Table Name as Title Case)
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

## Relationship Configuration

### Foreign Keys

Foreign keys are automatically detected and a dropdown selection is provided.

```ts
export const locations = sqliteTable('locations', {
  id: integer().primaryKey(),
  platformId: integer().notNull().references(() => platforms.id),
})
```

When the `locations` model is registered, a dropdown selection of platforms will be provided in form.

### Many-to-Many (`m2m`)

A many-to-many relationship requires a third "join" table that connects two other tables. To configure it, you provide the `m2m` option with an object where the key is the label for the related model and the value is the Drizzle schema for the join table.

```typescript
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

```typescript
// plugins/admin.ts
import { posts, postsToTags, tags } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()
  registry.register(tags)
  registry.register(posts, {
    m2m: {
      // 'tags' is the label, postsToTags is the join/junction table schema
      tags: postsToTags
    }
  })
})
```

This will render a multi-select component on the `posts` form, allowing you to associate multiple tags with a post.

### One-to-Many (`o2m`)

While this is not usually required, autoadmin allows rendering one to many relation in a form.

```typescript
// server/db/schema.ts
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  // Foreign key linking each post to a user
  authorId: integer('author_id').references(() => users.id),
})
```

When registering the `users` model, use the `o2m` option to declare that a user can have many posts.

```typescript
// plugins/admin.ts
import { posts, users } from '~~/server/db/schema'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()
  registry.register(users, {
    o2m: {
      // 'posts' is the label, and its value is the posts table schema
      posts
    }
  })
})
```

This will add a dropdown selection of posts on users form.

## Delete Configuration (`delete`)

The `delete` option controls the deletion functionality for a model's records. By default, deletion is enabled.

To disable the delete action for a model, set the `enabled` property to `false`. This will remove delete functionality, including delete button on list row and bulk delete from list data table.

```typescript
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

## Runtime Config

AutoAdmin can be configured using environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_AUTOADMIN_TITLE` | The title displayed in the admin interface | `AutoAdmin` |
| `NUXT_AUTOADMIN_URL_PREFIX` | The URL prefix for the admin interface | `/admin` |

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

## List Filters

You can filter data in list using a table column, a relation column, or a custom filter.

- `enableFilter`: Enable/disable filtering (default: `true`)
- `filterFields`: Array of filter definitions (optional - auto-detected if not provided)

```ts
registerAdminModel(usersTable, {
  list: {
    enableFilter: true, // Enable filtering functionality
    filterFields: [
      // Simple column filter
      'status',
      // Relation column filter
      'authorId',

      // Detailed filter configuration
      {
        field: 'role',
        label: 'User Role',
        type: 'text',
        options: [ // if not provided, the filter will be a dropdown with all unique values for the column in the database
          { label: 'Administrator', value: 'admin' },
          { label: 'User', value: 'user' }
        ]
      },

      // Custom filter with dynamic options
      {
        parameterName: 'department',
        label: 'Department',
        type: 'relation',
        options: async (db, query) => {
          const departments = await db.select().from(departmentsTable)
          return departments.map(dept => ({
            label: dept.name,
            value: dept.id
          }))
        },
        queryConditions: async (db, value) => [
          eq(usersTable.departmentId, value)
        ]
      }
    ]
  }
})
```

### Filter Types

#### Boolean Filters
Automatically created for boolean columns. Provides Yes/No/All options.

```ts
{
  field: 'isActive',
  type: 'boolean'
}
```

#### Text Filters
For string columns. You can provide a list of options for the filter. If not provided, the filter will be a dropdown with all unique values for the column in the database.

```ts
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

```ts
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

```ts
{
  field: 'categoryId',
  type: 'relation',
}
```

### Custom Filters

Create advanced filters with custom logic:

```ts
export const platformStatusFilter: CustomFilter = {
  label: 'Platform Status',
  parameterName: 'platform_status_filter',

  options: async () => [
    'enabled_active',
    'disabled_any',
    'enabled_inactive',
    'status_mismatch',
    // { label: 'Enabled & Active', value: 'enabled_active' },
    // { label: 'Disabled (Any Status)', value: 'disabled_any' },
    // { label: 'Enabled but Inactive', value: 'enabled_inactive' },
    // { label: 'Status Mismatch', value: 'status_mismatch' },
  ],

  queryConditions: async (db: any, value: any): Promise<SQL<unknown>[]> => {
    switch (value) {
      case 'enabled_active':
        return [
          eq(platforms.isEnabled, true),
          eq(platforms.status, 'active'),
        ]

      case 'disabled_any':
        return [eq(platforms.isEnabled, false)]

      case 'enabled_inactive':
        return [
          eq(platforms.isEnabled, true),
          sql`${platforms.status} != 'active'`,
        ]

      case 'status_mismatch':
        // Platforms where original status differs from current status
        return [sql`${platforms.status} != ${platforms.originalStatus}`]

      default:
        return []
    }
  },
}

// Registration
registry.register(platforms, {
  list: {
    filterFields: [
      platformStatusFilter
    ]
  }
})
```

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
      action: async (rowIds: string[] | number[]) => {
        const emails = await db.select({ email: users.email }).from(users).where(inArray(users.id, rowIds))
        return { message: `Emails sent to ${emails.map(e => e.email).join(', ')}` }
      },
    }],
    bulkActions: [{
      label: 'Something else',
      icon: 'i-lucide-check',
      action: async (rowIds: string[] | number[]) => {
        // Do something with the selected rows
        return { message: `Something else done`, refresh: true }
        // refresh: true instructs the list view to be refreshed after successful action completion
      },
    }],
  }
})
```

If `delete.enabled` is not set to `false` in registration option, a bulk action for delete is automatically added to the list view.

## List Sorting

Sorting is enabled by default but can be controlled through the `list.enableSort` option. Sorting can be done by clicking on a column header. Sorting is persisted in the URL just like filtering and searching.

```ts
registerAdminModel(usersTable, {
  list: {
    enableSort: true, // Enable/disable sorting (default: true)
    fields: [
      // Simple column with sorting
      'name',

      // Custom sort key
      {
        field: 'displayName',
        sortKey: 'name' // Sort by 'name' column when clicking 'displayName'
      },

      // Relation sorting
      {
        field: 'authorId.email',
        sortKey: 'authorId.name' // Sort by author name when clicking email
      },

      // Disable sorting for specific field
      {
        field: 'calculatedField',
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

```ts
{
  field: 'createdAt',
  sortKey: 'createdAt' // or just omit sortKey, defaults to field name
}
```

#### Custom Sort Key
Sort by a different column than what's displayed:

```ts
{
  field: popularity, // Custom function showing view count
  sortKey: 'views' // Sort by the actual views column
}
```

#### Relation Sorting
Sort by columns in related tables using dot notation:

```ts
{
  field: 'authorId.email',
  sortKey: 'authorId.name' // Sort by author name, not email
}
```

#### Disable Sorting
Prevent sorting on specific columns:

```ts
{
  field: 'actions',
  sortKey: false // No sorting for action buttons
}
```

### Automatic Sort Key Detection

When using simple field definitions, sort keys are automatically assigned:

```ts
registerAdminModel(postsTable, {
  list: {
    fields: [
      'title', // Automatically gets sortKey: 'title'
      'authorId.name', // Automatically gets sortKey: 'authorId.name'
    ]
  }
})
```

## Stack

- [Nuxt](https://nuxt.com/)
- [Drizzle](https://orm.drizzle.team/)
- [Nuxt UI](https://ui.nuxt.com/)
- [Zod](https://zod.dev/)
