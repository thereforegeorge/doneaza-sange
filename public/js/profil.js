// ============================================================
// PROFIL.JS - statistici personale + istoric + donații programate
// ============================================================

$(function () {

  if (!requireLogin()) return;

  const me = Auth.getUser();
  if (me.role === 'hospital') {
    window.location.href = '/spital.html';
    return;
  }

  api({ url: '/api/requests/me/history', type: 'GET' }).done(function (data) {
    renderHero(data);
    renderActivePledges(data.activePledges);
    renderHistory(data.donations);
  });

  // ----- Hero: salut + 3 statistici personale -----
  // Numele utilizatorului e afișat exact așa cum l-a introdus.
  function renderHero(data) {
    const wait = data.daysUntilEligible;
    const eligibleNumber = wait === 0 ? 'Acum' : wait;
    const eligibleLabel  = wait === 0 ? 'poți dona' : 'zile până la donare';

    const html = [
      '<h1 class="profile-greeting">Salut, ' + me.name + '</h1>',
      '<div class="stat-card-row">',
        statCard(data.donationCount, data.donationCount === 1 ? 'donație' : 'donații', false),
        statCard(data.livesHelped, data.livesHelped === 1 ? 'viață ajutată' : 'vieți ajutate', true),
        statCard(eligibleNumber, eligibleLabel, false, wait === 0),
        statCard(me.blood_type, 'grupa ta', true),
      '</div>'
    ];
    $('#profile-hero').html(html.join(''));
  }

  // Helper pentru un card de statistică (cifră mare + etichetă)
  // bloodColor=true face numărul roșu; eligible=true folosește verde.
  function statCard(value, label, bloodColor, eligible) {
    const cls = 'stat-card-num' + (bloodColor ? ' blood-color' : '') + (eligible ? ' eligible' : '');
    return '<div class="stat-card">' +
             '<div class="' + cls + '">' + value + '</div>' +
             '<div class="stat-card-label">' + label + '</div>' +
           '</div>';
  }

  // ----- Donații programate (pledge-uri active) -----
  function renderActivePledges(pledges) {
    const $section = $('#active-pledges-section');
    const $list = $('#active-pledges-list').empty();
    if (pledges.length === 0) {
      $section.hide();
      return;
    }
    $section.show();
    pledges.forEach(function (p) {
      const $row = $('<a class="entity-row"></a>').attr('href', '/cerere.html?id=' + p.request_id);
      $row.append(
        '<div class="entity-row-main">' +
          '<strong>' + p.hospital_name + '</strong>' +
          '<div class="entity-row-meta">grupa ' + p.blood_type + ' · deadline ' + formatDateTime(p.deadline) + '</div>' +
        '</div>'
      );
      let statusText = 'urmează să donezi';
      if (p.donor_confirmed && !p.hospital_confirmed) statusText = 'așteptăm spitalul';
      if (!p.donor_confirmed) statusText = 'confirmă după ce donezi';
      $row.append('<span class="entity-row-status">' + statusText + '</span>');
      $list.append($row);
    });
  }

  // ----- Istoricul donațiilor -----
  function renderHistory(donations) {
    const $list = $('#history-list').empty();
    if (donations.length === 0) {
      $list.html('<p style="color: var(--ink-muted);">Încă nu ai donații înregistrate. Donează pentru prima dată și apare aici.</p>');
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
