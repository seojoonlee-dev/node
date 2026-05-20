const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const NOTES_DIR = path.join(__dirname, 'notes');

// Asynchronously discover all text files recursively
async function getAllFiles(dir, baseDir = dir) {
  let results = [];
  try {
    const list = await fs.readdir(dir, { withFileTypes: true });
    
    for (let file of list) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, baseDir);
        results = results.concat(subFiles);
      } else if (file.name.endsWith('.txt')) {
        const relativePath = path.relative(baseDir, fullPath);
        const normalizedPath = relativePath.split(path.sep).join('/');
        results.push(normalizedPath);
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return results;
}

app.get('/api/files', async (req, res) => {
  try {
    const files = await getAllFiles(NOTES_DIR);
    res.json({ success: true, files });
  } catch (error) {
    console.error("Error reading files:", error);
    res.status(500).json({ success: false, message: 'Failed to read files' });
  }
});

app.get('/api/load', async (req, res) => {
  const { filePath } = req.query;
  if (!filePath) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    const fullPath = path.join(NOTES_DIR, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      res.json({ success: true, content });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({ success: true, content: '' });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error loading file:", error);
    res.status(500).json({ success: false, message: 'Failed to load file' });
  }
});

app.post('/api/save', async (req, res) => {
  const { filePath, content } = req.body;
  try {
    const fullPath = path.join(NOTES_DIR, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ success: true, message: 'File saved successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to save file' });
  }
});

// Create note folder and nested text file while avoiding duplicate collisions
app.post('/api/create', async (req, res) => {
  const { currentPath } = req.body;
  
  try {
    let baseDir = NOTES_DIR;
    if (currentPath) {
      // If active note is "README/README.txt", parent folder context is "notes/README"
      baseDir = path.join(NOTES_DIR, path.dirname(currentPath));
    }
    
    let counter = 0;
    let candidateName = "NewFile";
    
    // Find next unallocated unique folder name slot
    while (true) {
      const checkDir = path.join(baseDir, candidateName);
      const checkFile = path.join(checkDir, `${candidateName}.txt`);
      try {
        await fs.access(checkFile);
        counter++;
        candidateName = `NewFile${counter}`;
      } catch {
        break; // Available
      }
    }
    
    const finalDir = path.join(baseDir, candidateName);
    await fs.mkdir(finalDir, { recursive: true });
    
    const finalFile = path.join(finalDir, `${candidateName}.txt`);
    await fs.writeFile(finalFile, '', 'utf8');
    
    const relativePath = path.relative(NOTES_DIR, finalFile).split(path.sep).join('/');
    res.json({ success: true, filePath: relativePath });
  } catch (error) {
    console.error("Error creating file:", error);
    res.status(500).json({ success: false, message: 'Failed to create file' });
  }
});

// Rename container directory and internal file keeping them completely aligned
app.post('/api/rename', async (req, res) => {
  const { filePath, newTitle } = req.body;
  if (!filePath || !newTitle) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }
  
  try {
    const oldFullPath = path.join(NOTES_DIR, filePath); // notes/README/A/A.txt
    const oldDir = path.dirname(oldFullPath);           // notes/README/A
    const parentDir = path.dirname(oldDir);             // notes/README
    
    const cleanTitle = path.basename(newTitle).replace(/\.txt$/, '');
    const newDir = path.join(parentDir, cleanTitle);    // notes/README/B
    const newFullPath = path.join(newDir, `${cleanTitle}.txt`);
    
    // Rename container folder block first, then internal file
    await fs.rename(oldDir, newDir);
    const oldFileInNewDir = path.join(newDir, path.basename(oldFullPath));
    await fs.rename(oldFileInNewDir, newFullPath);
    
    const newRelativePath = path.relative(NOTES_DIR, newFullPath).split(path.sep).join('/');
    res.json({ success: true, filePath: newRelativePath });
  } catch (error) {
    console.error("Error renaming file:", error);
    res.status(500).json({ success: false, message: 'Failed to rename file' });
  }
});

// Delete note container directory entirely to avoid leaving empty orphaned folders
app.delete('/api/delete', async (req, res) => {
  const { filePath } = req.query;
  if (!filePath) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    const fullPath = path.join(NOTES_DIR, filePath);
    const targetFolder = path.dirname(fullPath);
    
    await fs.rm(targetFolder, { recursive: true, force: true });
    res.json({ success: true, message: 'File deleted successfully!' });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
});

app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001');
});