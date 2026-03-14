import process from 'node:process'
import * as postgresqlSchema from './postgresql'
import * as sqliteSchema from './sqlite'

const dialect = process.env.NUXT_DATABASE_DIALECT === 'postgresql' ? 'postgresql' : 'sqlite'
const schema = dialect === 'postgresql' ? postgresqlSchema : sqliteSchema

export const { categories, posts, postsToTags, tags, users } = schema
