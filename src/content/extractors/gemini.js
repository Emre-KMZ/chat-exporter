// Gemini extractor — targets gemini.google.com
//
// DOM notes (verify in DevTools if selectors break after a Google redeploy):
//   Gemini uses Angular and heavy class obfuscation, so we rely on structural
//   and aria attributes rather than class names.
//
//   Each conversation turn is in a <user-query> or <model-response> custom element.
//   User text:       user-query .query-text  (or user-query [data-input-text])
//   Assistant text:  model-response .response-content, or message-content

window.ChatExporter = window.ChatExporter || {};

window.ChatExporter.GeminiExtractor = class GeminiExtractor extends window.ChatExporter.BaseExtractor {
  canExtract() {
    return window.location.hostname === "gemini.google.com";
  }

  cleanText(el) {
    if (!el) return "";
    let text = el.innerText ?? "";
    el.querySelectorAll(".cdk-visually-hidden").forEach((n) => {
      text = text.replace(n.innerText, "");
    });
    return text.trim().replace(/\n{3,}/g, "\n\n");
  }

  _clean(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".cdk-visually-hidden").forEach((n) => n.remove());
    return clone;
  }

  extract() {
    const messages = [];

    // User turns — Gemini uses a <user-query> custom element
    document.querySelectorAll("user-query").forEach((el) => {
      const textEl = el.querySelector(".query-text, [data-input-text]") || el;
      const content = this.cleanText(textEl);
      if (content) messages.push({ role: "user", content, _order: this._order(el) });
    });

    // Assistant turns — <model-response> custom element
    document.querySelectorAll("model-response").forEach((el) => {
      const textEl = el.querySelector("message-content, .response-container-content") || el;
      const content = this._htmlToMarkdown(this._clean(textEl));
      if (content) messages.push({ role: "assistant", content, _order: this._order(el) });
    });

    if (messages.length === 0) return null;

    messages.sort((a, b) => a._order - b._order);
    messages.forEach((m) => delete m._order);

    return {
      title: document.title.replace(" - Gemini", "").replace("Gemini - ", "").trim(),
      sourceUrl: this.url,
      exportedAt: new Date().toISOString(),
      model: this._model(),
      messages,
    };
  }

  _order(el) {
    return Array.from(document.querySelectorAll("user-query, model-response")).indexOf(el);
  }

  _htmlToMarkdown(el) {
    if (!el) return "";

    const convert = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;

      const tag = node.tagName?.toLowerCase();
      const inner = () => Array.from(node.childNodes).map(convert).join("");

      switch (tag) {
        case "p":       return `\n\n${inner()}\n\n`;
        case "br":      return "\n";
        case "strong":
        case "b":       return `**${inner()}**`;
        case "em":
        case "i":       return `*${inner()}*`;
        case "code": {
          // Inline code — only wrap if not already inside a <pre>
          const isBlock = node.closest("pre");
          return isBlock ? node.textContent : `\`${node.textContent}\``;
        }
        case "pre": {
          const codeEl = node.querySelector("code");
          const lang = codeEl?.className?.match(/language-(\S+)/)?.[1] ?? "";
          const text = (codeEl ?? node).textContent;
          return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
        }
        case "h1":      return `\n\n# ${inner()}\n\n`;
        case "h2":      return `\n\n## ${inner()}\n\n`;
        case "h3":      return `\n\n### ${inner()}\n\n`;
        case "h4":      return `\n\n#### ${inner()}\n\n`;
        case "ul": {
          return "\n\n" + Array.from(node.children).map(
            (li) => `- ${this._htmlToMarkdown(li).trim()}`
          ).join("\n") + "\n\n";
        }
        case "ol": {
          return "\n\n" + Array.from(node.children).map(
            (li, i) => `${i + 1}. ${this._htmlToMarkdown(li).trim()}`
          ).join("\n") + "\n\n";
        }
        case "li":      return inner();
        case "a":       return `[${inner()}](${node.href})`;
        case "hr":      return "\n\n---\n\n";
        // Skip purely presentational/chrome nodes
        case "button":
        case "svg":
        case "img":
        case "style":
        case "script":  return "";
        default:        return inner();
      }
    };

    return convert(el).replace(/\n{3,}/g, "\n\n").trim();
  }

  _model() {
    // Model version appears in the top bar (e.g. "Gemini 2.0 Flash").
    const el = document.querySelector("[data-model-name], bard-mode-switcher span");
    return el ? el.innerText.trim() : null;
  }
};
