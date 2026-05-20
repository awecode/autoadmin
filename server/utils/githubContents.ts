export interface GithubFilePayload {
  message: string
  content: string
  sha?: string
  branch?: string
}

export interface GetGithubFileResult<T = unknown> {
  parsed: T
  sha: string
  encoding: string
}

export interface GithubReadOptions {
  /** Throw 413 when the file exceeds this size in bytes. */
  maxBytes?: number
  /** Emit a console.warn (once per path) when the file exceeds this size. */
  warnAtBytes?: number
  /**
   * Opt-in: cache responses by ETag in-process and send `If-None-Match` on
   * subsequent reads. GitHub returns 304 without spending rate-limit budget when
   * unchanged. Disabled by default because the cache lives at module scope,
   * which is undesirable for some deployment topologies (e.g. multi-tenant
   * shared isolates, or anywhere a stale read could hide a manual repo edit).
   */
  cacheReads?: boolean
}

export interface GithubWriteOptions {
  /** Throw 413 when the new file content exceeds this size in bytes. */
  maxBytes?: number
  /** Emit a console.warn (once per path) when the new content exceeds this size. */
  warnAtBytes?: number
}

// Tracks paths that have already triggered a `warnAtBytes` warning, so the same
// soft-limit warning isn't logged on every request.
const sizeWarned = new Set<string>()

interface CacheEntry {
  etag: string
  sha: string
  encoding: string
  // Parsed JSON is `unknown` in the cache; callers re-assert their generic.
  parsed: unknown
}

// Module-level LRU cache for read responses. ETag-conditional requests against
// GitHub return 304 without counting toward the rate limit, so caching the
// parsed value alongside the etag is a meaningful latency + quota win on
// repeated reads of the same resource (e.g. admin list re-renders). Gated by
// the per-call `cacheReads` flag; when disabled (the default), the cache is
// never populated. Writes always invalidate the entry regardless.
const READ_CACHE_MAX = 64
const readCache = new Map<string, CacheEntry>()

function cacheKey(owner: string, repo: string, path: string, ref?: string): string {
  return `${owner}/${repo}@${ref ?? '*'}:${path}`
}

function cacheTouch(key: string, entry: CacheEntry): void {
  if (readCache.has(key)) {
    readCache.delete(key)
  }
  else if (readCache.size >= READ_CACHE_MAX) {
    const oldest = readCache.keys().next().value
    if (oldest !== undefined) {
      readCache.delete(oldest)
    }
  }
  readCache.set(key, entry)
}

function cacheGet(key: string): CacheEntry | undefined {
  const entry = readCache.get(key)
  if (entry) {
    // Refresh LRU position.
    readCache.delete(key)
    readCache.set(key, entry)
  }
  return entry
}

function authHeaders(token: string): HeadersInit {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Awecode-Autoadmin',
  }
}

function locator(owner: string, repo: string, path: string, ref?: string): string {
  return `${owner}/${repo}:${path}${ref ? `@${ref}` : ''}`
}

function checkSize(
  size: number,
  owner: string,
  repo: string,
  path: string,
  ref: string | undefined,
  opts: GithubReadOptions | GithubWriteOptions | undefined,
): void {
  const where = locator(owner, repo, path, ref)
  if (opts?.maxBytes !== undefined && size > opts.maxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: `File ${where} is ${size} bytes, exceeds configured maxBytes=${opts.maxBytes}.`,
    })
  }
  if (opts?.warnAtBytes !== undefined && size > opts.warnAtBytes && !sizeWarned.has(where)) {
    sizeWarned.add(where)
    console.warn(
      `[autoadmin] ${where} is ${size} bytes (warnAtBytes=${opts.warnAtBytes}). `
      + `GitHub Contents API inlines content only under 1 MB; files between 1 MB and 100 MB `
      + `take an extra Blobs API round-trip on every read. See docs/storage-limits.md.`,
    )
  }
}

