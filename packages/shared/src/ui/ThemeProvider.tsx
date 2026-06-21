import { type ReactNode } from 'react';
import { cssVars } from '../theme/cssVars';

export interface ThemeProviderProps {
  /** Document direction; default RTL (Arabic-first, Plan §7/§9). */
  dir?: 'rtl' | 'ltr';
  children?: ReactNode;
}

/** Injects the B-Systems token CSS variables and sets the writing direction. */
export function ThemeProvider({ dir = 'rtl', children }: ThemeProviderProps) {
  return (
    <div dir={dir} data-theme="b-systems">
      <style dangerouslySetInnerHTML={{ __html: cssVars() }} />
      {children}
    </div>
  );
}
