import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import Editor from './Editor';
import './style/App.css';

const FileList = memo(({ files, onCreate }: { files: string[], onCreate: () => void }) => {
  const parsedList = useMemo(() => {
    return files
      .map((fullPath) => {
        const parts = fullPath.split('/');
        // Strip out extension for UI rendering
        const name = parts[parts.length - 1].replace(/\.txt$/, '');
        const depth = Math.max(0, parts.length - 2);
        const segments = parts.slice(0, -1); // Parent folder directories

        return { fullPath, name, depth, segments };
      })
      .sort((a, b) => {
        const minLen = Math.min(a.segments.length, b.segments.length);
        
        // Compare folder segments level by level
        for (let i = 0; i < minLen; i++) {
          const segA = a.segments[i].toLowerCase();
          const segB = b.segments[i].toLowerCase();
          
          if (segA !== segB) {
            // Pin README nodes to the top of the current directory level
            if (segA === 'readme') return -1;
            if (segB === 'readme') return 1;
            return segA.localeCompare(segB);
          }
        }
        // If paths match up to the minimum length, the shorter path (the parent) comes first
        return a.segments.length - b.segments.length;
      });
  }, [files]);

  return (
    <div id="nodesItems">
      {parsedList.map(({ fullPath, name, depth }) => (
        <div 
          key={fullPath} 
          style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : '0px' }}
        >
          <Link to={`/${fullPath}`} style={{ textDecoration: 'none' }}>
            <button className="button">
              {depth > 0 ? '↳ ' : ''}{name}
            </button>
          </Link>
        </div>
      ))}
      <button onClick={onCreate} id="addButton">+</button> 
    </div>
  );
});

FileList.displayName = 'FileList';

function MainWorkspace() {
  const { '*': filePath } = useParams(); 
  const [fileName, setFileName] = useState('');
  const navigate = useNavigate();
  
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const cacheRef = useRef<Record<string, string>>({});
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (popupOpen) {
      const timer = setTimeout(() => setPopupOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [popupOpen]);

  // Fetch updated directory array from backend
  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/files');
      const data = await response.json();
            
      if (data.success) {
        setFiles(data.files);
      } else {
         setError('Failed to load files from server.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Stale While Revalidate Data Loader
  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        setContent('');
        setFileName('');
        return;
      }

      const parsedFilePath = filePath.split("/").at(-1)?.replace(/\.txt$/, '');
      setFileName(parsedFilePath || '');

      if (cacheRef.current[filePath] !== undefined) {
        setContent(cacheRef.current[filePath]);
      } else {
        setContent('');
      }
      
      try {
        const response = await fetch(`/api/load?filePath=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success) {
          if (cacheRef.current[filePath] !== data.content) {
            setContent(data.content);
            cacheRef.current[filePath] = data.content;
          }
        }
      } catch (error) {
        console.error('Load failed:', error);
      }
    };

    loadFile();
  }, [filePath]);

  const saveFile = useCallback(async () => {
    if (!filePath) return;
    
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content }),
      });
      
      if (response.ok) {
        setPopupOpen(true);
        cacheRef.current[filePath] = content;
      }
    } catch (error) {
      alert("Couldn't save: " + error);
    }
  }, [filePath, content]);

  const renameFile = useCallback(async (newTitle: string) => {
    if (!filePath || !newTitle.trim()) return;

    try {
      const response = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, newTitle }),
      });
      const data = await response.json();
      
      if (data.success) {
        cacheRef.current[data.filePath] = content;
        if (data.filePath !== filePath) {
          delete cacheRef.current[filePath];
        }
        await fetchFiles();
        navigate(`/${data.filePath}`);
      }
    } catch (error) {
      alert("Couldn't rename: " + error);
    }
  }, [filePath, content, navigate, fetchFiles]);

  const createFile = useCallback(async () => {
    try {
      const response = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPath: filePath || '' }),
      });
      const data = await response.json();
      
      if (data.success) {
        cacheRef.current[data.filePath] = '';
        await fetchFiles();
        navigate(`/${data.filePath}`); 
      }
    } catch (error) {
      console.error('Create failed:', error);
    }
  }, [filePath, navigate, fetchFiles]);

  const deleteFile = useCallback(async () => {
    if (!filePath) {
      alert("No file selected to delete!");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete "${fileName}"?`);
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/delete?filePath=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        delete cacheRef.current[filePath];
        await fetchFiles();
        setContent('');
        navigate('/');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [filePath, fileName, navigate, fetchFiles]);

  // Command + S Shortcut Save Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  return (
    <>
      <div id="view">
        <div id="nodes">
            <header id="header">
              <button onClick={saveFile} className='headerButton'>save</button>
              <button onClick={deleteFile} className='headerButton'>delete</button>
            </header>
            <h1 style={{margin: "20px 0px"}}>Nodes</h1>
            
            {loading && <p>Loading files...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            {!loading && !error && files.length === 0 && (
                <p>No nodes found. Create a new node!</p>
            )}

            {!loading && !error && (
              <FileList files={files} onCreate={createFile} />
            )}
        </div>
        <div id="edit">
          <Editor 
            content={content} 
            onChange={setContent} 
            title={fileName ? fileName : "Select or create a file"} 
            onTitleChange={renameFile}
          />
        </div>
        <div className={`popup ${popupOpen ? 'open' : ''}`}>
          <div className="popup-content">
            <p>Saved!</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<MainWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}