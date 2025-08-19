import type { ZodType } from 'zod'
import { ZodDefault, ZodNullable, ZodOptional } from 'zod'

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

export function unwrapZodType(zodType: ZodType): {
  innerType: ZodType
  isOptional: boolean
  defaultValue?: unknown
} {
  let currentType = zodType
  let isOptional = false
  let defaultValue: unknown

  while (currentType) {
    if (currentType instanceof ZodOptional || currentType instanceof ZodNullable) {
      currentType = currentType.unwrap() as ZodType
      isOptional = true
    } else if (currentType instanceof ZodDefault) {
      isOptional = true
      const val = currentType.def.defaultValue
      defaultValue = typeof val === 'function' ? val() : val
      currentType = currentType.unwrap() as ZodType
    } else {
      break
    }
  }

  return {
    innerType: currentType,
    isOptional,
    defaultValue,
  }
}
