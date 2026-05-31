export type ImageFloat = 'none' | 'left' | 'right'

export function parseFloatAttribute(element: HTMLElement): ImageFloat {
  if (element.classList.contains('content-image-float-left'))
    return 'left'
  if (element.classList.contains('content-image-float-right'))
    return 'right'
  const inlineFloat = element.style.cssFloat
  if (inlineFloat === 'left' || inlineFloat === 'right')
    return inlineFloat
  return 'none'
}

export function floatClassForValue(float: ImageFloat | null | undefined): string | undefined {
  if (float === 'left')
    return 'content-image-float-left'
  if (float === 'right')
    return 'content-image-float-right'
  return undefined
}

export function applyFloatClass(element: HTMLElement, float: ImageFloat | null | undefined) {
  element.classList.remove('content-image-float-left', 'content-image-float-right')
  const cls = floatClassForValue(float)
  if (cls)
    element.classList.add(cls)
}

export const imageFloatAttribute = {
  default: 'none' as ImageFloat,
  parseHTML: (element: HTMLElement) => parseFloatAttribute(element),
  renderHTML: (attributes: { float?: ImageFloat | null }) => {
    const cls = floatClassForValue(attributes.float)
    return cls ? { class: cls } : {}
  },
}
