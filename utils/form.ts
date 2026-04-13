import type { FormSpec, Option } from '#layers/autoadmin/server/utils/form'
import type { ZodObject, ZodRawShape } from 'zod'
import { z } from 'zod'

export function normalizeOptions(opts: Option[]) {
  return opts.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    if (typeof option === 'number') {
      return { label: option.toString(), value: option }
    }
    return { label: option.label || option.value?.toString(), value: option.value, count: option.count }
  })
}

export function getErrorMessageFromError(error: Error) {
  return typeof error === 'object' && error !== null
    ? (error as any)?.data?.data?.message ?? (error as any)?.data?.message ?? (error as any)?.message ?? String(error)
    : String(error)
}

// Transform Zod error messages to be more user-friendly
export function transformErrorMessage(message: string, fieldType?: string): string {
  // Handle common Zod error patterns
  if (message.includes('expected string, received null')
    || message.includes('expected string, received undefined')) {
    return 'This field is required'
  }

  if (message.includes('expected number, received null')
    || message.includes('expected number, received undefined')) {
    if (fieldType === 'relation') {
      return 'Please select an option'
    }
    else if (fieldType === 'relation-many') {
      return 'Please select at least one option'
    }
    else {
      return 'Please enter a number'
    }
  }

  if (message.includes('expected boolean, received null')
    || message.includes('expected boolean, received undefined')) {
    return 'Please select an option'
  }

  if (message.includes('expected array, received null')
    || message.includes('expected array, received undefined')) {
    return 'Please select at least one option'
  }
  // Return original message if no pattern matches
  return message
}

export function processSchemaForForm<S extends ZodRawShape>(
  schema: ZodObject<S>,
  spec: FormSpec,
) {
  if (!schema || !spec?.fields?.length)
    return z.object({})

  const shape = schema.shape ?? schema

  const pickKeys = Object.fromEntries(
    spec.fields
      .map(({ name }) => name)
      .filter((name): name is Extract<keyof S, string> => name in shape)
      .map(name => [name, true] as const),
  ) as { [K in keyof S]?: true }

  const picked = schema.pick(pickKeys as any)

  const requiredFields = spec.fields
    .filter(f => f.required === true && f.name in shape)

  if (!requiredFields.length)
    return picked

  return picked.superRefine((data, ctx) => {
    for (const field of requiredFields) {
      const value = (data as Record<string, unknown>)[field.name]
      let isEmpty = value === null || value === undefined || value === ''
      if (!isEmpty && Array.isArray(value)) {
        isEmpty = value.length === 0
      }
      if (!isEmpty && field.type === 'rich-text' && typeof value === 'string') {
        isEmpty = value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === ''
      }
      if (isEmpty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'This field is required',
          path: [field.name],
        })
      }
    }
  })
}
