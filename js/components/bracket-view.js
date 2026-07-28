(function () {
  'use strict';
  window.LH = window.LH || {};
  const S = window.LH.services;

  class BracketView extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { crestHTML } = window.LH.components || {};
      const { matches, teams } = this._data;
      const rounds = new Map();
      matches.forEach((match) => {
        const key = Number(match.roundIndex || 0);
        if (!rounds.has(key)) rounds.set(key, []);
        rounds.get(key).push(match);
      });
      const orderedRounds = [...rounds.entries()].sort((a, b) => a[0] - b[0]);
      this.innerHTML = `<div class="bracket">
        ${orderedRounds.map(([, roundMatches]) => {
          const sorted = roundMatches.sort((a, b) => (a.matchIndex || 0) - (b.matchIndex || 0));
          return `<section class="bracket-round">
            <h3 class="bracket-round__title">${S.escapeHTML(sorted[0]?.roundName || 'Ronda')}</h3>
            <div class="bracket-round__matches">
              ${sorted.map((match) => {
                const home = S.getTeamById(teams, match.homeTeamId);
                const away = S.getTeamById(teams, match.awayTeamId);
                const winnerId = S.getMatchWinnerId(match);
                return `<article class="bracket-match" data-link="#match/${match.id}">
                  <div class="bracket-team ${winnerId === match.homeTeamId ? 'is-winner' : ''}">
                    <span class="bracket-team__name">${crestHTML ? crestHTML(home, 'crest--sm') : ''}<span>${S.escapeHTML(home?.name || 'Por definir')}</span></span>
                    <strong>${match.status === 'finished' ? match.scoreHome : '—'}</strong>
                  </div>
                  <div class="bracket-team ${winnerId === match.awayTeamId ? 'is-winner' : ''}">
                    <span class="bracket-team__name">${crestHTML ? crestHTML(away, 'crest--sm') : ''}<span>${S.escapeHTML(away?.name || 'Por definir')}</span></span>
                    <strong>${match.status === 'finished' ? match.scoreAway : '—'}</strong>
                  </div>
                  <div class="bracket-match__meta"><span>${S.escapeHTML(S.formatDate(match.date, false))}</span><span>${match.status === 'finished' ? 'Finalizado' : 'Programado'}</span></div>
                </article>`;
              }).join('')}
            </div>
          </section>`;
        }).join('') || '<p class="muted">El bracket aún no ha sido generado.</p>'}
      </div>`;
    }
  }

  if (!customElements.get('bracket-view')) {
    customElements.define('bracket-view', BracketView);
  }
})();
