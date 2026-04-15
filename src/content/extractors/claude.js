// Claude extractor — targets claude.ai
//
// DOM notes (verify in DevTools if selectors break after a Claude redeploy):
//   Human turns:    div[data-testid="human-turn"]
//   Assistant turns: div[data-testid="assistant-turn"]
//   Message content: .font-claude-message  (innermost prose container)
//   Model name:      shown in the header — button or span near the top of the page

window.ChatExporter = window.ChatExporter || {};

window.ChatExporter.ClaudeExtractor = class ClaudeExtractor extends window.ChatExporter.BaseExtractor {
  canExtract() {
    return window.location.hostname === "claude.ai";
  }

  extract() {
    const messages = [];

    // Human turns
    document.querySelectorAll('[data-testid="human-turn"]').forEach((el) => {
      const content = this.cleanText(el);
      if (content) messages.push({ role: "user", content, _index: this._turnIndex(el) });
    });

    // Assistant turns
    document.querySelectorAll('[data-testid="assistant-turn"]').forEach((el) => {
      // Prefer the inner prose container if present — avoids picking up UI chrome
      const prose = el.querySelector(".font-claude-message") || el;
      const content = this.cleanText(prose);
      if (content) messages.push({ role: "assistant", content, _index: this._turnIndex(el) });
    });

    if (messages.length === 0) return null;

    // Sort by DOM order
    messages.sort((a, b) => a._index - b._index);
    messages.forEach((m) => delete m._index);

    return {
      title: document.title.replace(" - Claude", "").trim(),
      sourceUrl: this.url,
      exportedAt: new Date().toISOString(),
      model: this._model(),
      messages,
    };
  }

  /** DOM position index — used to sort mixed human/assistant arrays */
  _turnIndex(el) {
    return Array.from(document.querySelectorAll('[data-testid="human-turn"], [data-testid="assistant-turn"]')).indexOf(el);
  }

  _model() {
    // The selected model name appears in a button near the top of the composer area.
    // Adjust this selector if Claude changes the UI.
    const el = document.querySelector('[data-testid="model-selector-dropdown"] span');
    return el ? el.innerText.trim() : null;
  }
};
