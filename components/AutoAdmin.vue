<template>
  <UApp>
    <div class="container max-w-none">
      <div class="flex-col flex md:flex-row gap-4">
        <NavMenu />
        <div class="flex-1 min-w-0 p-4">
          <slot></slot>
        </div>
      </div>
    </div>
  </UApp>
</template>
