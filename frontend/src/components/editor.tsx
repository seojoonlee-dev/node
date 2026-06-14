import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { livePreview } from '../extensions/livePreview';
import '../style/editor.css';

interface EditorProps {
  rawContent: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  onTitleChange: (value: string) => Promise<boolean>;
  // Used once wikilinks return in a later phase; harmless to receive now.
  createFile: (value?: string) => void;
}

// Phase 1: source-mode markdown highlighting. Live Preview decorations (hiding
// the markers, rendering inline) arrive in a later phase. The CodeMirror
// document IS the markdown, so there is no lossy round-trip — what you type is
// exactly what gets saved.
const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: 'bold' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: t.heading3, fontSize: '1.25em', fontWeight: 'bold' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: "'Fira Code', 'Courier New', monospace", color: '#e0c9a6' },
  { tag: [t.link, t.url], color: '#7aa2f7', textDecoration: 'underline' },
  { tag: t.quote, color: '#9aaab0', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta], color: '#6f6f6f' },
]);

const editorTheme = EditorView.theme(
  {
    '&': { color: '#FFF0E3', backgroundColor: 'transparent', height: '100%' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.5', overflow: 'auto', paddingBottom: '50vh' },
    '.cm-content': { caretColor: '#FFF0E3', paddingRight: '10px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#FFF0E3' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#3a3a3a',
    },
    '.cm-placeholder': { color: '#959595' },
  },
  { dark: true },
);

function Editor({ rawContent, onChange, placeholder = 'Start typing your note here...', title, onTitleChange }: EditorProps) {
  const { '*': parsedFilePath } = useParams();

  const prevFilePath = useRef(parsedFilePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Keep the latest onChange without recreating the editor, and suppress the
  // change event we fire ourselves when syncing external content in.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const settingExternal = useRef(false);

  const invalidChars = /[\\/:*?"<>|]/;

  const [value, setTitle] = useState(title);
  const [showTitleError, toggleTitleError] = useState(false);

  const titleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setTitle(inputValue);
    toggleTitleError(invalidChars.test(inputValue));
  };

  const titleChangeSave = async () => {
    const trimmedValue = value.trim();

    if (invalidChars.test(trimmedValue)) {
      setTitle(title);
      toggleTitleError(false);
      return;
    }

    if (trimmedValue && title !== trimmedValue) {
      const renamed = await onTitleChange(trimmedValue);
      if (!renamed) setTitle(title);
    } else {
      setTitle(title);
    }
  };

  useEffect(() => {
    setTitle(title);
  }, [title]);

  // Create the editor once.
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: rawContent,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(markdownHighlight),
          livePreview,
          EditorView.lineWrapping,
          cmPlaceholder(placeholder),
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !settingExternal.current) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Created once; content/file syncing is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external content changes (file switches, loads, autosave restores)
  // into the editor without clobbering what the user is actively typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isFileChange = prevFilePath.current !== parsedFilePath;
    const current = view.state.doc.toString();

    if (isFileChange || (!view.hasFocus && rawContent !== current)) {
      if (rawContent !== current) {
        settingExternal.current = true;
        view.dispatch({ changes: { from: 0, to: current.length, insert: rawContent } });
        settingExternal.current = false;
      }
      if (isFileChange) prevFilePath.current = parsedFilePath;
    }
  }, [rawContent, parsedFilePath]);

  return (
    <div>
      <div className="editor">
        <div className="editor-title">
          <input
            type="text"
            value={value}
            onChange={titleChange}
            onBlur={titleChangeSave}
            className="editor-title-input"
          />
          <p className="editor-path">{parsedFilePath && '/' + parsedFilePath}</p>
        </div>
        <hr />
        <div className="cm-host" ref={containerRef} />
      </div>
      <p className={`editor-error ${showTitleError ? 'is-visible' : ''}`}>
        File names can't contain \, /, :, *, ?, ", &lt;, &gt;, and |.
      </p>
    </div>
  );
}

export default Editor;
