import Image from '@tiptap/extension-image'

export const AdvancedImage = Image.extend({
  addAttributes() {
    return {
      // Keep all the default attributes (like src, alt, title)
      ...this.parent?.(),
      // Add our custom float attribute
      float: {
        default: null,
        // Tell Tiptap how to read this from pasted HTML
        parseHTML: element => element.style.float,
        // Tell Tiptap how to output this into the editor DOM and v-model
        renderHTML: (attributes) => {
          if (!attributes.float) {
            return {}
          }

          // Automatically add a margin on the opposite side of the float
          // so the text doesn't touch the image
          const marginSide = attributes.float === 'left' ? 'right' : 'left'

          return {
            style: `float: ${attributes.float}; margin-${marginSide}: 1rem; margin-bottom: 1rem;`,
          }
        },
      },
    }
  },
})
