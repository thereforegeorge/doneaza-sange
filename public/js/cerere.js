// ============================================================
// CERERE.JS - pagina cu detaliile unei cereri
// Pagina e PUBLICĂ - vizitatorii văd detaliile + lista pledgerilor,
// dar pentru a dona sau a invita prieteni trebuie să se logheze.
// ============================================================

$(function () {

  const me = Auth.getUser();  // poate fi null

  const params = new URLSearchParams(window.location.search);
  const requestId = parseInt(params.get('id'), 10);
  if (!requestId) {
    $('#request-detail').html('<p>Cerere invalidă.</p>');
    return;
  }

  // Abonare la update-uri live (doar dacă logat - socket-ul e null altfel)
  if (socket) {
    socket.emit('watch-request', requestId);
    socket.on('pledge-update', function (payload) {
      if (payload.requestId !== requestId) return;
      load();
    });
  }

  let currentData = null;

  function load() {
    api({ url: '/api/requests/' + requestId, type: 'GET' })
      .done(function (data) {
        currentData = data;
        render(data);
      })
      .fail(function () {
        $('#request-detail').html('<p>Cererea nu a fost găsită.</p>');
      });
  }
  load();

  // ----- Randare -----
  function render(data) {
    const r = data.request;
    const pledges = data.pledges;
    const myPledge = data.myPledge;
    const threshold = data.threshold;

    const isUrgent = r.urgency === 'urgent';
    const pledgeCount = pledges.filter(p => p.status !== 'no_show').length;

    const html = [];

    html.push('<div class="' + (isUrgent ? 'urgency-badge urgent' : 'urgency-badge') + '">' + (isUrgent ? 'Urgent' : 'Programat') + '</div>');
    html.push('<h1>' + r.hospital_name + '</h1>');
    let metaHtml = r.hospital_address + ', ' + r.hospital_city;
    if (r.hospital_phone) {
      // Icon telefon SVG inline - simplu, linie subțire
      const phoneIcon = '<svg class="icon-inline icon-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
      metaHtml += '<br>' + phoneIcon + '<a href="tel:' + r.hospital_phone + '">' + r.hospital_phone + '</a>';
    }
    html.push('<p class="hospital-meta">' + metaHtml + '</p>');

    html.push('<div class="detail-stats">');
    html.push('<div><div class="detail-stat-num blood-color">' + r.blood_type + '</div><div class="detail-stat-label">grupa</div></div>');
    html.push('<div><div class="detail-stat-num">' + r.units_needed + '</div><div class="detail-stat-label">unități necesare</div></div>');
    html.push('<div><div class="detail-stat-num">' + pledgeCount + '/' + threshold + '</div><div class="detail-stat-label">' + (pledgeCount >= threshold ? 'cerere acoperită' : 'donatori') + '</div></div>');
    html.push('<div><div class="detail-stat-num" style="font-size:1.5rem">' + formatDateTime(r.deadline) + '</div><div class="detail-stat-label">deadline</div></div>');
    html.push('</div>');

    if (r.notes) {
      html.push('<div class="notes-block">' + r.notes + '</div>');
    }

    // Acțiuni: diferite pentru vizitator vs donator logat vs spital
    html.push(renderActions(r, myPledge));

    // Lista pledgerilor
    html.push('<h2 class="section-title">Cine vine</h2>');
    if (pledges.length === 0) {
      html.push('<p style="color: var(--ink-muted);">Nimeni încă. Fii primul.</p>');
    } else {
      html.push('<div class="pledgers-list">');
      pledges.forEach(function (p) {
        const statusText = p.status === 'showed_up' ? 'a donat' :
                           p.status === 'no_show' ? 'nu a venit' :
                           p.donor_confirmed && p.hospital_confirmed ? 'confirmat' :
                           p.donor_confirmed ? 'donatorul a confirmat' :
                           p.hospital_confirmed ? 'spitalul a confirmat' :
                           'vine să doneze';
        const statusClass = (p.status === 'showed_up' || (p.donor_confirmed && p.hospital_confirmed)) ? 'confirmed' : '';
        html.push('<div class="pledger-row">');
        html.push('<span class="pledger-name">' + p.display_name + (p.is_me ? ' (tu)' : '') + '</span>');
        html.push('<span class="pledger-status ' + statusClass + '">' + statusText + '</span>');
        html.push('</div>');
      });
      html.push('</div>');
    }

    // Block pentru invitarea prietenilor (doar pentru donatori logați)
    if (me && me.role === 'donor') {
      html.push('<div class="invite-friends-block">');
      html.push('<h2 class="section-title" style="margin-top:0">Invită un prieten</h2>');
      html.push('<p style="color: var(--ink-soft); font-size: 0.95rem;">Primește o notificare privată în aplicație.</p>');
      html.push('<div class="invite-friends-list" id="invite-friends-list">Se încarcă...</div>');
      html.push('</div>');
    }

    $('#request-detail').html(html.join(''));

    if (me && me.role === 'donor') {
      loadFriendsForInvite(r.blood_type);
    }
  }

  // ----- Acțiunile (vizitator, donator, spital) -----
  function renderActions(r, myPledge) {
    // Vizitator neautentificat
    if (!me) {
      const next = encodeURIComponent('/cerere.html?id=' + r.id);
      return [
        '<div class="pledge-actions">',
        '<a class="btn-primary" href="/login.html?next=' + next + '">Intră în cont ca să donezi</a>',
        '<span style="color: var(--ink-soft); font-size: 0.9rem;">sau <a href="/signup.html">creează un cont nou</a></span>',
        '</div>'
      ].join('');
    }

    // Spital nu poate dona
    if (me.role === 'hospital') {
      return '<div class="pledge-actions"><span style="color: var(--ink-muted);">Conturile spitalelor nu pot dona.</span></div>';
    }

    // Donator deja a donat
    if (myPledge && myPledge.status === 'showed_up') {
      return '<div class="pledge-actions"><strong style="color: var(--leaf);">✓ Ai donat. Mulțumim!</strong></div>';
    }
    if (myPledge && myPledge.status === 'no_show') {
      return '<div class="pledge-actions"><span style="color: var(--ink-muted);">Spitalul a marcat că nu te-ai prezentat.</span></div>';
    }
    if (myPledge) {
      let html = '<div class="pledge-actions">';
      if (!myPledge.donor_confirmed) {
        html += '<button class="btn-primary" id="confirm-donor-btn">Am donat</button>';
        html += '<span style="color: var(--ink-soft); font-size: 0.9rem;">Apasă după ce ai fost la spital.</span>';
      } else {
        html += '<strong>✓ Ai confirmat că ai donat.</strong>';
        if (!myPledge.hospital_confirmed) {
          html += '<span style="color: var(--ink-soft); font-size: 0.9rem;">Așteptăm confirmarea de la spital.</span>';
        }
      }
      html += '</div>';
      return html;
    }

    // Donator logat dar incompatibil
    const canDonate = canDonateLocal(me.blood_type, r.blood_type);
    if (!canDonate) {
      return '<div class="pledge-actions">' +
             '<span style="color: var(--ink-muted);">Grupa ta (' + me.blood_type + ') nu e compatibilă pentru ' + r.blood_type + '. Dar poți invita un prieten mai jos.</span>' +
             '</div>';
    }

    // Donator logat și compatibil
    return [
      '<div class="pledge-actions">',
      '<button class="btn-primary" id="pledge-btn">Donez</button>',
      '<label class="anonymity-toggle">',
        '<input type="checkbox" id="anonymous-check" checked>',
        '<span class="anonymity-box"></span>',
        '<span class="anonymity-label">Apar ca anonim spitalului</span>',
      '</label>',
      '</div>'
    ].join('');
  }

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

  // ----- Click: Donez -----
  $(document).on('click', '#pledge-btn', function () {
    const isAnonymous = $('#anonymous-check').is(':checked');
    api({
      url: '/api/requests/' + requestId + '/pledge',
      type: 'POST',
      data: { is_anonymous: isAnonymous }
    })
      .done(function () { load(); })
      .fail(function (xhr) {
        alert(xhr.responseJSON ? xhr.responseJSON.error : 'Eroare necunoscută');
      });
  });

  // ----- Click: am donat -----
  $(document).on('click', '#confirm-donor-btn', function () {
    if (!currentData || !currentData.myPledge) return;
    api({
      url: '/api/requests/pledge/' + currentData.myPledge.id + '/confirm-donor',
      type: 'POST'
    }).done(function () { load(); });
  });

  // ----- Invitarea prietenilor -----
  // Afișăm DOAR prietenii compatibili (cei a căror grupă poate dona
  // pentru cererea curentă). Pe ceilalți nu îi listăm deloc -
  // nu are sens să trimiți invitație cuiva care nu poate dona.
  function loadFriendsForInvite(requestBloodType) {
    api({ url: '/api/friends', type: 'GET' }).done(function (data) {
      const $list = $('#invite-friends-list').empty();
      if (data.friends.length === 0) {
        $list.html('<p style="color: var(--ink-muted); font-size: 0.9rem;">Nu ai încă prieteni în aplicație. <a href="/prieteni.html">Adaugă-i aici.</a></p>');
        return;
      }

      // Filtrăm doar prietenii compatibili
      const compatible = data.friends.filter(function (f) {
        return canDonateLocal(f.blood_type, requestBloodType);
      });

      if (compatible.length === 0) {
        $list.html('<p style="color: var(--ink-muted); font-size: 0.9rem;">Niciun prieten cu grupa compatibilă pentru ' + requestBloodType + '.</p>');
        return;
      }

      // Sortăm alfabetic (lista compatibilă, deja filtrată)
      compatible.sort(function (a, b) { return a.name.localeCompare(b.name); });

      // SVG check pentru starea "trimis"
      const checkSvg = '<svg class="icon-inline" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';

      compatible.forEach(function (f) {
        const $row = $('<div class="invite-friend-row"></div>');
        $row.append(
          '<div><strong>' + f.name + '</strong>' +
          ' <span class="friend-blood" style="font-size:1rem; margin-left:0.5rem;">' + f.blood_type + '</span>' +
          '<div class="invite-friend-meta">compatibil pentru ' + requestBloodType + '</div></div>'
        );
        const $btn = $('<button class="invite-btn"><span>Invită</span></button>');
        $btn.on('click', function () {
          const $b = $(this);
          $b.prop('disabled', true).html('<span>...</span>');
          api({
            url: '/api/invitations',
            type: 'POST',
            data: { request_id: requestId, friend_id: f.id }
          })
            .done(function () {
              $b.addClass('sent').html(checkSvg + '<span>Invitat</span>');
            })
            .fail(function (xhr) {
              $b.prop('disabled', false).html('<span>Invită</span>');
              alert(xhr.responseJSON ? xhr.responseJSON.error : 'Eroare');
            });
        });
        $row.append($btn);
        $list.append($row);
      });
    });
  }

});
