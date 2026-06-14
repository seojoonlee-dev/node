import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

// Live Preview: hide the markdown syntax markers and let syntaxHighlighting
// render the formatting inline. Markers on the line(s) the cursor/selection
// touches are revealed so they stay editable — the core Obsidian behavior.
// Links and wikilinks additionally get a clickable mark carrying their target;
// the click handler lives in the editor (see editor.tsx).

const hidden = Decoration.replace({});

class RuleWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-hr';
    return el;
  }
  eq() {
    return true;
  }
}
const ruleDeco = Decoration.replace({ widget: new RuleWidget() });

class BulletWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-bullet';
    el.textContent = '•';
    return el;
  }
  eq() {
    return true;
  }
}
const bulletDeco = Decoration.replace({ widget: new BulletWidget() });

// Header that replaces the opening ```lang fence: language label on the left,
// a copy button on the right. The code text is captured so copy is self-contained.
class CodeHeaderWidget extends WidgetType {
  lang: string;
  code: string;
  constructor(lang: string, code: string) {
    super();
    this.lang = lang;
    this.code = code;
  }
  eq(other: CodeHeaderWidget) {
    return other.lang === this.lang && other.code === this.code;
  }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-code-header';

    const lang = document.createElement('span');
    lang.className = 'cm-code-lang';
    lang.textContent = this.lang || 'text';

    const copy = document.createElement('button');
    copy.className = 'cm-code-copy';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('mousedown', (e) => e.preventDefault());
    copy.addEventListener('click', (e) => {
      e.preventDefault();
      void navigator.clipboard?.writeText(this.code);
      copy.textContent = 'Copied';
      window.setTimeout(() => {
        copy.textContent = 'Copy';
      }, 1200);
    });

    wrap.append(lang, copy);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

// Lines (1-based) touched by any selection range — markers here stay visible.
// When the editor isn't focused there is no active line, so everything renders
// as preview (no stray markers on reload or after clicking away).
function activeLines(view: EditorView): Set<number> {
  const lines = new Set<number>();
  if (!view.hasFocus) return lines;
  const { doc } = view.state;
  for (const range of view.state.selection.ranges) {
    const first = doc.lineAt(range.from).number;
    const last = doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

function childrenByName(node: SyntaxNode) {
  const out: Record<string, SyntaxNode[]> = {};
  for (let c = node.firstChild; c; c = c.nextSibling) {
    (out[c.name] ??= []).push(c);
  }
  return out;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const active = activeLines(view);
  const { doc } = view.state;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const onActiveLine = active.has(doc.lineAt(node.from).number);

        // Standard link: [text](url) -> show "text" only, clickable.
        if (node.name === 'Link') {
          if (!onActiveLine) {
            const kids = childrenByName(node.node);
            const marks = kids.LinkMark ?? [];
            const url = kids.URL?.[0];
            const open = marks[0];
            const close = marks[1];
            if (open && close && url && open.to < close.from) {
              const href = doc.sliceString(url.from, url.to);
              builder.add(open.from, open.to, hidden);
              builder.add(
                open.to,
                close.from,
                Decoration.mark({ class: 'cm-link', attributes: { 'data-href': href } }),
              );
              builder.add(close.from, node.to, hidden);
            }
          }
          return false;
        }

        // Wikilink: [[Note]] -> show "Note" only, clickable.
        if (node.name === 'WikiLink') {
          if (!onActiveLine) {
            const marks = childrenByName(node.node).WikiLinkMark ?? [];
            const open = marks[0];
            const close = marks[1];
            if (open && close && open.to < close.from) {
              const name = doc.sliceString(open.to, close.from);
              builder.add(open.from, open.to, hidden);
              builder.add(
                open.to,
                close.from,
                Decoration.mark({ class: 'cm-wikilink', attributes: { 'data-wikilink': name } }),
              );
              builder.add(close.from, close.to, hidden);
            }
          }
          return false;
        }

        // Fenced code: background box on every line (always on). The opening
        // ```lang line becomes a header (language + copy); the closing ``` is
        // hidden. Both reveal as raw when the cursor is on that line. Syntax
        // highlighting itself is handled by the embedded language parser.
        if (node.name === 'FencedCode') {
          const kids = childrenByName(node.node);
          const marks = kids.CodeMark ?? [];
          const info = kids.CodeInfo?.[0];
          const codeText = kids.CodeText?.[0];
          const openMark = marks[0];
          const closeMark = marks.length > 1 ? marks[marks.length - 1] : undefined;
          const code = codeText ? doc.sliceString(codeText.from, codeText.to) : '';

          const startLine = doc.lineAt(node.from).number;
          const endLine = doc.lineAt(Math.max(node.from, node.to - 1)).number;
          const openLine = openMark ? doc.lineAt(openMark.from).number : -1;
          const closeLine = closeMark ? doc.lineAt(closeMark.from).number : -1;

          for (let ln = startLine; ln <= endLine; ln++) {
            const line = doc.line(ln);
            const cls =
              'cm-code-block' +
              (ln === startLine ? ' cm-code-block-first' : '') +
              (ln === endLine ? ' cm-code-block-last' : '');
            builder.add(line.from, line.from, Decoration.line({ class: cls }));

            if (active.has(ln)) continue; // editing this fence line: show it raw

            if (openMark && ln === openLine) {
              const lang = info ? doc.sliceString(info.from, info.to) : '';
              const headerTo = info ? info.to : openMark.to;
              builder.add(openMark.from, headerTo, Decoration.replace({ widget: new CodeHeaderWidget(lang, code) }));
            }
            if (closeMark && ln === closeLine) {
              builder.add(closeMark.from, closeMark.to, hidden);
            }
          }
          return false;
        }

        // Inline code: hide the backticks and give the content a chip background.
        if (node.name === 'InlineCode') {
          if (!onActiveLine) {
            const marks = childrenByName(node.node).CodeMark ?? [];
            const open = marks[0];
            const close = marks[marks.length - 1];
            if (open && close && open.to <= close.from) {
              builder.add(open.from, open.to, hidden);
              if (open.to < close.from) {
                builder.add(open.to, close.from, Decoration.mark({ class: 'cm-inline-code' }));
              }
              builder.add(close.from, close.to, hidden);
            }
          }
          return false;
        }

        if (node.name === 'HorizontalRule') {
          if (!onActiveLine) builder.add(node.from, node.to, ruleDeco);
          return;
        }

        if (onActiveLine) return;

        switch (node.name) {
          case 'HeaderMark':
          case 'QuoteMark': {
            // Swallow the single space after the marker so text isn't indented.
            let end = node.to;
            if (doc.sliceString(end, end + 1) === ' ') end += 1;
            builder.add(node.from, end, hidden);
            break;
          }
          case 'EmphasisMark':
          case 'StrikethroughMark':
            builder.add(node.from, node.to, hidden);
            break;
          case 'ListMark':
            // Render bullet-list markers as a bullet; ordered lists keep numbers.
            if (node.node.parent?.parent?.name === 'BulletList') {
              builder.add(node.from, node.to, bulletDeco);
            }
            break;
        }
      },
    });
  }
  return builder.finish();
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
