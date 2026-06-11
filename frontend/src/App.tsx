import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import Editor from './Editor';
import './style/App.css';
import { TintedImage } from './helpers/TintedImage';
import { Settings } from './Settings';
import { fetchFilesList, loadFile, saveFile, renameFile, createFile, deleteFile } from './helpers/Api';
import { GraphView, migrateSavedPositions } from './GraphView';

const FileList = memo(({ files, onCreate, onDelete, onRename }: { files: string[], onCreate: (path:string) => void, onDelete: (path:string) => void, onRename: (path:string, newTitle:string) => void }) => {
  const { '*': parsedFilePath } = useParams();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string, value: string } | null>(null);
  const closeMenu = () => setContextMenu(null);

  const invalidChars = /[\\/:*?"<>|]/;

  const commitRename = () => {
    if (!renaming) return;
    const trimmed = renaming.value.trim();
    const currentName = renaming.path.split('/').pop();
    if (trimmed && trimmed !== currentName && !invalidChars.test(trimmed)) {
      onRename(renaming.path, trimmed);
    }
    setRenaming(null);
  };

  useEffect(() => {
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu]);

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
    <div className="file-tree">
      {visibleList.map(({ dirPath, name, depth, hasChildren }) => (
        <div 
          key={dirPath} 
          style={{ paddingLeft: depth * 10 }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, path: dirPath });
          }}
        >
          <div className={`file-tree-node ${parsedFilePath === dirPath ? 'is-active' : ''}`}>
            {hasChildren ? (
              <button 
                onClick={() => setCollapsed(prev => ({ ...prev, [dirPath]: !prev[dirPath] }))}
                className="btn-expand"
              >
                <span className={`icon-arrow ${collapsed[dirPath] ? 'is-collapsed' : ''}`}>
                  ❯
                </span>
              </button>
            ) : <p className="file-tree-spacer">T</p>}
            {renaming?.path === dirPath ? (
              <input
                className="file-tree-rename"
                value={renaming.value}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => setRenaming({ path: dirPath, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onBlur={commitRename}
              />
            ) : (
              <Link to={`/${dirPath}`} className="file-tree-link">
                <button className="btn-link">{name}</button>
              </Link>
            )}
            <button onClick={() => onCreate(dirPath)} className="btn-add">+</button> 
          </div>
        </div>
      ))}
      <button onClick={() => onCreate('')} className="btn-create">+</button>

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(contextMenu.path);
              setContextMenu(null);
            }}
          >
            Copy File Path
          </button>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setRenaming({ path: contextMenu.path, value: contextMenu.path.split('/').pop() || '' });
              setContextMenu(null);
            }}
          >
            Rename File
          </button>
          <button
            className="context-menu-item is-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(contextMenu.path);
              setContextMenu(null);
            }}
          >
            Delete File
          </button>
        </div>
      )}
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
      const newWidth = Math.max(150, Math.min(rawWidth, 400));
      setSidebarWidth(newWidth); 
    }
  };

  const [showGraph, setShowGraph] = useState(() => localStorage.getItem('showGraph') === 'true');

  const updateShowGraph = useCallback((value: boolean) => {
    setShowGraph(value);
    localStorage.setItem('showGraph', String(value));
  }, []);

  const location = useLocation();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location;
      updateShowGraph(false);
    }
  }, [location, updateShowGraph]);
  
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
  const handleRenameFile = useCallback(async (dirPath: string | undefined, newTitle: string) => {
    if (!dirPath || !newTitle.trim()) return;
    const targetFilePath = getFilePath(dirPath);

    try {
      const data = await renameFile(targetFilePath, newTitle);

      if (data.success) {
        Object.keys(cacheRef.current).forEach((key) => {
          if (key === targetFilePath || key.startsWith(dirPath + '/')) {
            delete cacheRef.current[key];
          }
        });
        if (targetFilePath === filePath) {
          cacheRef.current[getFilePath(data.filePath)] = content;
        }
        migrateSavedPositions(dirPath, data.filePath);
        await fetchFiles();
        if (parsedFilePath === dirPath) {
          navigate(`/${data.filePath}`);
        } else if (parsedFilePath && parsedFilePath.startsWith(dirPath + '/')) {
          navigate(`/${data.filePath}${parsedFilePath.slice(dirPath.length)}`);
        }
      }
    } catch (error) {
      alert("Couldn't rename: " + error);
    }
  }, [filePath, content, parsedFilePath, navigate, fetchFiles]);

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
  const handleDeleteFile = useCallback(async (pathToDelete: string) => {
    if (!pathToDelete) return;

    const targetFilePath = getFilePath(pathToDelete); 
    const targetFileName = pathToDelete.split('/').pop() || pathToDelete;

    const confirmDelete = window.confirm(`Are you sure you want to delete "${targetFileName}"?`);
    if (!confirmDelete) return;

    try {
      await deleteFile(targetFilePath);
      delete cacheRef.current[targetFilePath];
      await fetchFiles();
      
      if (targetFilePath === filePath) {
        setContent('');
        navigate('/');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert("Couldn't delete: " + error);
    }
  }, [filePath, navigate, fetchFiles]);

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
      <div className="l-app">
        <div className="l-header">
          <button className="btn-header" onClick={() => toggleSideBar(!sideBarOpen)}>
            <TintedImage src='/sidebar.png' alt="Toggle Sidebar" />
          </button>
          <button className="btn-header" onClick={() => navigate("/settings/general")}>
            <TintedImage src='/settings.png' alt="Settings" tintColor='#FFF0E3'/>
          </button>
          <div className="spacer" />
          <button className="btn-header" onClick={() => updateShowGraph(!showGraph)}>
            {showGraph ?
              <TintedImage src='/file.png' alt="editor" /> :
              <TintedImage src='/graph.png' alt="graph" />
            }
          </button>
        </div>
        <div 
          className={`l-sidebar ${sideBarOpen ? 'is-open' : ''}`}
          ref={sidebarRef} 
          style={{ 
            width: sideBarOpen ? `${sidebarWidth}px` : '0px',
            opacity: sideBarOpen ? 1 : 0
          }}
        >
          <div className="sidebar-content">
            {loading && <p>Loading files...</p>}
            {error && <p className="sidebar-error">{error}</p>}
            
            {!loading && !error && files.length === 0 && (
                <p>No notes found. Create a new note!</p>
            )}

            {!loading && !error && (
              <FileList files={files} onCreate={handleCreateFile} onDelete={handleDeleteFile} onRename={handleRenameFile} />
            )}
          </div>
          <div
            className="drag-handle"
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
        <div className="l-main">
        {showGraph ? (
          <GraphView 
            files={files} 
            onNodeClick={(path) => {
              const dirPath = path.substring(0, path.lastIndexOf('/'));
              navigate(`/${dirPath}`);
              updateShowGraph(false);
            }}
          />
        ) : (
          <Editor 
            rawContent={content} 
            onChange={(newContent) => { setContent(newContent); debouncedSave(newContent) }}
            title={fileName ? fileName : "Select or create a file"}
            onTitleChange={(newTitle) => handleRenameFile(parsedFilePath, newTitle)}
            createFile={(filename) => handleCreateFile((parsedFilePath ? parsedFilePath : '/'), filename)}
          />
        )}
      </div>
      </div>
      <div className={`popup ${popupOpen ? 'is-open' : ''}`}>
        <div className="popup-content">
          <p>Saved!</p>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/settings/*" element={<Settings to={'/'} />} />
        <Route path="/*" element={<MainWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}