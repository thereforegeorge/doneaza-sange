// ============================================================
// PRIETENI.JS - lista prietenilor + cereri primite + adăugare
// ============================================================

$(function () {

  if (!requireLogin()) return;

  function load() {
    api({ url: '/api/friends', type: 'GET' }).done(function (data) {
      renderIncoming(data.incoming);
      renderFriends(data.friends);
    });
  }
  load();

  // ----- Adăugare prieten după email -----
  $('#add-friend-form').on('submit', function (e) {
    e.preventDefault();
    const email = $(this).find('input[name=email]').val();
    $('#add-friend-error, #add-friend-success').hide();

    api({
      url: '/api/friends/request',
      type: 'POST',
      data: { email: email }
    })
      .done(function (data) {
        const msg = data.status === 'accepted_existing'
          ? 'Sunteți acum prieteni (avea deja o cerere către tine).'
          : 'Cerere trimisă.';
        $('#add-friend-success').text(msg).show();
        $('#add-friend-form input[name=email]').val('');
        load();
      })
      .fail(function (xhr) {
        const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Eroare';
        $('#add-friend-error').text(msg).show();
      });
  });

  // ----- Cereri primite -----
  function renderIncoming(incoming) {
    const $section = $('#incoming-section');
    const $list = $('#incoming-list').empty();
    if (incoming.length === 0) {
      $section.hide();
      return;
    }
    $section.show();
    incoming.forEach(function (req) {
      const $row = $('<div class="incoming-row"></div>');
      $row.append('<div><strong>' + req.from_name + '</strong> <span class="friend-blood-tag">' + req.blood_type + '</span><div class="entity-row-meta">vrea să fie prieten</div></div>');
      const $actions = $('<div class="incoming-actions"></div>');
      const $accept = $('<button class="btn-secondary">Accept</button>').on('click', function () {
        api({ url: '/api/friends/accept/' + req.id, type: 'POST' }).done(load);
      });
      const $decline = $('<button class="btn-link">Refuz</button>').on('click', function () {
        api({ url: '/api/friends/decline/' + req.id, type: 'POST' }).done(load);
      });
      $actions.append($accept).append($decline);
      $row.append($actions);
      $list.append($row);
    });
  }

  // ----- Lista prietenilor: UI identic cu donatiile programate din profil -----
  function renderFriends(friends) {
    const $list = $('#friends-list').empty();
    if (friends.length === 0) {
      $list.html('<p style="color: var(--ink-muted);">Nu ai încă prieteni. Adaugă pe cineva cu email-ul de mai sus.</p>');
      return;
    }

    // Sortare alfabetică după nume
    friends.sort(function (a, b) { return a.name.localeCompare(b.name); });

    friends.forEach(function (f) {
      // Rândul devine un <a> clickable spre profilul prietenului
      const $row = $('<a class="entity-row"></a>')
        .attr('href', '/profil-prieten.html?id=' + f.id);
      $row.append(
        '<div class="entity-row-main">' +
          '<strong>' + f.name + '</strong>' +
          '<div class="entity-row-meta">ultima donație: ' + (f.last_donation ? formatDate(f.last_donation) : 'necunoscut') + '</div>' +
        '</div>'
      );
      $row.append('<span class="friend-blood-tag">' + f.blood_type + '</span>');
      $list.append($row);
    });
  }

});
