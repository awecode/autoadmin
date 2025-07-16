import type { ZodObject, ZodTypeAny } from 'zod'
import { getDef, mapZodCheckToRules, unwrapZodType } from './zod'

type Rules = Record<string, unknown>
type FieldType = 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'datetime-local' | 'select' | 'json' | 'file' | 'relation' | 'relation-many'

export interface FieldSpec {
  name: string
  label: string
  type: FieldType
  required?: boolean
  rules?: Rules
  enumValues?: string[]
  options?: string[] | number[] | { label?: string, value: string | number, count?: number }[]
  selectItems?: { label: string, value: string }[]
  defaultValue?: unknown
  choicesEndpoint?: string
}
export interface FormSpec {
  fields: FieldSpec[]
  values?: Record<string, any>
  warnOnUnsavedChanges?: boolean
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

export const normalizeOptions = (options: { label?: string, value: string | number, count?: number }[] | string[]) => {
  return options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    return { label: option.label || option.value?.toString(), value: option.value, count: option.count }
  })
}

export const getErrorMessage = (error: Error) => {
  return typeof error === 'object' && error !== null
    ? (error as any)?.data?.message ?? (error as any)?.message ?? String(error)
    : String(error)
}
