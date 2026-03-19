import * as postgresqlSchema from './postgresql'

const schema = postgresqlSchema

// import * as sqliteSchema from './sqlite'

// const schema = sqliteSchema

export const { categories, posts, postsToTags, tags, users } = schema
