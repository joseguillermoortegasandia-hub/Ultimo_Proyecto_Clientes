(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class PlayerCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { avatarHTML } = window.LH.components || {};
      const { player, team } = this._data;
      this.innerHTML = `
        <article class="entity-card player-card" data-link="#player/${player.id}">
          <div class="player-card__visual">
            ${avatarHTML ? avatarHTML(player) : ''}
            <div class="entity-card__title">
              <p class="eyebrow">${S.escapeHTML(player.position || 'Posición libre')}</p>
              <h3>${S.escapeHTML(player.name)}</h3>
              <p>${S.escapeHTML(team?.name || 'Equipo no disponible')}</p>
            </div>
            <span class="player-number">${S.escapeHTML(player.number)}</span>
          </div>
          <div class="entity-card__meta">
            <div><span>Anotaciones</span><strong>${player.stats?.scores || 0}</strong></div>
            <div><span>Partidos con anotación</span><strong>${player.stats?.played || 0}</strong></div>
          </div>
          <div class="entity-card__actions">
            <a class="button button--soft" href="#player/${player.id}">Ver trayectoria</a>
            <button class="button button--outline" data-action="edit-player" data-id="${player.id}">Editar</button>
            <button class="button button--ghost" data-action="delete-player" data-id="${player.id}">Eliminar</button>
          </div>
        </article>`;
    }
  }

  if (!customElements.get('player-card')) {
    customElements.define('player-card', PlayerCard);
  }
})();+
