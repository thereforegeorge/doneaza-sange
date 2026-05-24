// ============================================================
// AUTH.JS - logica pentru paginile de login și signup
// Folosește jQuery pentru AJAX (cerință din enunț).
// Suportă query string ?next=... pentru redirecționare după login.
// ============================================================

$(function () {

  // Dacă suntem deja autentificați, ne ducem la /
  if (localStorage.getItem('token')) {
    window.location.href = '/';
    return;
  }

  // Citim parametrul ?next= (unde să redirecționăm după login)
  const urlParams = new URLSearchParams(window.location.search);
  const nextUrl = urlParams.get('next') || '/';

  // Decidem unde mergem după login (spitalele la dashboard-ul lor)
  function destinationAfterLogin(user) {
    if (user.role === 'hospital') return '/spital.html';
    // Dacă next-ul a fost setat și nu duce către o pagină de spital,
    // îl folosim. Altfel mergem la homepage.
    if (nextUrl && nextUrl !== '/spital.html') return nextUrl;
    return '/';
  }

  // ----- LOGIN -----
  $('#login-form').on('submit', function (e) {
    e.preventDefault();
    const $form = $(this);
    const $err = $('#error-msg').hide();

    $.ajax({
      url: '/api/auth/login',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        email: $form.find('input[name=email]').val(),
        password: $form.find('input[name=password]').val()
      }),
      dataType: 'json'
    })
      .done(function (data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = destinationAfterLogin(data.user);
      })
      .fail(function (xhr) {
        const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Eroare necunoscută';
        $err.text(msg).show();
      });
  });

  // ----- SIGNUP -----
  $('#signup-form').on('submit', function (e) {
    e.preventDefault();
    const $form = $(this);
    const $err = $('#error-msg').hide();

    // Oraș-ul e hardcodat: aplicația acoperă doar București
    const payload = {
      name:          $form.find('input[name=name]').val(),
      email:         $form.find('input[name=email]').val(),
      password:      $form.find('input[name=password]').val(),
      blood_type:    $form.find('select[name=blood_type]').val(),
      last_donation: $form.find('input[name=last_donation]').val() || null,
      city:          'București'
    };

    $.ajax({
      url: '/api/auth/signup',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
      dataType: 'json'
    })
      .done(function (data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/';
      })
      .fail(function (xhr) {
        const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Eroare necunoscută';
        $err.text(msg).show();
      });
  });

});
