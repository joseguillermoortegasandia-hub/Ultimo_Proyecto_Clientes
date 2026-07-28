(function () {
  'use strict';
  class EventForm extends HTMLElement {}
  if (!customElements.get('event-form')) customElements.define('event-form', EventForm);
})();
