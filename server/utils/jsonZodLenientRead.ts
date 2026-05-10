import type { ZodObject, ZodType } from 'zod'
import { z } from 'zod'

const lenientJsonObjectReadCache = new WeakMap<ZodObject<Record<string, ZodType>>, ZodObject<Record<string, ZodType>>>()

/**
 * Clone a Zod object schema so each property uses `.catch(undefined)` on parse failure.
 * Used only for JSON file **reads** (legacy or mistyped values); writes keep the strict schema.
 */
export function getZodObjectWithLenientJsonRead(
  schema: ZodObject<Record<string, ZodType>>,
): ZodObject<Record<string, ZodType>> {
  const cached = lenientJsonObjectReadCache.get(schema)
  if (cached) {
    return cached
  }
  const shape = schema.shape
  const newShape: Record<string, ZodType> = {}
  for (const key of Object.keys(shape)) {
    const field = shape[key]!
    newShape[key] = field.catch(undefined) as ZodType
  }
  const built = z.object(newShape) as ZodObject<Record<string, ZodType>>
  lenientJsonObjectReadCache.set(schema, built)
  return built
}
