/**
 * IndexedDB wrapper for API key storage
 */

const DB_NAME = 'CamPromptDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

let db = null;

async function openDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function saveApiKey(apiKey) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key: 'gemini_api_key', value: apiKey });
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getApiKey() {
  // Try env first (dev mode)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey !== 'your_api_key_here') {
    return envKey;
  }
  
  // Try IndexedDB
  try {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('gemini_api_key');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
    });
  } catch (e) {
    console.error('Failed to get API key from IndexedDB:', e);
    return null;
  }
}

export async function clearApiKey() {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete('gemini_api_key');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
