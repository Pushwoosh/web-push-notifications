import { act } from 'preact/test-utils';

import { type WebPopupParams, type WebPopupSlot } from '@pushwoosh/websdk-common/web-popups';

import { renderEmbeddedWebPopup } from '../embeddedRenderer';
import { type WebPopupSubmitHandlers } from '../renderer';

const HANDLERS: WebPopupSubmitHandlers = {
  onSubmitChoice: jest.fn(),
  onSubmitRating: jest.fn(),
  onRequestSubscribe: jest.fn(),
  onSubmitFormValues: jest.fn(),
};

const button = (key: string, label: string, action: Extract<WebPopupSlot, { type: 'button' }>['action']): WebPopupSlot => ({
  type: 'button', key, variant: 'primary', label, action,
});

type PageSpec = { key: string; slots: Array<WebPopupSlot>; width?: number; image?: string };

function popupOf(pages: Array<PageSpec>): WebPopupParams {
  return {
    colors: {
      background: '#ffffff', accent: '#000000', text: '#000000', textSecondary: '#666666', textInverse: '#ffffff',
    },
    placement: { v: 'middle', h: 'center', offset: 20 },
    overlay: { color: '#000000', opacity: 0.5 },
    animation: 'fade',
    borderRadius: 8,
    boxShadow: 'none',
    pages: pages.map(({
      key, slots, width, image,
    }) => ({
      key,
      kind: 'content',
      layout: image
        ? { type: 'Horizontal', children: [{ type: 'Content', props: { content: 'main' } }, { type: 'Image', props: { image: 'side' } }] }
        : { type: 'Content', props: { content: 'main' } },
      images: image ? [{ key: 'side', label: 'Side', src: image }] : [],
      contents: [{ key: 'main', label: 'Main', slots }],
      ...(width !== undefined ? { width } : {}),
    })),
  };
}

function mount(params: WebPopupParams): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    renderEmbeddedWebPopup(container, params, HANDLERS);
  });

  return container;
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderEmbeddedWebPopup', () => {
  it('draws the block without a close icon or close buttons', () => {
    const container = mount(popupOf([{
      key: 'main',
      slots: [
        button('close', 'No thanks', { type: 'close' }),
        button('shop', 'Shop now', { type: 'href', url: 'https://example.com' }),
      ],
    }]));

    expect(container.textContent).toContain('Shop now');
    expect(container.textContent).not.toContain('No thanks');
    expect(container.textContent).not.toContain('✕');
  });

  it('switches pages with page-action buttons', () => {
    const container = mount(popupOf([
      { key: 'first', slots: [button('next', 'Next', { type: 'page', page: 'second' })] },
      { key: 'second', slots: [button('done', 'Done', { type: 'href', url: 'https://example.com' })] },
    ]));

    act(() => {
      buttonByText(container, 'Next').click();
    });

    expect(container.textContent).toContain('Done');
    expect(container.textContent).not.toContain('Next');
  });

  it('stays on the page when its hide-popup countdown has run out', () => {
    const container = mount(popupOf([{
      key: 'main',
      slots: [
        {
          type: 'timer', key: 'countdown', endTime: '2000-01-01T00:00:00', timezone: '', language: 'en', showLabels: true, onExpire: 'hide-popup',
        },
        button('shop', 'Shop now', { type: 'href', url: 'https://example.com' }),
      ],
    }]));

    expect(container.textContent).toContain('Shop now');
  });

  it('stretches to the container width whatever width the page sets', () => {
    const container = mount(popupOf([{ key: 'main', slots: [button('shop', 'Shop now', { type: 'href', url: 'https://example.com' })], width: 600 }]));

    const wrapper = <HTMLElement>container.firstElementChild;
    const box = <HTMLElement>wrapper.querySelector(':scope > div');

    expect(wrapper.style.width).toBe('100%');
    expect(box.style.width).toBe('');
  });

  it('caps an image at the embedded max height, cropped by cover', () => {
    const container = mount(popupOf([{ key: 'main', slots: [button('shop', 'Shop now', { type: 'href', url: 'https://example.com' })], image: 'https://example.com/side.png' }]));

    const image = <HTMLImageElement>container.querySelector('img');
    const style = getComputedStyle(image);

    expect(style.maxHeight).toBe('360px');
    expect(style.objectFit).toBe('cover');
    expect(container.textContent).toContain('Shop now');
  });
});
