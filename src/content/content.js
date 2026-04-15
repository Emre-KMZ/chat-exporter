// Content script entry point.
// Listens for EXTRACT_CHAT messages from the popup, runs the right extractor,
// and sends back the normalized chat object.

(function () {
  const { BaseExtractor, ClaudeExtractor, ChatGPTExtractor, GeminiExtractor } =
    window.ChatExporter;

  const extractors = [
    new ClaudeExtractor(),
    new ChatGPTExtractor(),
    new GeminiExtractor(),
  ];

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "EXTRACT_CHAT") return;

    const extractor = extractors.find((e) => e.canExtract());

    if (!extractor) {
      sendResponse({ ok: false, error: "No extractor found for this page." });
      return;
    }

    try {
      const chat = extractor.extract();
      if (!chat) {
        sendResponse({ ok: false, error: "Could not find any messages on this page." });
      } else {
        sendResponse({ ok: true, chat });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }

    // Return true to keep the message channel open for async sendResponse.
    return true;
  });
})();
