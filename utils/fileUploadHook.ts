import type { InjectionKey } from 'vue'

/** Lets an upload hook read and write other fields of the form it was uploaded in. */
export interface AutoadminFormBridge {
  getFieldValue: (name: string) => unknown
  setFieldValue: (name: string, value: unknown) => void
}

export const autoadminFormBridgeKey: InjectionKey<AutoadminFormBridge> = Symbol('autoadmin-form-bridge')

export interface AutoadminFileUploadedPayload {
  /** Form field name, for example `pdfFile`. */
  name: string
  /** The local file the admin picked, before upload. */
  file: File
  /** Stored URL returned by the upload endpoint. */
  url: string
  /** Undefined when the uploader is used outside an AutoForm. */
  form?: AutoadminFormBridge
}

declare module '#app' {
  interface RuntimeNuxtHooks {
    /** Called after a file or image field uploads successfully. Hooks run in the browser only. */
    'autoadmin:file-uploaded': (payload: AutoadminFileUploadedPayload) => void | Promise<void>
  }
}
