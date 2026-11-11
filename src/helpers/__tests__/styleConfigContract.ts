import { readCssVariableUsages } from './cssVariableUsage';
import { formatStyleVariable, type IStyleVariable } from '../cssVariables';

// Both widgets owe their stylesheet the same promises, so the block checking
// them lives here rather than once per widget.
export function describeStyleConfiguration<TName extends string>(
  css: string,
  prefix: string,
  configStyles: Array<IStyleVariable<TName>>,
  defaults: Record<TName, string | number>,
): void {
  describe('style configuration', () => {
    const usages = readCssVariableUsages(css, prefix);
    const usedInCss = usages.map((usage) => usage.name);
    const registered = configStyles.map((style) => style.name);

    it('leaves no unprefixed variable behind', () => {
      expect(css.match(new RegExp(`var\\(--(?!${prefix}-)`, 'g'))).toBeNull();
    });

    it('registers every variable the stylesheet reads', () => {
      const unregistered = [...new Set(usedInCss)].filter((name) => registered.indexOf(<never>name) === -1);

      expect(unregistered).toEqual([]);
    });

    it('gives every registered style a default, so no variable resolves to undefined', () => {
      registered.forEach((name) => {
        expect(defaults[name]).toBeDefined();
      });
    });

    it('leaves no registered style unused, so the registry does not rot', () => {
      const unused = registered.filter((name) => usedInCss.indexOf(name) === -1);

      expect(unused).toEqual([]);
    });

    // A rejected value falls through to the CSS fallback, so the fallback has
    // to say exactly what the default says.
    it('matches every CSS fallback to the configured default', () => {
      const mismatched = usages
        .map(({ name, fallback }) => {
          const style = configStyles.find((candidate) => candidate.name === name)!;
          const expected = formatStyleVariable(style.type, defaults[style.name]);

          return fallback === expected ? null : `${name}: ${fallback} != ${expected}`;
        })
        .filter(Boolean);

      expect(mismatched).toEqual([]);
    });
  });
}
