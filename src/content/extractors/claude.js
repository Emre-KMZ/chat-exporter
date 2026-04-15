// Claude extractor — targets claude.ai
//
// DOM structure (as of Apr 2025 — verify in DevTools if selectors break):
//   Conversation container: first ancestor of [data-testid="user-message"] with 3+ children
//   User turns:    children of that container that contain [data-testid="user-message"]
//   Assistant turns: other children of that container that have text content
//   Model name:    [data-testid="model-selector-dropdown"] span

window.ChatExporter = window.ChatExporter || {};

window.ChatExporter.ClaudeExtractor = class ClaudeExtractor extends window.ChatExporter.BaseExtractor {
  canExtract() {
    return window.location.hostname === "claude.ai";
  }

  extract() {
    const firstUserMsg = document.querySelector('[data-testid="user-message"]');
    if (!firstUserMsg) return null;

    // Walk up from the user message to find the conversation container —
    // the first ancestor that holds all turn elements (3+ children).
    let el = firstUserMsg;
    while (el.parentElement && el.parentElement.children.length < 3) {
      el = el.parentElement;
    }
    const conversationContainer = el.parentElement;
    if (!conversationContainer) return null;

    const messages = [];
    for (const child of conversationContainer.children) {
      const userEl = child.querySelector('[data-testid="user-message"]');
      if (userEl) {
        // User turn — extract from the specific message element to exclude timestamps.
        const content = this._htmlToMarkdown(userEl).trim().replace(/\n{3,}/g, "\n\n");
        if (content) messages.push({ role: "user", content });
      } else if (child.innerText.trim()) {
        // Assistant turn — extract from the whole child, buttons/SVG are skipped by _nodeToMd.
        const content = this._htmlToMarkdown(child).trim().replace(/\n{3,}/g, "\n\n");
        if (content) messages.push({ role: "assistant", content });
      }
      // Empty children (input area, spacers) are ignored.
    }

    if (messages.length === 0) return null;

    return {
      title: this._title(),
      sourceUrl: this.url,
      exportedAt: new Date().toISOString(),
      model: this._model(),
      messages,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _title() {
    // Try the sidebar item for the current conversation first.
    const active = document.querySelector('[data-testid="conversation-list-item"][aria-current="page"] span');
    if (active) return active.innerText.trim();
    // Fall back to document title.
    return document.title.replace(/\s*[-–|]\s*Claude.*$/i, "").trim() || "Claude Chat";
  }

  _model() {
    // Primary: the model selector dropdown button text.
    const selectors = [
      '[data-testid="model-selector-dropdown"] span',
      '[data-testid="model-selector-dropdown"] button',
      'button[data-testid^="model-"] span',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }
    return null;
  }

  /**
   * Recursively converts an HTML element's contents to Markdown.
   * Handles the elements Claude's renderer produces.
   */
  _htmlToMarkdown(el) {
    return this._nodeToMd(el).trim();
  }

  _nodeToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();

    // Code blocks — grab raw text to preserve indentation.
    if (tag === "pre") {
      const codeEl = node.querySelector("code");
      const lang = this._codeLanguage(codeEl || node);
      const text = (codeEl || node).innerText.replace(/\n$/, "");
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    }

    // Inline code — do not recurse, just grab text.
    if (tag === "code") {
      return "`" + node.innerText + "`";
    }

    const inner = () => Array.from(node.childNodes).map((c) => this._nodeToMd(c)).join("");

    switch (tag) {
      case "h1": return `\n# ${inner().trim()}\n`;
      case "h2": return `\n## ${inner().trim()}\n`;
      case "h3": return `\n### ${inner().trim()}\n`;
      case "h4": return `\n#### ${inner().trim()}\n`;
      case "h5": return `\n##### ${inner().trim()}\n`;
      case "h6": return `\n###### ${inner().trim()}\n`;

      case "p":           return `\n${inner()}\n`;
      case "br":          return "\n";
      case "hr":          return "\n---\n";

      case "strong":
      case "b":           return `**${inner()}**`;

      case "em":
      case "i":           return `*${inner()}*`;

      case "s":
      case "del":         return `~~${inner()}~~`;

      case "blockquote":  return inner().split("\n").map((l) => `> ${l}`).join("\n") + "\n";

      case "a": {
        const href = node.getAttribute("href") || "";
        const text = inner().trim();
        return href ? `[${text}](${href})` : text;
      }

      case "img": {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "image";
        // Blob URLs are ephemeral — note the attachment but skip the data URL.
        if (src.startsWith("blob:") || src.startsWith("data:")) {
          return `![${alt}]`;
        }
        return `![${alt}](${src})`;
      }

      case "ul": return this._list(node, false);
      case "ol": return this._list(node, true);

      // li is handled inside _list; if we ever hit one standalone, just yield content.
      case "li": return inner();

      case "table": return this._table(node);

      // UI chrome — skip entirely.
      case "button":
      case "svg":
      case "time":  return "";

      case "div":

      // Spans and everything else: just recurse.
      case "span":
      default:    return inner();
    }
  }

  _list(listEl, ordered) {
    const items = Array.from(listEl.children).filter((c) => c.tagName.toLowerCase() === "li");
    const lines = items.map((li, i) => {
      const marker = ordered ? `${i + 1}.` : "-";
      const text = Array.from(li.childNodes).map((c) => this._nodeToMd(c)).join("").trim();
      return `${marker} ${text}`;
    });
    return `\n${lines.join("\n")}\n`;
  }

  _table(tableEl) {
    const rows = Array.from(tableEl.querySelectorAll("tr"));
    if (rows.length === 0) return "";

    const toRow = (tr) =>
      "| " + Array.from(tr.querySelectorAll("th, td"))
        .map((cell) => this._nodeToMd(cell).trim().replace(/\|/g, "\\|"))
        .join(" | ") + " |";

    const headerRow = rows[0];
    const isHeader = headerRow.querySelector("th") !== null;
    const lines = [];

    if (isHeader) {
      lines.push(toRow(headerRow));
      const cols = headerRow.querySelectorAll("th, td").length;
      lines.push("| " + Array(cols).fill("---").join(" | ") + " |");
      rows.slice(1).forEach((r) => lines.push(toRow(r)));
    } else {
      rows.forEach((r) => lines.push(toRow(r)));
    }

    return `\n${lines.join("\n")}\n`;
  }

  _codeLanguage(codeEl) {
    if (!codeEl) return "";
    // Claude adds classes like "language-python" or "language-js".
    const cls = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
    return cls ? cls.replace("language-", "") : "";
  }
};
