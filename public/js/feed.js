// ============================================================
// FEED.JS - pagina principală cu cererile active
// Pagina e PUBLICĂ - vizitatorii (neautentificați) văd cererile,
// dar la click pe "Donez" sunt duși la login.
// ============================================================

$(function () {

  const me = Auth.getUser();  // poate fi null dacă vizitator

  // Setup hartă centrată pe București
  const map = L.map('map').setView([44.4356, 26.0900], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  // Cerem datele din API. Endpoint-ul e public (nu cere token).
  $.ajax({ url: '/api/requests/public', type: 'GET', dataType: 'json' })
    .done(function (requests) {
      renderHero(requests);
      renderList(requests);
      renderMarkers(requests);
    })
    .fail(function () {
      $('#hero-title').text('Eroare la încărcarea datelor.');
      $('#requests-list').html('<p>Nu s-au putut încărca cererile. Reîncarcă pagina.</p>');
    });

  // Dacă utilizatorul e logat, suprapunem peste date informația de
  // pledge personal (a apăsat deja pe această cerere?)
  if (me) {
    api({ url: '/api/requests/me/pledges-ids', type: 'GET' }).done(function (ids) {
      ids.forEach(function (id) {
        $('.request-card[data-id=' + id + ']').addClass('already-pledged');
      });
    });
  }

  // ----- HERO TITLE -----
  function renderHero(requests) {
    const urgentCount = requests.filter(r => r.urgency === 'urgent').length;
    const total = requests.length;
    if (urgentCount > 0) {
      $('#hero-title').html(urgentCount + ' ' + (urgentCount === 1 ? 'cerere urgentă' : 'cereri urgente') + '<br><em>au nevoie de tine.</em>');
    } else if (total > 0) {
      $('#hero-title').html(total + ' ' + (total === 1 ? 'cerere activă' : 'cereri active') + ' în București.');
    } else {
      $('#hero-title').text('Nu sunt cereri active acum.');
    }
    $('#hero-sub').text('Click pe o cerere ca să vezi detalii. Donezi tu, sau inviți un prieten care poate.');
  }

  // ----- LISTA CARDURILOR -----
  function renderList(requests) {
    const $list = $('#requests-list').empty();
    if (requests.length === 0) {
      $list.html('<p>Nu sunt cereri active acum. Mulțumim că ești aici!</p>');
      return;
    }
    requests.forEach(function (r) {
      $list.append(buildCard(r));
    });
  }

  function buildCard(r) {
    const isUrgent = r.urgency === 'urgent';
    const $card = $('<a class="request-card"></a>')
      .addClass(isUrgent ? 'urgent' : '')
      .attr('href', '/cerere.html?id=' + r.id)
      .attr('data-id', r.id);

    const $top = $('<div class="request-card-top"></div>');
    $top.append('<span class="urgency-badge ' + (isUrgent ? 'urgent' : '') + '">' + (isUrgent ? 'Urgent' : 'Programat') + '</span>');
    $top.append('<span class="deadline-label">până ' + formatDateTime(r.deadline) + '</span>');
    $card.append($top);

    $card.append('<div class="blood-type-big">' + r.blood_type + '</div>');
    $card.append('<div class="units-line">' + r.units_needed + (r.units_needed === 1 ? ' unitate' : ' unități') + ' necesare</div>');
    $card.append('<div class="hospital-line">' + r.hospital_name + '</div>');

    const $status = $('<div class="pledge-status"></div>');
    $status.append(
      '<div><span class="pledge-count">' + r.pledge_count + '/3</span>' +
      '<span class="pledge-count-label">' + (r.pledge_count >= 3 ? 'completă' : 'donatori') + '</span></div>'
    );

    // Hint pentru donatorii logați cu grupă incompatibilă
    if (me && me.role === 'donor' && !canDonateLocal(me.blood_type, r.blood_type)) {
      $status.append('<span class="cant-donate-hint">invită un prieten</span>');
    }

    $card.append($status);
    return $card;
  }

  // Compatibilitate (replicată pe client - tabel mic)
  function canDonateLocal(donor, patient) {
    const t = {
      'O-':['O-'], 'O+':['O-','O+'],
      'A-':['O-','A-'], 'A+':['O-','O+','A-','A+'],
      'B-':['O-','B-'], 'B+':['O-','O+','B-','B+'],
      'AB-':['O-','A-','B-','AB-'],
      'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+']
    };
    return (t[patient] || []).indexOf(donor) !== -1;
  }

  // ----- MARKERI PE HARTĂ -----
  // Grupăm cererile după spital - un singur marker per spital, cu
  // popup care listează toate cererile sale (urgente sus, programate jos).
  // Asta evită suprapunerea perfectă a markerilor la aceleași coordonate.
  function renderMarkers(requests) {
    const byHospital = {};
    requests.forEach(function (r) {
      const key = r.hospital_id;
      if (!byHospital[key]) {
        byHospital[key] = {
          name: r.hospital_name,
          lat: r.hospital_lat,
          lng: r.hospital_lng,
          requests: []
        };
      }
      byHospital[key].requests.push(r);
    });

    Object.keys(byHospital).forEach(function (key) {
      const h = byHospital[key];

      // Sortăm cererile spitalului: urgente întâi
      h.requests.sort(function (a, b) {
        if (a.urgency === b.urgency) return 0;
        return a.urgency === 'urgent' ? -1 : 1;
      });

      // Icon roșu dacă spitalul are cel puțin o cerere urgentă
      const hasUrgent = h.requests.some(function (r) { return r.urgency === 'urgent'; });
      const marker = L.marker([h.lat, h.lng], { icon: buildIcon(hasUrgent) }).addTo(map);

      // Construim popup-ul: titlu spital + listă cereri
      let html = '<div class="map-popup">';
      html += '<strong>' + h.name + '</strong>';
      html += '<div class="map-popup-count">' + h.requests.length + (h.requests.length === 1 ? ' cerere activă' : ' cereri active') + '</div>';
      html += '<ul class="map-popup-list">';
      h.requests.forEach(function (r) {
        const badge = r.urgency === 'urgent'
          ? '<span class="map-popup-badge urgent">Urgent</span>'
          : '<span class="map-popup-badge">Programat</span>';
        html += '<li>' + badge +
                '<a href="/cerere.html?id=' + r.id + '">' +
                '<strong>' + r.blood_type + '</strong> · ' + r.units_needed + ' unit.' +
                '</a></li>';
      });
      html += '</ul></div>';
      marker.bindPopup(html);
    });
  }

  // Helper: construim un icon Leaflet colorat în roșu pentru urgent
  // sau în negru pentru programat. Folosim divIcon - HTML curat,
  // fără să mai descărcăm imagini.
  function buildIcon(isUrgent) {
    const color = isUrgent ? '#8B0000' : '#1A1A1A';
    const html = '<div class="map-pin" style="background:' + color + '">' +
                 (isUrgent ? '<span class="map-pin-pulse"></span>' : '') +
                 '</div>';
    return L.divIcon({
      className: 'map-pin-wrap',
      html: html,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

});
