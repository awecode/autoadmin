import type { ZodDefault, ZodNullable, ZodOptional, ZodTypeAny } from 'zod'

export function getDef(zodType: ZodTypeAny) {
  return zodType?._def
}

export function mapZodCheckToRules(check: any): Record<string, unknown> {
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
