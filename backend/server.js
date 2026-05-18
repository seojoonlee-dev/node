const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const NOTES_DIR = path.join(__dirname, 'notes');

app.post('/api/save', async (req, res) => {
  const { filePath, content } = req.body;
  
  try {
    const fullPath = path.join(NOTES_DIR, `${filePath}.txt`);
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, content, 'utf8');
    
    res.json({ success: true, message: 'File saved successfully!' });
  } catch (error) {
    console.error(error);

    res.status(500).json({ success: false, message: 'Failed to save file' });
  }
});

app.post('/api/rename', async (req, res) => {
  const { filePath, newSavePath } = req.body;
  
  try {
    const oldPath = path.join(NOTES_DIR, `${filePath}.txt`);
    const newPath = path.join(NOTES_DIR, `${newSavePath}.txt`);
    
    await fs.rename(oldPath, newPath);
    
    res.json({ success: true, message: 'File renamed successfully!' });
  } catch (error) {
    console.error(error);

    res.status(500).json({ success: false, message: 'Failed to rename file' });
  }
});

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

        results.push(normalizedPath.replace(/\.txt$/, ''));
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
    res.json({ success: true, files: files });
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
    const fullPath = path.join(NOTES_DIR, `${filePath}.txt`);

    try {
      const content = await fs.readFile(fullPath, 'utf8');
      res.json({ success: true, content: content });
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

app.delete('/api/delete', async (req, res) => {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    const fullPath = path.join(NOTES_DIR, `${filePath}.txt`);

    await fs.unlink(fullPath);

    res.json({ success: true, message: 'File deleted successfully!' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    console.error("Error deleting file:", error);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
});

app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001');
});