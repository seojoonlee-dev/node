import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { livePreview } from '../extensions/livePreview';
import { WikiLink } from '../extensions/wikiLink';
import '../style/editor.css';

interface EditorProps {
  rawContent: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  onTitleChange: (value: string) => Promise<boolean>;
  // Invoked when a [[wikilink]] is clicked: creates the note (or navigates to it
  // if it already exists), matching the previous behavior.
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

  // Code-token colors for highlighted fenced code blocks (dark, VS Code-ish).
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#c586c0' },
  { tag: [t.string, t.special(t.string)], color: '#ce9178' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6a9955', fontStyle: 'italic' },
  { tag: [t.number, t.integer, t.float], color: '#b5cea8' },
  { tag: [t.bool, t.null, t.atom], color: '#569cd6' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dcdcaa' },
  { tag: [t.typeName, t.className, t.namespace], color: '#4ec9b0' },
  { tag: [t.propertyName, t.attributeName, t.definition(t.variableName)], color: '#9cdcfe' },
  { tag: [t.operator], color: '#d4d4d4' },
  { tag: t.regexp, color: '#d16969' },
  { tag: t.tagName, color: '#569cd6' },
  { tag: [t.punctuation, t.bracket, t.escape], color: '#d4d4d4' },
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

function Editor({ rawContent, onChange, placeholder = 'Start typing your note here...', title, onTitleChange, createFile }: EditorProps) {
  const { '*': parsedFilePath } = useParams();

  const prevFilePath = useRef(parsedFilePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Keep the latest callbacks without recreating the editor, and suppress the
  // change event we fire ourselves when syncing external content in.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const createFileRef = useRef(createFile);
  createFileRef.current = createFile;
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
          keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown({ base: markdownLanguage, codeLanguages: languages, extensions: [WikiLink] }),
          syntaxHighlighting(markdownHighlight),
          livePreview,
          EditorView.lineWrapping,
          cmPlaceholder(placeholder),
          editorTheme,
          // Click a rendered link to open it / a wikilink to create-or-open the note.
          EditorView.domEventHandlers({
            mousedown: (event) => {
              const target = event.target as HTMLElement | null;
              if (!target) return false;

              const linkEl = target.closest('.cm-link');
              if (linkEl) {
                const href = linkEl.getAttribute('data-href') || '';
                if (/^(https?:|mailto:)/i.test(href)) {
                  event.preventDefault();
                  window.open(href, '_blank', 'noopener,noreferrer');
                  return true;
                }
                return false;
              }

              const wikiEl = target.closest('.cm-wikilink');
              if (wikiEl) {
                const name = wikiEl.getAttribute('data-wikilink') || '';
                if (name) {
                  event.preventDefault();
                  createFileRef.current(name);
                  return true;
                }
              }
              return false;
            },
          }),
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
