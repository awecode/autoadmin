import process from 'node:process'
import * as postgresSchema from './postgres'
import * as sqliteSchema from './sqlite'

const dialect = process.env.NUXT_DATABASE_DIALECT === 'postgres' ? 'postgres' : 'sqlite'
const schema = dialect === 'postgres' ? postgresSchema : sqliteSchema

export const { categories, posts, postsToTags, tags, users } = schema
