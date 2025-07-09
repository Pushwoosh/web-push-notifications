import { COLOR_TEST_REGEXP } from './constants';

export function getValidColor(color: string): string {
  if (color === 'transparent') {
    return color;
  }

  return COLOR_TEST_REGEXP.test(color)
    ? color
    : '#333';
}
