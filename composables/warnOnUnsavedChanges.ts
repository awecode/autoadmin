export function useWarnOnUnsavedChanges(
  formState: Ref<Record<string, any>>,
  initialValues?: Record<string, any>,
) {
  const navigationWarningEnabled = true
  const warnOnEmptyForm = false
  const warnOnSingleChange = false

  const originalState = ref<Record<string, any>>({})
  const hasUnsavedChanges = ref(false)

  // Initialize original state and track changes
  watchEffect(() => {
    if (initialValues && Object.keys(originalState.value).length === 0) {
      originalState.value = { ...initialValues }
    }
  })

  // Watch for changes in form state
  watch(formState, (newState) => {
    if (!warnOnEmptyForm && Object.keys(initialValues || {}).length === 0) {
      originalState.value = { ...newState }
      hasUnsavedChanges.value = false
      return
    }
    if (!warnOnSingleChange && Object.keys(originalState.value).length === 0) {
      originalState.value = { ...newState }
      hasUnsavedChanges.value = false
      return
    }

    // Check if current state differs from original
    hasUnsavedChanges.value = JSON.stringify(newState) !== JSON.stringify(originalState.value)
  }, { deep: true })

  // Browser beforeunload warning
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (hasUnsavedChanges.value) {
      event.preventDefault()
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return event.returnValue
    }
  }

  // Router navigation warning
  const router = useRouter()

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Add router beforeEach guard for navigation warning
    router.beforeEach((to, from, next) => {
      if (hasUnsavedChanges.value && navigationWarningEnabled) {
        // eslint-disable-next-line no-alert
        const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
        if (confirmed) {
          hasUnsavedChanges.value = false
          next()
        } else {
          next(false)
        }
      } else {
        next()
      }
    })
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return {
    hasUnsavedChanges,
  }
}
