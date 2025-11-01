"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const baseStyle: Record<string, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

const Toaster = ({ style, theme = "dark", ...props }: ToasterProps) => (
  <Sonner
    theme={theme as ToasterProps["theme"]}
    className="toaster group"
    style={{ ...baseStyle, ...(style ?? {}) } as CSSProperties}
    {...props}
  />
);

export { Toaster };
