// Opens the native OS Save As dialog via chrome.downloads with saveAs: true.
// Requires the "downloads" permission in manifest.json.
//
// Uses a data: URL instead of a blob URL — blob URLs are tied to the popup's
// JS context and become invalid when the popup is destroyed (which happens as
// soon as the Save As dialog steals focus), causing Chrome to crash on retry.
export function saveAsText(filename, content, mimeType = "text/plain") {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const dataUrl = `data:${mimeType};base64,${btoa(binary)}`;

  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url: dataUrl, filename, saveAs: true }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (downloadId == null) {
        reject(new Error("cancelled"));
        return;
      }

      // The callback above fires immediately — before the user interacts with
      // the Save As dialog. Listen for the download reaching a terminal state
      // so the caller stays blocked (button disabled) until save or cancel.
      const onChanged = (delta) => {
        if (delta.id !== downloadId) return;
        const state = delta.state?.current;
        if (state === "complete") {
          chrome.downloads.onChanged.removeListener(onChanged);
          resolve();
        } else if (state === "interrupted") {
          chrome.downloads.onChanged.removeListener(onChanged);
          const err = delta.error?.current ?? "interrupted";
          reject(new Error(err === "USER_CANCELED" ? "cancelled" : err));
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
  });
}

/** Sanitize a string so it's safe to use as a filename */
export function safeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, "-")  // illegal chars on Windows/Mac
    .replace(/\s+/g, "_")
    .slice(0, 100)                   // keep it reasonable
    || "chat";
}
