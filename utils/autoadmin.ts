export const getTitle = () => {
  const config = useRuntimeConfig()
  if (config.public.autoAdmin?.title) {
    return config.public.autoAdmin.title
  }
  return 'AutoAdmin'
}
