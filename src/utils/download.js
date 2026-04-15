// Triggers a file download in the browser without needing the "downloads" permission.
// Uses a temporary object URL — works for any string content.

export function downloadText(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Cleanup — small delay so the click has time to fire
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Sanitize a string so it's safe to use as a filename */
export function safeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, "-")  // illegal chars on Windows/Mac
    .replace(/\s+/g, "_")
    .slice(0, 100)                   // keep it reasonable
    || "chat";
}
