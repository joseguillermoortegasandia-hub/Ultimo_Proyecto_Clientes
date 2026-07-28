(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class TeamCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { crestHTML } = window.LH.components || {};
      const { team, playerCount, position } = this._data;
      this.innerHTML = `
        <article class="entity-card" style="--card-primary:${S.escapeHTML(team.primaryColor || '#334155')};--card-secondary:${S.escapeHTML(team.secondaryColor || '#cbd5e1')}">
          <span class="entity-card__accent"></span>
          <div class="entity-card__head">
            ${crestHTML ? crestHTML(team) : ''}
            <span class="status">${position ? `Puesto ${position}` : 'Sin clasificación'}</span>
          </div>
          <div class="entity-card__title">
            <h3>${S.escapeHTML(team.name)}</h3>
            <p>${S.escapeHTML(team.city || 'Sede no especificada')}</p>
          </div>
          <div class="entity-card__meta">
            <div><span>Plantilla</span><strong>${playerCount} jugadores</strong></div>
            <div><span>Partidos</span><strong>${team.stats?.played || 0}</strong></div>
            <div><span>Puntos</span><strong>${team.stats?.points || 0}</strong></div>
          </div>
          <div class="entity-card__actions">
            <a class="button button--soft" href="#team/${team.id}">Ver equipo</a>
            <button class="button button--outline" data-action="edit-team" data-id="${team.id}">Editar</button>
            <button class="button button--ghost" data-action="delete-team" data-id="${team.id}">Eliminar</button>
          </div>
        </article>`;
    }
  }

  if (!customElements.get('team-card')) {
    customElements.define('team-card', TeamCard);
  }
})();
