export const getTitle = () => {
  const config = useRuntimeConfig()
  if (config.public.autoadmin?.title) {
    return config.public.autoadmin.title
  }
  return 'AutoAdmin'
}
