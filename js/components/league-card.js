(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class LeagueCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { league, teamCount, matchCount } = this._data;
      const sport = window.LH.sports.get(league.sport);
      this.innerHTML = `
        <article class="entity-card ${league.isActive ? 'entity-card--active' : ''}" style="--card-primary:${sport.colors.primary};--card-secondary:${sport.colors.secondary}">
          <span class="entity-card__accent"></span>
          <div class="entity-card__head">
            <div class="entity-card__title">
              <p class="eyebrow">${S.escapeHTML(sport.name)} · ${league.mode === 'league' ? 'Liga' : 'Eliminación directa'}</p>
              <h3>${S.escapeHTML(league.name)}</h3>
              <p>${S.escapeHTML(league.season)}</p>
            </div>
            ${league.isActive ? '<span class="status status--active">Activa</span>' : ''}
          </div>
          <div class="entity-card__meta">
            <div><span>Equipos</span><strong>${teamCount}</strong></div>
            <div><span>Partidos</span><strong>${matchCount}</strong></div>
            <div><span>Calendario</span><strong>${league.fixtureGenerated ? 'Generado' : 'Pendiente'}</strong></div>
          </div>
          <div class="entity-card__actions">
            ${league.isActive ? '' : `<button class="button button--soft" data-action="activate-league" data-id="${league.id}">Activar</button>`}
            <button class="button button--outline" data-action="edit-league" data-id="${league.id}">Editar</button>
            <button class="button button--outline" data-action="export-league" data-id="${league.id}">Exportar</button>
            <button class="button button--ghost" data-action="delete-league" data-id="${league.id}">Eliminar</button>
          </div>
        </article>`;
    }
  }

  if (!customElements.get('league-card')) {
    customElements.define('league-card', LeagueCard);
  }
})();
