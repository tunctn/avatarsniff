"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyPill({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative flex h-10 items-center rounded-md border border-border bg-[linear-gradient(to_top,var(--gray-2),var(--gray-1)_8px)] pr-14 pl-3 font-mono text-sm text-foreground">
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
        {command}
      </span>
      <Button
        aria-label={copied ? "Copied" : "Copy install command"}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[5px]"
        onClick={() => {
          navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        size="icon-sm"
        type="button"
        variant="outline"
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
  );
}
