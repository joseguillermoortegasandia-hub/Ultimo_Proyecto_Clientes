(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class RankingTable extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { avatarHTML } = window.LH.components || {};
      const { players, teams, limit = 10 } = this._data;
      const ranked = [...players]
        .sort((a, b) => (b.stats?.scores || 0) - (a.stats?.scores || 0) || a.name.localeCompare(b.name, 'es'))
        .slice(0, limit);
      this.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Pos.</th><th>Jugador</th><th>Equipo</th><th>Anotaciones</th><th>PJ</th><th>Promedio</th></tr></thead>
            <tbody>
              ${ranked.map((player, index) => {
                const team = S.getTeamById(teams, player.teamId);
                const played = player.stats?.played || 0;
                const scores = player.stats?.scores || 0;
                return `<tr data-link="#player/${player.id}">
                  <td class="table-rank">${index + 1}</td>
                  <td><div class="table-team">${avatarHTML ? avatarHTML(player) : ''}<strong>${S.escapeHTML(player.name)}</strong></div></td>
                  <td>${S.escapeHTML(team?.name || 'Sin equipo')}</td>
                  <td><strong>${scores}</strong></td><td>${played}</td><td>${played ? (scores / played).toFixed(2) : '0.00'}</td>
                </tr>`;
              }).join('') || `<tr><td colspan="6" class="text-center muted">Todavía no hay jugadores.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }
  }

  if (!customElements.get('ranking-table')) {
    customElements.define('ranking-table', RankingTable);
  }
})();
