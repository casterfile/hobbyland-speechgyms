
import { HistoryItem } from '../types';
import localforage from 'localforage';

const DB_NAME = 'InstantSpeechDB';
const STORE_NAME = 'history';

// Initialize localforage
localforage.config({
  name: DB_NAME,
  storeName: STORE_NAME
});

export const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const stored = await localforage.getItem<HistoryItem[]>('sessions');
    return stored || [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveHistoryItem = async (item: HistoryItem) => {
  try {
    const history = await getHistory();
    // Limit to 50 items (increased limit due to better storage capacity of IndexedDB)
    const updated = [item, ...history].slice(0, 50); 
    await localforage.setItem('sessions', updated);
  } catch (e) {
    console.error("Failed to save history", e);
  }
};
