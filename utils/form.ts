import type { ZodDefault, ZodNullable, ZodObject, ZodOptional, ZodTypeAny } from 'zod'

type Rules = Record<string, unknown>
type FieldType = 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'datetime-local' | 'select' | 'json' | 'file' | 'relation'

interface FieldSpec {
  name: string
  label: string
  type: FieldType
  required: boolean
  rules: Rules
  enumValues?: string[]
  selectItems?: { label: string, value: string }[]
  defaultValue?: unknown
}
export interface FormSpec {
  fields: FieldSpec[]
}

function getDef(zodType: ZodTypeAny) {
  return zodType?._def
}

function mapZodCheckToRules(check: any): Record<string, unknown> {
  switch (check.kind) {
    case 'min':
      return { minLength: check.value }
    case 'max':
      return { maxLength: check.value }
    case 'email':
      return { isEmail: true }
    case 'url':
      return { isUrl: true }
      // Add more mappings for other Zod checks as needed
    default:
      return {}
  }
}

type UnwrappedZod<T extends ZodTypeAny> = T extends
  | ZodOptional<infer U>
  | ZodNullable<infer U>
  | ZodDefault<infer U>
  ? UnwrappedZod<U>
  : T

export function unwrapZodType<T extends ZodTypeAny>(zodType: T): {
  innerType: UnwrappedZod<T>
  isOptional: boolean
  defaultValue?: unknown
} {
  let currentType: ZodTypeAny = zodType
  let isOptional = false
  let defaultValue: unknown

  while (true) {
    const def = currentType._def
    if (!def) break

    const typeName = def.typeName ?? def.type

    if (
      typeName === 'ZodOptional'
      || typeName === 'optional'
      || typeName === 'ZodNullable'
      || typeName === 'nullable'
    ) {
      isOptional = true
      currentType = def.innerType
    } else if (typeName === 'ZodDefault' || typeName === 'default') {
      isOptional = true
      if (def.defaultValue !== undefined) {
        defaultValue
          = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue
      }
      currentType = def.innerType
    } else {
      break
    }
  }

  return {
    innerType: currentType as UnwrappedZod<T>,
    isOptional,
    defaultValue,
  }
}

export function zodToFormSpec(schema: ZodObject<any>): FormSpec {
  const shape = getDef(schema)?.shape ?? schema.shape
  if (!shape) {
    // Fallback for safety, though a ZodObject should always have a shape.
    return { fields: [] }
  }

  const fields: FieldSpec[] = Object.entries(shape).map(([name, zodType]) => {
    const { innerType, isOptional, defaultValue } = unwrapZodType(zodType as ZodTypeAny)

    const definition = getDef(innerType)
    const definitionTypeKey = definition?.typeName ?? definition?.type

    let type: FieldType = 'text'
    const rules: Rules = {}
    let enumValues: string[] | undefined

    switch (definitionTypeKey) {
      case 'ZodString':
      case 'string':
        type = 'text'
        if (definition.checks) {
          for (const check of definition.checks) {
            if (check.kind === 'email') type = 'email'
            Object.assign(rules, mapZodCheckToRules(check))
          }
        }
        break
      case 'ZodNumber':
      case 'number':
        type = 'number'
        if (definition.checks) {
          for (const check of definition.checks) {
            Object.assign(rules, mapZodCheckToRules(check))
          }
        }
        // Check for top-level minValue and maxValue on the innerType object itself,
        // which is where they appear in the provided schema structure.
        if ((innerType as any).minValue != null) {
          rules.min = (innerType as any).minValue
        }
        if ((innerType as any).maxValue != null) {
          rules.max = (innerType as any).maxValue
        }
        break
      case 'ZodBoolean':
      case 'boolean':
        type = 'checkbox'
        break
      case 'ZodEnum':
      case 'enum':
        type = 'select'
        enumValues = definition.values ?? (innerType as any).options ?? Object.keys(definition.entries ?? {})
        break
      case 'ZodDate':
      case 'date':
        type = 'date'
        break
      case 'ZodBigInt':
      case 'bigint':
        type = 'number' // HTML inputs do not have a 'bigint' type, so 'number' is the closest, separate from number because no min/max
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

    return {
      name,
      label: name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      type,
      required: !isOptional,
      rules,
      enumValues,
      defaultValue,
    }
  })

  return { fields }
}
