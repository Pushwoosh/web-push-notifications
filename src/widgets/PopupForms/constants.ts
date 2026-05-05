export const POPUP_FORMS_WIDGET_NAMESPACE = 'pushwoosh-popup-forms';

export const DEFAULT_DOCUMENT_WIDTH = 600;

export const POPUP_STYLES = `
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    overflow: auto;
    text-align: center;
    white-space: nowrap;
    font-size: 0;
    z-index: 2147483647;
  }
  .backdrop::before {
    content: '';
    display: inline-block;
    vertical-align: middle;
    height: 100%;
    width: 0;
  }
  .popup {
    position: relative;
    display: inline-block;
    vertical-align: middle;
    white-space: normal;
    text-align: left;
    font-size: 16px;
    background: #fff;
    border-radius: 8px;
    max-width: 90vw;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    color: #333;
  }
`;
