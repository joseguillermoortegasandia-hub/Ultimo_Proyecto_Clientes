(function () {
  'use strict';

  window.LH = window.LH || {};

  // Configuración central del esquema y nombres de object stores.
  const DB_NAME = 'leaguehub-db';
  const DB_VERSION = 1;
  let dbInstance = null;

  const STORES = {
    leagues: 'leagues',
    teams: 'teams',
    players: 'players',
    matches: 'matches',
    events: 'events'
  };

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Error de IndexedDB'));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('La transacción falló'));
      transaction.onabort = () => reject(transaction.error || new Error('La transacción fue cancelada'));
    });
  }

  function normalizeTeam(team) {
    return {
      ...team,
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scored: 0,
        conceded: 0,
        points: 0,
        ...(team.stats || {})
      }
    };
  }

  function normalizePlayer(player) {
    return {
      ...player,
      stats: {
        played: 0,
        scores: 0,
        ...(player.stats || {})
      }
    };
  }

  // Apertura y versionado de la base de datos.
  async function open() {
    if (dbInstance) return dbInstance;

    dbInstance = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.leagues)) {
          const store = db.createObjectStore(STORES.leagues, { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: true });
          store.createIndex('isActive', 'isActive', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.teams)) {
          const store = db.createObjectStore(STORES.teams, { keyPath: 'id', autoIncrement: true });
          store.createIndex('leagueId', 'leagueId', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('leagueName', ['leagueId', 'name'], { unique: true });
        }

        if (!db.objectStoreNames.contains(STORES.players)) {
          const store = db.createObjectStore(STORES.players, { keyPath: 'id', autoIncrement: true });
          store.createIndex('teamId', 'teamId', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('teamNumber', ['teamId', 'number'], { unique: true });
        }

        if (!db.objectStoreNames.contains(STORES.matches)) {
          const store = db.createObjectStore(STORES.matches, { keyPath: 'id', autoIncrement: true });
          store.createIndex('leagueId', 'leagueId', { unique: false });
          store.createIndex('homeTeamId', 'homeTeamId', { unique: false });
          store.createIndex('awayTeamId', 'awayTeamId', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('leagueStatus', ['leagueId', 'status'], { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.events)) {
          const store = db.createObjectStore(STORES.events, { keyPath: 'id', autoIncrement: true });
          store.createIndex('matchId', 'matchId', { unique: false });
          store.createIndex('playerId', 'playerId', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB'));
      request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña'));
    });

    return dbInstance;
  }

  // Operaciones CRUD genéricas consumidas por el resto de la aplicación.
  async function get(storeName, id) {
    const db = await open();
    const tx = db.transaction(storeName, 'readonly');
    return requestToPromise(tx.objectStore(storeName).get(Number(id)));
  }

  async function getAll(storeName) {
    const db = await open();
    const tx = db.transaction(storeName, 'readonly');
    return requestToPromise(tx.objectStore(storeName).getAll());
  }

  async function getAllByIndex(storeName, indexName, value) {
    const db = await open();
    const tx = db.transaction(storeName, 'readonly');
    return requestToPromise(tx.objectStore(storeName).index(indexName).getAll(value));
  }

  async function add(storeName, value) {
    const db = await open();
    const tx = db.transaction(storeName, 'readwrite');
    const payload = storeName === STORES.teams ? normalizeTeam(value)
      : storeName === STORES.players ? normalizePlayer(value)
        : value;
    const id = await requestToPromise(tx.objectStore(storeName).add(payload));
    await transactionDone(tx);
    return id;
  }

  async function put(storeName, value) {
    const db = await open();
    const tx = db.transaction(storeName, 'readwrite');
    const payload = storeName === STORES.teams ? normalizeTeam(value)
      : storeName === STORES.players ? normalizePlayer(value)
        : value;
    const id = await requestToPromise(tx.objectStore(storeName).put(payload));
    await transactionDone(tx);
    return id;
  }

  async function remove(storeName, id) {
    const db = await open();
    const tx = db.transaction(storeName, 'readwrite');
    await requestToPromise(tx.objectStore(storeName).delete(Number(id)));
    await transactionDone(tx);
  }

  async function getActiveLeague() {
    const preferredId = Number(localStorage.getItem('leaguehub-active-league'));
    if (preferredId) {
      const preferred = await get(STORES.leagues, preferredId);
      if (preferred) return preferred;
    }
    const leagues = await getAll(STORES.leagues);
    return leagues.find((league) => league.isActive) || leagues[0] || null;
  }

  async function activateLeague(id) {
    const db = await open();
    const tx = db.transaction(STORES.leagues, 'readwrite');
    const store = tx.objectStore(STORES.leagues);
    const leagues = await requestToPromise(store.getAll());
    const numericId = Number(id);

    for (const league of leagues) {
      const shouldBeActive = league.id === numericId;
      if (league.isActive !== shouldBeActive) {
        league.isActive = shouldBeActive;
        store.put(league);
      }
    }

    await transactionDone(tx);
    localStorage.setItem('leaguehub-active-league', String(numericId));
  }

  async function createLeague(league) {
    const leagues = await getAll(STORES.leagues);
    const shouldActivate = leagues.length === 0;
    const id = await add(STORES.leagues, {
      ...league,
      isActive: shouldActivate,
      fixtureGenerated: false,
      createdAt: new Date().toISOString()
    });
    if (shouldActivate) localStorage.setItem('leaguehub-active-league', String(id));
    return id;
  }

  async function deleteLeagueCascade(leagueId) {
    const id = Number(leagueId);
    const db = await open();
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    const leagueStore = tx.objectStore(STORES.leagues);
    const teamStore = tx.objectStore(STORES.teams);
    const playerStore = tx.objectStore(STORES.players);
    const matchStore = tx.objectStore(STORES.matches);
    const eventStore = tx.objectStore(STORES.events);

    const [teams, matches] = await Promise.all([
      requestToPromise(teamStore.index('leagueId').getAll(id)),
      requestToPromise(matchStore.index('leagueId').getAll(id))
    ]);

    const teamIds = new Set(teams.map((team) => team.id));
    const matchIds = new Set(matches.map((match) => match.id));
    const players = await requestToPromise(playerStore.getAll());
    const events = await requestToPromise(eventStore.getAll());

    events.filter((event) => matchIds.has(event.matchId)).forEach((event) => eventStore.delete(event.id));
    matches.forEach((match) => matchStore.delete(match.id));
    players.filter((player) => teamIds.has(player.teamId)).forEach((player) => playerStore.delete(player.id));
    teams.forEach((team) => teamStore.delete(team.id));
    leagueStore.delete(id);

    await transactionDone(tx);

    const remaining = await getAll(STORES.leagues);
    const currentActiveId = Number(localStorage.getItem('leaguehub-active-league'));
    if (currentActiveId === id) {
      if (remaining.length) await activateLeague(remaining[0].id);
      else localStorage.removeItem('leaguehub-active-league');
    }
  }

  async function deleteTeamCascade(teamId) {
    const id = Number(teamId);
    const db = await open();
    const tx = db.transaction([STORES.teams, STORES.players, STORES.matches], 'readwrite');
    const teams = tx.objectStore(STORES.teams);
    const players = tx.objectStore(STORES.players);
    const matches = tx.objectStore(STORES.matches);

    const [homeMatches, awayMatches] = await Promise.all([
      requestToPromise(matches.index('homeTeamId').getAll(id)),
      requestToPromise(matches.index('awayTeamId').getAll(id))
    ]);
    if (homeMatches.length || awayMatches.length) {
      tx.abort();
      throw new Error('No se puede eliminar un equipo que ya tiene partidos asociados.');
    }

    const roster = await requestToPromise(players.index('teamId').getAll(id));
    roster.forEach((player) => players.delete(player.id));
    teams.delete(id);
    await transactionDone(tx);
  }

  async function deletePlayerSafe(playerId) {
    const id = Number(playerId);
    const events = await getAllByIndex(STORES.events, 'playerId', id);
    if (events.length) throw new Error('No se puede eliminar un jugador con anotaciones registradas.');
    await remove(STORES.players, id);
  }

  async function bulkAddMatches(leagueId, matches, fixtureGenerated = true) {
    const db = await open();
    const tx = db.transaction([STORES.matches, STORES.leagues], 'readwrite');
    const matchStore = tx.objectStore(STORES.matches);
    const leagueStore = tx.objectStore(STORES.leagues);
    const ids = [];

    for (const match of matches) {
      const id = await requestToPromise(matchStore.add({
        leagueId: Number(leagueId),
        status: 'scheduled',
        scoreHome: null,
        scoreAway: null,
        ...match
      }));
      ids.push(id);
    }

    const league = await requestToPromise(leagueStore.get(Number(leagueId)));
    if (league) {
      league.fixtureGenerated = fixtureGenerated;
      leagueStore.put(league);
    }

    await transactionDone(tx);
    return ids;
  }

  async function createBracket(leagueId, matches) {
    const db = await open();
    const tx = db.transaction([STORES.matches, STORES.leagues], 'readwrite');
    const matchStore = tx.objectStore(STORES.matches);
    const leagueStore = tx.objectStore(STORES.leagues);
    const byKey = new Map();
    const inserted = [];

    for (const match of matches) {
      const payload = {
        ...match,
        leagueId: Number(leagueId),
        status: 'scheduled',
        scoreHome: null,
        scoreAway: null,
        nextMatchId: null,
        nextSlot: null
      };
      const id = await requestToPromise(matchStore.add(payload));
      payload.id = id;
      byKey.set(match.bracketKey, payload);
      inserted.push(payload);
    }

    for (const match of inserted) {
      if (!match.nextBracketKey) continue;
      const next = byKey.get(match.nextBracketKey);
      match.nextMatchId = next ? next.id : null;
      delete match.nextBracketKey;
      matchStore.put(match);
    }

    const league = await requestToPromise(leagueStore.get(Number(leagueId)));
    if (league) {
      league.fixtureGenerated = true;
      leagueStore.put(league);
    }

    await transactionDone(tx);
    return inserted.map((match) => match.id);
  }

  function computeOutcome(homeScore, awayScore, team, side) {
    const won = side === 'home' ? homeScore > awayScore : awayScore > homeScore;
    const drew = homeScore === awayScore;
    const scored = side === 'home' ? homeScore : awayScore;
    const conceded = side === 'home' ? awayScore : homeScore;
    const stats = { ...normalizeTeam(team).stats };
    stats.played += 1;
    stats.scored += scored;
    stats.conceded += conceded;
    if (drew) {
      stats.draws += 1;
      stats.points += 1;
    } else if (won) {
      stats.wins += 1;
      stats.points += 3;
    } else {
      stats.losses += 1;
    }
    return { ...team, stats };
  }

  function reverseOutcome(homeScore, awayScore, team, side) {
    const won = side === 'home' ? homeScore > awayScore : awayScore > homeScore;
    const drew = homeScore === awayScore;
    const scored = side === 'home' ? homeScore : awayScore;
    const conceded = side === 'home' ? awayScore : homeScore;
    const stats = { ...normalizeTeam(team).stats };
    stats.played = Math.max(0, stats.played - 1);
    stats.scored = Math.max(0, stats.scored - scored);
    stats.conceded = Math.max(0, stats.conceded - conceded);
    if (drew) {
      stats.draws = Math.max(0, stats.draws - 1);
      stats.points = Math.max(0, stats.points - 1);
    } else if (won) {
      stats.wins = Math.max(0, stats.wins - 1);
      stats.points = Math.max(0, stats.points - 3);
    } else {
      stats.losses = Math.max(0, stats.losses - 1);
    }
    return { ...team, stats };
  }

  // Operación de integridad: partido, equipos, jugadores, eventos y bracket
  // se actualizan dentro de una sola transacción readwrite.
  async function finishMatch(matchId, stagedEvents, tiebreakWinnerId) {
    const id = Number(matchId);
    const db = await open();
    const tx = db.transaction([STORES.leagues, STORES.teams, STORES.players, STORES.matches, STORES.events], 'readwrite');
    const leagueStore = tx.objectStore(STORES.leagues);
    const teamStore = tx.objectStore(STORES.teams);
    const playerStore = tx.objectStore(STORES.players);
    const matchStore = tx.objectStore(STORES.matches);
    const eventStore = tx.objectStore(STORES.events);

    try {
      const match = await requestToPromise(matchStore.get(id));
      if (!match) throw new Error('El partido no existe.');
      if (match.status === 'finished') throw new Error('El partido ya está finalizado.');
      if (!match.homeTeamId || !match.awayTeamId) throw new Error('El partido aún tiene equipos por definir.');

      const league = await requestToPromise(leagueStore.get(match.leagueId));
      const [homeTeam, awayTeam] = await Promise.all([
        requestToPromise(teamStore.get(match.homeTeamId)),
        requestToPromise(teamStore.get(match.awayTeamId))
      ]);
      if (!league || !homeTeam || !awayTeam) throw new Error('Faltan datos relacionados con el partido.');

      const cleanEvents = (stagedEvents || []).map((event) => ({
        teamId: Number(event.teamId),
        playerId: Number(event.playerId),
        minute: event.minute === '' || event.minute == null ? null : Number(event.minute)
      }));
      const scoreHome = cleanEvents.filter((event) => event.teamId === match.homeTeamId).length;
      const scoreAway = cleanEvents.filter((event) => event.teamId === match.awayTeamId).length;

      if (league.mode === 'knockout' && scoreHome === scoreAway) {
        const validWinner = [match.homeTeamId, match.awayTeamId].includes(Number(tiebreakWinnerId));
        if (!validWinner) throw new Error('En eliminación directa debes declarar el ganador del desempate.');
      }

      const existingEvents = await requestToPromise(eventStore.index('matchId').getAll(id));
      existingEvents.forEach((event) => eventStore.delete(event.id));

      const playerScoreCounts = new Map();
      for (const event of cleanEvents) {
        event.matchId = id;
        event.type = 'score';
        eventStore.add(event);
        playerScoreCounts.set(event.playerId, (playerScoreCounts.get(event.playerId) || 0) + 1);
      }

      teamStore.put(computeOutcome(scoreHome, scoreAway, homeTeam, 'home'));
      teamStore.put(computeOutcome(scoreHome, scoreAway, awayTeam, 'away'));

      for (const [playerId, scoreCount] of playerScoreCounts) {
        const player = await requestToPromise(playerStore.get(playerId));
        if (!player) throw new Error('Uno de los jugadores anotadores ya no existe.');
        const normalized = normalizePlayer(player);
        normalized.stats.played += 1;
        normalized.stats.scores += scoreCount;
        playerStore.put(normalized);
      }

      match.status = 'finished';
      match.scoreHome = scoreHome;
      match.scoreAway = scoreAway;
      match.tiebreakWinnerId = scoreHome === scoreAway ? Number(tiebreakWinnerId) : null;
      match.finishedAt = new Date().toISOString();
      matchStore.put(match);

      if (league.mode === 'knockout' && match.nextMatchId) {
        const nextMatch = await requestToPromise(matchStore.get(match.nextMatchId));
        if (nextMatch) {
          const winnerId = scoreHome === scoreAway
            ? Number(tiebreakWinnerId)
            : (scoreHome > scoreAway ? match.homeTeamId : match.awayTeamId);
          if (match.nextSlot === 'home') nextMatch.homeTeamId = winnerId;
          else nextMatch.awayTeamId = winnerId;
          matchStore.put(nextMatch);
        }
      }

      await transactionDone(tx);
      return match;
    } catch (error) {
      try { tx.abort(); } catch (_) { /* La transacción pudo cerrarse antes. */ }
      throw error;
    }
  }

  // Transacción inversa que resta las contribuciones del partido.
  async function undoMatch(matchId) {
    const id = Number(matchId);
    const db = await open();
    const tx = db.transaction([STORES.leagues, STORES.teams, STORES.players, STORES.matches, STORES.events], 'readwrite');
    const leagueStore = tx.objectStore(STORES.leagues);
    const teamStore = tx.objectStore(STORES.teams);
    const playerStore = tx.objectStore(STORES.players);
    const matchStore = tx.objectStore(STORES.matches);
    const eventStore = tx.objectStore(STORES.events);

    try {
      const match = await requestToPromise(matchStore.get(id));
      if (!match || match.status !== 'finished') throw new Error('El partido no está finalizado.');
      const league = await requestToPromise(leagueStore.get(match.leagueId));

      if (league && league.mode === 'knockout' && match.nextMatchId) {
        const nextMatch = await requestToPromise(matchStore.get(match.nextMatchId));
        if (nextMatch && nextMatch.status === 'finished') {
          throw new Error('Primero debes deshacer el partido dependiente de la siguiente ronda.');
        }
        if (nextMatch) {
          if (match.nextSlot === 'home') nextMatch.homeTeamId = null;
          else nextMatch.awayTeamId = null;
          matchStore.put(nextMatch);
        }
      }

      const [homeTeam, awayTeam, events] = await Promise.all([
        requestToPromise(teamStore.get(match.homeTeamId)),
        requestToPromise(teamStore.get(match.awayTeamId)),
        requestToPromise(eventStore.index('matchId').getAll(id))
      ]);

      if (homeTeam) teamStore.put(reverseOutcome(match.scoreHome || 0, match.scoreAway || 0, homeTeam, 'home'));
      if (awayTeam) teamStore.put(reverseOutcome(match.scoreHome || 0, match.scoreAway || 0, awayTeam, 'away'));

      const counts = new Map();
      events.forEach((event) => counts.set(event.playerId, (counts.get(event.playerId) || 0) + 1));
      for (const [playerId, scoreCount] of counts) {
        const player = await requestToPromise(playerStore.get(playerId));
        if (!player) continue;
        const normalized = normalizePlayer(player);
        normalized.stats.played = Math.max(0, normalized.stats.played - 1);
        normalized.stats.scores = Math.max(0, normalized.stats.scores - scoreCount);
        playerStore.put(normalized);
      }

      match.status = 'scheduled';
      match.scoreHome = null;
      match.scoreAway = null;
      match.tiebreakWinnerId = null;
      match.finishedAt = null;
      matchStore.put(match);

      await transactionDone(tx);
    } catch (error) {
      try { tx.abort(); } catch (_) { /* La transacción pudo cerrarse antes. */ }
      throw error;
    }
  }

  // Serialización e importación completa de una liga con remapeo de IDs.
  async function exportLeague(leagueId) {
    const id = Number(leagueId);
    const league = await get(STORES.leagues, id);
    if (!league) throw new Error('No se encontró la liga.');
    const teams = await getAllByIndex(STORES.teams, 'leagueId', id);
    const teamIds = new Set(teams.map((team) => team.id));
    const players = (await getAll(STORES.players)).filter((player) => teamIds.has(player.teamId));
    const matches = await getAllByIndex(STORES.matches, 'leagueId', id);
    const matchIds = new Set(matches.map((match) => match.id));
    const events = (await getAll(STORES.events)).filter((event) => matchIds.has(event.matchId));
    return {
      format: 'leaguehub-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      league,
      teams,
      players,
      matches,
      events
    };
  }

  function validateImportPackage(pkg) {
    if (!pkg || pkg.format !== 'leaguehub-export' || !pkg.league) {
      throw new Error('El archivo no tiene un formato válido de LeagueHub.');
    }
    for (const key of ['teams', 'players', 'matches', 'events']) {
      if (!Array.isArray(pkg[key])) throw new Error(`El archivo no contiene una colección válida de ${key}.`);
    }
  }

  async function importLeague(pkg, renamedLeagueName) {
    validateImportPackage(pkg);
    const db = await open();
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    const leagueStore = tx.objectStore(STORES.leagues);
    const teamStore = tx.objectStore(STORES.teams);
    const playerStore = tx.objectStore(STORES.players);
    const matchStore = tx.objectStore(STORES.matches);
    const eventStore = tx.objectStore(STORES.events);

    try {
      const existing = await requestToPromise(leagueStore.getAll());
      const desiredName = (renamedLeagueName || pkg.league.name || 'Liga importada').trim();
      if (existing.some((league) => league.name.toLowerCase() === desiredName.toLowerCase())) {
        throw new Error('Ya existe una liga con ese nombre.');
      }

      const oldLeagueId = pkg.league.id;
      const leaguePayload = { ...pkg.league, name: desiredName, isActive: existing.length === 0 };
      delete leaguePayload.id;
      const newLeagueId = await requestToPromise(leagueStore.add(leaguePayload));

      const teamMap = new Map();
      for (const team of pkg.teams) {
        const oldId = team.id;
        const payload = normalizeTeam({ ...team, leagueId: newLeagueId });
        delete payload.id;
        const newId = await requestToPromise(teamStore.add(payload));
        teamMap.set(oldId, newId);
      }

      const playerMap = new Map();
      for (const player of pkg.players) {
        const oldId = player.id;
        const payload = normalizePlayer({ ...player, teamId: teamMap.get(player.teamId) });
        delete payload.id;
        const newId = await requestToPromise(playerStore.add(payload));
        playerMap.set(oldId, newId);
      }

      const matchMap = new Map();
      const pendingMatchPayloads = [];
      for (const match of pkg.matches) {
        const oldId = match.id;
        const payload = {
          ...match,
          leagueId: newLeagueId,
          homeTeamId: match.homeTeamId ? teamMap.get(match.homeTeamId) : null,
          awayTeamId: match.awayTeamId ? teamMap.get(match.awayTeamId) : null,
          tiebreakWinnerId: match.tiebreakWinnerId ? teamMap.get(match.tiebreakWinnerId) : null,
          nextMatchId: null
        };
        delete payload.id;
        const newId = await requestToPromise(matchStore.add(payload));
        payload.id = newId;
        payload._oldNextMatchId = match.nextMatchId;
        pendingMatchPayloads.push(payload);
        matchMap.set(oldId, newId);
      }

      for (const payload of pendingMatchPayloads) {
        if (payload._oldNextMatchId) payload.nextMatchId = matchMap.get(payload._oldNextMatchId) || null;
        delete payload._oldNextMatchId;
        matchStore.put(payload);
      }

      for (const event of pkg.events) {
        const payload = {
          ...event,
          matchId: matchMap.get(event.matchId),
          playerId: playerMap.get(event.playerId),
          teamId: teamMap.get(event.teamId)
        };
        delete payload.id;
        eventStore.add(payload);
      }

      await transactionDone(tx);
      if (existing.length === 0) localStorage.setItem('leaguehub-active-league', String(newLeagueId));
      return newLeagueId;
    } catch (error) {
      try { tx.abort(); } catch (_) { /* La transacción pudo cerrarse antes. */ }
      throw error;
    }
  }

  window.LH.db = {
    STORES,
    open,
    get,
    getAll,
    getAllByIndex,
    add,
    put,
    remove,
    getActiveLeague,
    activateLeague,
    createLeague,
    deleteLeagueCascade,
    deleteTeamCascade,
    deletePlayerSafe,
    bulkAddMatches,
    createBracket,
    finishMatch,
    undoMatch,
    exportLeague,
    importLeague,
    validateImportPackage,
    normalizeTeam,
    normalizePlayer
  };
})();
