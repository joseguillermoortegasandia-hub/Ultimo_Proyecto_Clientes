(function () {
  'use strict';

  window.LH = window.LH || {};

  const SPORTS = {
    football: {
      id: 'football',
      name: 'Fútbol',
      eventSingular: 'Gol',
      eventPlural: 'Goles',
      scorerTitle: 'Goleadores',
      forShort: 'GF',
      againstShort: 'GC',
      visualLabel: 'Campo',
      colors: { primary: '#176b4d', secondary: '#d7a73e', soft: '#dcece4' }
    },
    basketball: {
      id: 'basketball',
      name: 'Básquet',
      eventSingular: 'Canasta',
      eventPlural: 'Canastas',
      scorerTitle: 'Encestadores',
      forShort: 'PF',
      againstShort: 'PC',
      visualLabel: 'Duela',
      colors: { primary: '#b84d2e', secondary: '#e0a24f', soft: '#f2ded5' }
    },
    volleyball: {
      id: 'volleyball',
      name: 'Vóley',
      eventSingular: 'Punto',
      eventPlural: 'Puntos',
      scorerTitle: 'Anotadores',
      forShort: 'PF',
      againstShort: 'PC',
      visualLabel: 'Cancha',
      colors: { primary: '#3558a4', secondary: '#78a7d8', soft: '#dde6f5' }
    },
    baseball: {
      id: 'baseball',
      name: 'Béisbol',
      eventSingular: 'Carrera',
      eventPlural: 'Carreras',
      scorerTitle: 'Productores',
      forShort: 'CF',
      againstShort: 'CC',
      visualLabel: 'Diamante',
      colors: { primary: '#7d2834', secondary: '#c59a5c', soft: '#ecdde0' }
    }
  };

  function getSport(id) {
    return SPORTS[id] || SPORTS.football;
  }

  function applySportTheme(id) {
    const sport = getSport(id);
    const root = document.documentElement;
    root.style.setProperty('--sport-accent', sport.colors.primary);
    root.style.setProperty('--sport-accent-2', sport.colors.secondary);
    root.style.setProperty('--sport-soft', sport.colors.soft);
  }

  window.LH.sports = {
    all: SPORTS,
    list: Object.values(SPORTS),
    get: getSport,
    applyTheme: applySportTheme
  };
})();
