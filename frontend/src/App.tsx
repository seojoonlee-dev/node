import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import Editor from './Editor';
import './App.css';

const FileList = memo(({ files, onCreate }: { files: string[], onCreate: () => void }) => {
  return (
    <div id="nodesItems">
        {files.map((file) => (
          <Link to={`/${file}`} key={file} style={{ textDecoration: 'none' }}>
              <button className="button">{file}</button> 
          </Link>
        ))}
        <button onClick={onCreate} id="addButton">+</button> 
    </div>
  );
});
FileList.displayName = 'FileList';

function MainWorkspace() {
  const { '*': filePath } = useParams(); 
  const navigate = useNavigate();
  
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const cacheRef = useRef<Record<string, string>>({});

  //Stale While Revalidate
  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        setContent('');
        return;
      }

      // Stale
      if (cacheRef.current[filePath] !== undefined) {
        setContent(cacheRef.current[filePath]);
      } else {
        setContent('');
      }
      
      // Revalidate
      try {
        const response = await fetch(`/api/load?filePath=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success) {
          if (cacheRef.current[filePath] !== data.content) {
            setContent(data.content);
            cacheRef.current[filePath] = data.content;
            console.log('Background sync: File updated from server.');
          }
        } else {
          console.log('Failed to load file contents.');
        }
      } catch (error) {
        console.error('Load failed:', error);
      }
    };

    loadFile();
  }, [filePath]);

  const saveFile = useCallback(async () => {
    if (!filePath) return;
    
    console.log('Saving...');
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content }),
      });
      
      if (response.ok) {
        alert("saved")
        cacheRef.current[filePath] = content;
        setTimeout(() => console.log(''), 2000);
      } else {
        console.log('Error saving file.');
      }
    } catch (error) {
      alert("couldnt save: " + error)
      console.error('Save failed:', error);
      console.log('Server connection error.');
    }
  }, [filePath, content]);

  const renameFile = useCallback(async (renameTo:string) => {
    if (!filePath) return;
    
    console.log('Renaming...');
    try {
      const response = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filePath, newSavePath: renameTo }),
      });
      
      if (response.ok) {
        cacheRef.current[renameTo] = content;

        setFiles((prevFiles: string[]) =>
          [...prevFiles, renameTo].filter((file) => file !== filePath)
        );
        navigate(`/${renameTo}`);
      } else {
        console.log('Error renaming file.');
      }
    } catch (error) {
      alert("couldnt rename: " + error)
      console.error('Save failed:', error);
      console.log('Server connection error.');
    }
  }, [filePath, content, navigate]);

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

  useEffect(() => {
    const fetchFiles = async () => {
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
    };

    fetchFiles();
  }, []);

  const deleteFile = useCallback(async () => {
    if (!filePath) {
      alert("No file selected to delete!");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete "${filePath}.txt"?`);
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/delete?filePath=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        delete cacheRef.current[filePath];
        setFiles((prevFiles) => prevFiles.filter(file => file !== filePath));
        
        setContent('');
        navigate('/');
        
        setTimeout(() => console.log(''), 2000);
      } else {
        console.log('Error deleting file.');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      console.log('Server connection error.');
    }
  }, [filePath, navigate]);

  const createFile = useCallback(async () => {
    const fileName = prompt("Enter the name for your new note:");
    
    if (!fileName || fileName.trim() === "") return;
    
    const sanitizedName = fileName.trim();

    console.log('Creating file...');
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: sanitizedName, content: '' }),
      });
      
      if (response.ok) {
        console.log('Created!');
        
        cacheRef.current[sanitizedName] = '';
        setFiles((prevFiles) => [...prevFiles, sanitizedName]);
        navigate(`/${sanitizedName}`); 
        
        setTimeout(() => console.log(''), 2000);
      } else {
        console.log('Error creating file.');
      }
    } catch (error) {
      console.error('Create failed:', error);
      console.log('Server connection error.');
    }
  }, [navigate]);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.localeCompare(b));
  }, [files]); 

  return (
    <>
      <div id="view">
        <div id="nodes">
            <header id="header">
              <button onClick={saveFile} className='headerButton'>save</button>
              <button onClick={deleteFile} className='headerButton'>delete</button>
            </header>
            <h1>Nodes</h1>
            
            {loading && <p>Loading files...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            {!loading && !error && files.length === 0 && (
                <p>No nodes found. Create a new node!</p>
            )}

            {!loading && !error && (
              <FileList files={sortedFiles} onCreate={createFile} />
            )}
        </div>

        <div id="edit">
          <Editor content={content} onChange={setContent} title={filePath ? filePath : "Select or create a file"} onTitleChange={renameFile}/>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<MainWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;