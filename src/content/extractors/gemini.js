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
      // Prefer the inner message/response container to avoid UI chrome
      const textEl = el.querySelector("message-content, .response-container-content") || el;
      const content = this.cleanText(textEl);
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

  _model() {
    // Model version appears in the top bar (e.g. "Gemini 2.0 Flash").
    const el = document.querySelector("[data-model-name], bard-mode-switcher span");
    return el ? el.innerText.trim() : null;
  }
};
