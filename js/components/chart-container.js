(function () {
  'use strict';

  class ChartContainer extends HTMLElement {
    connectedCallback() {
      if (!this.innerHTML.trim()) {
        this.innerHTML = '<div class="chart-box"><canvas></canvas></div>';
      }
    }
  }

  if (!customElements.get('chart-container')) {
    customElements.define('chart-container', ChartContainer);
  }
})();
