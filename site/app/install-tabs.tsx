"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const MANAGERS = [
  { id: "pnpm", command: "pnpm add avatarsniff" },
  { id: "npm", command: "npm install avatarsniff" },
  { id: "yarn", command: "yarn add avatarsniff" },
  { id: "bun", command: "bun add avatarsniff" },
] as const;

export function InstallTabs() {
  const [active, setActive] = useState<(typeof MANAGERS)[number]["id"]>("pnpm");
  const [copied, setCopied] = useState(false);

  const command =
    MANAGERS.find((m) => m.id === active)?.command ?? MANAGERS[0].command;

  return (
    <div className="overflow-hidden rounded-none border-2 border-[var(--px-ink)] bg-[var(--px-surface-2)] shadow-[3px_3px_0_0_var(--px-ink)]">
      <div className="flex items-center gap-1 border-b-2 border-[var(--px-ink)] px-2.5 py-1.5">
        <span
          aria-hidden="true"
          className="mr-1 inline-flex size-7 items-center justify-center rounded-none bg-[var(--px-accent)] text-[var(--px-accent-ink)]"
        >
          <svg
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="m4 17 6-6-6-6" />
            <path d="M12 19h8" />
          </svg>
        </span>
        {MANAGERS.map((m) => (
          <button
            aria-selected={active === m.id}
            className={
              active === m.id
                ? "rounded-none border-2 border-[var(--px-ink)] bg-[var(--px-surface)] px-2.5 py-1 font-mono text-[13px] text-foreground"
                : "rounded-none border-2 border-transparent px-2.5 py-1 font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            }
            key={m.id}
            onClick={() => setActive(m.id)}
            role="tab"
            type="button"
          >
            {m.id}
          </button>
        ))}
        <Button
          aria-label={copied ? "Copied" : "Copy install command"}
          className="ml-auto rounded-none border-2 border-[var(--px-ink)] text-foreground hover:bg-[var(--px-surface)]"
          onClick={() => {
            navigator.clipboard?.writeText(command).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              width="14"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              width="14"
            >
              <path d="M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z" />
            </svg>
          )}
        </Button>
      </div>
      <div className="overflow-x-auto px-4 py-3 font-mono text-[13px] text-foreground">
        {command}
      </div>
    </div>
  );
}
