(function () {
  'use strict';
  class ConfirmDialog extends HTMLElement {}
  if (!customElements.get('confirm-dialog')) customElements.define('confirm-dialog', ConfirmDialog);
})();
