(function () {
  'use strict';

  window.LH = window.LH || {};

  const { STORES } = window.LH.db;

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function initials(name, max = 2) {
    return String(name || 'LH')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function toLocalInputValue(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 16);
  }

  function formatDate(value, includeTime = true) {
    if (!value) return 'Fecha por definir';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha inválida';
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
    }).format(date);
  }

  function slugify(value) {
    return String(value || 'liga')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function getTeamById(teams, id) {
    return teams.find((team) => team.id === Number(id)) || null;
  }

  function getPlayerById(players, id) {
    return players.find((player) => player.id === Number(id)) || null;
  }

  function sortStandings(teams) {
    return [...teams].sort((a, b) => {
      const aStats = a.stats || {};
      const bStats = b.stats || {};
      const points = (bStats.points || 0) - (aStats.points || 0);
      if (points) return points;
      const difference = ((bStats.scored || 0) - (bStats.conceded || 0)) - ((aStats.scored || 0) - (aStats.conceded || 0));
      if (difference) return difference;
      const scored = (bStats.scored || 0) - (aStats.scored || 0);
      if (scored) return scored;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  function getMatchWinnerId(match) {
    if (!match || match.status !== 'finished') return null;
    if (match.scoreHome === match.scoreAway) return match.tiebreakWinnerId || null;
    return match.scoreHome > match.scoreAway ? match.homeTeamId : match.awayTeamId;
  }

  function getResultForTeam(match, teamId) {
    if (match.status !== 'finished') return null;
    const isHome = match.homeTeamId === teamId;
    const own = isHome ? match.scoreHome : match.scoreAway;
    const other = isHome ? match.scoreAway : match.scoreHome;
    if (own === other) return 'D';
    return own > other ? 'W' : 'L';
  }

  function roundName(roundIndex, totalRounds) {
    const remaining = totalRounds - roundIndex;
    if (remaining === 1) return 'Final';
    if (remaining === 2) return 'Semifinal';
    if (remaining === 3) return 'Cuartos';
    if (remaining === 4) return 'Octavos';
    return `Ronda ${roundIndex + 1}`;
  }

  // Algoritmo circular para una vuelta o ida y vuelta.
  function generateRoundRobin(teams, legs, startDate) {
    const teamIds = teams.map((team) => team.id);
    if (teamIds.length < 2) return [];
    if (teamIds.length % 2 !== 0) teamIds.push(null);

    const total = teamIds.length;
    const rounds = total - 1;
    const half = total / 2;
    const rotation = [...teamIds];
    const matches = [];
    const start = new Date(startDate || Date.now());
    start.setMinutes(0, 0, 0);

    for (let round = 0; round < rounds; round += 1) {
      for (let pair = 0; pair < half; pair += 1) {
        let homeTeamId = rotation[pair];
        let awayTeamId = rotation[total - 1 - pair];
        if (!homeTeamId || !awayTeamId) continue;
        if ((round + pair) % 2 === 1) [homeTeamId, awayTeamId] = [awayTeamId, homeTeamId];
        const date = new Date(start);
        date.setDate(start.getDate() + round * 7);
        date.setHours(16 + (pair % 3) * 2, 0, 0, 0);
        matches.push({
          homeTeamId,
          awayTeamId,
          date: date.toISOString(),
          round: round + 1,
          leg: 1
        });
      }
      const fixed = rotation[0];
      const rest = rotation.slice(1);
      rest.unshift(rest.pop());
      rotation.splice(0, rotation.length, fixed, ...rest);
    }

    if (Number(legs) === 2) {
      const secondLegStart = rounds * 7;
      const firstLeg = [...matches];
      firstLeg.forEach((match, index) => {
        const date = new Date(match.date);
        date.setDate(date.getDate() + secondLegStart);
        matches.push({
          homeTeamId: match.awayTeamId,
          awayTeamId: match.homeTeamId,
          date: date.toISOString(),
          round: match.round + rounds,
          leg: 2,
          returnOfIndex: index
        });
      });
    }

    return matches;
  }

  function seededShuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  // Construye rondas y referencias lógicas antes de persistir el bracket.
  function generateBracket(teams, startDate, randomize = true) {
    const count = teams.length;
    if (![4, 8, 16].includes(count)) throw new Error('El bracket requiere 4, 8 o 16 equipos.');
    const seededTeams = randomize ? seededShuffle(teams) : [...teams];
    const totalRounds = Math.log2(count);
    const matches = [];
    const start = new Date(startDate || Date.now());
    start.setHours(18, 0, 0, 0);

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
      const matchesInRound = count / (2 ** (roundIndex + 1));
      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
        const bracketKey = `r${roundIndex}-m${matchIndex}`;
        const nextBracketKey = roundIndex < totalRounds - 1
          ? `r${roundIndex + 1}-m${Math.floor(matchIndex / 2)}`
          : null;
        const date = new Date(start);
        date.setDate(start.getDate() + roundIndex * 7);
        date.setHours(18 + (matchIndex % 2) * 2, 0, 0, 0);
        const firstRound = roundIndex === 0;
        matches.push({
          bracketKey,
          nextBracketKey,
          nextSlot: matchIndex % 2 === 0 ? 'home' : 'away',
          roundIndex,
          roundName: roundName(roundIndex, totalRounds),
          matchIndex,
          homeTeamId: firstRound ? seededTeams[matchIndex * 2].id : null,
          awayTeamId: firstRound ? seededTeams[matchIndex * 2 + 1].id : null,
          date: date.toISOString()
        });
      }
    }
    return matches;
  }

  function cumulativePointsSeries(team, matches) {
    const played = matches
      .filter((match) => match.status === 'finished' && [match.homeTeamId, match.awayTeamId].includes(team.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let total = 0;
    return played.map((match) => {
      const result = getResultForTeam(match, team.id);
      total += result === 'W' ? 3 : result === 'D' ? 1 : 0;
      return { x: formatDate(match.date, false), y: total };
    });
  }

  function scoringTimeline(matches) {
    const byDate = new Map();
    matches
      .filter((match) => match.status === 'finished')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((match) => {
        const label = formatDate(match.date, false);
        byDate.set(label, (byDate.get(label) || 0) + (match.scoreHome || 0) + (match.scoreAway || 0));
      });
    return [...byDate.entries()].map(([label, value]) => ({ label, value }));
  }

  function roundScoring(matches) {
    const byRound = new Map();
    matches.filter((match) => match.status === 'finished').forEach((match) => {
      const label = match.roundName || `Ronda ${match.round || 1}`;
      byRound.set(label, (byRound.get(label) || 0) + (match.scoreHome || 0) + (match.scoreAway || 0));
    });
    return [...byRound.entries()].map(([label, value]) => ({ label, value }));
  }

  async function getLeagueBundle(leagueId) {
    const id = Number(leagueId);
    const [league, teams, allPlayers, matches, allEvents] = await Promise.all([
      window.LH.db.get(STORES.leagues, id),
      window.LH.db.getAllByIndex(STORES.teams, 'leagueId', id),
      window.LH.db.getAll(STORES.players),
      window.LH.db.getAllByIndex(STORES.matches, 'leagueId', id),
      window.LH.db.getAll(STORES.events)
    ]);
    const teamIds = new Set(teams.map((team) => team.id));
    const matchIds = new Set(matches.map((match) => match.id));
    return {
      league,
      teams,
      players: allPlayers.filter((player) => teamIds.has(player.teamId)),
      matches,
      events: allEvents.filter((event) => matchIds.has(event.matchId))
    };
  }

  function createTeamSeed(name, city, primary, secondary) {
    return { name, city, primaryColor: primary, secondaryColor: secondary, crestUrl: '', stats: {} };
  }

  async function insertDemoData() {
    const leagues = await window.LH.db.getAll(STORES.leagues);
    if (leagues.length) throw new Error('Las plantillas solo se insertan cuando no existen ligas.');

    const footballLeagueId = await window.LH.db.createLeague({
      name: 'Liga Metropolitana',
      sport: 'football',
      mode: 'league',
      legs: 1,
      season: 'Temporada 2026',
      description: 'Competencia de cuatro clubes con calendario semanal.'
    });

    const footballTeams = [
      createTeamSeed('Atlético Norte', 'Caracas', '#1f5d49', '#d6b15d'),
      createTeamSeed('Deportivo Central', 'Valencia', '#9f352f', '#f1d1a8'),
      createTeamSeed('Unión Costera', 'La Guaira', '#1f4f7d', '#b8d5e7'),
      createTeamSeed('Real Montaña', 'Mérida', '#4d3b72', '#c5b4df')
    ];
    for (const team of footballTeams) team.id = await window.LH.db.add(STORES.teams, { ...team, leagueId: footballLeagueId });

    const footballPlayers = [];
    for (const team of footballTeams) {
      for (let index = 1; index <= 4; index += 1) {
        const player = {
          leagueId: footballLeagueId,
          teamId: team.id,
          name: `${['Luis', 'Carlos', 'Diego', 'Andrés'][index - 1]} ${team.name.split(' ').at(-1)}`,
          position: ['Delantero', 'Mediocampo', 'Defensa', 'Portero'][index - 1],
          number: index === 4 ? 1 : index * 3,
          photoUrl: '',
          stats: {}
        };
        player.id = await window.LH.db.add(STORES.players, player);
        footballPlayers.push(player);
      }
    }

    const footballStart = new Date();
    footballStart.setDate(footballStart.getDate() - 28);
    const footballMatches = generateRoundRobin(footballTeams, 1, footballStart);
    const footballMatchIds = await window.LH.db.bulkAddMatches(footballLeagueId, footballMatches);
    const finishedCount = Math.min(3, footballMatchIds.length);
    for (let index = 0; index < finishedCount; index += 1) {
      const match = await window.LH.db.get(STORES.matches, footballMatchIds[index]);
      const localPlayers = footballPlayers.filter((player) => player.teamId === match.homeTeamId);
      const awayPlayers = footballPlayers.filter((player) => player.teamId === match.awayTeamId);
      const events = [
        { teamId: match.homeTeamId, playerId: localPlayers[0].id, minute: 18 + index },
        { teamId: match.homeTeamId, playerId: localPlayers[1].id, minute: 52 + index },
        ...(index % 2 === 0 ? [{ teamId: match.awayTeamId, playerId: awayPlayers[0].id, minute: 71 }] : [])
      ];
      await window.LH.db.finishMatch(match.id, events, null);
    }

    const basketballLeagueId = await window.LH.db.createLeague({
      name: 'Copa de la Ciudad',
      sport: 'basketball',
      mode: 'knockout',
      teamCount: 4,
      season: 'Copa 2026',
      description: 'Torneo corto de eliminación directa.'
    });
    const basketballTeams = [
      createTeamSeed('Halcones', 'Maracay', '#a53d28', '#e3aa53'),
      createTeamSeed('Titanes', 'Barquisimeto', '#202f57', '#8ca9d1'),
      createTeamSeed('Cóndores', 'Mérida', '#364a36', '#c8a868'),
      createTeamSeed('Marineros', 'Puerto Cabello', '#27697a', '#d5e3e7')
    ];
    for (const team of basketballTeams) team.id = await window.LH.db.add(STORES.teams, { ...team, leagueId: basketballLeagueId });

    const basketballPlayers = [];
    for (const team of basketballTeams) {
      for (let index = 1; index <= 4; index += 1) {
        const player = {
          leagueId: basketballLeagueId,
          teamId: team.id,
          name: `${['Marco', 'Samuel', 'Rafael', 'Víctor'][index - 1]} ${team.name}`,
          position: ['Base', 'Escolta', 'Alero', 'Pívot'][index - 1],
          number: index + 4,
          photoUrl: '',
          stats: {}
        };
        player.id = await window.LH.db.add(STORES.players, player);
        basketballPlayers.push(player);
      }
    }

    const basketballStart = new Date();
    basketballStart.setDate(basketballStart.getDate() - 7);
    const bracketMatches = generateBracket(basketballTeams, basketballStart, false);
    const basketballMatchIds = await window.LH.db.createBracket(basketballLeagueId, bracketMatches);
    const semifinal = await window.LH.db.get(STORES.matches, basketballMatchIds[0]);
    const semiLocal = basketballPlayers.filter((player) => player.teamId === semifinal.homeTeamId);
    const semiAway = basketballPlayers.filter((player) => player.teamId === semifinal.awayTeamId);
    await window.LH.db.finishMatch(semifinal.id, [
      { teamId: semifinal.homeTeamId, playerId: semiLocal[0].id, minute: 5 },
      { teamId: semifinal.homeTeamId, playerId: semiLocal[1].id, minute: 12 },
      { teamId: semifinal.homeTeamId, playerId: semiLocal[0].id, minute: 28 },
      { teamId: semifinal.awayTeamId, playerId: semiAway[0].id, minute: 31 }
    ], null);

    await window.LH.db.activateLeague(footballLeagueId);
    return { footballLeagueId, basketballLeagueId };
  }

  window.LH.services = {
    escapeHTML,
    initials,
    toLocalInputValue,
    formatDate,
    slugify,
    downloadJSON,
    getTeamById,
    getPlayerById,
    sortStandings,
    getMatchWinnerId,
    getResultForTeam,
    roundName,
    generateRoundRobin,
    generateBracket,
    cumulativePointsSeries,
    scoringTimeline,
    roundScoring,
    getLeagueBundle,
    insertDemoData
  };
})();
