import * as postgresqlSchema from './postgresql'
import * as sqliteSchema from './sqlite'

// const dialect = process.env.NUXT_DATABASE_DIALECT === 'postgresql' ? 'postgresql' : 'sqlite'
const dialect = 'postgresql'
const schema = dialect === 'postgresql' ? postgresqlSchema : sqliteSchema

export const { categories, posts, postsToTags, tags, users } = schema
