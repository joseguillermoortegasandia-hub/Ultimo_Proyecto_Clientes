(function () {
  'use strict';
  class FooterComponent extends HTMLElement {}
  if (!customElements.get('footer-component')) customElements.define('footer-component', FooterComponent);
})();
