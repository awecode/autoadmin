# Developing Locally

When developing locally, you can use autoadmin in your local project by adding the path to the autoadmin project directory as a layer to your nuxt.config.ts. Example:

```ts
export default defineNuxtConfig({
  extends: [
    '../autoadmin/.playground',
  ],
})
```

Drizzle ORM is a peer dependency of autoadmin. Installing it in your project will do for runtime. To get IDE support for Drizzle ORM within autoadmin project, you can instruct pnpm inside autoadmin project to use drizzle-orm from your project that utilizes autoadmin. Example:

```bash
rm -rf node_modules/drizzle-orm
pnpm store prune
pnpm add ../../wpress/node_modules/drizzle-orm --dir
git stash
```
