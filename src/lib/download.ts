export function downloadBytes(data: Uint8Array, filename: string, mime = "application/octet-stream") {
  const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], {
    type: mime,
  });
  downloadBlob(blob, filename);
}

export function downloadText(text: string, filename: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export async function readFileText(file: File): Promise<string> {
  return file.text();
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: BufferSource | Blob | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

function extOf(filename: string) {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i) : "";
}

export function canSaveWithPicker() {
  return typeof window !== "undefined" && typeof (window as FilePickerWindow).showSaveFilePicker === "function";
}

export async function saveBytes(
  data: Uint8Array,
  filename: string,
  mime = "application/octet-stream",
): Promise<"picker" | "download" | "cancelled"> {
  const picker = typeof window !== "undefined" ? (window as FilePickerWindow).showSaveFilePicker : undefined;
  if (picker) {
    try {
      const ext = extOf(filename) || ".bin";
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: filename, accept: { [mime]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
      await writable.close();
      return "picker";
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return "cancelled";
    }
  }
  downloadBytes(data, filename, mime);
  return "download";
}

export async function saveText(
  text: string,
  filename: string,
  mime = "text/plain",
): Promise<"picker" | "download" | "cancelled"> {
  return saveBytes(new TextEncoder().encode(text), filename, mime);
}