export async function getGithubJsonFile<T = unknown>(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  opts?: GithubReadOptions,
): Promise<GetGithubFileResult<T>> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path.replace(/^\//, '')}`)
  if (ref) {
    url.searchParams.set('ref', ref)
  }
  const where = locator(owner, repo, path, ref)
  const cacheEnabled = opts?.cacheReads === true
  const key = cacheEnabled ? cacheKey(owner, repo, path, ref) : ''
  const cached = cacheEnabled ? cacheGet(key) : undefined
  const headers: Record<string, string> = { ...(authHeaders(token) as Record<string, string>) }
  if (cached) {
    headers['If-None-Match'] = cached.etag
  }
  const res = await fetch(url, { headers })

  // 304 Not Modified: return cached parsed value without spending rate-limit budget.
  if (cacheEnabled && res.status === 304 && cached) {
    return { parsed: cached.parsed as T, sha: cached.sha, encoding: cached.encoding }
  }

  const text = await res.text()
  let body: any
  try {
    body = JSON.parse(text)
  }
  catch {
    body = { message: text }
  }
  if (!res.ok) {
    throw createError({
      statusCode: res.status === 404 ? 404 : res.status >= 500 ? 502 : 400,
      statusMessage: body?.message
        ? `${body.message} (${where})`
        : `GitHub API error (${res.status}) for ${where}`,
    })
  }
  if (body.type !== 'file' || !body.sha) {
    throw createError({
      statusCode: 500,
      statusMessage: `GitHub response for ${where} is not a regular file (type=${body?.type ?? 'unknown'}).`,
    })
  }

  if (typeof body.size === 'number') {
    checkSize(body.size, owner, repo, path, ref, opts)
  }

  // The Contents API omits `content` for files >1 MB (returns encoding "none").
  // Fall back to the Git Blobs API, which streams base64 content up to 100 MB.
  let base64Content: string | undefined = typeof body.content === 'string' && body.content.length > 0 ? body.content : undefined
  if (!base64Content || body.encoding === 'none') {
    const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${body.sha}`
    const blobRes = await fetch(blobUrl, { headers: authHeaders(token) })
    const blobText = await blobRes.text()
    let blobBody: any
    try {
      blobBody = JSON.parse(blobText)
    }
    catch {
      blobBody = { message: blobText }
    }
    if (!blobRes.ok) {
      throw createError({
        statusCode: blobRes.status >= 500 ? 502 : 400,
        statusMessage: blobBody?.message
          ? `${blobBody.message} (${where}, blob ${body.sha.slice(0, 8)})`
          : `GitHub Blobs API error (${blobRes.status}) for ${where}`,
      })
    }
    if (blobBody.encoding !== 'base64' || typeof blobBody.content !== 'string') {
      throw createError({
        statusCode: 500,
        statusMessage: `GitHub Blobs API response for ${where} is missing base64 content (encoding=${blobBody?.encoding ?? 'unknown'}).`,
      })
    }
    base64Content = blobBody.content
  }

  // Explicit narrowing after the if-block: TypeScript can't follow the cross-branch
  // dataflow proving `base64Content` is now a string.
  if (typeof base64Content !== 'string') {
    throw createError({
      statusCode: 500,
      statusMessage: `Internal error: no base64 content resolved for ${where}.`,
    })
  }
  const decoded = Buffer.from(base64Content.replace(/\n/g, ''), 'base64').toString('utf8')
  if (!decoded) {
    throw createError({
      statusCode: 422,
      statusMessage: `File ${where} is empty.`,
    })
  }
  let parsed: T
  try {
    parsed = JSON.parse(decoded) as T
  }
  catch (e: any) {
    throw createError({
      statusCode: 422,
      statusMessage: `File ${where} is not valid JSON: ${e?.message ?? 'parse error'}.`,
    })
  }

  if (cacheEnabled) {
    const etag = res.headers.get('etag')
    if (etag) {
      cacheTouch(key, { etag, sha: body.sha, encoding: body.encoding, parsed })
    }
  }

  return { parsed, sha: body.sha, encoding: body.encoding }
}

export async function putGithubJsonFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  payload: GithubFilePayload,
  opts?: GithubWriteOptions,
): Promise<{ commitSha?: string }> {
  const where = locator(owner, repo, path, payload.branch)
  if (opts?.maxBytes !== undefined || opts?.warnAtBytes !== undefined) {
    // payload.content is base64; check the raw byte size that will land in the repo.
    const rawSize = Buffer.byteLength(payload.content, 'base64')
    checkSize(rawSize, owner, repo, path, payload.branch, opts)
  }
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path.replace(/^\//, '')}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body: any
  try {
    body = JSON.parse(text)
  }
  catch {
    body = { message: text }
  }
  // Defensive: drop any cached read for this path on every PUT (success or
  // conflict). Cache invalidation runs unconditionally so it stays correct
  // regardless of whether reads opted in to caching.
  const cKey = cacheKey(owner, repo, path, payload.branch)
  if (res.status === 409) {
    readCache.delete(cKey)
    throw createError({
      statusCode: 409,
      statusMessage: body?.message
        ? `${body.message} (${where})`
        : `GitHub file ${where} changed on the server (sha conflict). Refresh and try again.`,
    })
  }
  if (!res.ok) {
    throw createError({
      statusCode: res.status >= 500 ? 502 : 400,
      statusMessage: body?.message
        ? `${body.message} (${where})`
        : `GitHub API error (${res.status}) for ${where}`,
    })
  }
  readCache.delete(cKey)
  return { commitSha: body?.commit?.sha }
}

/** Test/diagnostic helper: clear the in-memory ETag cache. */
export function clearGithubReadCache(): void {
  readCache.clear()
}
