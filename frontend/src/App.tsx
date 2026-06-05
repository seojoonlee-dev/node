import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import Editor from './Editor';
import './style/App.css';
import { fetchFilesList, loadFile, saveFile, renameFile, createFile, deleteFile } from './Api';

const FileList = memo(({ files, onCreate }: { files: string[], onCreate: (path:string) => void }) => {
  const { '*': parsedFilePath } = useParams();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const parsedList = useMemo(() => {
    const parsed = files.map((fullPath) => {
      const parts = fullPath.split('/');
      return {
        dirPath: fullPath.substring(0, fullPath.lastIndexOf('/')),
        name: parts[parts.length - 1].replace(/\.md$/, ''),
        depth: Math.max(0, parts.length - 2),
        segments: parts.slice(0, -1),
      };
    });

    const hasChildSet = new Set<string>();
    parsed.forEach(({ dirPath }) => {
      let current = dirPath;
      while (current.includes('/')) {
        current = current.substring(0, current.lastIndexOf('/'));
        hasChildSet.add(current);
      }
    });

    return parsed.sort((a, b) => {
      const minLen = Math.min(a.segments.length, b.segments.length);
      
      for (let i = 0; i < minLen; i++) {
        const segA = a.segments[i];
        const segB = b.segments[i];
        
        if (segA.toLowerCase() !== segB.toLowerCase()) {
          return segA.localeCompare(segB);
        }
      }
      return a.segments.length - b.segments.length;
    }).map(item => ({
      ...item,
      hasChildren: hasChildSet.has(item.dirPath)
    }));
  }, [files]);

  const visibleList = parsedList.filter(item => 
    !Object.keys(collapsed).some(p => collapsed[p] && item.dirPath.startsWith(p + '/'))
  );

  return (
    <div id="nodesItems">
      {visibleList.map(({ dirPath, name, depth, hasChildren }) => (
        <div key={dirPath} style={{ paddingLeft: depth * 10 }}>
          <div style={{ backgroundColor: parsedFilePath == dirPath ? "#282828" : "rgba(0,0,0,0)" }} className='node'>
            {hasChildren ? (
              <button 
                onClick={() => setCollapsed(prev => ({ ...prev, [dirPath]: !prev[dirPath] }))}
                className='expandButton'
              >
                <span style={{
                  display: 'inline-block',
                  transition: 'transform 0.1s ease',
                  transform: collapsed[dirPath] ? 'rotate(0deg)' : 'rotate(90deg)'
                }}>
                  ❯
                </span>
              </button>
            ) : <p style={{ width: "10px", cursor: "default" }}>T</p>}
            <Link to={`/${dirPath}`} style={{ display: "flex", flex: 1, textDecoration: "none" }}>
              <button className="button">{name}</button>
            </Link>
            <div></div>
            <button onClick={() => onCreate(dirPath)} id="addButton">+</button> 
          </div>
        </div>
      ))}
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

  const navigate = useNavigate();
  const filePath = getFilePath(parsedFilePath);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const cacheRef = useRef<Record<string, string>>({});
  const [popupOpen, setPopupOpen] = useState(false);
  const [sideBarOpen, toggleSideBar] = useState(true);

  // sidebar
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 200;
  }); 

  const sidebarRef = useRef<HTMLDivElement>(null);
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 1 && sidebarRef.current) {
      const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
      const rawWidth = e.clientX - sidebarLeft;
      const newWidth = Math.max(120, Math.min(rawWidth, 400));
      setSidebarWidth(newWidth); 
    }
  };
  
  // popup
  useEffect(() => {
    if (popupOpen) {
      const timer = setTimeout(() => setPopupOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [popupOpen]);

  // fetch
  const fetchFiles = useCallback(async () => {
    try {
      const data = await fetchFilesList();
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

  // load
  useEffect(() => {
    const handleLoadFile = async () => {
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
        const data = await loadFile(filePath);
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

    handleLoadFile();
  }, [filePath, parsedFilePath]);

  // save
  const handleSaveFile = useCallback(async () => {
    if (!filePath) return;
    
    try {
      await saveFile(filePath, content);
      setPopupOpen(true);
      cacheRef.current[filePath] = content;
    } catch (error) {
      alert("Couldn't save: " + error);
    }
  }, [filePath, content]);

  // rename
  const handleRenameFile = useCallback(async (newTitle: string) => {
    if (!filePath || !newTitle.trim()) return;

    try {
      const data = await renameFile(filePath, newTitle);
      
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

  // create
  const handleCreateFile = useCallback(async (path:string, filename?:string) => {
    try {
      const data = await createFile(path, filename);
      
      if (data.success) {
        cacheRef.current[data.filePath] = '';
        await fetchFiles();
        navigate(`/${data.filePath}`); 
      }
    } catch (error) {
      console.error('Create failed:', error);
    }
  }, [navigate, fetchFiles]);

  // delete
  const handleDeleteFile = useCallback(async () => {
    if (!filePath) {
      alert("No file selected to delete!");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete "${fileName}"?`);
    if (!confirmDelete) return;

    try {
      await deleteFile(filePath);
      delete cacheRef.current[filePath];
      await fetchFiles();
      setContent('');
      navigate('/');
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [filePath, fileName, navigate, fetchFiles]);

  // save shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile]);

  // autosave
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback((newContent: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!filePath) return;
      saveFile(filePath, newContent).then(() => {
        cacheRef.current[filePath] = newContent;
      }).catch(err => console.error('Autosave failed:', err))
    }, 700);
  }, [filePath]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, []);

  return (
    <>
      <div id="view">
        <header id="header">
          <button onClick={() => toggleSideBar(!sideBarOpen)} className='headerButton'><img src='/sidebar.png' style={{width: "100%"}} className='headerImage' alt="Toggle Sidebar"/></button>
          <button onClick={handleSaveFile} className='headerButton'><img src='/save.png' style={{width: "100%"}} className='headerImage' alt="Save File"/></button>
          <button onClick={handleDeleteFile} className='headerButton'><img src='/delete.png' style={{width: "100%"}} className='headerImage' alt="Delete File"/></button>
          <button onClick={() => handleCreateFile("")} className='headerButton'><img src='/plus.png' style={{width: "100%"}} className='headerImage' alt="Create File"/></button>
          <div style={{marginTop: "auto"}} />
          <button onClick={() => navigate("/settings")} className='headerButton'><img src='/settings.png' style={{width: "100%"}} className='headerImage' alt="Settings"/></button>
        </header>
        <div id="nodes" ref={sidebarRef} style={{ width: `${sidebarWidth}px`, display: sideBarOpen ? "flex" : "none" }}>
            <div className='list'>
              <h1 style={{ margin: "5px 0px", paddingLeft: "5px" }}>Nodes</h1>
            
              <hr id="divider"></hr>

              {loading && <p>Loading files...</p>}
              {error && <p style={{ color: 'red' }}>{error}</p>}
              
              {!loading && !error && files.length === 0 && (
                  <p>No nodes found. Create a new node!</p>
              )}

              {!loading && !error && (
                <FileList files={files} onCreate={handleCreateFile} />
              )}
            </div>
            <div
              style={{ minWidth: "10px", height: "100%", cursor: "col-resize", position: "absolute", right: "-5px", zIndex: 99 }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                document.body.style.userSelect = "none";
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                document.body.style.userSelect = "";
                localStorage.setItem("sidebarWidth", sidebarWidth.toString());
              }}
              onPointerMove={handlePointerMove}
            />
        </div>
        <div id="editor">
          <Editor 
            rawContent={content} 
            onChange={(newContent) => { setContent(newContent); debouncedSave(newContent) }}
            title={fileName ? fileName : "Select or create a file"} 
            onTitleChange={handleRenameFile}
            createFile={(filename) => handleCreateFile((parsedFilePath ? parsedFilePath : '/'), filename)}
          />
        </div>
      </div>
      <div className={`popup ${popupOpen ? 'open' : ''}`}>
        <div className="popup-content">
          <p>Saved!</p>
        </div>
      </div>
    </>
  );
}

function Settings() {
  const navigate = useNavigate();

  function changeServer() {
    let ip = prompt("Enter the address of the server. (example: http://xxx.xxx.xxx.xxx:3001) ");
    if (ip) { 
      localStorage.setItem('serverIp', ip);
      navigate("/");
    }
  }

  return (
    <div>
      <p>Settings</p>
      <button onClick={changeServer}>change server</button>
      <button onClick={() => navigate("/")}>go back</button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/*" element={<MainWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}