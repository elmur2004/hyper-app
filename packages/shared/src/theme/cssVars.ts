import { colors, spacing, radii, statusColors } from './tokens';

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * Emit the tokens as CSS custom properties for the Vite dashboard, including a `[dir=rtl]`
 * block. RTL is a token concern (logical start/end), not a per-component patch (Plan §7/§9).
 */
export function cssVars(): string {
  const lines: string[] = [':root {'];
  for (const [k, v] of Object.entries(colors)) lines.push(`  --color-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(spacing)) lines.push(`  --space-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(radii)) lines.push(`  --radius-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(statusColors)) {
    lines.push(`  --status-${k.replace(/_/g, '-')}: ${v};`);
  }
  // Logical-direction defaults; RTL flips inline start/end.
  lines.push('  --flow-start: left;');
  lines.push('  --flow-end: right;');
  lines.push('}');
  lines.push('[dir="rtl"] {');
  lines.push('  --flow-start: right;');
  lines.push('  --flow-end: left;');
  lines.push('}');
  return lines.join('\n');
}
