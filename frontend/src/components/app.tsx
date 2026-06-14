import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import Editor from './editor';
import '../style/app.css';
import { TintedImage } from './tintedImage';
import { Settings } from './settings';
import { ContextMenu } from './contextMenu';
import { toDirPath, nameOf, validateRename } from '../helpers/paths';
import { useNotes } from '../hooks/useNotes';
import { GraphView } from './graphView';
import { getStartupNote } from '../helpers/settings';

const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';

const FileList = memo(({ files, onCreate, onDelete, onRename }: { files: string[], onCreate: (path:string) => void, onDelete: (path:string) => void, onRename: (path:string, newTitle:string) => void }) => {
  const { '*': parsedFilePath } = useParams();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string, value: string } | null>(null);
  const closeMenu = useCallback(() => setContextMenu(null), []);

  const commitRename = () => {
    if (!renaming) return;
    const newTitle = validateRename(renaming.path, renaming.value);
    if (newTitle) {
      onRename(renaming.path, newTitle);
    }
    setRenaming(null);
  };

  const parsedList = useMemo(() => {
    const parsed = files.map((fullPath) => {
      const parts = fullPath.split('/');
      return {
        dirPath: toDirPath(fullPath),
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
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={closeMenu}
          onRename={(path) => setRenaming({ path, value: nameOf(path) })}
          onDelete={onDelete}
        />
      )}
    </div>
  );
});

FileList.displayName = 'FileList';

function MainWorkspace() {
  const navigate = useNavigate();
  const {
    files,
    loading,
    error,
    parsedFilePath,
    fileName,
    content,
    notFound,
    updateContent,
    saveCurrentFile,
    renameFile,
    createFile,
    deleteFile,
  } = useNotes();

  const [popupOpen, setPopupOpen] = useState(false);
  const [sideBarOpen, toggleSideBar] = useState(() => { const saved = localStorage.getItem("sideBarOpen"); return saved ? JSON.parse(saved) : true; })

  const location = useLocation();
  const prevLocationRef = useRef(location);

  // On load, redirect to the configured startup note (only when landing on the
  // home screen, so deep links and in-app navigation are left alone).
  useEffect(() => {
    if (window.location.pathname !== '/') return;
    const target = getStartupNote();
    if (!target) return;
    let cancelled = false;
    (async () => {
      // In the demo the note may still need seeding before we navigate to it.
      if (isDemo) {
        const { seedIfNeeded } = await import('../helpers/demoStore');
        await seedIfNeeded();
      }
      if (!cancelled) navigate('/' + target, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount (a fresh page load); in-app nav keeps this mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const withViewTransition = useCallback((update: () => void) => {
    if (!document.startViewTransition) {
      update();
      return;
    }
    document.startViewTransition(() => flushSync(update));
  }, []);

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

  // save shortcut
  const handleSave = useCallback(async () => {
    if (await saveCurrentFile()) {
      setPopupOpen(true);
    }
  }, [saveCurrentFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <>
      <div className="l-app">
        <div className="l-header">
          <button className="btn-header" onClick={() => {toggleSideBar(!sideBarOpen); localStorage.setItem("sideBarOpen", JSON.stringify(!sideBarOpen))}}>
            <TintedImage src='/menu.svg' alt="Toggle Sidebar" />
          </button>
          <button className="btn-header" onClick={() => navigate("/settings/general")}>
            <TintedImage src='/settings.svg' alt="Settings" />
          </button>
          <div className="spacer" />
          <button className="btn-header" onClick={() => withViewTransition(() => updateShowGraph(!showGraph))}>
            {showGraph ?
              <TintedImage src='/editor.svg' alt="editor" /> :
              <TintedImage src='/graph.svg' alt="graph" />
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
              <FileList files={files} onCreate={createFile} onDelete={deleteFile} onRename={renameFile} />
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
              const dirPath = toDirPath(path);
              withViewTransition(() => {
                navigate(`/${dirPath}`);
                updateShowGraph(false);
              });
            }}
            onNodeRename={renameFile}
            onNodeDelete={deleteFile}
          />
        ) : notFound ? (
          <div className="not-found">
            <h2>Note not found</h2>
            <p>"/{parsedFilePath}" doesn't exist or may have been deleted.</p>
            <Link to="/">Go back</Link>
          </div>
        ) : (
          <Editor
            rawContent={content}
            onChange={updateContent}
            title={fileName ? fileName : "Select or create a file"}
            onTitleChange={(newTitle) => renameFile(parsedFilePath, newTitle)}
            createFile={(filename) => createFile(parsedFilePath ?? '', filename)}
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