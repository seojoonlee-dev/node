import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';

// Live Preview: hide the markdown syntax markers and let syntaxHighlighting
// render the formatting inline. Markers on the line(s) the cursor/selection
// touches are revealed so they stay editable — the core Obsidian behavior.

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

// Lines (1-based) touched by any selection range — markers here stay visible.
function activeLines(view: EditorView): Set<number> {
  const lines = new Set<number>();
  const { doc } = view.state;
  for (const range of view.state.selection.ranges) {
    const first = doc.lineAt(range.from).number;
    const last = doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
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

        // Render a divider for horizontal rules (reveal raw on the active line).
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
          case 'LinkMark':
            builder.add(node.from, node.to, hidden);
            break;
          case 'CodeMark':
            // Hide inline-code backticks; leave fenced-code fences visible.
            if (node.node.parent?.name === 'InlineCode') builder.add(node.from, node.to, hidden);
            break;
          case 'URL':
          case 'LinkTitle':
            // Hide the (url) portion of a link, keeping just the visible text.
            if (node.node.parent?.name === 'Link') builder.add(node.from, node.to, hidden);
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
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
