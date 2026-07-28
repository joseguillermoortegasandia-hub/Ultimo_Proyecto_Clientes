(function () {
  'use strict';
  class ToastComponent extends HTMLElement {}
  if (!customElements.get('toast-message')) customElements.define('toast-message', ToastComponent);
})();
