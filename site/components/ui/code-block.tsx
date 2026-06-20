import { highlight } from "@/lib/highlight";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

const TS_EXT = /\.tsx?$/;

// The little language chip in the header. Only TS/TSX for now, matching the
// files we actually show; extend as needed.
function FileIcon({ name }: { name: string }) {
  if (!TS_EXT.test(name)) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-[18px] items-center justify-center rounded-none bg-[#3178c6] text-[9px] font-bold leading-none text-white"
    >
      TS
    </span>
  );
}

export async function CodeBlock({
  code,
  lang = "ts",
  title,
  showLineNumbers = true,
  highlightLines,
  className,
}: {
  code: string;
  lang?: string;
  title?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}) {
  const html = await highlight(code, lang, highlightLines);

  return (
    <figure
      className={cn(
        "shiki-block group relative overflow-hidden rounded-none border-2 border-[var(--px-ink)] bg-[var(--px-surface-2)] shadow-[3px_3px_0_0_var(--px-ink)]",
        className,
      )}
      data-line-numbers={showLineNumbers ? "" : undefined}
    >
      {title ? (
        <figcaption className="flex items-center gap-2 border-b-2 border-[var(--px-ink)] px-2.5 py-1.5 font-mono text-[13px] text-muted-foreground">
          <FileIcon name={title} />
          <span className="text-foreground">{title}</span>
          <CopyButton
            className="-my-1 ml-auto rounded-none border-2 border-[var(--px-ink)] text-foreground hover:bg-[var(--px-surface)]"
            value={code}
          />
        </figcaption>
      ) : (
        <CopyButton
          className="absolute right-2 top-2 z-10 rounded-none border-2 border-[var(--px-ink)] text-foreground opacity-0 transition-opacity hover:bg-[var(--px-surface)] focus-visible:opacity-100 group-hover:opacity-100"
          value={code}
        />
      )}
      <div
        className="overflow-x-auto py-3 font-mono text-[13px] leading-[1.55]"
        // Shiki output is trusted, build-time generated HTML.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
