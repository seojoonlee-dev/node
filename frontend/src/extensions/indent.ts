import { Extension, type KeyboardShortcutCommand } from '@tiptap/core'

const NBSP = '\u00A0'
const INDENT = NBSP.repeat(4)

const getLineStart = (editor: any) => {
  const { state } = editor
  const { $from } = state.selection
  return $from.start($from.depth)
}

const getLineText = (editor: any) => {
  const { state } = editor
  const { $from } = state.selection
  const node = $from.node($from.depth)
  return node.textContent
}

const indent: KeyboardShortcutCommand = ({ editor }) => {
  if (editor.can().sinkListItem('listItem'))
    return editor.chain().focus().sinkListItem('listItem').run()

  const { from } = editor.state.selection
  return editor.chain().focus()
    .insertContentAt(from, INDENT)
    .run()
}

const outdent: KeyboardShortcutCommand = ({ editor }) => {
  if (editor.can().liftListItem('listItem'))
    return editor.chain().focus().liftListItem('listItem').run()

  const text = getLineText(editor)
  if (!text.startsWith(INDENT)) return false

  const lineStart = getLineStart(editor)
  return editor.chain().focus()
    .deleteRange({ from: lineStart, to: lineStart + INDENT.length })
    .run()
}

const outdentAtHead: KeyboardShortcutCommand = ({ editor }) => {
  const { selection } = editor.state
  if (selection.$anchor.parentOffset === 0 && selection.from === selection.to) {
    return outdent({ editor } as any)
  }
  return false
}

export const Indent = Extension.create({
  name: 'indent',
  addKeyboardShortcuts() {
    return {
      Tab: indent,
      'Shift-Tab': outdent,
      Backspace: outdentAtHead,
      'Mod-]': indent,
      'Mod-[': outdent,
    }
  },
})