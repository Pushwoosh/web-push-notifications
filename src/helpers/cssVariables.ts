import { getValidColor } from './cssColor';

export type TStyleVariableType = 'number' | 'color' | 'string' | 'size';

export interface IStyleVariable<TName extends string = string> {
  name: TName;
  type: TStyleVariableType;
}

export function getCssVariableName(prefix: string, name: string): string {
  return `--${prefix}-${name}`;
}

// `null` means "leave it unset": a custom property holding garbage makes every
// rule that reads it invalid, while an absent one falls back to the stylesheet.
export function formatStyleVariable(type: TStyleVariableType, value: string | number | undefined): string | null {
  switch (type) {
    case 'size': {
      const size = Number(value ?? 0);
      return Number.isFinite(size) ? `${size}px` : null;
    }
    case 'number': {
      const parsed = parseFloat(String(value));
      return Number.isFinite(parsed) ? String(parsed) : null;
    }
    case 'color': {
      const color = String(value);
      return getValidColor(color) === color ? color : null;
    }
    default: {
      const text = String(value).trim();
      return text || null;
    }
  }
}

export function applyStyleVariables<TName extends string>(
  element: HTMLElement,
  prefix: string,
  variables: Array<IStyleVariable<TName>>,
  values: Record<TName, string | number>,
): void {
  variables.forEach(({ name, type }) => {
    const formatted = formatStyleVariable(type, values[name]);

    if (formatted !== null) {
      element.style.setProperty(getCssVariableName(prefix, name), formatted);
    }
  });
}
