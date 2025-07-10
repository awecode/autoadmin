import type { ZodObject, ZodTypeAny } from 'zod'
import { getDef, unwrapZodType } from './zod'

export type FieldType = 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'datetime-local' | 'select' | 'json' | 'file' | 'relation' | 'relation-many'

export function zodToListSpec(schema: ZodObject<any>): Record<string, FieldType> {
  const shape = getDef(schema)?.shape ?? schema.shape
  if (!shape) {
    // Fallback for safety, though a ZodObject should always have a shape.
    return {}
  }

  const fields: [string, FieldType][] = Object.entries(shape).map(([name, zodType]) => {
    const { innerType } = unwrapZodType(zodType as ZodTypeAny)

    const definition = getDef(innerType)
    const definitionTypeKey = definition?.typeName ?? definition?.type

    let type: FieldType = 'text'

    switch (definitionTypeKey) {
      case 'ZodString':
      case 'string':
        type = 'text'
        if (definition.checks) {
          for (const check of definition.checks) {
            if (check.kind === 'email') type = 'email'
          }
        }
        break
      case 'ZodNumber':
      case 'number':
        type = 'number'
        break
      case 'ZodBoolean':
      case 'boolean':
        type = 'checkbox'
        break
      case 'ZodEnum':
      case 'enum':
        type = 'select'
        break
      case 'ZodDate':
      case 'date':
        type = 'date'
        break
      case 'ZodBigInt':
      case 'bigint':
        type = 'number'
        break
      case 'ZodCustom':
      case 'custom':
        // Drizzle-zod uses a custom type for blobs, which we'll map to 'file'.
        type = 'file'
        break
      case 'ZodRecord':
      case 'record':
        type = 'json'
        break
      case 'ZodUnion':
      case 'union':
        // If a union contains a record type, it's likely a JSON field from drizzle-zod.
        if (definition.options?.some((opt: any) => {
          const optDef = getDef(opt)
          const optTypeKey = optDef?.typeName ?? optDef?.type
          return optTypeKey === 'ZodRecord' || optTypeKey === 'record'
        })) {
          type = 'json'
        }
        break
    }

    return [name, type]
  })
  return Object.fromEntries(fields)
}
