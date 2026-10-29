import { act } from 'preact/test-utils';

import { type WebPopupParams, type WebPopupSlot } from '@pushwoosh/websdk-common/web-popups';

import { renderEmbeddedWebPopup } from '../embeddedRenderer';
import { renderWebPopup, type WebPopupSubmitHandlers } from '../renderer';

const EMAIL_INPUT: WebPopupSlot = {
  type: 'email-input', key: 'email', label: 'Email', placeholder: 'you@example.com',
  invalidMessage: 'Enter a valid email', requiredMessage: 'Required',
};

const SUBMIT: WebPopupSlot = {
  type: 'submit', key: 'submit', variant: 'primary', label: 'Subscribe', errorMessage: 'Something went wrong',
};

const THANKS: WebPopupSlot = { type: 'text', key: 'thanks', variant: 'body', html: 'Thanks!' };

const page = (key: string, slots: Array<WebPopupSlot>, role?: 'success') => ({
  key,
  kind: 'content',
  layout: { type: 'Content', props: { content: 'main' } },
  images: [],
  contents: [{ key: 'main', label: 'Main', slots }],
  ...(role ? { role } : {}),
});

const FORM = <WebPopupParams>{
  colors: {
    background: '#ffffff', accent: '#000000', text: '#000000', textSecondary: '#666666', textInverse: '#ffffff',
  },
  placement: { v: 'middle', h: 'center', offset: 20 },
  overlay: { color: '#000000', opacity: 0.5 },
  animation: 'fade',
  borderRadius: 8,
  boxShadow: 'none',
  pages: [page('form', [EMAIL_INPUT, SUBMIT]), page('success', [THANKS], 'success')],
};

type RenderInto = (container: HTMLElement, params: WebPopupParams, handlers: WebPopupSubmitHandlers) => void;

const RENDERERS: Array<[string, RenderInto]> = [
  ['a popup', (container, params, handlers) => renderWebPopup(container, params, () => undefined, handlers)],
  ['an inline block', (container, params, handlers) => renderEmbeddedWebPopup(container, params, handlers)],
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(RENDERERS)('form values in %s', (_name, renderInto) => {
  it('reach the submit handler, and its ok opens the Success page', async () => {
    const onSubmitFormValues = jest.fn().mockResolvedValue('ok');
    const container = document.createElement('div');
    document.body.appendChild(container);

    act(() => {
      renderInto(container, FORM, {
        onSubmitChoice: jest.fn(), onSubmitRating: jest.fn(), onRequestSubscribe: jest.fn(), onSubmitFormValues,
      });
    });

    const input = <HTMLInputElement>container.querySelector('input[placeholder="you@example.com"]');
    act(() => {
      input.value = 'visitor@example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submit = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Subscribe');
    await act(async () => {
      submit?.click();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(onSubmitFormValues).toHaveBeenCalledWith({ email: 'visitor@example.com', tags: {}, policyAccepted: true });
    expect(container.textContent).toContain('Thanks!');
  });
});
