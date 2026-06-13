import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { Indent } from '../extensions/indent';
import { NewFile } from '../extensions/newFile';
import '../style/editor.css';

interface EditorProps {
  rawContent: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  onTitleChange: (value: string) => Promise<boolean>;
  createFile: (value?: string) => void;
}

function Editor({ rawContent, onChange, placeholder = "Start typing your note here...", title, onTitleChange, createFile }: EditorProps) {
  const { '*': parsedFilePath } = useParams();
  
  const prevFilePath = useRef(parsedFilePath);

  const lastSavedContent = useRef(rawContent);

  const invalidChars = /[\\/:*?"<>|]/;

  const [value, setTitle] = useState(title);
  const [showTitleError, toggleTitleError] = useState(false);

  const titleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setTitle(inputValue);

    if(invalidChars.test(inputValue)) {
      toggleTitleError(true);
    } else {
      toggleTitleError(false);
    }
  };

  const titleChangeSave = async () => {
    const trimmedValue = value.trim();

    if(invalidChars.test(trimmedValue)) {
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
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        orderedList: {
          keepMarks: true,
        },
      }),
      Markdown,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty', 
      }),
      Indent,
      NewFile
    ],
    content: rawContent,
    contentType: 'markdown',
    editorProps: {
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        
        if (target.nodeName === 'A' && target.dataset.type === 'new-file') {
          event.preventDefault(); 
          
          const filename = target.dataset.filename;
          createFile(filename);
          editor?.commands.blur();

          return true;
        }
        
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      const currentMarkdown = editor.getMarkdown();
      
      lastSavedContent.current = currentMarkdown;
      
      onChange(currentMarkdown);
    },
  });

  useEffect(() => {
    if (!editor) return;
    
    const isFileChange = prevFilePath.current !== parsedFilePath;

    if (isFileChange || (!editor.isFocused && rawContent !== lastSavedContent.current)) {      
      editor.commands.setContent(rawContent, {
        emitUpdate: false,
        contentType: 'markdown'
      });

      if (isFileChange) {
        prevFilePath.current = parsedFilePath;
      }
      
      lastSavedContent.current = rawContent;
    }
  }, [editor, rawContent, parsedFilePath]);

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
          <p className="editor-path">{parsedFilePath && ('/' + parsedFilePath)}</p>
        </div>
        <hr />
        <EditorContent editor={editor} />
      </div>
      <p className={`editor-error ${showTitleError ? 'is-visible' : ''}`}>File names can't contain \, /, :, *, ?, ", &lt;, &gt;, and |.</p>
    </div>
  );
}

export default Editor;