export default defineAppConfig({
  sidebar: {
    topItems: [
      {
        label: 'Dashboard',
        icon: 'i-lucide-home',
        to: { name: 'autoadmin-index' },
        type: 'link' as const,
      },
    ],
    modelLabel: {
      label: 'Entities',
      type: 'label' as const,
    },
    additionalItems: [
      {
        label: 'GitHub',
        icon: 'i-simple-icons-github',
        to: 'https://github.com/awecode/autoadmin/',
        target: '_blank',
      },
      {
        label: 'Help',
        icon: 'i-lucide-circle-help',
        to: 'https://awecode.com/contact',
        target: '_blank',
      },
    ],
  },
})
