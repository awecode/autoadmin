import { AwsClient } from 'aws4fetch'

export const s3Backend = {
  name: 's3',
  getClient: () => {
    const { s3 } = useRuntimeConfig()
    const s3Config = s3
    if (!s3Config.accessKey || !s3Config.secretKey || !s3Config.bucketName || !s3Config.endpointUrl || !s3Config.region) {
      throw new Error('Object storage is not configured correctly. Please check your environment variables.')
    }
    return new AwsClient({
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
      service: 's3',
      region: s3Config.region,
    })
  },

  checkIfFileExists: async (client: AwsClient, path: string) => {
    const { s3 } = useRuntimeConfig()
    const url = `${s3.endpointUrl}/${s3.bucketName}`
    const request = await client.sign(`${url}/${path}`, {
      method: 'GET',
    })
    const response = await fetch(request)
    if (response.status === 404 || response.status === 403) {
      return false
    }
    return response.ok
  },

  getPublicUrl: () => {
    const { s3 } = useRuntimeConfig()
    let publicUrl = s3.publicUrl || ''
    if (!publicUrl.endsWith('/')) {
      publicUrl = `${publicUrl}/`
    }
    return publicUrl
  },

  put: async (client: AwsClient, path: string, body: BodyInit, headers: Record<string, string>) => {
    const { s3 } = useRuntimeConfig()
    const url = `${s3.endpointUrl}/${s3.bucketName}`
    const request = await client.sign(`${url}/${path}`, {
      method: 'PUT',
      body,
      headers,
    })
    const response = await fetch(request)
    if (!response.ok) {
      throw new Error(`Error uploading file to object storage: ${response.statusText}`)
    }
  },

}
