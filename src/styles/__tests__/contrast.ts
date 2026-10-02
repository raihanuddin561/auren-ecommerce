/** Helpers for reading design tokens out of globals.css and checking WCAG contrast. */

export type Scope = Map<string, string>;

export interface ParsedTokens {
  /** Declarations inside the first `@theme { ... }` block (the brand palette and scales). */
  theme: Scope;
  /** Declarations of a selector block, layered on top of a base scope (themes inherit :root). */
  scope(selector: string, base?: Scope): Scope;
}

function blockBody(css: string, header: string): string {
  const start = css.indexOf(header);
  if (start === -1) throw new Error(`block not found: ${header}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block: ${header}`);
}

function declarations(body: string): Scope {
  const result: Scope = new Map();
  // Drop nested blocks (keyframes, media queries) so only direct declarations remain.
  let flat = '';
  let depth = 0;
  for (const char of body) {
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (depth === 0) flat += char;
  }
  for (const match of flat.matchAll(/(--[\w*-]+)\s*:\s*([^;]+);/g)) {
    result.set(match[1]!, match[2]!.trim());
  }
  return result;
}

export function parseTokens(css: string): ParsedTokens {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const theme = declarations(blockBody(source, '@theme {'));
  return {
    theme,
    scope(selector, base) {
      const own = declarations(blockBody(source, `\n${selector} {`));
      return new Map([...theme, ...(base ?? []), ...own]);
    },
  };
}

/** Resolve `var(--x)` chains inside a scope down to a hex colour. */
export function resolveColor(scope: Scope, name: string): string {
  let value = scope.get(name);
  for (let depth = 0; depth < 8 && value; depth += 1) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    if (!ref) break;
    value = scope.get(ref[1]!);
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`cannot resolve ${name} to a hex colour (got ${value})`);
  }
  return value;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
