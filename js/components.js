(function () {
  'use strict';

  window.LH = window.LH || {};
  const S = window.LH.services;

  function crestHTML(team, size = '') {
    if (!team) {
      return `<span class="crest ${size}" style="--crest-primary:#4b5563;--crest-secondary:#9ca3af">PD</span>`;
    }
    const image = team.crestUrl
      ? `<img src="${S.escapeHTML(team.crestUrl)}" alt="Escudo de ${S.escapeHTML(team.name)}" onerror="this.remove()">`
      : S.escapeHTML(S.initials(team.name));
    return `<span class="crest ${size}" style="--crest-primary:${S.escapeHTML(team.primaryColor || '#334155')};--crest-secondary:${S.escapeHTML(team.secondaryColor || '#cbd5e1')}">${image}</span>`;
  }

  function avatarHTML(player, size = '') {
    if (!player) return `<span class="avatar ${size}">JG</span>`;
    const image = player.photoUrl
      ? `<img src="${S.escapeHTML(player.photoUrl)}" alt="Foto de ${S.escapeHTML(player.name)}" onerror="this.remove()">`
      : S.escapeHTML(S.initials(player.name));
    return `<span class="avatar ${size}" style="--crest-primary:#2d3748;--crest-secondary:#d8d2c8">${image}</span>`;
  }

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

  class TeamCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { team, playerCount, position } = this._data;
      this.innerHTML = `
        <article class="entity-card" style="--card-primary:${S.escapeHTML(team.primaryColor || '#334155')};--card-secondary:${S.escapeHTML(team.secondaryColor || '#cbd5e1')}">
          <span class="entity-card__accent"></span>
          <div class="entity-card__head">
            ${crestHTML(team)}
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

  class PlayerCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { player, team } = this._data;
      this.innerHTML = `
        <article class="entity-card player-card" data-link="#player/${player.id}">
          <div class="player-card__visual">
            ${avatarHTML(player)}
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

  class MatchCard extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
      const { match, homeTeam, awayTeam } = this._data;
      const score = match.status === 'finished' ? `${match.scoreHome} – ${match.scoreAway}` : 'vs';
      this.innerHTML = `
        <article class="match-row" data-link="#match/${match.id}">
          <div class="match-row__team">
            ${crestHTML(homeTeam, 'crest--sm')}
            <strong>${S.escapeHTML(homeTeam?.name || 'Por definir')}</strong>
          </div>
          <div class="match-row__score">${score}</div>
          <div class="match-row__team match-row__team--away">
            <strong>${S.escapeHTML(awayTeam?.name || 'Por definir')}</strong>
            ${crestHTML(awayTeam, 'crest--sm')}
          </div>
          <div class="match-row__date">
            ${S.escapeHTML(S.formatDate(match.date))}
            ${match.roundName ? `<br><small>${S.escapeHTML(match.roundName)}</small>` : ''}
          </div>
          <span class="status ${match.status === 'finished' ? 'status--success' : 'status--scheduled'}">${match.status === 'finished' ? 'Finalizado' : 'Programado'}</span>
        </article>`;
    }
  }

  class StandingsTable extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
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
                  <td><div class="table-team">${crestHTML(team, 'crest--sm')}<strong>${S.escapeHTML(team.name)}</strong></div></td>
                  <td>${stats.played || 0}</td><td>${stats.wins || 0}</td><td>${stats.draws || 0}</td><td>${stats.losses || 0}</td>
                  <td>${stats.scored || 0}</td><td>${stats.conceded || 0}</td><td>${(stats.scored || 0) - (stats.conceded || 0)}</td><td><strong>${stats.points || 0}</strong></td>
                </tr>`;
              }).join('') || `<tr><td colspan="10" class="text-center muted">Todavía no hay equipos.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }
  }

  class RankingTable extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
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
                  <td><div class="table-team">${avatarHTML(player)}<strong>${S.escapeHTML(player.name)}</strong></div></td>
                  <td>${S.escapeHTML(team?.name || 'Sin equipo')}</td>
                  <td><strong>${scores}</strong></td><td>${played}</td><td>${played ? (scores / played).toFixed(2) : '0.00'}</td>
                </tr>`;
              }).join('') || `<tr><td colspan="6" class="text-center muted">Todavía no hay jugadores.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }
  }

  class BracketView extends HTMLElement {
    set data(value) { this._data = value; this.render(); }
    render() {
      if (!this._data) return;
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
                    <span class="bracket-team__name">${crestHTML(home, 'crest--sm')}<span>${S.escapeHTML(home?.name || 'Por definir')}</span></span>
                    <strong>${match.status === 'finished' ? match.scoreHome : '—'}</strong>
                  </div>
                  <div class="bracket-team ${winnerId === match.awayTeamId ? 'is-winner' : ''}">
                    <span class="bracket-team__name">${crestHTML(away, 'crest--sm')}<span>${S.escapeHTML(away?.name || 'Por definir')}</span></span>
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

  class ChartContainer extends HTMLElement {
    connectedCallback() {
      if (!this.innerHTML.trim()) this.innerHTML = '<div class="chart-box"><canvas></canvas></div>';
    }
  }

  class ConfirmDialog extends HTMLElement {}
  class EventForm extends HTMLElement {}
  class LoadingState extends HTMLElement {}
  class ToastComponent extends HTMLElement {}
  class NavBar extends HTMLElement {}

  const definitions = [
    ['league-card', LeagueCard],
    ['team-card', TeamCard],
    ['player-card', PlayerCard],
    ['match-card', MatchCard],
    ['standings-table', StandingsTable],
    ['ranking-table', RankingTable],
    ['bracket-view', BracketView],
    ['chart-container', ChartContainer],
    ['confirm-dialog', ConfirmDialog],
    ['event-form', EventForm],
    ['loading-state', LoadingState],
    ['toast-message', ToastComponent],
    ['nav-bar', NavBar]
  ];

  definitions.forEach(([name, definition]) => {
    if (!customElements.get(name)) customElements.define(name, definition);
  });

  window.LH.components = { crestHTML, avatarHTML };
})();
