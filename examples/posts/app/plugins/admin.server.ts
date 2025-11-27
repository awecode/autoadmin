import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { inArray, sql } from 'drizzle-orm'
import { categories, posts, postsToTags, tags, users } from '../../server/db/sqlite'

export default defineNuxtPlugin(() => {
  const registry = useAdminRegistry()

  //   Categories - Simple setup
  registry.register(categories, {
    label: 'Categories',
    key: 'cat',
    list: {
      searchFields: ['name', 'description'],
      filterFields: ['isActive'],
      bulkActions: [{
        label: 'Archive Categories',
        icon: 'i-lucide-archive',
        action: async (db, rowIds) => {
          await db.update(categories).set({ isActive: false }).where(inArray(categories.id, rowIds as number[]))
          return { message: `${rowIds.length} categories archived`, refresh: true }
        },
      }],
    },
  })

  // Users - Custom field types and validation
  registry.register(users, {
    labelColumnName: 'email',
    fields: [
      {
        name: 'avatar',
        type: 'image',
        fileConfig: {
          prefix: 'avatars/',
          maxSize: 2 * 1024 * 1024, // 2MB
        },
      },
      {
        name: 'bio',
        type: 'textarea',
        inputAttrs: {
          rows: 4,
          placeholder: 'Tell us about yourself...',
        },
      },
    ],
    list: {
      fields: [
        'name',
        'email',
        'role',
        {
          field: 'isActive',
          label: 'Status',
        },
        'createdAt',
      ],
      searchFields: ['name', 'email'],
      filterFields: ['role', 'isActive'],
      bulkActions: [{
        label: 'Activate Users',
        icon: 'i-lucide-user-check',
        action: async (db, rowIds) => {
          await db.update(users).set({ isActive: true }).where(inArray(users.id, rowIds as number[]))
          return { message: `${rowIds.length} users activated`, refresh: true }
        },
      }],
    },
  })

  // Posts - Complex setup with relationships and custom functions
  registry.register(posts, {
    slugFields: { slug: ['title'] },
    fields: [
      {
        name: 'content',
        type: 'rich-text',
        label: 'Post Content',
        fieldAttrs: {
          class: 'w-full',
        },
      },
      {
        name: 'excerpt',
        type: 'textarea',
        help: 'Brief summary of the post (max 200 characters)',
        inputAttrs: {
          maxlength: 200,
        },
      },
      {
        name: 'featuredImage',
        type: 'image',
        fileConfig: {
          accept: ['.jpg', '.jpeg', '.png', '.webp'],
          prefix: 'posts/',
          maxSize: 5 * 1024 * 1024, // 5MB
        },
        fieldAttrs: {
          class: 'w-1/3',
        },
      },
    ],
    list: {
      fields: [
        'title',
        {
          field: 'authorId.name',
          label: 'Author',
        },
        {
          field: 'categoryId.name',
          label: 'Category',
        },
        'status',
        {
          field: async (db, post) => `${post.views || 0} views`,
          label: 'Popularity',
          sortKey: 'views',
        },
        {
          field: 'publishedAt',
          label: 'Published',
          type: 'date',
        },
        {
          field: async (db, obj) => obj.slugWithId,
          label: 'Slug with ID',
        },
      ],
      searchFields: ['title', 'excerpt', 'authorId.name'],
      filterFields: [
        'status',
        'authorId',
        'categoryId',
        'isCommentsEnabled',
        {
          field: 'publishedAt',
          type: 'daterange',
          label: 'Publication Date',
        },
        {
          field: 'createdAt',
          type: 'date',
          label: 'Created At',
        },
        {
          field: 'updatedAt',
          type: 'daterange',
          label: 'Updated At',
        },
      ],
      bulkActions: [
        {
          label: 'Publish Posts',
          icon: 'i-lucide-send',
          action: async (db, rowIds) => {
            await db.update(posts).set({ status: 'published' }).where(inArray(posts.id, rowIds as number[]))
            return { message: `${rowIds.length} posts published`, refresh: true }
          },
        },
      ],
      customSelections: {
        slugWithId: {
          sql: sql<string>`(${posts.slug} || '-' || ${posts.id})`,
          label: 'Slug w/ ID',
        },
        totalViews: {
          sql: sql<number>`sum(${posts.views}) OVER ()`,
          isAggregate: true,
        },
      },
      aggregates: {
        averageView: {
          function: 'avg',
          column: posts.views,
        },
        pagesWithViews: {
          function: 'count',
          column: 'views', // counts truthy values
        },
        minViews: {
          function: 'min',
          column: 'views',
          label: 'Minimum View in a Post',
        },
        maxViews: {
          function: 'max',
          column: 'views',
          label: 'Maximum View in a Post',
        },
      },
    },
    m2m: {
      tags: postsToTags,
    },
    warnOnUnsavedChanges: false,
  })

  // Tags
  registry.register(tags, {
    icon: 'i-lucide-tag',
    fields: [
      {
        name: 'color',
        inputAttrs: {
          type: 'color',
        },
        help: 'Choose a color for this tag',
      },
    ],
    list: {
      enableFilter: false, // Disable filters
    },
  })
})
