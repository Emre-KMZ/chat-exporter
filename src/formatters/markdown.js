// Markdown formatter.
// Takes a normalized chat object and returns a Markdown string.
//
// To add a new format (e.g. JSON, HTML), create a new file in this directory
// that exports a `format(chat)` function with the same signature.

export function format(chat) {
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

/** File extension for this format */
export const extension = "md";

/** Human-readable label shown in the UI */
export const label = "Markdown";
