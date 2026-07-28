(function () {
  'use strict';

  const LH = window.LH;
  const DB = LH.db;
  const S = LH.services;
  const C = LH.components;
  const { STORES } = DB;

  const app = document.getElementById('app-view');
  const dialog = document.getElementById('app-dialog');
  const dialogForm = document.getElementById('dialog-form-shell');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogEyebrow = document.getElementById('dialog-eyebrow');
  const dialogBody = document.getElementById('dialog-body');
  const toastRegion = document.getElementById('toast-region');
  const menuButton = document.getElementById('menu-button');
  const mainNav = document.getElementById('main-nav');

  // Estado de navegación, filtros y eventos provisionales aún no persistidos.
  const state = {
    activeLeague: null,
    bundle: null,
    route: null,
    dialogSubmit: null,
    filters: {
      players: { search: '', teamId: '', position: '' },
      matches: { status: '', teamId: '', dateFrom: '', dateTo: '', round: '' }
    },
    stagedEvents: new Map(),
    playerSearchTimer: null
  };

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'toast--error' : ''}`;
    node.textContent = message;
    toastRegion.append(node);
    window.setTimeout(() => node.remove(), 4200);
  }

  function setLoading(message = 'Actualizando información…') {
    app.innerHTML = `<section class="loading-screen"><span class="loading-line"></span><p>${S.escapeHTML(message)}</p></section>`;
  }

  function pageHeader(eyebrow, title, description, actions = '') {
    return `<header class="page-header">
      <div>
        <p class="eyebrow">${S.escapeHTML(eyebrow)}</p>
        <h1>${S.escapeHTML(title)}</h1>
        ${description ? `<p>${S.escapeHTML(description)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </header>`;
  }

  function emptyState(title, message, actionHTML = '') {
    return `<section class="empty-state"><div class="empty-state__inner">
      <div class="empty-mark"></div>
      <h2>${S.escapeHTML(title)}</h2>
      <p>${S.escapeHTML(message)}</p>
      ${actionHTML}
    </div></section>`;
  }

  function updateContext() {
    const name = document.getElementById('active-league-name');
    const sport = document.getElementById('active-league-sport');
    if (!state.activeLeague) {
      name.textContent = 'Sin liga seleccionada';
      sport.textContent = 'Crea o activa una liga';
      LH.sports.applyTheme('football');
      return;
    }
    const terms = LH.sports.get(state.activeLeague.sport);
    name.textContent = state.activeLeague.name;
    sport.textContent = `${terms.name} · ${state.activeLeague.season}`;
    LH.sports.applyTheme(state.activeLeague.sport);
  }

  function setActiveNav(routeName) {
    document.querySelectorAll('[data-route]').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.route === routeName);
    });
  }

  // Router por fragmento de URL. Permite historial Atrás/Adelante sin recargas.
  function parseRoute() {
    const raw = location.hash.replace(/^#/, '') || 'dashboard';
    const [name, id] = raw.split('/');
    return { name, id: id ? Number(id) : null, raw };
  }

  async function refreshBundle() {
    state.activeLeague = await DB.getActiveLeague();
    state.bundle = state.activeLeague ? await S.getLeagueBundle(state.activeLeague.id) : null;
    updateContext();
  }

  async function renderCurrent(options = {}) {
    if (!options.skipRefresh) await refreshBundle();
    LH.charts.destroyAll();
    const route = parseRoute();
    state.route = route;
    const navRoute = ['team', 'player', 'match'].includes(route.name)
      ? ({ team: 'teams', player: 'players', match: 'matches' })[route.name]
      : route.name;
    setActiveNav(navRoute);

    try {
      if (route.name === 'leagues') await renderLeagues();
      else if (route.name === 'teams') await renderTeams();
      else if (route.name === 'team') await renderTeamDetail(route.id);
      else if (route.name === 'players') await renderPlayers();
      else if (route.name === 'player') await renderPlayerDetail(route.id);
      else if (route.name === 'matches') await renderMatches();
      else if (route.name === 'match') await renderMatchDetail(route.id);
      else if (route.name === 'stats') await renderStats();
      else await renderDashboard();
      app.focus({ preventScroll: true });
    } catch (error) {
      console.error(error);
      app.innerHTML = emptyState('No se pudo cargar esta vista', error.message || 'Ocurrió un error inesperado.', '<a class="button" href="#dashboard">Volver al inicio</a>');
      toast(error.message || 'Ocurrió un error inesperado.', 'error');
    }
  }

  function requireActiveLeague() {
    if (state.bundle?.league) return true;
    app.innerHTML = `${pageHeader('LeagueHub', 'Todavía no hay una liga activa', 'Crea una liga o inserta las plantillas de ejemplo para comenzar.')}
      ${emptyState('Configura el primer torneo', 'Los equipos, jugadores, partidos y estadísticas se organizan dentro de una liga activa.', '<a class="button" href="#leagues">Ir a ligas</a>')}`;
    return false;
  }

  function attachComponentData(selector, values) {
    document.querySelectorAll(selector).forEach((element, index) => { element.data = values[index]; });
  }

  // Vistas principales de la SPA. Cada render obtiene datos desde el bundle activo.
  async function renderDashboard() {
    if (!requireActiveLeague()) return;
    const { league, teams, players, matches } = state.bundle;
    const sport = LH.sports.get(league.sport);
    const now = new Date();
    const scheduled = matches
      .filter((match) => match.status === 'scheduled' && match.homeTeamId && match.awayTeamId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const nextMatch = scheduled.find((match) => new Date(match.date) >= now) || scheduled[0] || null;
    const finished = matches.filter((match) => match.status === 'finished').sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastMatch = finished[0] || null;
    const progress = matches.length ? Math.round((finished.length / matches.length) * 100) : 0;

    app.innerHTML = `
      <section class="hero-panel">
        <div>
          <p class="eyebrow">${S.escapeHTML(sport.name)} · ${league.mode === 'league' ? 'Temporada regular' : 'Eliminación directa'}</p>
          <h1>${S.escapeHTML(league.name)}</h1>
          <p>${S.escapeHTML(league.description || 'Controla el calendario, los resultados y la trayectoria de cada participante desde un solo lugar.')}</p>
          <div class="page-actions" style="justify-content:flex-start;margin-top:22px">
            <a class="button button--light" href="#matches">Ver partidos</a>
            <a class="button button--outline" style="color:white;border-color:rgba(255,255,255,.3)" href="#stats">Abrir estadísticas</a>
          </div>
        </div>
        <div class="hero-meta">
          <div class="hero-meta__row"><span>Temporada</span><strong>${S.escapeHTML(league.season)}</strong></div>
          <div class="hero-meta__row"><span>Formato</span><strong>${league.mode === 'league' ? `${league.legs === 2 ? 'Ida y vuelta' : 'Una vuelta'}` : `${league.teamCount} equipos`}</strong></div>
          <div class="hero-meta__row"><span>Estado</span><strong>${league.fixtureGenerated ? `${progress}% completado` : 'Calendario pendiente'}</strong></div>
        </div>
      </section>

      <section class="metric-strip" aria-label="Resumen operativo">
        <div class="metric-strip__item"><span>Equipos inscritos</span><strong>${teams.length}</strong><small>En la liga activa</small></div>
        <div class="metric-strip__item"><span>Jugadores</span><strong>${players.length}</strong><small>Plantillas registradas</small></div>
        <div class="metric-strip__item"><span>Partidos jugados</span><strong>${finished.length} de ${matches.length}</strong><small>Avance del calendario</small></div>
        <div class="metric-strip__item"><span>${sport.eventPlural}</span><strong>${finished.reduce((sum, match) => sum + (match.scoreHome || 0) + (match.scoreAway || 0), 0)}</strong><small>Total registrado</small></div>
      </section>

      <section class="content-grid">
        <article class="panel span-6">
          <div class="panel__header"><div><p class="eyebrow">Agenda</p><h2>Próximo partido</h2></div>${nextMatch ? `<a class="icon-button" href="#match/${nextMatch.id}">Abrir</a>` : ''}</div>
          ${matchFeatureHTML(nextMatch, 'Próximo encuentro')}
        </article>
        <article class="panel span-6 panel--tint">
          <div class="panel__header"><div><p class="eyebrow">Resultado</p><h2>Último partido</h2></div>${lastMatch ? `<a class="icon-button" href="#match/${lastMatch.id}">Detalle</a>` : ''}</div>
          ${matchFeatureHTML(lastMatch, 'Último resultado')}
        </article>

        <article class="panel span-12">
          <div class="panel__header"><div><p class="eyebrow">Torneo</p><h2>${league.mode === 'league' ? 'Vista rápida de la tabla' : 'Estado de las llaves'}</h2></div><a class="icon-button" href="#stats">Ver completo</a></div>
          ${league.mode === 'league' ? '<standings-table id="dashboard-standings"></standings-table>' : '<bracket-view id="dashboard-bracket"></bracket-view>'}
        </article>

        <article class="panel span-7">
          <div class="panel__header"><div><p class="eyebrow">Rendimiento</p><h2>Equipos con más producción</h2></div></div>
          <div id="chart-team-scoring" class="chart-box"><canvas id="dashboard-team-scoring"></canvas></div>
        </article>
        <article class="panel span-5">
          <div class="panel__header"><div><p class="eyebrow">Balance</p><h2>Distribución de resultados</h2></div></div>
          <div id="chart-results" class="chart-box"><canvas id="dashboard-results"></canvas></div>
        </article>
        <article class="panel span-12">
          <div class="panel__header"><div><p class="eyebrow">Cronología</p><h2>${sport.eventPlural} por fecha</h2></div></div>
          <div id="chart-timeline" class="chart-box"><canvas id="dashboard-timeline"></canvas></div>
        </article>
      </section>`;

    if (league.mode === 'league') {
      document.getElementById('dashboard-standings').data = { teams, sport, limit: 5 };
    } else {
      document.getElementById('dashboard-bracket').data = { matches, teams };
    }
    requestAnimationFrame(() => LH.charts.dashboard(state.bundle));
  }

  function matchFeatureHTML(match, label) {
    if (!match) return `<div class="empty-state" style="min-height:180px"><div class="empty-state__inner"><h2>Sin información</h2><p>No hay un partido disponible para mostrar.</p></div></div>`;
    const home = S.getTeamById(state.bundle.teams, match.homeTeamId);
    const away = S.getTeamById(state.bundle.teams, match.awayTeamId);
    return `<div class="feature-match">
      <div class="match-side">${C.crestHTML(home)}<strong>${S.escapeHTML(home?.name || 'Por definir')}</strong></div>
      <div class="match-center"><span class="match-center__score">${match.status === 'finished' ? `${match.scoreHome} – ${match.scoreAway}` : 'vs'}</span><span class="match-center__label">${S.escapeHTML(label)}</span><p class="muted">${S.escapeHTML(S.formatDate(match.date))}</p></div>
      <div class="match-side">${C.crestHTML(away)}<strong>${S.escapeHTML(away?.name || 'Por definir')}</strong></div>
    </div>`;
  }

  async function renderLeagues() {
    const [leagues, teams, matches] = await Promise.all([
      DB.getAll(STORES.leagues),
      DB.getAll(STORES.teams),
      DB.getAll(STORES.matches)
    ]);
    const cardData = leagues.map((league) => ({
      league,
      teamCount: teams.filter((team) => team.leagueId === league.id).length,
      matchCount: matches.filter((match) => match.leagueId === league.id).length
    }));
    const actions = `<button class="button" data-action="new-league">Crear liga</button>
      <button class="button button--outline" data-action="import-league">Importar JSON</button>
      ${leagues.length ? '' : '<button class="button button--soft" data-action="insert-demo">Insertar plantillas</button>'}`;
    app.innerHTML = `${pageHeader('Administración', 'Ligas y torneos', 'Crea competiciones, cambia la liga activa y conserva copias completas en JSON.', actions)}
      ${leagues.length ? `<section class="card-grid">${leagues.map(() => '<league-card></league-card>').join('')}</section>` : emptyState('No hay ligas creadas', 'Puedes comenzar desde cero o insertar dos plantillas de ejemplo para probar la aplicación.', '<button class="button" data-action="new-league">Crear primera liga</button>')}`;
    attachComponentData('league-card', cardData);
  }

  async function renderTeams() {
    if (!requireActiveLeague()) return;
    const { league, teams, players } = state.bundle;
    const standings = S.sortStandings(teams);
    const canAdd = league.mode !== 'knockout' || teams.length < Number(league.teamCount);
    const generationReady = league.mode === 'league'
      ? teams.length >= 2 && !league.fixtureGenerated
      : teams.length === Number(league.teamCount) && !league.fixtureGenerated;
    const generationText = league.mode === 'league' ? 'Generar fixture' : 'Generar bracket';
    const actions = `<button class="button" data-action="new-team" ${canAdd ? '' : 'disabled'}>Agregar equipo</button>
      <button class="button button--soft" data-action="generate-tournament" ${generationReady ? '' : 'disabled'}>${generationText}</button>`;
    const cardData = teams.map((team) => ({
      team,
      playerCount: players.filter((player) => player.teamId === team.id).length,
      position: league.mode === 'league' ? standings.findIndex((entry) => entry.id === team.id) + 1 : null
    }));
    app.innerHTML = `${pageHeader('Liga activa', 'Equipos', league.mode === 'knockout' ? `El torneo admite exactamente ${league.teamCount} equipos.` : 'Gestiona las plantillas que competirán en el calendario.', actions)}
      ${teams.length ? `<section class="card-grid">${teams.map(() => '<team-card></team-card>').join('')}</section>` : emptyState('Todavía no hay equipos', 'Registra al menos dos equipos para generar un fixture de liga.', '<button class="button" data-action="new-team">Agregar primer equipo</button>')}`;
    attachComponentData('team-card', cardData);
  }

  async function renderTeamDetail(teamId) {
    if (!requireActiveLeague()) return;
    const { league, teams, players, matches } = state.bundle;
    const team = S.getTeamById(teams, teamId);
    if (!team) throw new Error('El equipo solicitado no pertenece a la liga activa.');
    const sport = LH.sports.get(league.sport);
    const roster = players.filter((player) => player.teamId === team.id);
    const teamMatches = matches.filter((match) => [match.homeTeamId, match.awayTeamId].includes(team.id));
    const upcoming = teamMatches.filter((match) => match.status === 'scheduled').sort((a, b) => new Date(a.date) - new Date(b.date));
    const played = teamMatches.filter((match) => match.status === 'finished').sort((a, b) => new Date(b.date) - new Date(a.date));
    const position = league.mode === 'league' ? S.sortStandings(teams).findIndex((entry) => entry.id === team.id) + 1 : null;
    const stats = team.stats || {};
    app.innerHTML = `
      <section class="detail-hero">
        ${C.crestHTML(team, 'crest--lg')}
        <div>
          <p class="eyebrow">${S.escapeHTML(team.city || 'Sede no especificada')}</p>
          <h1>${S.escapeHTML(team.name)}</h1>
          <div class="detail-stats">
            <div><span>PJ</span><strong>${stats.played || 0}</strong></div><div><span>PG</span><strong>${stats.wins || 0}</strong></div><div><span>PE</span><strong>${stats.draws || 0}</strong></div><div><span>PP</span><strong>${stats.losses || 0}</strong></div>
            <div><span>${sport.forShort}</span><strong>${stats.scored || 0}</strong></div><div><span>${sport.againstShort}</span><strong>${stats.conceded || 0}</strong></div><div><span>Pts.</span><strong>${stats.points || 0}</strong></div>${position ? `<div><span>Pos.</span><strong>${position}</strong></div>` : ''}
          </div>
        </div>
        <div class="detail-hero__actions"><button class="button button--light" data-action="go-back" data-fallback="#teams">Volver</button><button class="button button--outline" style="color:white;border-color:rgba(255,255,255,.3)" data-action="edit-team" data-id="${team.id}">Editar equipo</button></div>
      </section>
      <section class="content-grid">
        <article class="panel span-7"><div class="panel__header"><div><p class="eyebrow">Plantilla</p><h2>Jugadores</h2></div><button class="icon-button" data-action="new-player" data-team-id="${team.id}">Agregar jugador</button></div>
          ${roster.length ? `<div class="card-grid">${roster.map(() => '<player-card></player-card>').join('')}</div>` : '<p class="muted">Este equipo todavía no tiene jugadores registrados.</p>'}
        </article>
        <article class="panel span-5"><div class="panel__header"><div><p class="eyebrow">Tendencia</p><h2>Puntos acumulados</h2></div></div><div id="chart-team-detail" class="chart-box"><canvas id="team-detail-chart"></canvas></div></article>
        <article class="panel span-6"><div class="panel__header"><div><p class="eyebrow">Agenda</p><h2>Próximos partidos</h2></div></div><div class="match-list">${upcoming.length ? upcoming.slice(0, 5).map((match) => matchRowHTML(match)).join('') : '<p class="muted">No hay encuentros programados.</p>'}</div></article>
        <article class="panel span-6"><div class="panel__header"><div><p class="eyebrow">Historial</p><h2>Partidos jugados</h2></div></div><div class="timeline">${played.length ? played.slice(0, 8).map((match) => historyItemHTML(match, team.id)).join('') : '<p class="muted">No hay resultados registrados.</p>'}</div></article>
      </section>`;
    attachComponentData('player-card', roster.map((player) => ({ player, team })));
    requestAnimationFrame(() => LH.charts.teamDetail(team, matches));
  }

  function historyItemHTML(match, teamId) {
    const rivalId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
    const rival = S.getTeamById(state.bundle.teams, rivalId);
    const result = S.getResultForTeam(match, teamId);
    const className = result === 'W' ? 'result-letter--w' : result === 'D' ? 'result-letter--d' : 'result-letter--l';
    return `<article class="timeline-item" data-link="#match/${match.id}"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>vs ${S.escapeHTML(rival?.name || 'Rival')}</strong><span class="result-letter ${className}">${result}</span></div><p>${match.scoreHome} – ${match.scoreAway} · ${S.escapeHTML(S.formatDate(match.date))}</p></article>`;
  }

  function matchRowHTML(match) {
    const home = S.getTeamById(state.bundle.teams, match.homeTeamId);
    const away = S.getTeamById(state.bundle.teams, match.awayTeamId);
    return `<article class="match-row" data-link="#match/${match.id}"><div class="match-row__team">${C.crestHTML(home, 'crest--sm')}<strong>${S.escapeHTML(home?.name || 'Por definir')}</strong></div><div class="match-row__score">${match.status === 'finished' ? `${match.scoreHome} – ${match.scoreAway}` : 'vs'}</div><div class="match-row__team match-row__team--away"><strong>${S.escapeHTML(away?.name || 'Por definir')}</strong>${C.crestHTML(away, 'crest--sm')}</div><div class="match-row__date">${S.escapeHTML(S.formatDate(match.date))}</div><span class="status ${match.status === 'finished' ? 'status--success' : 'status--scheduled'}">${match.status === 'finished' ? 'Finalizado' : 'Programado'}</span></article>`;
  }

  async function renderPlayers() {
    if (!requireActiveLeague()) return;
    const { teams, players } = state.bundle;
    const filters = state.filters.players;
    const positions = [...new Set(players.map((player) => player.position).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const filtered = players.filter((player) => {
      const matchesSearch = !filters.search || player.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesTeam = !filters.teamId || player.teamId === Number(filters.teamId);
      const matchesPosition = !filters.position || player.position === filters.position;
      return matchesSearch && matchesTeam && matchesPosition;
    });
    const actions = `<button class="button" data-action="new-player" ${teams.length ? '' : 'disabled'}>Agregar jugador</button>`;
    app.innerHTML = `${pageHeader('Plantillas', 'Jugadores', 'Busca por nombre y filtra por equipo o posición.', actions)}
      <section class="toolbar">
        <div class="field field--wide"><label for="player-search">Buscar jugador</label><input id="player-search" data-filter="player-search" type="search" placeholder="Nombre del jugador" value="${S.escapeHTML(filters.search)}"></div>
        <div class="field"><label for="player-team-filter">Equipo</label><select id="player-team-filter" data-filter="player-team"><option value="">Todos</option>${teams.map((team) => `<option value="${team.id}" ${String(team.id) === String(filters.teamId) ? 'selected' : ''}>${S.escapeHTML(team.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="player-position-filter">Posición</label><select id="player-position-filter" data-filter="player-position"><option value="">Todas</option>${positions.map((position) => `<option ${position === filters.position ? 'selected' : ''}>${S.escapeHTML(position)}</option>`).join('')}</select></div>
        <button class="button button--outline" data-action="clear-player-filters">Limpiar</button>
      </section>
      ${filtered.length ? `<section class="card-grid">${filtered.map(() => '<player-card></player-card>').join('')}</section>` : emptyState('No hay coincidencias', players.length ? 'Ajusta los filtros para ver otros jugadores.' : 'Registra equipos y jugadores para construir las plantillas.', teams.length ? '<button class="button" data-action="new-player">Agregar jugador</button>' : '<a class="button" href="#teams">Ir a equipos</a>')}`;
    attachComponentData('player-card', filtered.map((player) => ({ player, team: S.getTeamById(teams, player.teamId) })));
  }

  async function renderPlayerDetail(playerId) {
    if (!requireActiveLeague()) return;
    const { players, teams, matches, events, league } = state.bundle;
    const player = S.getPlayerById(players, playerId);
    if (!player) throw new Error('El jugador solicitado no pertenece a la liga activa.');
    const team = S.getTeamById(teams, player.teamId);
    const playerEvents = events.filter((event) => event.playerId === player.id);
    const matchIds = new Set(playerEvents.map((event) => event.matchId));
    const history = matches.filter((match) => matchIds.has(match.id)).sort((a, b) => new Date(b.date) - new Date(a.date));
    const average = player.stats?.played ? (player.stats.scores / player.stats.played).toFixed(2) : '0.00';
    const sport = LH.sports.get(league.sport);
    app.innerHTML = `
      <section class="detail-hero">
        ${C.avatarHTML(player, 'avatar--lg')}
        <div><p class="eyebrow">${S.escapeHTML(player.position || 'Posición libre')}</p><h1>${S.escapeHTML(player.name)}</h1><p>${S.escapeHTML(team?.name || 'Sin equipo')} · Número ${S.escapeHTML(player.number)}</p>
          <div class="detail-stats"><div><span>PJ</span><strong>${player.stats?.played || 0}</strong></div><div><span>${sport.eventPlural}</span><strong>${player.stats?.scores || 0}</strong></div><div><span>Prom.</span><strong>${average}</strong></div></div>
        </div>
        <div class="detail-hero__actions"><button class="button button--light" data-action="go-back" data-fallback="#players">Volver</button><button class="button button--outline" style="color:white;border-color:rgba(255,255,255,.3)" data-action="edit-player" data-id="${player.id}">Editar jugador</button></div>
      </section>
      <section class="content-grid">
        <article class="panel span-7"><div class="panel__header"><div><p class="eyebrow">Trayectoria</p><h2>Partidos con anotación</h2></div></div><div class="timeline">${history.length ? history.map((match) => {
          const count = playerEvents.filter((event) => event.matchId === match.id).length;
          const rivalId = match.homeTeamId === player.teamId ? match.awayTeamId : match.homeTeamId;
          const rival = S.getTeamById(teams, rivalId);
          return `<article class="timeline-item" data-link="#match/${match.id}"><strong>${count} ${count === 1 ? sport.eventSingular.toLowerCase() : sport.eventPlural.toLowerCase()} vs ${S.escapeHTML(rival?.name || 'Rival')}</strong><p>${match.scoreHome} – ${match.scoreAway} · ${S.escapeHTML(S.formatDate(match.date))}</p></article>`;
        }).join('') : '<p class="muted">El jugador aún no tiene anotaciones registradas.</p>'}</div></article>
        <article class="panel span-5"><div class="panel__header"><div><p class="eyebrow">Producción</p><h2>Anotaciones por partido</h2></div></div><div id="chart-player-detail" class="chart-box"><canvas id="player-detail-chart"></canvas></div></article>
      </section>`;
    requestAnimationFrame(() => LH.charts.playerDetail(player, events, matches));
  }

  async function renderMatches() {
    if (!requireActiveLeague()) return;
    const { league, teams, matches } = state.bundle;
    const filters = state.filters.matches;
    const rounds = [...new Set(matches.map((match) => match.roundName).filter(Boolean))];
    const filtered = matches.filter((match) => {
      if (filters.status && match.status !== filters.status) return false;
      if (filters.teamId && ![match.homeTeamId, match.awayTeamId].includes(Number(filters.teamId))) return false;
      if (filters.dateFrom && new Date(match.date) < new Date(`${filters.dateFrom}T00:00:00`)) return false;
      if (filters.dateTo && new Date(match.date) > new Date(`${filters.dateTo}T23:59:59`)) return false;
      if (filters.round && match.roundName !== filters.round) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    const actions = league.mode === 'league' ? '<button class="button" data-action="new-match">Programar partido</button>' : '';
    app.innerHTML = `${pageHeader('Calendario', 'Partidos', league.mode === 'league' ? 'Programa encuentros manualmente o consulta el fixture generado.' : 'Los partidos provienen del bracket; solo sus fechas pueden ajustarse.', actions)}
      <section class="toolbar">
        <div class="field"><label>Estado</label><select data-filter="match-status"><option value="">Todos</option><option value="scheduled" ${filters.status === 'scheduled' ? 'selected' : ''}>Programados</option><option value="finished" ${filters.status === 'finished' ? 'selected' : ''}>Finalizados</option></select></div>
        <div class="field"><label>Equipo</label><select data-filter="match-team"><option value="">Todos</option>${teams.map((team) => `<option value="${team.id}" ${String(team.id) === String(filters.teamId) ? 'selected' : ''}>${S.escapeHTML(team.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Desde</label><input type="date" data-filter="match-from" value="${S.escapeHTML(filters.dateFrom)}"></div>
        <div class="field"><label>Hasta</label><input type="date" data-filter="match-to" value="${S.escapeHTML(filters.dateTo)}"></div>
        ${league.mode === 'knockout' ? `<div class="field"><label>Ronda</label><select data-filter="match-round"><option value="">Todas</option>${rounds.map((round) => `<option ${round === filters.round ? 'selected' : ''}>${S.escapeHTML(round)}</option>`).join('')}</select></div>` : ''}
        <button class="button button--outline" data-action="clear-match-filters">Limpiar</button>
      </section>
      ${filtered.length ? `<section class="match-list">${filtered.map(() => '<match-card></match-card>').join('')}</section>` : emptyState('No hay partidos para mostrar', matches.length ? 'Ajusta los filtros para recuperar otros encuentros.' : 'Genera el torneo desde la sección de equipos o programa un partido manual.', league.mode === 'league' ? '<button class="button" data-action="new-match">Programar partido</button>' : '<a class="button" href="#teams">Ir a equipos</a>')}`;
    attachComponentData('match-card', filtered.map((match) => ({ match, homeTeam: S.getTeamById(teams, match.homeTeamId), awayTeam: S.getTeamById(teams, match.awayTeamId) })));
  }

  async function renderMatchDetail(matchId) {
    if (!requireActiveLeague()) return;
    const { league, teams, players, matches, events } = state.bundle;
    const match = matches.find((entry) => entry.id === Number(matchId));
    if (!match) throw new Error('El partido solicitado no pertenece a la liga activa.');
    const home = S.getTeamById(teams, match.homeTeamId);
    const away = S.getTeamById(teams, match.awayTeamId);
    if (!state.stagedEvents.has(match.id)) {
      state.stagedEvents.set(match.id, events.filter((event) => event.matchId === match.id).map((event) => ({ ...event })));
    }
    const staged = state.stagedEvents.get(match.id) || [];
    const sport = LH.sports.get(league.sport);
    const homeEvents = staged.filter((event) => event.teamId === match.homeTeamId);
    const awayEvents = staged.filter((event) => event.teamId === match.awayTeamId);
    const scheduledAndReady = match.status === 'scheduled' && home && away;
    app.innerHTML = `
      ${pageHeader(match.roundName || 'Partido', `${S.escapeHTML(home?.name || 'Por definir')} vs ${S.escapeHTML(away?.name || 'Por definir')}`, S.formatDate(match.date), `<button class="button button--outline" data-action="go-back" data-fallback="#matches">Volver</button>${match.status === 'scheduled' ? `<button class="button button--soft" data-action="edit-match" data-id="${match.id}">Editar fecha</button>` : ''}`)}
      <section class="scoreboard">
        <div class="match-side">${C.crestHTML(home, 'crest--lg')}<strong>${S.escapeHTML(home?.name || 'Por definir')}</strong></div>
        <div class="scoreboard__score"><strong>${match.status === 'finished' ? `${match.scoreHome} – ${match.scoreAway}` : `${homeEvents.length} – ${awayEvents.length}`}</strong><span>${match.status === 'finished' ? 'Marcador final' : 'Marcador provisional'}</span>${match.tiebreakWinnerId ? `<p>Ganador del desempate: ${S.escapeHTML(S.getTeamById(teams, match.tiebreakWinnerId)?.name || '')}</p>` : ''}</div>
        <div class="match-side">${C.crestHTML(away, 'crest--lg')}<strong>${S.escapeHTML(away?.name || 'Por definir')}</strong></div>
      </section>

      <section class="content-grid" style="margin-top:20px">
        <article class="panel span-12">
          <div class="panel__header"><div><p class="eyebrow">Registro</p><h2>${sport.eventPlural} del partido</h2><p>${match.status === 'finished' ? 'Los eventos permanecen guardados y pueden reutilizarse si deshaces el resultado.' : 'Agrega cada anotación antes de finalizar el partido.'}</p></div>${scheduledAndReady ? `<button class="button" data-action="add-event" data-id="${match.id}">Agregar ${sport.eventSingular.toLowerCase()}</button>` : ''}</div>
          <div class="events-grid">
            ${eventColumnHTML(home, homeEvents, players, match.status === 'scheduled')}
            ${eventColumnHTML(away, awayEvents, players, match.status === 'scheduled')}
          </div>
          <div class="form-actions">
            ${match.status === 'scheduled' && league.mode === 'league' ? `<button class="button button--ghost" data-action="delete-match" data-id="${match.id}">Eliminar partido</button>` : ''}
            ${scheduledAndReady ? `<button class="button" data-action="finish-match" data-id="${match.id}">Finalizar partido</button>` : ''}
            ${match.status === 'finished' ? `<button class="button button--danger" data-action="undo-match" data-id="${match.id}">Deshacer resultado</button>` : ''}
          </div>
        </article>
      </section>`;
  }

  function eventColumnHTML(team, list, players, editable) {
    return `<section class="event-column"><h3>${S.escapeHTML(team?.name || 'Por definir')}</h3>${list.length ? list.map((event) => {
      const player = S.getPlayerById(players, event.playerId);
      const index = (state.stagedEvents.get(state.route.id) || []).indexOf(event);
      return `<div class="event-item"><span><strong>${S.escapeHTML(player?.name || 'Jugador')}</strong>${event.minute != null ? ` · ${event.minute}'` : ''}</span>${editable ? `<button class="icon-button" data-action="remove-event" data-index="${index}" data-match-id="${state.route.id}">Quitar</button>` : ''}</div>`;
    }).join('') : '<p class="muted">Sin anotaciones.</p>'}</section>`;
  }

  async function renderStats() {
    if (!requireActiveLeague()) return;
    const { league, teams, players, matches } = state.bundle;
    const sport = LH.sports.get(league.sport);
    app.innerHTML = `${pageHeader('Análisis', 'Estadísticas', league.mode === 'league' ? 'Tabla, rankings y evolución de la temporada.' : 'Bracket, producción por ronda y rendimiento individual.')}
      <section class="content-grid">
        <article class="panel span-12"><div class="panel__header"><div><p class="eyebrow">Estructura del torneo</p><h2>${league.mode === 'league' ? 'Tabla de posiciones' : 'Bracket completo'}</h2></div></div>${league.mode === 'league' ? '<standings-table id="stats-standings"></standings-table>' : '<bracket-view id="stats-bracket"></bracket-view>'}</article>
        <article class="panel span-12"><div class="panel__header"><div><p class="eyebrow">Rendimiento individual</p><h2>${sport.scorerTitle}</h2></div></div><ranking-table id="stats-ranking"></ranking-table></article>
        ${league.mode === 'league' ? `
          <article class="panel span-7"><div class="panel__header"><div><p class="eyebrow">Evolución</p><h2>Puntos acumulados</h2></div></div><div id="chart-points-evolution" class="chart-box"><canvas id="stats-points-evolution"></canvas></div></article>
          <article class="panel span-5"><div class="panel__header"><div><p class="eyebrow">Producción</p><h2>Top de anotadores</h2></div></div><div id="chart-top-scorers" class="chart-box"><canvas id="stats-top-scorers"></canvas></div></article>
          <article class="panel span-12"><div class="panel__header"><div><p class="eyebrow">Comparativa</p><h2>A favor y en contra</h2></div></div><div id="chart-league-balance" class="chart-box"><canvas id="stats-league-balance"></canvas></div></article>` : `
          <article class="panel span-6"><div class="panel__header"><div><p class="eyebrow">Rondas</p><h2>Anotaciones por etapa</h2></div></div><div id="chart-round-scoring" class="chart-box"><canvas id="stats-round-scoring"></canvas></div></article>
          <article class="panel span-6"><div class="panel__header"><div><p class="eyebrow">Producción</p><h2>Top de anotadores</h2></div></div><div id="chart-top-scorers" class="chart-box"><canvas id="stats-top-scorers"></canvas></div></article>
          <article class="panel span-12"><div class="panel__header"><div><p class="eyebrow">Partidos</p><h2>Distribución de anotaciones</h2></div></div><div id="chart-knockout-distribution" class="chart-box"><canvas id="stats-knockout-distribution"></canvas></div></article>`}
      </section>`;
    if (league.mode === 'league') document.getElementById('stats-standings').data = { teams, sport };
    else document.getElementById('stats-bracket').data = { matches, teams };
    document.getElementById('stats-ranking').data = { players, teams, limit: 10 };
    requestAnimationFrame(() => LH.charts.stats(state.bundle));
  }

  // Formularios y confirmaciones reutilizan un único elemento dialog.
  function openDialog({ title, eyebrow = 'LeagueHub', body, submitText = 'Guardar', onSubmit }) {
    dialogTitle.textContent = title;
    dialogEyebrow.textContent = eyebrow;
    dialogBody.innerHTML = `${body}<div class="form-actions"><button class="button button--ghost" type="button" data-action="close-dialog">Cancelar</button>${submitText ? `<button class="button" type="submit" value="save">${S.escapeHTML(submitText)}</button>` : ''}</div>`;
    state.dialogSubmit = onSubmit || null;
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
    state.dialogSubmit = null;
  }

  function confirmDialog(title, message, confirmText = 'Confirmar') {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      openDialog({
        title,
        eyebrow: 'Confirmación',
        body: `<p class="help-box">${S.escapeHTML(message)}</p>`,
        submitText: confirmText,
        onSubmit: async () => { finish(true); closeDialog(); }
      });
      const cancel = dialogBody.querySelector('[data-action="close-dialog"]');
      cancel.addEventListener('click', () => finish(false), { once: true });
      dialog.addEventListener('cancel', () => finish(false), { once: true });
      dialog.addEventListener('close', () => finish(false), { once: true });
    });
  }

  function sportOptions(selected) {
    return LH.sports.list.map((sport) => `<option value="${sport.id}" ${sport.id === selected ? 'selected' : ''}>${S.escapeHTML(sport.name)}</option>`).join('');
  }

  async function openLeagueForm(leagueId = null) {
    const league = leagueId ? await DB.get(STORES.leagues, Number(leagueId)) : null;
    openDialog({
      title: league ? 'Editar liga' : 'Crear liga',
      eyebrow: 'Configuración del torneo',
      body: `
        <div class="field"><label for="league-name">Nombre</label><input id="league-name" name="name" required maxlength="70" value="${S.escapeHTML(league?.name || '')}"></div>
        <div class="field-row">
          <div class="field"><label for="league-sport">Deporte</label><select id="league-sport" name="sport" required ${league ? 'disabled' : ''}>${sportOptions(league?.sport || 'football')}</select>${league ? `<input type="hidden" name="sport" value="${S.escapeHTML(league.sport)}">` : ''}</div>
          <div class="field"><label for="league-season">Temporada</label><input id="league-season" name="season" required value="${S.escapeHTML(league?.season || 'Temporada 2026')}"></div>
        </div>
        ${league ? `<div class="help-box">La modalidad no puede modificarse después de crear la liga. Formato actual: ${league.mode === 'league' ? 'liga' : 'eliminación directa'}.</div><input type="hidden" name="mode" value="${league.mode}">` : `
        <div class="field"><label for="league-mode">Modalidad</label><select id="league-mode" name="mode" required><option value="league">Liga (todos contra todos)</option><option value="knockout">Eliminación directa</option></select></div>
        <div class="field-row">
          <div class="field"><label for="league-legs">Vueltas en modalidad liga</label><select id="league-legs" name="legs"><option value="1">Una vuelta</option><option value="2">Ida y vuelta</option></select></div>
          <div class="field"><label for="league-team-count">Equipos en eliminación</label><select id="league-team-count" name="teamCount"><option value="4">4 equipos</option><option value="8">8 equipos</option><option value="16">16 equipos</option></select></div>
        </div>`}
        <div class="field"><label for="league-description">Descripción</label><textarea id="league-description" name="description" maxlength="300">${S.escapeHTML(league?.description || '')}</textarea></div>`,
      submitText: league ? 'Guardar cambios' : 'Crear liga',
      onSubmit: async (formData) => {
        const payload = {
          name: String(formData.get('name')).trim(),
          sport: String(formData.get('sport')),
          season: String(formData.get('season')).trim(),
          mode: String(formData.get('mode')),
          description: String(formData.get('description') || '').trim(),
          ...(String(formData.get('mode')) === 'league' ? { legs: Number(formData.get('legs') || league?.legs || 1) } : { teamCount: Number(formData.get('teamCount') || league?.teamCount || 4) })
        };
        if (league) await DB.put(STORES.leagues, { ...league, name: payload.name, season: payload.season, description: payload.description });
        else await DB.createLeague(payload);
        closeDialog();
        toast(league ? 'La liga fue actualizada.' : 'La liga fue creada.');
        await renderCurrent();
      }
    });
  }

  async function openTeamForm(teamId = null) {
    if (!state.activeLeague) return;
    const team = teamId ? await DB.get(STORES.teams, Number(teamId)) : null;
    openDialog({
      title: team ? 'Editar equipo' : 'Agregar equipo',
      eyebrow: state.activeLeague.name,
      body: `
        <div class="field"><label for="team-name">Nombre</label><input id="team-name" name="name" required maxlength="60" value="${S.escapeHTML(team?.name || '')}"></div>
        <div class="field-row"><div class="field"><label for="team-city">Ciudad o sede</label><input id="team-city" name="city" value="${S.escapeHTML(team?.city || '')}"></div><div class="field"><label for="team-crest">URL del escudo</label><input id="team-crest" name="crestUrl" type="url" value="${S.escapeHTML(team?.crestUrl || '')}" placeholder="Opcional"></div></div>
        <div class="field-row"><div class="field"><label for="team-primary">Color principal</label><input id="team-primary" name="primaryColor" type="color" value="${S.escapeHTML(team?.primaryColor || '#176b4d')}"></div><div class="field"><label for="team-secondary">Color secundario</label><input id="team-secondary" name="secondaryColor" type="color" value="${S.escapeHTML(team?.secondaryColor || '#d7a73e')}"></div></div>`,
      submitText: team ? 'Guardar cambios' : 'Agregar equipo',
      onSubmit: async (formData) => {
        const payload = {
          name: String(formData.get('name')).trim(), city: String(formData.get('city') || '').trim(), crestUrl: String(formData.get('crestUrl') || '').trim(),
          primaryColor: String(formData.get('primaryColor')), secondaryColor: String(formData.get('secondaryColor')), leagueId: state.activeLeague.id
        };
        if (team) await DB.put(STORES.teams, { ...team, ...payload });
        else await DB.add(STORES.teams, payload);
        closeDialog(); toast(team ? 'El equipo fue actualizado.' : 'El equipo fue agregado.'); await renderCurrent();
      }
    });
  }

  async function openPlayerForm(playerId = null, presetTeamId = null) {
    if (!state.bundle?.teams.length) { toast('Primero debes registrar un equipo.', 'error'); return; }
    const player = playerId ? await DB.get(STORES.players, Number(playerId)) : null;
    const selectedTeamId = player?.teamId || Number(presetTeamId) || state.bundle.teams[0].id;
    openDialog({
      title: player ? 'Editar jugador' : 'Agregar jugador',
      eyebrow: state.activeLeague.name,
      body: `
        <div class="field"><label for="player-name">Nombre</label><input id="player-name" name="name" required maxlength="70" value="${S.escapeHTML(player?.name || '')}"></div>
        <div class="field-row"><div class="field"><label for="player-position">Posición</label><input id="player-position" name="position" value="${S.escapeHTML(player?.position || '')}" placeholder="Texto libre"></div><div class="field"><label for="player-number">Número</label><input id="player-number" name="number" type="number" required min="0" max="999" value="${S.escapeHTML(player?.number ?? '')}"></div></div>
        <div class="field"><label for="player-team">Equipo</label><select id="player-team" name="teamId" required>${state.bundle.teams.map((team) => `<option value="${team.id}" ${team.id === selectedTeamId ? 'selected' : ''}>${S.escapeHTML(team.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="player-photo">URL de la foto</label><input id="player-photo" name="photoUrl" type="url" value="${S.escapeHTML(player?.photoUrl || '')}" placeholder="Opcional"></div>`,
      submitText: player ? 'Guardar cambios' : 'Agregar jugador',
      onSubmit: async (formData) => {
        const payload = { name: String(formData.get('name')).trim(), position: String(formData.get('position') || '').trim(), number: Number(formData.get('number')), teamId: Number(formData.get('teamId')), photoUrl: String(formData.get('photoUrl') || '').trim(), leagueId: state.activeLeague.id };
        if (player) await DB.put(STORES.players, { ...player, ...payload });
        else await DB.add(STORES.players, payload);
        closeDialog(); toast(player ? 'El jugador fue actualizado.' : 'El jugador fue agregado.'); await renderCurrent();
      }
    });
  }

  async function openMatchForm(matchId = null) {
    const match = matchId ? await DB.get(STORES.matches, Number(matchId)) : null;
    if (!match && state.activeLeague.mode !== 'league') return;
    const onlyDate = match && state.activeLeague.mode === 'knockout';
    openDialog({
      title: match ? 'Editar partido' : 'Programar partido',
      eyebrow: state.activeLeague.name,
      body: `${onlyDate ? '<div class="help-box">En eliminación directa solo se puede modificar la fecha del partido.</div>' : `
        <div class="field-row"><div class="field"><label>Equipo local</label><select name="homeTeamId" required>${state.bundle.teams.map((team) => `<option value="${team.id}" ${team.id === match?.homeTeamId ? 'selected' : ''}>${S.escapeHTML(team.name)}</option>`).join('')}</select></div><div class="field"><label>Equipo visitante</label><select name="awayTeamId" required>${state.bundle.teams.map((team) => `<option value="${team.id}" ${team.id === match?.awayTeamId ? 'selected' : ''}>${S.escapeHTML(team.name)}</option>`).join('')}</select></div></div>`}
        <div class="field"><label>Fecha y hora</label><input name="date" type="datetime-local" required value="${S.escapeHTML(S.toLocalInputValue(match?.date || new Date()))}"></div>`,
      submitText: match ? 'Guardar cambios' : 'Programar',
      onSubmit: async (formData) => {
        const date = new Date(String(formData.get('date'))).toISOString();
        if (match) {
          const payload = { ...match, date };
          if (!onlyDate) { payload.homeTeamId = Number(formData.get('homeTeamId')); payload.awayTeamId = Number(formData.get('awayTeamId')); }
          if (payload.homeTeamId === payload.awayTeamId) throw new Error('Un equipo no puede enfrentarse a sí mismo.');
          await DB.put(STORES.matches, payload);
        } else {
          const homeTeamId = Number(formData.get('homeTeamId')); const awayTeamId = Number(formData.get('awayTeamId'));
          if (homeTeamId === awayTeamId) throw new Error('Un equipo no puede enfrentarse a sí mismo.');
          const duplicate = state.bundle.matches.some((entry) => entry.homeTeamId === homeTeamId && entry.awayTeamId === awayTeamId && new Date(entry.date).getTime() === new Date(date).getTime());
          if (duplicate) throw new Error('Ya existe un partido idéntico en esa fecha.');
          await DB.add(STORES.matches, { leagueId: state.activeLeague.id, homeTeamId, awayTeamId, date, status: 'scheduled', scoreHome: null, scoreAway: null, round: null });
        }
        closeDialog(); toast(match ? 'El partido fue actualizado.' : 'El partido fue programado.'); await renderCurrent();
      }
    });
  }

  async function openEventForm(matchId) {
    const match = state.bundle.matches.find((entry) => entry.id === Number(matchId));
    const home = S.getTeamById(state.bundle.teams, match.homeTeamId); const away = S.getTeamById(state.bundle.teams, match.awayTeamId);
    const availablePlayers = state.bundle.players.filter((player) => [match.homeTeamId, match.awayTeamId].includes(player.teamId));
    if (!availablePlayers.length) { toast('Registra jugadores en los equipos antes de agregar anotaciones.', 'error'); return; }
    const sport = LH.sports.get(state.activeLeague.sport);
    openDialog({
      title: `Agregar ${sport.eventSingular.toLowerCase()}`,
      eyebrow: `${home.name} vs ${away.name}`,
      body: `<div class="field"><label>Equipo</label><select name="teamId" id="event-team"><option value="${home.id}">${S.escapeHTML(home.name)}</option><option value="${away.id}">${S.escapeHTML(away.name)}</option></select></div><div class="field"><label>Jugador</label><select name="playerId" id="event-player">${availablePlayers.filter((player) => player.teamId === home.id).map((player) => `<option value="${player.id}">${S.escapeHTML(player.name)}</option>`).join('')}</select></div><div class="field"><label>Minuto (opcional)</label><input type="number" name="minute" min="0" max="999"></div>`,
      submitText: 'Agregar',
      onSubmit: async (formData) => {
        const teamId = Number(formData.get('teamId')); const playerId = Number(formData.get('playerId')); const player = S.getPlayerById(state.bundle.players, playerId);
        if (!player || player.teamId !== teamId) throw new Error('El jugador no pertenece al equipo seleccionado.');
        const list = state.stagedEvents.get(match.id) || [];
        list.push({ matchId: match.id, teamId, playerId, minute: formData.get('minute') === '' ? null : Number(formData.get('minute')), type: 'score' });
        state.stagedEvents.set(match.id, list); closeDialog(); await renderCurrent({ skipRefresh: true });
      }
    });
    const teamSelect = document.getElementById('event-team'); const playerSelect = document.getElementById('event-player');
    teamSelect.addEventListener('change', () => {
      playerSelect.innerHTML = availablePlayers.filter((player) => player.teamId === Number(teamSelect.value)).map((player) => `<option value="${player.id}">${S.escapeHTML(player.name)}</option>`).join('');
    });
  }

  // Delegación central de acciones para evitar listeners repetidos en cada vista.
  async function handleAction(action, element) {
    const id = Number(element.dataset.id || 0);
    if (action === 'close-dialog') { closeDialog(); return; }
    if (action === 'go-back') { if (history.length > 1) history.back(); else location.hash = element.dataset.fallback || '#dashboard'; return; }
    if (action === 'new-league') return openLeagueForm();
    if (action === 'edit-league') return openLeagueForm(id);
    if (action === 'new-team') return openTeamForm();
    if (action === 'edit-team') return openTeamForm(id);
    if (action === 'new-player') return openPlayerForm(null, element.dataset.teamId);
    if (action === 'edit-player') return openPlayerForm(id);
    if (action === 'new-match') return openMatchForm();
    if (action === 'edit-match') return openMatchForm(id);
    if (action === 'add-event') return openEventForm(id);

    if (action === 'activate-league') {
      await DB.activateLeague(id); toast('La liga activa fue cambiada.'); location.hash = '#dashboard'; await renderCurrent(); return;
    }
    if (action === 'delete-league') {
      const league = await DB.get(STORES.leagues, id); const ok = await confirmDialog('Eliminar liga', `Se borrarán en cascada todos los datos de “${league.name}”. Esta acción no se puede deshacer.`, 'Eliminar definitivamente');
      if (!ok) return; await DB.deleteLeagueCascade(id); closeDialog(); toast('La liga y sus datos fueron eliminados.'); await renderCurrent(); return;
    }
    if (action === 'delete-team') {
      const team = await DB.get(STORES.teams, id); const ok = await confirmDialog('Eliminar equipo', `Se eliminará “${team.name}” y sus jugadores si no tiene partidos asociados.`, 'Eliminar equipo');
      if (!ok) return; await DB.deleteTeamCascade(id); closeDialog(); toast('El equipo fue eliminado.'); await renderCurrent(); return;
    }
    if (action === 'delete-player') {
      const player = await DB.get(STORES.players, id); const ok = await confirmDialog('Eliminar jugador', `Se eliminará a “${player.name}” si no tiene anotaciones registradas.`, 'Eliminar jugador');
      if (!ok) return; await DB.deletePlayerSafe(id); closeDialog(); toast('El jugador fue eliminado.'); await renderCurrent(); return;
    }
    if (action === 'delete-match') {
      const ok = await confirmDialog('Eliminar partido', 'El partido programado se borrará del calendario.', 'Eliminar partido'); if (!ok) return;
      await DB.remove(STORES.matches, id); state.stagedEvents.delete(id); closeDialog(); toast('El partido fue eliminado.'); location.hash = '#matches'; await renderCurrent(); return;
    }
    if (action === 'export-league') {
      const pkg = await DB.exportLeague(id); S.downloadJSON(pkg, `${S.slugify(pkg.league.name)}-leaguehub.json`); toast('La copia JSON fue generada.'); return;
    }
    if (action === 'import-league') return openImportDialog();
    if (action === 'insert-demo') {
      setLoading('Insertando plantillas de ejemplo…'); await S.insertDemoData(); toast('Se insertaron dos ligas de ejemplo.'); location.hash = '#dashboard'; await renderCurrent(); return;
    }
    if (action === 'generate-tournament') return generateTournament();
    if (action === 'remove-event') {
      const matchId = Number(element.dataset.matchId); const list = state.stagedEvents.get(matchId) || []; list.splice(Number(element.dataset.index), 1); state.stagedEvents.set(matchId, list); await renderCurrent({ skipRefresh: true }); return;
    }
    if (action === 'finish-match') return finishMatch(id);
    if (action === 'undo-match') {
      const ok = await confirmDialog('Deshacer resultado', 'Las estadísticas se revertirán y los eventos quedarán disponibles para corregir el partido.', 'Deshacer partido'); if (!ok) return;
      await DB.undoMatch(id); closeDialog(); state.stagedEvents.delete(id); toast('El resultado fue deshecho.'); await renderCurrent(); return;
    }
    if (action === 'clear-player-filters') { state.filters.players = { search: '', teamId: '', position: '' }; await renderCurrent({ skipRefresh: true }); return; }
    if (action === 'clear-match-filters') { state.filters.matches = { status: '', teamId: '', dateFrom: '', dateTo: '', round: '' }; await renderCurrent({ skipRefresh: true }); return; }
  }

  async function generateTournament() {
    const { league, teams } = state.bundle;
    if (league.fixtureGenerated) { toast('El calendario ya fue generado.', 'error'); return; }
    const start = new Date(); start.setDate(start.getDate() + 7);
    if (league.mode === 'league') {
      if (teams.length < 2) throw new Error('Registra al menos dos equipos.');
      const matches = S.generateRoundRobin(teams, league.legs || 1, start);
      await DB.bulkAddMatches(league.id, matches);
      toast(`Se generaron ${matches.length} partidos.`);
    } else {
      if (teams.length !== Number(league.teamCount)) throw new Error(`Debes registrar exactamente ${league.teamCount} equipos.`);
      const matches = S.generateBracket(teams, start, true);
      await DB.createBracket(league.id, matches);
      toast('El bracket fue generado.');
    }
    await renderCurrent();
  }

  async function finishMatch(matchId) {
    const match = state.bundle.matches.find((entry) => entry.id === Number(matchId));
    const staged = state.stagedEvents.get(match.id) || [];
    const homeScore = staged.filter((event) => event.teamId === match.homeTeamId).length;
    const awayScore = staged.filter((event) => event.teamId === match.awayTeamId).length;
    if (state.activeLeague.mode === 'knockout' && homeScore === awayScore) {
      const home = S.getTeamById(state.bundle.teams, match.homeTeamId); const away = S.getTeamById(state.bundle.teams, match.awayTeamId);
      openDialog({ title: 'Definir ganador', eyebrow: 'Desempate obligatorio', body: `<div class="help-box">El marcador está empatado. Indica qué equipo avanzó por penales u otro criterio de desempate.</div><div class="field"><label>Ganador</label><select name="winnerId"><option value="${home.id}">${S.escapeHTML(home.name)}</option><option value="${away.id}">${S.escapeHTML(away.name)}</option></select></div>`, submitText: 'Finalizar y avanzar', onSubmit: async (formData) => {
        await DB.finishMatch(match.id, staged, Number(formData.get('winnerId'))); closeDialog(); state.stagedEvents.delete(match.id); toast('El partido fue finalizado y el ganador avanzó.'); await renderCurrent();
      }}); return;
    }
    const ok = await confirmDialog('Finalizar partido', `Se guardará el marcador ${homeScore} – ${awayScore} y se actualizarán todas las estadísticas.`, 'Finalizar');
    if (!ok) return;
    await DB.finishMatch(match.id, staged, null); closeDialog(); state.stagedEvents.delete(match.id); toast('El partido fue finalizado.'); await renderCurrent();
  }

  function openImportDialog() {
    openDialog({ title: 'Importar liga', eyebrow: 'Restaurar desde JSON', body: `<div class="field"><label>Archivo LeagueHub</label><input type="file" name="file" accept="application/json,.json" required></div><div class="field"><label>Nombre alternativo</label><input name="rename" placeholder="Úsalo si el nombre ya existe"></div>`, submitText: 'Importar', onSubmit: async (formData) => {
      const file = formData.get('file'); if (!(file instanceof File) || !file.size) throw new Error('Selecciona un archivo JSON.');
      const pkg = JSON.parse(await file.text()); await DB.importLeague(pkg, String(formData.get('rename') || '').trim() || undefined); closeDialog(); toast('La liga fue importada correctamente.'); await renderCurrent();
    }});
  }

  dialogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { closeDialog(); return; }
    if (!state.dialogSubmit) return;
    try {
      const submitter = event.submitter; if (submitter) submitter.disabled = true;
      await state.dialogSubmit(new FormData(dialogForm));
      if (submitter) submitter.disabled = false;
    } catch (error) {
      console.error(error); toast(error.message || 'No se pudo completar la operación.', 'error');
      if (event.submitter) event.submitter.disabled = false;
    }
  });

  document.addEventListener('click', async (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (actionElement) {
      event.preventDefault(); event.stopPropagation();
      try { await handleAction(actionElement.dataset.action, actionElement); }
      catch (error) { console.error(error); toast(error.message || 'No se pudo completar la operación.', 'error'); if (dialog.open && actionElement.dataset.action !== 'close-dialog') { /* Mantener abierto para corregir. */ } }
      return;
    }
    const linkElement = event.target.closest('[data-link]');
    if (linkElement && !event.target.closest('a,button,input,select,textarea')) location.hash = linkElement.dataset.link;
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-filter="player-search"]')) {
      clearTimeout(state.playerSearchTimer);
      state.playerSearchTimer = setTimeout(async () => { state.filters.players.search = event.target.value.trim(); await renderCurrent({ skipRefresh: true }); }, 350);
    }
  });

  document.addEventListener('change', async (event) => {
    const filter = event.target.dataset.filter;
    if (!filter) return;
    if (filter === 'player-team') state.filters.players.teamId = event.target.value;
    else if (filter === 'player-position') state.filters.players.position = event.target.value;
    else if (filter === 'match-status') state.filters.matches.status = event.target.value;
    else if (filter === 'match-team') state.filters.matches.teamId = event.target.value;
    else if (filter === 'match-from') state.filters.matches.dateFrom = event.target.value;
    else if (filter === 'match-to') state.filters.matches.dateTo = event.target.value;
    else if (filter === 'match-round') state.filters.matches.round = event.target.value;
    else return;
    await renderCurrent({ skipRefresh: true });
  });

  menuButton.addEventListener('click', () => {
    const open = mainNav.classList.toggle('is-open'); menuButton.setAttribute('aria-expanded', String(open));
  });
  mainNav.addEventListener('click', () => { mainNav.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); });
  window.addEventListener('hashchange', () => renderCurrent());
  window.addEventListener('leaguehub-chart-ready', () => renderCurrent({ skipRefresh: true }));

  async function init() {
    try {
      await DB.open();
      const status = document.getElementById('db-status'); status.textContent = 'IndexedDB: conectado'; status.classList.add('is-ok');
      if (!location.hash) history.replaceState(null, '', '#dashboard');
      await renderCurrent();
    } catch (error) {
      console.error(error);
      const status = document.getElementById('db-status'); status.textContent = 'IndexedDB: error'; status.classList.add('is-error');
      app.innerHTML = emptyState('No se pudo iniciar LeagueHub', 'El navegador bloqueó IndexedDB. Revisa los permisos o prueba en una ventana normal.', '');
    }
  }

  init();
})();
