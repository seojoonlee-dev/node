import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';

export const NewFile = Mark.create({
  name: 'newFile',
  inclusive: false,

  addAttributes() {
    return {
      filename: {
        default: "no name was provided",
        parseHTML: element => element.getAttribute('data-filename'),
        renderHTML: attributes => {
          return { 
            'data-filename': attributes.filename,
            'href': '#', 
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-type="new-file"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-type': 'new-file' }), 0];
  },

  markdownTokenizer: {
    name: 'newFile',
    level: 'inline',
    tokenize: (src, _tokens, lexer) => {
      const match = /^\[\[([^\]]+)\]\]/.exec(src)
      if (!match) return undefined
      
      return {
        type: 'newFile',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const content = helpers.parseInline(token.tokens || [])

    return helpers.applyMark('newFile', content, { filename: token.text }) 
  },

  renderMarkdown: (mark, helpers) => {
    const content = helpers.renderChildren(mark)
    return `[[${content}]]`
  },

  addInputRules() {
    return [
      markInputRule({
        find: /\[\[([^\]]+)\]\]\s$/,
        type: this.type,
        getAttributes: match => {
          return { filename: match[1] };
        }
      }),
    ]
  },
})