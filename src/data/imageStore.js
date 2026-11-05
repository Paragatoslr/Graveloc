const DB_NAME = "graveloc-images";
const STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function imageKind(file) {
  const name = String(file?.name || "").toLowerCase();
  if (file?.type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (file?.type === "image/png" || name.endsWith(".png")) return "image/png";
  if (file?.type === "image/webp" || name.endsWith(".webp")) return "image/webp";
  return "";
}

export function uploadErrorText(code) {
  if (code === "type") return "Use a JPG, PNG, or WebP image.";
  if (code === "size") return "That image is larger than 8 MB. Choose a smaller file.";
  if (code === "read") return "That image could not be read. Try a different file.";
  return "The image could not be saved in this browser.";
}

export async function prepareImage(file) {
  const kind = imageKind(file);
  if (!kind) {
    const error = new Error("type");
    error.code = "type";
    throw error;
  }
  if (file.size > 8 * 1024 * 1024) {
    const error = new Error("size");
    error.code = "size";
    throw error;
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 2400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const outputType = kind === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, 0.9));
  if (!blob) {
    const error = new Error("read");
    error.code = "read";
    throw error;
  }
  return { blob, width, height, type: blob.type || outputType };
}

export async function saveImage(id, record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadImage(id) {
  if (!id) return null;
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

export async function clearImages() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
