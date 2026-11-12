/**
 * Audio Storage Utility for Formation & Lighting Studio
 * Persists user-uploaded audio files per project across app reboots/sessions
 * using IndexedDB (high capacity binary storage) + Electron IPC disk cache.
 */

const DB_NAME = 'formation_studio_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_items';

interface StoredAudioRecord {
  projectId: string;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
  waveform: number[];
  duration: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open audio IndexedDB'));
  });
  return dbPromise;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decode an audio Blob or ArrayBuffer and compute a temporally exact waveform array
 * (using floating-point sample bin boundaries so zero samples are lost at the end).
 */
export async function decodeAudioWaveform(
  source: Blob | ArrayBuffer
): Promise<{ peaks: number[]; duration: number }> {
  const rawBuffer =
    source instanceof ArrayBuffer ? source.slice(0) : await source.arrayBuffer();
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuf = await ctx.decodeAudioData(rawBuffer);
    const totalLen = audioBuf.length;
    const duration = audioBuf.duration;
    const ch0 = audioBuf.getChannelData(0);
    const ch1 = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : null;

    // Dense peaks (~60/sec, up to 30,000 bins) with exact [0, totalLen] floating-point mapping
    const samples = Math.max(
      1000,
      Math.min(30000, Math.round(duration * 60))
    );
    const peaks: number[] = new Array(samples);
    for (let i = 0; i < samples; i++) {
      const start = Math.floor((i * totalLen) / samples);
      const end = Math.max(start + 1, Math.floor(((i + 1) * totalLen) / samples));
      const span = end - start;
      const stride = Math.max(1, Math.floor(span / 64));
      let sum = 0;
      let maxAbs = 0;
      let cnt = 0;
      for (let j = start; j < end; j += stride) {
        const v0 = Math.abs(ch0[j] || 0);
        const v1 = ch1 ? Math.abs(ch1[j] || 0) : v0;
        const v = v0 > v1 ? v0 : v1;
        sum += v;
        if (v > maxAbs) maxAbs = v;
        cnt++;
      }
      const avg = cnt > 0 ? sum / cnt : 0;
      peaks[i] = avg * 0.65 + maxAbs * 0.35;
    }

    let maxPeak = 0.01;
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] > maxPeak) maxPeak = peaks[i];
    }
    const normalized = peaks.map((p) => Math.min(1, p / maxPeak));
    return { peaks: normalized, duration };
  } finally {
    try {
      await ctx.close();
    } catch {}
  }
}

/**
 * Save project audio binary to IndexedDB and Electron disk
 */
export async function saveProjectAudio(
  projectId: string,
  audioSource: File | Blob | ArrayBuffer,
  fileName: string,
  mimeType: string,
  waveform: number[],
  duration: number
): Promise<void> {
  try {
    let buffer: ArrayBuffer;
    if (audioSource instanceof ArrayBuffer) {
      buffer = audioSource;
    } else {
      buffer = await audioSource.arrayBuffer();
    }

    // 1. Save to IndexedDB
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredAudioRecord = {
        projectId,
        fileName,
        mimeType: mimeType || 'audio/mpeg',
        data: buffer,
        waveform: waveform || [],
        duration: duration || 0,
        savedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // 2. Also cache to Electron disk storage if in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI?.saveAudio) {
      try {
        const b64 = arrayBufferToBase64(buffer);
        await window.electronAPI.saveAudio({
          projectId,
          fileName,
          mimeType: mimeType || 'audio/mpeg',
          bufferBase64: b64,
          waveform: waveform || [],
          duration: duration || 0,
        });
      } catch (electronErr) {
        console.warn('Failed to cache audio in Electron disk:', electronErr);
      }
    }
  } catch (err) {
    console.error(`Failed to save audio for project ${projectId}:`, err);
  }
}

/**
 * Load project audio binary and create an active ObjectURL.
 * Checks IndexedDB first; falls back to Electron disk cache if needed.
 */
export async function loadProjectAudio(projectId: string): Promise<{
  blob: Blob;
  url: string;
  fileName: string;
  waveform: number[];
  duration: number;
} | null> {
  try {
    // 1. Try IndexedDB
    try {
      const db = await getDB();
      const record = await new Promise<StoredAudioRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(projectId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (record && record.data && record.data.byteLength > 0) {
        const blob = new Blob([record.data], { type: record.mimeType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        return {
          blob,
          url,
          fileName: record.fileName,
          waveform: record.waveform || [],
          duration: record.duration || 0,
        };
      }
    } catch (idbErr) {
      console.warn('IndexedDB read failed, trying Electron disk:', idbErr);
    }

    // 2. Try Electron disk cache
    if (typeof window !== 'undefined' && window.electronAPI?.loadAudio) {
      const res = await window.electronAPI.loadAudio(projectId);
      if (res.success && res.data && res.data.bufferBase64) {
        const buffer = base64ToArrayBuffer(res.data.bufferBase64);
        const mimeType = res.data.mimeType || 'audio/mpeg';
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Re-populate IndexedDB for faster subsequent access
        try {
          const db = await getDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({
            projectId,
            fileName: res.data.fileName,
            mimeType,
            data: buffer,
            waveform: res.data.waveform || [],
            duration: res.data.duration || 0,
            savedAt: Date.now(),
          });
        } catch {}

        return {
          blob,
          url,
          fileName: res.data.fileName,
          waveform: res.data.waveform || [],
          duration: res.data.duration || 0,
        };
      }
    }
  } catch (err) {
    console.error(`Failed to load audio for project ${projectId}:`, err);
  }
  return null;
}

/**
 * Delete project audio from storage
 */
export async function deleteProjectAudio(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(projectId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  if (typeof window !== 'undefined' && window.electronAPI?.deleteAudio) {
    try {
      await window.electronAPI.deleteAudio(projectId);
    } catch {}
  }
}

/**
 * Clone project audio from source to target project
 */
export async function cloneProjectAudio(sourceProjectId: string, targetProjectId: string): Promise<void> {
  try {
    const loaded = await loadProjectAudio(sourceProjectId);
    if (!loaded) return;
    await saveProjectAudio(
      targetProjectId,
      loaded.blob,
      loaded.fileName,
      loaded.blob.type,
      loaded.waveform,
      loaded.duration
    );
  } catch (err) {
    console.error(`Failed to clone audio from ${sourceProjectId} to ${targetProjectId}:`, err);
  }
}
