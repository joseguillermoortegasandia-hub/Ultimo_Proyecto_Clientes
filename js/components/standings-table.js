(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class StandingsTable extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { crestHTML } = window.LH.components || {};
      const { teams, sport, limit } = this._data;
      const standings = S.sortStandings(teams).slice(0, limit || teams.length);
      this.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Pos.</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
              <th>${sport.forShort}</th><th>${sport.againstShort}</th><th>DIF</th><th>Pts.</th>
            </tr></thead>
            <tbody>
              ${standings.map((team, index) => {
                const stats = team.stats || {};
                return `<tr data-link="#team/${team.id}">
                  <td class="table-rank">${index + 1}</td>
                  <td><div class="table-team">${crestHTML ? crestHTML(team, 'crest--sm') : ''}<strong>${S.escapeHTML(team.name)}</strong></div></td>
                  <td>${stats.played || 0}</td><td>${stats.wins || 0}</td><td>${stats.draws || 0}</td><td>${stats.losses || 0}</td>
                  <td>${stats.scored || 0}</td><td>${stats.conceded || 0}</td><td>${(stats.scored || 0) - (stats.conceded || 0)}</td><td><strong>${stats.points || 0}</strong></td>
                </tr>`;
              }).join('') || `<tr><td colspan="10" class="text-center muted">Todavía no hay equipos.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }
  }

  if (!customElements.get('standings-table')) {
    customElements.define('standings-table', StandingsTable);
  }
})();
