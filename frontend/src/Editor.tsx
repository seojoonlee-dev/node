import { useEffect, useState, type ChangeEvent } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import './Editor.css';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  onTitleChange: (value: string) => void;
}

function Editor({ content, onChange, placeholder = "Start typing your node here...", title, onTitleChange }: EditorProps) {
  const titleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const titleChangeSave = (event: ChangeEvent<HTMLInputElement>) => {
    onTitleChange(event.target.value);
  };

  useEffect(() => {
    setTitle(title);
  }, [title]);

  const [value, setTitle] = useState(title);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty', 
      }),
    ],
    content: content, 
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getHTML();

    if (content !== currentContent && !editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div>
      <div className="tiptap-container">
        <input type="text" value={value} onChange={titleChange} onBlur={titleChangeSave} id="titleEdit"></input>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default Editor;