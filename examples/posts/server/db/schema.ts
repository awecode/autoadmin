import process from 'node:process'

const dialect = process.env.NUXT_DATABASE_DIALECT === 'postgres' ? 'postgres' : 'sqlite'
const schema = dialect === 'postgres'
  ? await import('./postgres')
  : await import('./sqlite')

export const { categories, posts, postsToTags, tags, users } = schema
