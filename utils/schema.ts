import type { ZodObject, ZodRawShape } from 'zod'
import { z } from 'zod'

export function processSchema<S extends ZodRawShape>(
  schema: ZodObject<S>,
  spec: FormSpec,
) {
  if (!schema || !spec?.fields?.length) return z.object({})

  const shape = schema.shape

  const pickKeys = Object.fromEntries(
    spec.fields
      .map(({ name }) => name)
      .filter((name): name is keyof S => name in shape) // ignore unknown field names
      .map(name => [name, true] as const), // keep literal true
  ) as { [K in keyof S]?: true }

  return schema.pick(pickKeys)
}
