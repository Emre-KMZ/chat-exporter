// ChatGPT extractor — targets chat.openai.com and chatgpt.com
//
// DOM structure (as of Apr 2026 — verify in DevTools if selectors break):
//   Each turn:       section[data-testid^="conversation-turn-"]  (was article pre-2026)
//   Author role:     data-turn="user"|"assistant" attribute on the section
//   User content:    first div inside section (whitespace-pre-wrap text)
//   Assistant prose: div.markdown  (Tailwind prose container)
//   Model name:      button[data-testid="model-switcher-dropdown-button"] span

window.ChatExporter = window.ChatExporter || {};

window.ChatExporter.ChatGPTExtractor = class ChatGPTExtractor extends window.ChatExporter.BaseExtractor {
  canExtract() {
    const h = window.location.hostname;
    return h === "chat.openai.com" || h === "chatgpt.com";
  }

  extract() {
    // section[data-turn] is the current structure; fall back to article for older cached pages.
    const turns = document.querySelectorAll(
      "section[data-testid^='conversation-turn-'], article[data-testid^='conversation-turn-']"
    );
    if (turns.length === 0) return null;

    const messages = [];

    for (const turn of turns) {
      // data-turn is on the section itself; older DOM had data-message-author-role on a child.
      const role = turn.getAttribute("data-turn") ||
        turn.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role");
      if (role !== "user" && role !== "assistant") continue;

      let content;
      if (role === "assistant") {
        // Prefer the .markdown prose block — it has the full HTML structure.
        const proseEl = turn.querySelector(".markdown") || turn;
        content = this._htmlToMarkdown(proseEl).trim().replace(/\n{3,}/g, "\n\n");
      } else {
        // User messages: plain text in a whitespace-pre-wrap div.
        const userContentEl = turn.querySelector("div[class*='whitespace-pre-wrap']") || turn;
        content = this._htmlToMarkdown(userContentEl).trim().replace(/\n{3,}/g, "\n\n");
      }

      if (content) messages.push({ role, content });
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
    // Try the active sidebar item first.
    const active = document.querySelector("nav a[aria-current='page']");
    if (active && active.innerText.trim()) return active.innerText.trim();
    // Fall back to document title.
    return document.title
      .replace(/^ChatGPT\s*[-–|]\s*/i, "")
      .replace(/\s*[-–|]\s*ChatGPT$/i, "")
      .trim() || "ChatGPT Chat";
  }

  _model() {
    const el =
      document.querySelector("[data-testid='model-switcher-dropdown-button'] span") ||
      document.querySelector("button[aria-label*='model' i] span") ||
      document.querySelector("[data-testid='model-switcher-dropdown-button']");
    return el ? el.innerText.trim() : null;
  }

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

    // Inline code — do not recurse.
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

      case "p":          return `\n${inner()}\n`;
      case "br":         return "\n";
      case "hr":         return "\n---\n";

      case "strong":
      case "b":          return `**${inner()}**`;

      case "em":
      case "i":          return `*${inner()}*`;

      case "s":
      case "del":        return `~~${inner()}~~`;

      case "blockquote": return inner().split("\n").map((l) => `> ${l}`).join("\n") + "\n";

      case "a": {
        const href = node.getAttribute("href") || "";
        const text = inner().trim();
        return href ? `[${text}](${href})` : text;
      }

      case "img": {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "image";
        if (src.startsWith("blob:") || src.startsWith("data:")) return `![${alt}]`;
        return `![${alt}](${src})`;
      }

      case "ul": return this._list(node, false);
      case "ol": return this._list(node, true);
      case "li": return inner();

      case "table": return this._table(node);

      // UI chrome — skip entirely.
      case "button":
      case "svg":
      case "time":  return "";

      // ChatGPT wraps code blocks in a div with a header bar (language label + copy button).
      // Skip the header, keep only the <pre>.
      case "div": {
        const pre = node.querySelector(":scope > pre");
        if (pre) return this._nodeToMd(pre);
        return inner();
      }

      case "span":
      default: return inner();
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
    // ChatGPT adds classes like "language-python" on the <code> element.
    const cls = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
    return cls ? cls.replace("language-", "") : "";
  }
};
