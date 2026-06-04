import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';

export interface NewFileOptions {
  url?: string;
}

export const NewFile = Mark.create<NewFileOptions>({
  name: 'newFile',
  inclusive: false,

  addOptions() {
    return {
      url: '',
    }
  },

  addAttributes() {
    return {
      filepath: {
        default: "no name was provided",
        parseHTML: element => element.getAttribute('data-filepath'),
        renderHTML: attributes => {
          return { 
            'data-filepath': attributes.filepath,
            'href': `${this.options.url || ''}/${attributes.filepath}`,
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
    return helpers.applyMark('newFile', content, { filepath: token.text })
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
          return { filepath: match[1] };
        }
      }),
    ]
  },
})