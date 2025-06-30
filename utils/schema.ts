import type { FormSpec } from './form'

/**
 * Processes a schema by removing any fields that are not defined in the form spec.
 * This ensures that only fields present in the spec are validated.
 */
export function processSchema(schema: Record<string, any>, spec: FormSpec): Record<string, any> {
  if (!schema || !spec?.fields) {
    return {}
  }

  const processedSchema: Record<string, any> = {}
  const specFieldNames = new Set(spec.fields.map(field => field.name))

  // Only include schema properties for fields that exist in the spec
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    if (specFieldNames.has(fieldName)) {
      processedSchema[fieldName] = fieldSchema
    }
  }

  return processedSchema
}
