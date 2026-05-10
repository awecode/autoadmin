/** Opaque revision for optimistic writes (GitHub blob sha or local mtime token). */
export type JsonStorageRevision = string

export interface JsonStorageReadResult {
  parsed: unknown
  revision: JsonStorageRevision
}

export interface JsonStorageWriteInput {
  /** UTF-8 JSON text to persist (including trailing newline if desired). */
  bodyUtf8: string
  /** Revision from last read; use `'0'` when creating a new local file. */
  revision: JsonStorageRevision
  /** Optional commit message (GitHub only). */
  message?: string
}

/**
 * Pluggable persistence for JSON admin resources (GitHub Contents API, local filesystem, etc.).
 */
export interface JsonStorageRepository {
  readonly adapterKind: 'github' | 'local'

  read: () => Promise<JsonStorageReadResult>

  /**
   * Replace file contents. Implementations should enforce `revision` against concurrent edits
   * (GitHub sha, local mtime) and surface 409 when stale.
   */
  write: (input: JsonStorageWriteInput) => Promise<void>
}
