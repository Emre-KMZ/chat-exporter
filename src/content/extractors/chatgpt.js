// ChatGPT extractor — targets chat.openai.com and chatgpt.com
//
// DOM notes (verify in DevTools if selectors break after an OpenAI redeploy):
//   Each turn:       article[data-testid^="conversation-turn-"]
//   Author role:     [data-message-author-role] attribute on the article (or a child)
//   Message content: .markdown  (prose container inside assistant turns)
//                    or the direct child div for user turns
//   Model name:      shown in a button or span at the top — selector below is a best-effort

window.ChatExporter = window.ChatExporter || {};

window.ChatExporter.ChatGPTExtractor = class ChatGPTExtractor extends window.ChatExporter.BaseExtractor {
  canExtract() {
    const h = window.location.hostname;
    return h === "chat.openai.com" || h === "chatgpt.com";
  }

  extract() {
    const turns = document.querySelectorAll("article[data-testid^='conversation-turn-']");
    if (turns.length === 0) return null;

    const messages = [];

    turns.forEach((article) => {
      // The role attribute can live on the article itself or a direct child
      const roleEl = article.querySelector("[data-message-author-role]") || article;
      const role = roleEl.getAttribute("data-message-author-role");
      if (!role) return;

      // For assistant, prefer the .markdown prose block; for user, take the whole turn text
      const proseEl = role === "assistant"
        ? article.querySelector(".markdown, [class*='prose']") || article
        : article;

      const content = this.cleanText(proseEl);
      if (content) messages.push({ role: role === "user" ? "user" : "assistant", content });
    });

    if (messages.length === 0) return null;

    return {
      title: document.title.replace("ChatGPT - ", "").replace(" | ChatGPT", "").trim(),
      sourceUrl: this.url,
      exportedAt: new Date().toISOString(),
      model: this._model(),
      messages,
    };
  }

  _model() {
    // Model name appears in a selector at the top of the chat.
    // Adjust selector if ChatGPT changes its UI.
    const el = document.querySelector("[data-testid='model-switcher-dropdown-button'] span")
      || document.querySelector("button[aria-label*='model'] span");
    return el ? el.innerText.trim() : null;
  }
};
