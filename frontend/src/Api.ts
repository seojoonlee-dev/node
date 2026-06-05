export const getServerIp = () => localStorage.getItem('serverIp') || "http://localhost:3001";

export const fetchFilesList = async () => {
  const response = await fetch(`${getServerIp()}/api/files`);
  return response.json();
};

export const loadFile = async (filePath: string) => {
  const response = await fetch(`${getServerIp()}/api/load?filePath=${encodeURIComponent(filePath)}`);
  return response.json();
};

export const saveFile = async (filePath: string, content: string) => {
  const response = await fetch(`${getServerIp()}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, content }),
  });
  if (!response.ok) throw new Error("Failed to save");
  return response;
};

export const renameFile = async (filePath: string, newTitle: string) => {
  const response = await fetch(`${getServerIp()}/api/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, newTitle }),
  });
  return response.json();
};

export const createFile = async (currentPath: string, fileName?: string) => {
  const response = await fetch(`${getServerIp()}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPath: currentPath || '', fileName }), 
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || "Failed to create file");
  }
  return data;
};

export const deleteFile = async (filePath: string) => {
  const response = await fetch(`${getServerIp()}/api/delete?filePath=${encodeURIComponent(filePath)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error("Failed to delete");
  return response;
};