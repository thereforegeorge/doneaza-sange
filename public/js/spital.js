// ============================================================
// SPITAL.JS - dashboard-ul pentru personalul medical
// Permite: creare cerere nouă, vizualizare cereri proprii,
// confirmare/dispută pe fiecare pledge.
// ============================================================

$(function () {

  if (!requireLogin()) return;

  const me = Auth.getUser();
  if (me.role !== 'hospital') {
    window.location.href = '/';
    return;
  }

  $('#hospital-name').text('Salut, ' + me.name);

  // ----- Creare cerere nouă -----
  $('#new-request-form').on('submit', function (e) {
    e.preventDefault();
    const $form = $(this);
    const $err = $('#new-request-error').hide();

    const payload = {
      blood_type:   $form.find('select[name=blood_type]').val(),
      units_needed: parseInt($form.find('input[name=units_needed]').val(), 10),
      urgency:      $form.find('select[name=urgency]').val(),
      deadline:     $form.find('input[name=deadline]').val(),
      notes:        $form.find('textarea[name=notes]').val() || null
    };

    api({
      url: '/api/requests',
      type: 'POST',
      data: payload
    })
      .done(function () {
        $form[0].reset();
        loadRequests();
      })
      .fail(function (xhr) {
        $err.text(xhr.responseJSON ? xhr.responseJSON.error : 'Eroare').show();
      });
  });

  // ----- Listare cereri ale spitalului curent -----
  function loadRequests() {
    api({ url: '/api/requests/hospital/mine', type: 'GET' }).done(function (rows) {
      const $list = $('#my-requests-list').empty();
      if (rows.length === 0) {
        $list.html('<p style="color: var(--ink-muted);">Nu ai cereri postate încă.</p>');
        return;
      }
      rows.forEach(function (r) {
        $list.append(buildRequestRow(r));
      });
      // Pentru fiecare cerere, încărcăm și lista de pledgeri
      rows.forEach(function (r) {
        loadPledgersFor(r.id);
      });
    });
  }
  loadRequests();

  function buildRequestRow(r) {
    const isUrgent = r.urgency === 'urgent';
    const html = [
      '<div class="hospital-request-row" data-request-id="' + r.id + '">',
        '<div class="hospital-request-top">',
          '<div>',
            '<span class="hospital-request-blood">' + r.blood_type + '</span>',
            ' <span style="color: var(--ink-soft);">' + r.units_needed + (r.units_needed === 1 ? ' unitate' : ' unități') + '</span>',
          '</div>',
          '<div>',
            '<span class="urgency-badge ' + (isUrgent ? 'urgent' : '') + '">' + (isUrgent ? 'Urgent' : 'Programat') + '</span>',
            ' <span style="color: var(--ink-muted); font-size: 0.85rem; margin-left: 1rem;">' + r.pledge_count + '/3 donatori</span>',
          '</div>',
        '</div>',
        '<div style="font-size: 0.9rem; color: var(--ink-soft);">Deadline: ' + formatDateTime(r.deadline) + '</div>',
        (r.notes ? '<div style="margin-top: 0.5rem; font-size: 0.9rem;">' + r.notes + '</div>' : ''),
        '<div class="hospital-pledgers-list" data-pledgers-for="' + r.id + '">Se încarcă...</div>',
      '</div>'
    ];
    return html.join('');
  }

  // Pentru o cerere dată, încărcăm pledge-urile și butoanele de confirmare
  function loadPledgersFor(requestId) {
    api({ url: '/api/requests/' + requestId, type: 'GET' }).done(function (data) {
      const $target = $('[data-pledgers-for="' + requestId + '"]').empty();
      if (data.pledges.length === 0) {
        $target.html('<p style="color: var(--ink-muted); font-size: 0.85rem;">Nu vine nimeni încă.</p>');
        return;
      }
      data.pledges.forEach(function (p) {
        const $row = $('<div class="hospital-pledger-row"></div>');
        const statusText = p.status === 'showed_up' ? '✓ a donat' :
                           p.status === 'no_show' ? 'nu a venit' :
                           p.donor_confirmed ? 'donatorul confirmă' : 'vine să doneze';
        $row.append('<span><strong>' + p.display_name + '</strong> <span style="color: var(--ink-muted); margin-left: 0.5rem;">' + statusText + '</span></span>');

        if (p.status === 'pledged') {
          const $actions = $('<div class="confirm-actions"></div>');
          const $confirm = $('<button class="confirm-btn">Confirmă</button>').on('click', function () {
            api({ url: '/api/requests/pledge/' + p.id + '/confirm-hospital', type: 'POST' })
              .done(function () { loadPledgersFor(requestId); });
          });
          const $dispute = $('<button class="dispute-btn">Nu a venit</button>').on('click', function () {
            api({ url: '/api/requests/pledge/' + p.id + '/dispute', type: 'POST' })
              .done(function () { loadPledgersFor(requestId); });
          });
          $actions.append($confirm).append($dispute);
          $row.append($actions);
        }
        $target.append($row);
      });
    });
  }

});
