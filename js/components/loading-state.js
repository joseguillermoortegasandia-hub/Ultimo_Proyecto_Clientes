(function () {
  'use strict';
  class LoadingState extends HTMLElement {}
  if (!customElements.get('loading-state')) customElements.define('loading-state', LoadingState);
})();
