(function () {
  'use strict';
  class NavBar extends HTMLElement {}
  if (!customElements.get('nav-bar')) customElements.define('nav-bar', NavBar);
})();
