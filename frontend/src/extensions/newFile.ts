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

  // We intentionally do NOT register a `markdownTokenizer` here.
  // A custom inline tokenizer corrupts marked's inline lexer state: once an
  // ordered list is parsed, every following heading/paragraph loses its text
  // on load (renders as empty <br>). This is a @tiptap/markdown/marked bug
  // (still present in 3.26.1). Without the tokenizer, markdown parses cleanly;
  // `[[..]]` links are still created while typing via addInputRules below.

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