(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class MatchCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { crestHTML } = window.LH.components || {};
      const { match, homeTeam, awayTeam } = this._data;
      const score = match.status === 'finished' ? `${match.scoreHome} – ${match.scoreAway}` : 'vs';
      this.innerHTML = `
        <article class="match-row" data-link="#match/${match.id}">
          <div class="match-row__team">
            ${crestHTML ? crestHTML(homeTeam, 'crest--sm') : ''}
            <strong>${S.escapeHTML(homeTeam?.name || 'Por definir')}</strong>
          </div>
          <div class="match-row__score">${score}</div>
          <div class="match-row__team match-row__team--away">
            <strong>${S.escapeHTML(awayTeam?.name || 'Por definir')}</strong>
            ${crestHTML ? crestHTML(awayTeam, 'crest--sm') : ''}
          </div>
          <div class="match-row__date">
            ${S.escapeHTML(S.formatDate(match.date))}
            ${match.roundName ? `<br><small>${S.escapeHTML(match.roundName)}</small>` : ''}
          </div>
          <span class="status ${match.status === 'finished' ? 'status--success' : 'status--scheduled'}">${match.status === 'finished' ? 'Finalizado' : 'Programado'}</span>
        </article>`;
    }
  }

  if (!customElements.get('match-card')) {
    customElements.define('match-card', MatchCard);
  }
})();
