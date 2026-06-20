import "server-only";

import { createHighlighter, type Highlighter } from "shiki";

// Themes match shadcn's docs: GitHub light/dark, switched purely with CSS
// variables (defaultColor: false) so we render one tree for both modes.
const THEMES = { light: "github-light-default", dark: "github-dark" } as const;
const LANGS = ["typescript", "tsx", "bash", "json"] as const;

// A single highlighter instance is reused across renders. During a build the
// page is a Server Component, so this lives for the whole render pass instead
// of spinning up Shiki per code block.
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEMES.light, THEMES.dark],
      langs: [...LANGS],
    });
  }
  return highlighterPromise;
}

export async function highlight(
  code: string,
  lang: string,
  highlightLines?: number[],
): Promise<string> {
  const highlighter = await getHighlighter();
  const marked = new Set(highlightLines);

  return highlighter.codeToHtml(code, {
    lang,
    themes: THEMES,
    defaultColor: false,
    transformers: [
      {
        line(node, line) {
          if (marked.has(line)) {
            node.properties["data-highlighted-line"] = "";
          }
        },
      },
    ],
  });
}
