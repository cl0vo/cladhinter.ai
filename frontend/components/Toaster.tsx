import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const defaultStyle: CSSProperties = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
} as CSSProperties;

export function Toaster(props: ToasterProps) {
  return <Sonner theme="dark" className="toaster group" style={defaultStyle} {...props} />;
}
