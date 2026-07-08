import type { createInsertSchema as CreateInsertSchemaFn } from 'drizzle-zod'

type CreateInsertSchema = typeof CreateInsertSchemaFn

// Drizzle v1 uses drizzle-orm/zod, but we need to fallback to drizzle-zod for older versions
let fallbackLoadError: unknown
// eslint-disable-next-line antfu/no-top-level-await
const resolvedCreateInsertSchema: CreateInsertSchema | undefined = await import('drizzle-orm/zod')
  .then(mod => mod.createInsertSchema as CreateInsertSchema)
  .catch(() => {
    return import('drizzle-zod')
      .then(mod => mod.createInsertSchema)
      .catch((error) => {
        fallbackLoadError = error
        return undefined
      })
  })

if (!resolvedCreateInsertSchema) {
  throw new Error(
    'AutoAdmin: could not load `createInsertSchema` from either `drizzle-orm/zod` (drizzle-orm >= 1.0) or the `drizzle-zod` package. Install one of them in your project, e.g. `npx nypm add drizzle-zod`.',
    { cause: fallbackLoadError },
  )
}

export const createInsertSchema: CreateInsertSchema = resolvedCreateInsertSchema
