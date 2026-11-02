export interface ICssVariableUsage {
  name: string;
  fallback: string;
}

// Hand-rolled because a fallback may itself contain parentheses (`rgba(...)`),
// which a regexp for the closing one gets wrong.
export function readCssVariableUsages(css: string, prefix: string): Array<ICssVariableUsage> {
  const opening = `var(--${prefix}-`;
  const usages: Array<ICssVariableUsage> = [];
  let cursor = css.indexOf(opening);

  while (cursor !== -1) {
    let depth = 1;
    let index = cursor + opening.length;

    while (index < css.length && depth > 0) {
      if (css[index] === '(') {
        depth += 1;
      } else if (css[index] === ')') {
        depth -= 1;
      }
      index += 1;
    }

    const body = css.slice(cursor + opening.length, index - 1);
    const comma = body.indexOf(',');

    usages.push({
      name: comma === -1 ? body.trim() : body.slice(0, comma).trim(),
      fallback: comma === -1 ? '' : body.slice(comma + 1).trim(),
    });

    cursor = css.indexOf(opening, index);
  }

  return usages;
}
