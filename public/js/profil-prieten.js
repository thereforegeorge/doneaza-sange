// ============================================================
// PROFIL-PRIETEN.JS - vizualizare profil al unui prieten
// Folosește același UI ca propriul profil (stat-cards + istoric).
// ============================================================

$(function () {

  if (!requireLogin()) return;

  // Citim id-ul prietenului din query string (?id=5)
  const params = new URLSearchParams(window.location.search);
  const friendId = parseInt(params.get('id'), 10);
  if (!friendId) {
    $('#profile-hero').html('<p>Profil invalid.</p>');
    return;
  }

  api({ url: '/api/friends/' + friendId + '/profile', type: 'GET' })
    .done(function (data) {
      renderHero(data);
      renderHistory(data.donations);
    })
    .fail(function (xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Profil indisponibil';
      $('#profile-hero').html('<p>' + msg + '</p>');
      $('#history-list').empty();
    });

  // ----- Hero: nume + 4 stat-cards (identic cu profilul propriu) -----
  function renderHero(data) {
    const wait = data.daysUntilEligible;
    const eligibleNumber = wait === 0 ? 'Acum' : wait;
    const eligibleLabel  = wait === 0 ? 'poate dona' : 'zile până la donare';

    const html = [
      '<h1 class="profile-greeting">' + data.name + '</h1>',
      '<div class="stat-card-row">',
        statCard(data.donationCount, data.donationCount === 1 ? 'donație' : 'donații', false),
        statCard(data.livesHelped, data.livesHelped === 1 ? 'viață ajutată' : 'vieți ajutate', true),
        statCard(eligibleNumber, eligibleLabel, false, wait === 0),
        statCard(data.blood_type, 'grupa', true),
      '</div>'
    ];
    $('#profile-hero').html(html.join(''));
  }

  function statCard(value, label, bloodColor, eligible) {
    const cls = 'stat-card-num' + (bloodColor ? ' blood-color' : '') + (eligible ? ' eligible' : '');
    return '<div class="stat-card">' +
             '<div class="' + cls + '">' + value + '</div>' +
             '<div class="stat-card-label">' + label + '</div>' +
           '</div>';
  }

  // ----- Istoricul donațiilor -----
  function renderHistory(donations) {
    const $list = $('#history-list').empty();
    if (donations.length === 0) {
      $list.html('<p style="color: var(--ink-muted);">Nu are încă donații înregistrate.</p>');
      return;
    }
    donations.forEach(function (d) {
      const $row = $('<div class="entity-row static"></div>');
      $row.append(
        '<div class="entity-row-main">' +
          '<strong>' + d.hospital_name + '</strong>' +
        '</div>'
      );
      $row.append('<span class="entity-row-meta">' + formatDate(d.donated_at) + '</span>');
      $list.append($row);
    });
  }

});
