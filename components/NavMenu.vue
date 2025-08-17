<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { getIconForLabel } from '#layers/autoadmin/utils/string'

// import { portalTargetInjectionKey } from '@nuxt/ui/composables/usePortal.js'
// import { inject } from 'vue'

// if (import.meta.server) {
//   const portalTarget = inject(portalTargetInjectionKey, null)

//   if (!portalTarget) {
//     throw new Error(
//       `UApp is not present. Please wrap your app.vue with Nuxt UI's UApp app component. https://ui.nuxt.com/components/app`,
//     )
//   }
// }

const appConfig = useAppConfig()

const collapsed = useCookie<boolean>('sidebar-collapsed', {
  default: () => false,
  sameSite: true,
  httpOnly: false,
})

const items = useState<NavigationMenuItem[][]>('sidebar-items', () => {
  const allModels = useAdminRegistry().all()
  const links = allModels.filter(model => model.enableIndex).map(model => ({
    label: model.label,
    icon: model.icon || getIconForLabel(model.label),
    to: { name: 'autoadmin-list', params: { modelKey: model.key } },
    type: 'link' as const,
  }))

  return [
    appConfig.sidebar.topItems,
    [
      appConfig.sidebar.modelLabel,
      ...links,
    ],
    appConfig.sidebar.additionalItems,
  ]
})

const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set(_isDark) {
    colorMode.preference = _isDark ? 'dark' : 'light'
  },
})

const mobileMenuOpen = ref(false)
</script>

<template>
  <!-- Desktop Sidebar -->
  <div
    class="hidden md:block rounded-lg border border-gray-200 dark:border-gray-800 py-4 transition-all duration-300 ease-in-out mt-2 ml-1"
    :class="{ 'px-4': !collapsed }"
  >
    <div class="flex justify-between items-center mb-4 transition-all duration-300 ease-in-out">
      <div
        v-if="!collapsed"
        class="text-lg font-bold transition-opacity duration-300 ease-in-out"
      >
        {{ getAdminTitle() }}
      </div>
      <UTooltip :delay="0" :text="collapsed ? 'Expand' : 'Collapse'">
        <UButton
          class="transition-all duration-300 ease-in-out"
          color="neutral"
          variant="ghost"
          :class="{ 'mx-auto': collapsed }"
          :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          @click="collapsed = !collapsed"
        />
      </UTooltip>
    </div>
    <div class="transition-all duration-300 ease-in-out">
      <UNavigationMenu
        popover
        tooltip
        class="data-[orientation=vertical]:w-48 gap-4 transition-all duration-300 ease-in-out"
        orientation="vertical"
        :class="{ 'data-[orientation=vertical]:w-12 items-center': collapsed }"
        :collapsed="collapsed"
        :items="items"
      />
    </div>
  </div>

  <!-- Mobile Top Bar -->
  <div class="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton
          color="neutral"
          icon="i-lucide-menu"
          variant="ghost"
          @click="mobileMenuOpen = !mobileMenuOpen"
        />
        <div class="text-lg font-bold">
          {{ getAdminTitle() }}
        </div>
      </div>
      <ClientOnly v-if="!colorMode?.forced">
        <UButton
          color="neutral"
          variant="ghost"
          :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
          @click="isDark = !isDark"
        />
      </ClientOnly>
    </div>

    <!-- Mobile Menu Overlay -->

    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 bg-black opacity-80 z-40"
      @click="mobileMenuOpen = false"
    ></div>

    <!-- Mobile Menu Sidebar -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-250 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-if="mobileMenuOpen"
        class="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50"
      >
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="text-lg font-bold">
            {{ getAdminTitle() }}
          </div>
          <UButton
            color="neutral"
            icon="i-lucide-x"
            variant="ghost"
            @click="mobileMenuOpen = false"
          />
        </div>
        <div class="p-4">
          <UNavigationMenu
            orientation="vertical"
            :items="items"
          />
        </div>
      </div>
    </Transition>
  </div>

  <!-- Desktop Theme Toggle -->
  <div class="hidden md:block fixed bottom-4 left-4">
    <ClientOnly v-if="!colorMode?.forced">
      <UTooltip placement="left" :delay="0" :text="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
        <UButton
          color="neutral"
          variant="ghost"
          :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
          @click="isDark = !isDark"
        />

        <template #fallback>
          <div class="size-8"></div>
        </template>
      </UTooltip>
    </ClientOnly>
  </div>
</template>
