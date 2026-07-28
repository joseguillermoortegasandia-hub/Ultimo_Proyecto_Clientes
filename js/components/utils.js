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

  window.LH.components = { crestHTML, avatarHTML };
})();
