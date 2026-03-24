export type HyperdriveBinding = { connectionString?: string }
export type HyperdriveBindingLike = string | HyperdriveBinding | undefined | null

export function getHyperdriveConnectionString(binding: HyperdriveBindingLike) {
  if (typeof binding === 'string') {
    return binding
  }
  return binding?.connectionString
}
