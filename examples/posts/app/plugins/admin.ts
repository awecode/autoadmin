import { NuxtLink } from '#components'
import { useAdminClient } from '#layers/autoadmin/composables/adminClient'
import { h } from 'vue'

export default defineNuxtPlugin(() => {
  const { register } = useAdminClient()
  register('posts', {
    list: {
      fields: [
        {
          field: 'authorId.name',
          cell: ({ row }) => h(NuxtLink, { to: { name: 'autoadmin-list', params: { modelKey: 'users' }, query: { q: `${row.original.authorId__name}` } } }, () => row.getValue('authorId__name')+'x'),
        },
      ],
    },
  })
})
