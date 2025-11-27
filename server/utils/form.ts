import type { FieldType } from '#layers/autoadmin/server/utils/registry'
import type { ZodObject, ZodType } from 'zod'
import type { SzType } from 'zodex'
import { defu } from 'defu'
import { ZodEnum, ZodNumber, ZodUnion } from 'zod'
import { colKey } from './drizzle'
import { getPrimaryKeyColumn } from './relation'
import { mapZodCheckToRules, unwrapZodType } from './zod'

type Rules = Record<string, unknown>
export type Option = string | number | { label?: string, value: string | number, count?: number }

export interface FieldSpec {
  name: string
  label?: string
  type: FieldType
  required?: boolean
  rules?: Rules
  options?: Option[]
  defaultValue?: unknown
  fieldAttrs?: Record<string, any>
  inputAttrs?: Record<string, any>
  help?: string
  hint?: string
  description?: string
  /** Configuration for file/image upload fields. Only applicable when type is 'file' or 'image' */
  fileConfig?: {
    /** Accept is a list of file extensions, e.g. ['.jpg', '.jpeg', '.png', '.svg'] */
    accept?: `.${string}`[]
    /** Prefix is a path that will be added used to store the file in the object storage bucket, e.g. 'uploads/' */
    prefix?: string
    /** Max size is the maximum size of the file in bytes, e.g. 1024 * 1024 for 1MB */
    maxSize?: number
  }
  /** Configuration for relation fields, automatically generated */
  relationConfig?: {
    /** The endpoint to fetch the choices for the relation */
    choicesEndpoint?: string
    /** The key of the related model */
    relatedConfigKey?: string
    /** Whether to enable the create button for the relation */
    enableCreate?: boolean
    /** Whether to enable the edit button for the relation */
    enableUpdate?: boolean
    /** The name of the foreign column */
    foreignRelatedColumnName?: string
    /** The name of the foreign label column */
    foreignLabelColumnName?: string
    // /** Whether to enable the delete button for the relation */
    // enableDelete?: boolean
    // /** Whether to enable the view button for the relation */
    // enableView?: boolean
    // /** Whether to enable the search button for the relation */
  }
  _defined?: boolean
}
export interface FormSpec {
  fields: FieldSpec[]
  values?: Record<string, any>
  warnOnUnsavedChanges?: boolean
  labelString?: string
  endpoint?: string
  listTitle?: string
  schema?: SzType
  slugFields?: Record<string, string[]>
}

export function zodToFormSpec(schema: ZodObject<Record<string, ZodType>>): FormSpec {
  const shape = schema.shape

  const fields: FieldSpec[] = Object.entries(shape).map(([name, zodType]) => {
    const { innerType, isOptional, defaultValue } = unwrapZodType(zodType)

    const definition = innerType.def
    const definitionTypeKey = definition?.type

    let type: FieldType = 'text'
    const rules: Rules = {}
    let options

    switch (definitionTypeKey) {
      case 'string':
        type = 'text'
        break
      case 'number':
        type = 'number'
        if (definition.checks) {
          for (const check of definition.checks) {
            Object.assign(rules, mapZodCheckToRules(check))
          }
        }
        // Check for top-level minValue and maxValue on the innerType object itself,
        // which is where they appear in the provided schema structure.
        if (innerType instanceof ZodNumber) {
          if (innerType.minValue != null) {
            rules.min = innerType.minValue
          }
          if (innerType.maxValue != null) {
            rules.max = innerType.maxValue
          }
        }
        break
      case 'boolean':
        type = 'boolean'
        break
      case 'enum':
        type = 'select'
        if (innerType instanceof ZodEnum) {
          options = innerType.options
        }
        break
      case 'date':
        type = 'date'
        break
      case 'bigint':
        type = 'number' // HTML inputs do not have a 'bigint' type, so 'number' is the closest, separate from number because no min/max
        break
      case 'custom':
        // Drizzle-zod uses a custom type for blobs, which we'll map to 'file'.
        type = 'blob'
        break
      case 'record':
        type = 'json'
        break
      case 'union':
        // If a union contains a record type, it's likely a JSON field from drizzle-zod.
        if (innerType instanceof ZodUnion) {
          if (innerType.options?.some((opt) => {
            return opt._zod.def.type === 'record'
          })) {
            type = 'json'
          }
        }
        break
    }

    return {
      name,
      label: name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      type,
      required: !isOptional,
      rules,
      options,
      defaultValue,
    }
  })

  return { fields }
}

export const useDefinedFields = (spec: FormSpec, cfg: AdminModelConfig) => {
  let definedFieldSpecs: FieldSpec[] = []
  if (cfg.update.formFields) {
    definedFieldSpecs = cfg.update.formFields.map((field) => {
      if (typeof field === 'string') {
        const fieldSpec = spec.fields.find(f => f.name === field)
        if (fieldSpec) {
          return { ...fieldSpec, _defined: true }
        }
      } else if (typeof field === 'object' && field !== null && 'name' in field) {
        const fieldSpec = spec.fields.find(f => f.name === field.name)
        if (fieldSpec) {
          return { ...defu(field, fieldSpec), _defined: true }
        }
      }
      throw createError({
        statusCode: 500,
        statusMessage: `Invalid form field: ${typeof field === 'object' && 'name' in field ? field.name : field}`,
      })
    })
  } else {
    definedFieldSpecs = spec.fields
  }
  if (typeof cfg.fields !== 'undefined') {
    definedFieldSpecs = definedFieldSpecs.map((field) => {
      const fieldSpec = cfg.fields!.find(f => f.name === field.name)
      if (fieldSpec) {
        return { ...defu(fieldSpec, field), _defined: true }
      }
      return field
    })
  }
  if (cfg.o2m || cfg.m2m) {
    // If the primary key is not in the form fields, add it to the end of the form fields for o2m/m2m relations
    const pkColumnName = colKey(getPrimaryKeyColumn(cfg.model))
    if (!definedFieldSpecs.some(f => f.name === pkColumnName)) {
      const pkFieldSpec = spec.fields.find(f => f.name === pkColumnName)
      spec.fields = definedFieldSpecs
      if (pkFieldSpec) {
        definedFieldSpecs.push(pkFieldSpec)
      }
    }
  }
  return definedFieldSpecs
}
