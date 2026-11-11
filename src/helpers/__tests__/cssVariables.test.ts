import { FALLBACK_COLOR } from '../cssColor';
import { applyStyleVariables, formatStyleVariable, getCssVariableName } from '../cssVariables';

describe('getCssVariableName', () => {
  it('prefixes the config field name', () => {
    expect(getCssVariableName('pw-inbox', 'bgColor')).toBe('--pw-inbox-bgColor');
  });
});

describe('formatStyleVariable', () => {
  it('appends px to a size and treats an empty one as zero', () => {
    expect(formatStyleVariable('size', 350)).toBe('350px');
    expect(formatStyleVariable('size', '350')).toBe('350px');
    expect(formatStyleVariable('size', '')).toBe('0px');
    expect(formatStyleVariable('size', undefined)).toBe('0px');
  });

  it('rejects a size that is not a number', () => {
    expect(formatStyleVariable('size', '350px')).toBeNull();
    expect(formatStyleVariable('size', 'wide')).toBeNull();
  });

  it('keeps a number and rejects one that does not parse', () => {
    expect(formatStyleVariable('number', 100)).toBe('100');
    expect(formatStyleVariable('number', '100.5')).toBe('100.5');
    expect(formatStyleVariable('number', 'top')).toBeNull();
  });

  it('keeps a colour the browser accepts', () => {
    expect(formatStyleVariable('color', '#ff4c00')).toBe('#ff4c00');
    expect(formatStyleVariable('color', 'rgba(0,0,0,.1)')).toBe('rgba(0,0,0,.1)');
  });

  it('rejects a colour instead of substituting the grey fallback', () => {
    expect(formatStyleVariable('color', 'not-a-colour')).toBeNull();
    expect(formatStyleVariable('color', 'red; position: fixed')).toBeNull();
  });

  it('still accepts a colour that happens to equal the cssColor fallback', () => {
    expect(formatStyleVariable('color', FALLBACK_COLOR)).toBe(FALLBACK_COLOR);
  });

  it('keeps a string and rejects an empty one', () => {
    expect(formatStyleVariable('string', 'inherit')).toBe('inherit');
    expect(formatStyleVariable('string', '  ')).toBeNull();
  });
});

describe('applyStyleVariables', () => {
  const variables = [
    { name: 'bgColor' as const, type: 'color' as const },
    { name: 'widgetWidth' as const, type: 'size' as const },
  ];

  it('sets every valid value as a prefixed custom property', () => {
    const element = document.createElement('div');

    applyStyleVariables(element, 'pw-inbox', variables, { bgColor: '#fff', widgetWidth: 350 });

    expect(element.style.getPropertyValue('--pw-inbox-bgColor')).toBe('#fff');
    expect(element.style.getPropertyValue('--pw-inbox-widgetWidth')).toBe('350px');
  });

  it('leaves an invalid value unset, so the stylesheet fallback survives', () => {
    const element = document.createElement('div');

    applyStyleVariables(element, 'pw-inbox', variables, { bgColor: 'nonsense', widgetWidth: 350 });

    expect(element.style.getPropertyValue('--pw-inbox-bgColor')).toBe('');
    expect(element.style.getPropertyValue('--pw-inbox-widgetWidth')).toBe('350px');
  });

  it('keeps a rule-breaking value inside the custom property it was written to', () => {
    const element = document.createElement('div');

    applyStyleVariables(element, 'pw-popup', [{ name: 'boxShadow', type: 'string' }], {
      boxShadow: 'none} body { display: none; }',
    });

    expect(element.style.length).toBe(1);
    expect(element.style.item(0)).toBe('--pw-popup-boxShadow');
  });
});
