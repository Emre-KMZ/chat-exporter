// Base extractor — all site-specific extractors extend this.
// Defines the interface and shared helpers.

window.ChatExporter = window.ChatExporter || {};

window.ChatExporter.BaseExtractor = class BaseExtractor {
  /**
   * Returns true if this extractor can handle the current page.
   * Called before extract() — used to select the right extractor.
   * @returns {boolean}
   */
  canExtract() {
    return false;
  }

  /**
   * Reads the DOM and returns a normalized chat object.
   * @returns {{ title: string, sourceUrl: string, exportedAt: string, model: string|null, messages: Array<{role: string, content: string}> } | null}
   */
  extract() {
    return null;
  }

  // --- Shared helpers ---

  /** Current page URL */
  get url() {
    return window.location.href;
  }

  /** Trim and collapse whitespace in a DOM element's text */
  cleanText(el) {
    return el ? el.innerText.trim().replace(/\n{3,}/g, "\n\n") : "";
  }
};
