import { get, set, del } from "idb-keyval";

/**
 * Completion photos are stored as Blobs in IndexedDB (too large for
 * localStorage). Quests reference photos by these keys. Object URLs are
 * created on demand and revoked by callers when no longer needed.
 */

function photoKey(id: string) {
  return `photo:${id}`;
}

export async function savePhoto(file: Blob): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await set(photoKey(id), file);
  return id;
}

export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  return get<Blob>(photoKey(id));
}

export async function getPhotoUrl(id: string): Promise<string | null> {
  const blob = await getPhotoBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function deletePhoto(id: string): Promise<void> {
  await del(photoKey(id));
}
