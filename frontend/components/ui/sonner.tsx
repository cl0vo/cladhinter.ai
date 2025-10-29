import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const defaultStyle: CSSProperties = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
} as CSSProperties;

export const Toaster = (props: ToasterProps) => (
  <Sonner theme="dark" className="toaster group" style={defaultStyle} {...props} />
);
