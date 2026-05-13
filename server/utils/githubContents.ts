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

function authHeaders(token: string): HeadersInit {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function getGithubJsonFile<T = unknown>(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GetGithubFileResult<T>> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path.replace(/^\//, '')}`)
  if (ref) {
    url.searchParams.set('ref', ref)
  }
  const res = await fetch(url, { headers: authHeaders(token) })
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
      statusMessage: body?.message || `GitHub API error (${res.status})`,
    })
  }
  if (body.type !== 'file' || !body.content || !body.sha) {
    throw createError({
      statusCode: 500,
      statusMessage: 'GitHub response is not a single file with content.',
    })
  }
  const decoded = Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8')
  let parsed: T
  try {
    parsed = JSON.parse(decoded) as T
  }
  catch {
    throw createError({
      statusCode: 422,
      statusMessage: 'File is not valid JSON.',
    })
  }
  return { parsed, sha: body.sha, encoding: body.encoding }
}

export async function putGithubJsonFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  payload: GithubFilePayload,
): Promise<{ commitSha?: string }> {
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
  if (res.status === 409) {
    throw createError({
      statusCode: 409,
      statusMessage: body?.message || 'GitHub file changed on the server (sha conflict). Refresh and try again.',
    })
  }
  if (!res.ok) {
    throw createError({
      statusCode: res.status >= 500 ? 502 : 400,
      statusMessage: body?.message || `GitHub API error (${res.status})`,
    })
  }
  return { commitSha: body?.commit?.sha }
}
