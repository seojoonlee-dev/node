import { useEffect, useState, useMemo, useRef, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { Indent } from './extentions/Indent';
import { NewFile } from './extentions/NewFile';
import './style/Editor.css';

interface EditorProps {
  rawContent: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  onTitleChange: (value: string) => void;
}

// fix this later
const preserveMarkdownNewlines = (markdown: string): string => {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const parts = normalized.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part) => {
      // ignore code blocks
      if (part.startsWith('```')) {
        return part;
      }
      
      return part.replace(/\n{3,}/g, (match) => {
        const emptyParagraphsCount = Math.floor((match.length - 2) / 2);
        
        if (emptyParagraphsCount <= 0) return '\n\n';
        
        const emptyParagraphsHTML = Array(emptyParagraphsCount).fill('<p></p>').join('\n');
        
        return `\n\n${emptyParagraphsHTML}\n\n`;
      });
    })
    .join('');
};

function Editor({ rawContent, onChange, placeholder = "Start typing your note here...", title, onTitleChange }: EditorProps) {
  const { '*': parsedFilePath } = useParams();
  const prevFilePath = useRef(parsedFilePath);

  const navigate = useNavigate();
  
  const content = useMemo(() => preserveMarkdownNewlines(rawContent), [rawContent]);
  
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

  const titleChangeSave = () => {
    const trimmedValue = value.trim();

    if(invalidChars.test(trimmedValue)) {
      setTitle(title);
      toggleTitleError(false);
      return;
    }

    if (trimmedValue && title !== trimmedValue) {
      onTitleChange(trimmedValue);
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
    content: content, 
    contentType: 'markdown',
    editorProps: {
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        
        // handle links
        if (target.nodeName === 'A' && target.dataset.type === 'new-file') {
          event.preventDefault(); 
          
          const filename = target.dataset.filename;
          navigate(`${filename}`);
          
          return true;
        }
        
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    
    const currentContent = editor.getMarkdown();
    const isFileChange = prevFilePath.current !== parsedFilePath;

    if (isFileChange || (content !== currentContent)) {
      
      editor.commands.setContent(content, { 
        emitUpdate: false,
        contentType: 'markdown'
      });

      if (isFileChange) {
        //clear file history
        prevFilePath.current = parsedFilePath;
      }
    }
  }, [content, editor, parsedFilePath]);

  return (
    <div>
      <div className="tiptap-container">
        <input 
          type="text" 
          value={value} 
          onChange={titleChange} 
          onBlur={titleChangeSave} 
          id="titleEdit"
        />
        <hr />
        <EditorContent editor={editor} />
      </div>
      <p style={{ display: showTitleError ? "flex" : "none" }} className='errorMessage'>File names can't contain \, /, :, *, ?, ", &lt;, &gt;, and |.</p>
    </div>
  );
}

export default Editor;