import type { MarkdownConfig } from '@lezer/markdown';

const BRACKET_OPEN = 91; // [
const BRACKET_CLOSE = 93; // ]
const NEWLINE = 10;

// Teaches the markdown parser about `[[Note]]` wikilinks so they become real
// syntax-tree nodes (WikiLink, with two WikiLinkMark children for the brackets).
// Live Preview then hides the brackets and makes the name clickable.
export const WikiLink: MarkdownConfig = {
  defineNodes: ['WikiLink', 'WikiLinkMark'],
  parseInline: [
    {
      name: 'WikiLink',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== BRACKET_OPEN || cx.char(pos + 1) !== BRACKET_OPEN) return -1;

        const end = cx.end;
        for (let i = pos + 2; i < end; i++) {
          const code = cx.char(i);
          if (code === NEWLINE) return -1;
          if (code === BRACKET_CLOSE && cx.char(i + 1) === BRACKET_CLOSE) {
            const name = cx.slice(pos + 2, i);
            if (!name || name.includes('[') || name.includes(']')) return -1;
            return cx.addElement(
              cx.elt('WikiLink', pos, i + 2, [
                cx.elt('WikiLinkMark', pos, pos + 2),
                cx.elt('WikiLinkMark', i, i + 2),
              ]),
            );
          }
        }
        return -1;
      },
    },
  ],
};
