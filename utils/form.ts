import {
    type ZodTypeAny,
    ZodObject,
    ZodOptional,
    ZodDefault,
    ZodEffects,
    ZodString,
    ZodNumber,
    ZodBoolean,
    ZodDate,
    ZodEnum,
    ZodNativeEnum,
} from 'zod'

type Rules = Record<string, unknown>

interface FieldSpec {
    name: string
    label: string
    type: string
    required: boolean
    rules: Rules
    enumValues?: string[]
    defaultValue?: unknown
}

interface FormSpec {
    fields: FieldSpec[]
}

function startCase(s: string) {
    return s
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_\-]+/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase())
}

function unwrap(t: ZodTypeAny): ZodTypeAny {
    let cur = t
    while (true) {
        if (cur instanceof ZodOptional || cur instanceof ZodDefault) {
            cur = cur._def.innerType
            continue
        }
        if (cur instanceof ZodEffects) {
            cur = cur._def.schema
            continue
        }
        break
    }
    return cur
}

export function zodToFormSpec(schema: ZodObject<any>): FormSpec {
    const shape = schema.shape as Record<string, ZodTypeAny>
    const fields: FieldSpec[] = []

    for (const [name, zodType] of Object.entries(shape)) {
        const required = !zodType.isOptional()
        const base = unwrap(zodType)

        let type = 'text'
        const rules: Rules = {}
        let enumValues: string[] | undefined
        let defaultValue: unknown

        if ('_def' in zodType && (zodType as any)._def.defaultValue !== undefined) {
            defaultValue = (zodType as any)._def.defaultValue()
        }

        if (base instanceof ZodEnum) {
            type = 'select'
            enumValues = [...base.options]
        } else if (base instanceof ZodNativeEnum) {
            type = 'select'
            enumValues = Object.values(base.enum).filter(
                (v): v is string => typeof v === 'string',
            )
        } else if (base instanceof ZodString) {
            const checks = base._def.checks ?? []
            if (checks.some((c) => c.kind === 'email')) {
                type = 'email'
                rules.email = true
            }
            checks.forEach((c) => {
                if (c.kind === 'min') rules.min = c.value
                if (c.kind === 'max') rules.max = c.value
                if (c.kind === 'regex') rules.regex = c.regex
            })
        } else if (base instanceof ZodNumber) {
            type = 'number'
            const checks = base._def.checks ?? []
            checks.forEach((c) => {
                if (c.kind === 'int') rules.int = true
                if (c.kind === 'min') rules.min = c.value
                if (c.kind === 'max') rules.max = c.value
            })
        } else if (base instanceof ZodBoolean) {
            type = 'checkbox'
        } else if (base instanceof ZodDate) {
            type = 'date'
        }

        fields.push({
            name,
            label: startCase(name),
            type,
            required,
            rules,
            enumValues,
            defaultValue,
        })
    }

    return { fields }
}
