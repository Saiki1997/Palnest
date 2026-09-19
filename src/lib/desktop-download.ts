import { downloadBlob } from "./download";

type SavePickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: BufferSource | Blob | string) => Promise<void>;
      close: () => Promise<void>;
      abort: () => Promise<void>;
    }>;
  }>;
};

export function formatBytes(n: number) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export async function headPackage(href: string) {
  const res = await fetch(href, { method: "HEAD" });
  return {
    ok: res.ok,
    bytes: Number(res.headers.get("content-length") || 0),
  };
}

function chunkToBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function canUseSavePicker() {
  if (typeof window === "undefined") return false;
  if (window.parent !== window) return false;
  return typeof (window as SavePickerWindow).showSaveFilePicker === "function";
}

/** Framed preview panes block blob saves. Prefer a top-level navigation. */
export function shouldUseNativeDownload() {
  return typeof window !== "undefined" && window.parent !== window;
}

export async function savePackage(
  href: string,
  filename: string,
  onProgress?: (ratio: number) => void,
): Promise<"picker" | "download" | "cancelled"> {
  let writable: {
    write: (data: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  } | null = null;

  if (canUseSavePicker()) {
    try {
      const handle = await (window as SavePickerWindow).showSaveFilePicker!({
        suggestedName: filename,
        types: [{ description: "Palnest for Windows", accept: { "application/zip": [".zip"] } }],
      });
      writable = await handle.createWritable();
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return "cancelled";
    }
  }

  const res = await fetch(href, { credentials: "same-origin" });
  if (!res.ok) {
    await writable?.abort().catch(() => undefined);
    throw new Error(res.status === 404 ? "Windows package is not on this world yet." : `Download failed (${res.status}).`);
  }

  const total = Number(res.headers.get("content-length") || 0);
  const body = res.body;
  if (!body) {
    const blob = await res.blob();
    if (writable) {
      await writable.write(blob);
      await writable.close();
      return "picker";
    }
    downloadBlob(blob, filename);
    onProgress?.(1);
    return "download";
  }

  const reader = body.getReader();
  const parts: ArrayBuffer[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (writable) await writable.write(value);
      else parts.push(chunkToBuffer(value));
      received += value.byteLength;
      if (total) onProgress?.(Math.min(1, received / total));
    }
    if (writable) {
      await writable.close();
      onProgress?.(1);
      return "picker";
    }
  } catch (err) {
    await writable?.abort().catch(() => undefined);
    throw err;
  }

  downloadBlob(new Blob(parts, { type: "application/zip" }), filename);
  onProgress?.(1);
  return "download";
}
