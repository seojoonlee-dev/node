import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import Editor from './Editor';
import './style/App.css';

// file list in the sidebar
const FileList = memo(({ files, onCreate }: { files: string[], onCreate: () => void }) => {
  const parsedList = useMemo(() => {
    return files
      .map((fullPath) => {
        const parts = fullPath.split('/');
        const name = parts[parts.length - 1].replace(/\.md$/, '');
        const depth = Math.max(0, parts.length - 2);
        const segments = parts.slice(0, -1);
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));

        return { dirPath, name, depth, segments };
      })
      .sort((a, b) => {
        const minLen = Math.min(a.segments.length, b.segments.length);
        
        for (let i = 0; i < minLen; i++) {
          const segA = a.segments[i].toLowerCase();
          const segB = b.segments[i].toLowerCase();
          
          if (segA !== segB) {
            // if README folder exists it wil always stay on top of the list.
            if (segA === 'readme') return -1;
            if (segB === 'readme') return 1;
            return segA.localeCompare(segB);
          }
        }
        return a.segments.length - b.segments.length;
      });
  }, [files]);

  return (
    <div id="nodesItems">
      {parsedList.map(({ dirPath, name, depth }) => (
        <div 
          key={ dirPath } 
          style={{ paddingLeft: (depth * 10 )}}
        >
          <Link to={`/${dirPath}`} style={{ textDecoration: 'none' }}>
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
  const { '*': parsedFilePath } = useParams();

  const getFilePath = (path?:string) => {
    if (!path) {
      return "";
    } else {
      const segments = path.split('/');

      const lastSegment = segments[segments.length - 1];

      return `${path}/${lastSegment}.md`;
    }
  };

  const filePath = getFilePath(parsedFilePath);

  const [fileName, setFileName] = useState('');
  const navigate = useNavigate();
  const [serverIp, setServerIp] = useState(localStorage.getItem('serverIp') ? localStorage.getItem('serverIp') : "http://localhost:3001");
  
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const cacheRef = useRef<Record<string, string>>({});
  const [popupOpen, setPopupOpen] = useState(false);

  // sidebar
  const savedWidth = localStorage.getItem('sidebarWidth') ? localStorage.getItem('sidebarWidth') : "250";
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 1 && sidebarRef.current) {
      const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
      const rawWidth = e.clientX - sidebarLeft;
      
      const newWidth = Math.max(160, Math.min(rawWidth, 360));
      
      sidebarRef.current.style.width = `${newWidth}px`;
    }
  };

  // saved popup
  useEffect(() => {
    if (popupOpen) {
      const timer = setTimeout(() => setPopupOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [popupOpen]);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`${serverIp}/api/files`);
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
  }, [serverIp]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        setContent('');
        setFileName('');
        return;
      }
      setFileName(parsedFilePath?.split("/").at(-1) || '');

      if (cacheRef.current[filePath] !== undefined) {
        setContent(cacheRef.current[filePath]);
      } else {
        setContent('');
      }
      
      try {
        const response = await fetch(`${serverIp}/api/load?filePath=${encodeURIComponent(filePath)}`);
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
  }, [filePath, serverIp]);

  const saveFile = useCallback(async () => {
    if (!filePath) return;
    
    try {
      const response = await fetch(`${serverIp}/api/save`, {
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
  }, [filePath, content, serverIp]);

  const renameFile = useCallback(async (newTitle: string) => {
    if (!filePath || !newTitle.trim()) return;

    try {
      const response = await fetch(`${serverIp}/api/rename`, {
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
  }, [filePath, content, navigate, fetchFiles, serverIp]);

  const createFile = useCallback(async () => {
    try {
      const response = await fetch(`${serverIp}/api/create`, {
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
  }, [filePath, navigate, fetchFiles, serverIp]);

  const deleteFile = useCallback(async () => {
    if (!filePath) {
      alert("No file selected to delete!");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete "${fileName}"?`);
    if (!confirmDelete) return;

    try {
      const response = await fetch(`${serverIp}/api/delete?filePath=${encodeURIComponent(filePath)}`, {
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
  }, [filePath, fileName, navigate, fetchFiles, serverIp]);

  function changeServer() {
    let ip = prompt("Enter the address of the server. (example: http://xxx.xxx.xxx.xxx:3001) ");
    if (ip) { 
      setServerIp(ip);
      localStorage.setItem('serverIp', ip);
      navigate("/");
    }
  }
  // save shortcut listener
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
        <div id="nodes" ref={sidebarRef} style={{ width: `${savedWidth}px` }}>
            <header id="header">
              <button onClick={saveFile} className='headerButton'><img src='/save.png' style={{width: "100%"}} className='headerImage' /></button>
              <button onClick={deleteFile} className='headerButton'><img src='/delete.png' style={{width: "100%"}} className='headerImage' /></button>
              <div style={{marginTop: "auto"}} />
              <button onClick={changeServer} className='headerButton'><img src='/settings.png' style={{width: "100%"}} className='headerImage' /></button>
            </header>
            <div className='list'>
              <h1 style={{ margin: "5px 0px", paddingBottom: "15px", paddingLeft: "5px" }}>Nodes</h1>
            
              {loading && <p>Loading files...</p>}
              {error && <p style={{ color: 'red' }}>{error}</p>}
              
              {!loading && !error && files.length === 0 && (
                  <p>No nodes found. Create a new node!</p>
              )}

              {!loading && !error && (
                <FileList files={files} onCreate={createFile} />
              )}
            </div>
            <div
              style={{ width: "12px", cursor: "col-resize", position: "relative", left: "4px" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                document.body.style.userSelect = "none";
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                document.body.style.userSelect = "";
                
                if (sidebarRef.current) {
                  const finalWidth = sidebarRef.current.style.width.replace('px', '');
                  localStorage.setItem("sidebarWidth", finalWidth);
                }
              }}
              onPointerMove={handlePointerMove}
            />
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