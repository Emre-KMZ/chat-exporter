import { saveAsText, safeFilename } from "../utils/download.js";

const exportBtn = document.getElementById("export-btn");
const statusEl = document.getElementById("status");

function formatMarkdown(chat) {
  const lines = [];

  lines.push(`# ${chat.title || "Chat Export"}`);
  lines.push("");

  lines.push("| | |");
  lines.push("|---|---|");
  lines.push(`| **Source** | ${chat.sourceUrl} |`);
  lines.push(`| **Exported** | ${new Date(chat.exportedAt).toLocaleString()} |`);
  if (chat.model) lines.push(`| **Model** | ${chat.model} |`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const message of chat.messages) {
    const heading = message.role === "user" ? "## You" : "## Assistant";
    lines.push(heading);
    lines.push("");
    lines.push(message.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

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
    // Content script not present — inject programmatically and retry once.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          "src/content/extractors/base.js",
          "src/content/extractors/claude.js",
          "src/content/extractors/chatgpt.js",
          "src/content/extractors/gemini.js",
          "src/content/content.js",
        ],
      });
    } catch (injectErr) {
      console.error("[ChatExporter] executeScript failed:", injectErr);
      setStatus(`Injection failed: ${injectErr.message}`, "error");
      setLoading(false);
      return;
    }

    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CHAT" });
    } catch (msgErr) {
      console.error("[ChatExporter] sendMessage after inject failed:", msgErr);
      setStatus("Scripts injected but no response from page. Check the popup console for details.", "error");
      setLoading(false);
      return;
    }
  }

  if (!response?.ok) {
    setStatus(response?.error || "Unknown error during extraction.", "error");
    setLoading(false);
    return;
  }

  const { chat } = response;
  const content = formatMarkdown(chat);
  const filename = `${safeFilename(chat.title)}.md`;

  try {
    await saveAsText(filename, content, "text/markdown");
  } catch (saveErr) {
    const msg = saveErr.message || "";
    if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("abort")) {
      setStatus(msg || "Save dialog failed.", "error");
    }
    setLoading(false);
    return;
  }

  const count = chat.messages.length;
  setStatus(`Exported ${count} message${count === 1 ? "" : "s"}.`, "success");
  setLoading(false);
});
