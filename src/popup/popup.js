import { format, extension } from "../formatters/markdown.js";
import { downloadText, safeFilename } from "../utils/download.js";

const exportBtn = document.getElementById("export-btn");
const statusEl = document.getElementById("status");

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

function setLoading(loading) {
  exportBtn.disabled = loading;
  exportBtn.textContent = loading ? "Exporting…" : "Export as Markdown";
}

exportBtn.addEventListener("click", async () => {
  setLoading(true);
  setStatus("");

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    setStatus("Could not access the current tab.", "error");
    setLoading(false);
    return;
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CHAT" });
  } catch {
    setStatus(
      "Could not reach the page. Make sure you are on a supported chat page (Claude, ChatGPT, or Gemini) and reload it.",
      "error"
    );
    setLoading(false);
    return;
  }

  if (!response?.ok) {
    setStatus(response?.error || "Unknown error during extraction.", "error");
    setLoading(false);
    return;
  }

  const { chat } = response;
  const content = format(chat);
  const filename = `${safeFilename(chat.title)}.${extension}`;

  // downloadText must run in the popup's own document
  downloadText(filename, content, "text/markdown");

  const count = chat.messages.length;
  setStatus(`Exported ${count} message${count === 1 ? "" : "s"}.`, "success");
  setLoading(false);
});
