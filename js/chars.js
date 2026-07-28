(function () {
  'use strict';

  window.LH = window.LH || {};
  const S = window.LH.services;
  const instances = new Map();

  function cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function palette() {
    return [
      cssVar('--sport-accent', '#176b4d'),
      cssVar('--sport-accent-2', '#d7a73e'),
      '#334155', '#708090', '#9f352f', '#4d3b72', '#27697a', '#7d2834', '#6b705c', '#b26e3d'
    ];
  }

  function destroyAll() {
    instances.forEach((chart) => chart.destroy());
    instances.clear();
  }

  function empty(container, message = 'No hay datos suficientes para construir este gráfico.') {
    if (!container) return;
    container.innerHTML = `<div class="chart-empty"><p>${S.escapeHTML(message)}</p></div>`;
  }

  // Renderizado centralizado: destruye instancias previas para evitar fugas.
  function draw(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (!window.Chart) {
      empty(canvas.parentElement, 'Chart.js no pudo cargarse. La gestión de la liga sigue funcionando sin conexión.');
      return null;
    }
    if (instances.has(canvasId)) instances.get(canvasId).destroy();
    const chart = new Chart(canvas, config);
    instances.set(canvasId, chart);
    return chart;
  }

  function baseOptions(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: '#4b5563', usePointStyle: true, boxWidth: 8 } },
        tooltip: { padding: 11, cornerRadius: 8 }
      },
      scales: {
        x: { ticks: { color: '#68707d' }, grid: { color: 'rgba(104,112,125,.12)' } },
        y: { beginAtZero: true, ticks: { color: '#68707d', precision: 0 }, grid: { color: 'rgba(104,112,125,.12)' } }
      },
      ...extra
    };
  }

  function dashboard(bundle) {
    const colors = palette();
    const finished = bundle.matches.filter((match) => match.status === 'finished');

    const scoredTeams = [...bundle.teams]
      .sort((a, b) => (b.stats?.scored || 0) - (a.stats?.scored || 0))
      .slice(0, 8);
    if (!finished.length || !scoredTeams.length) empty(document.getElementById('chart-team-scoring'));
    else draw('dashboard-team-scoring', {
      type: 'bar',
      data: {
        labels: scoredTeams.map((team) => team.name),
        datasets: [{ label: 'Puntos a favor', data: scoredTeams.map((team) => team.stats?.scored || 0), backgroundColor: colors[0], borderRadius: 7 }]
      },
      options: baseOptions({ plugins: { legend: { display: false } } })
    });

    let wins = 0;
    let draws = 0;
    let losses = 0;
    finished.forEach((match) => {
      if (match.scoreHome === match.scoreAway) draws += 1;
      else {
        wins += 1;
        losses += 1;
      }
    });
    if (!finished.length) empty(document.getElementById('chart-results'));
    else draw('dashboard-results', {
      type: 'doughnut',
      data: {
        labels: ['Victorias', 'Empates', 'Derrotas'],
        datasets: [{ data: [wins, draws, losses], backgroundColor: [colors[0], colors[1], colors[4]], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } } }
    });

    const timeline = S.scoringTimeline(bundle.matches);
    if (!timeline.length) empty(document.getElementById('chart-timeline'));
    else draw('dashboard-timeline', {
      type: 'line',
      data: {
        labels: timeline.map((item) => item.label),
        datasets: [{ label: 'Anotaciones por fecha', data: timeline.map((item) => item.value), borderColor: colors[0], backgroundColor: `${colors[0]}22`, fill: true, tension: .32, pointRadius: 4 }]
      },
      options: baseOptions({ plugins: { legend: { display: false } } })
    });
  }

  function stats(bundle) {
    const colors = palette();
    const finished = bundle.matches.filter((match) => match.status === 'finished');
    const topPlayers = [...bundle.players]
      .sort((a, b) => (b.stats?.scores || 0) - (a.stats?.scores || 0))
      .slice(0, 10);

    if (!topPlayers.some((player) => (player.stats?.scores || 0) > 0)) empty(document.getElementById('chart-top-scorers'));
    else draw('stats-top-scorers', {
      type: 'bar',
      data: {
        labels: topPlayers.map((player) => player.name),
        datasets: [{ label: 'Anotaciones', data: topPlayers.map((player) => player.stats?.scores || 0), backgroundColor: colors[1], borderRadius: 7 }]
      },
      options: baseOptions({ indexAxis: 'y', plugins: { legend: { display: false } } })
    });

    if (bundle.league.mode === 'league') {
      const selectedTeams = S.sortStandings(bundle.teams).slice(0, 5);
      const datasets = selectedTeams.map((team, index) => {
        const points = S.cumulativePointsSeries(team, bundle.matches);
        return {
          label: team.name,
          data: points.map((point) => point.y),
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length],
          tension: .25,
          pointRadius: 3
        };
      });
      const labels = selectedTeams.length ? S.cumulativePointsSeries(selectedTeams[0], bundle.matches).map((point) => point.x) : [];
      if (!finished.length) empty(document.getElementById('chart-points-evolution'));
      else draw('stats-points-evolution', {
        type: 'line',
        data: { labels, datasets },
        options: baseOptions()
      });

      const totals = bundle.teams.map((team) => ({ name: team.name, value: (team.stats?.scored || 0) + (team.stats?.conceded || 0) }));
      if (!finished.length) empty(document.getElementById('chart-league-balance'));
      else draw('stats-league-balance', {
        type: 'bar',
        data: {
          labels: totals.map((item) => item.name),
          datasets: [
            { label: 'A favor', data: bundle.teams.map((team) => team.stats?.scored || 0), backgroundColor: colors[0], borderRadius: 6 },
            { label: 'En contra', data: bundle.teams.map((team) => team.stats?.conceded || 0), backgroundColor: colors[4], borderRadius: 6 }
          ]
        },
        options: baseOptions()
      });
    } else {
      const byRound = S.roundScoring(bundle.matches);
      if (!byRound.length) empty(document.getElementById('chart-round-scoring'));
      else draw('stats-round-scoring', {
        type: 'bar',
        data: { labels: byRound.map((item) => item.label), datasets: [{ label: 'Anotaciones', data: byRound.map((item) => item.value), backgroundColor: colors[0], borderRadius: 7 }] },
        options: baseOptions({ plugins: { legend: { display: false } } })
      });

      const matchTotals = finished.map((match) => (match.scoreHome || 0) + (match.scoreAway || 0));
      const ranges = [
        matchTotals.filter((value) => value <= 2).length,
        matchTotals.filter((value) => value >= 3 && value <= 5).length,
        matchTotals.filter((value) => value >= 6).length
      ];
      if (!finished.length) empty(document.getElementById('chart-knockout-distribution'));
      else draw('stats-knockout-distribution', {
        type: 'doughnut',
        data: { labels: ['0–2', '3–5', '6 o más'], datasets: [{ data: ranges, backgroundColor: [colors[2], colors[1], colors[0]], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } } }
      });
    }
  }

  function teamDetail(team, matches) {
    const colors = palette();
    const series = S.cumulativePointsSeries(team, matches);
    if (!series.length) empty(document.getElementById('chart-team-detail'));
    else draw('team-detail-chart', {
      type: 'line',
      data: { labels: series.map((point) => point.x), datasets: [{ label: 'Puntos acumulados', data: series.map((point) => point.y), borderColor: colors[0], backgroundColor: `${colors[0]}22`, fill: true, tension: .28 }] },
      options: baseOptions({ plugins: { legend: { display: false } } })
    });
  }

  function playerDetail(player, events, matches) {
    const colors = palette();
    const counts = matches
      .filter((match) => match.status === 'finished')
      .map((match) => ({
        label: S.formatDate(match.date, false),
        value: events.filter((event) => event.matchId === match.id && event.playerId === player.id).length
      }))
      .filter((item) => item.value > 0);
    if (!counts.length) empty(document.getElementById('chart-player-detail'));
    else draw('player-detail-chart', {
      type: 'bar',
      data: { labels: counts.map((item) => item.label), datasets: [{ label: 'Anotaciones', data: counts.map((item) => item.value), backgroundColor: colors[0], borderRadius: 7 }] },
      options: baseOptions({ plugins: { legend: { display: false } } })
    });
  }

  window.LH.charts = { destroyAll, dashboard, stats, teamDetail, playerDetail };
})();
