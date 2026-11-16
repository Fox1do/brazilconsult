(function () {
  'use strict';
  var KEY = 'bc_analytics_consent_v1';
  var metrikaId = 114197653;
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  var active = false;
  function startAnalytics() {
    if (active) return;
    active = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = +new Date();
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + metrikaId;
    document.head.appendChild(script);
    window.ym(metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }
  if (choice === 'accepted') startAnalytics();
  else clearAnalyticsCookies();
  function update() {
    var banner = document.getElementById('bc-cookie-banner');
    if (banner) banner.hidden = choice === 'accepted' || choice === 'rejected';
  }
  function clearAnalyticsCookies() {
    // Remove first-party Yandex Metrika cookies that JavaScript can access.
    // Third-party/HttpOnly cookies are controlled by their issuing domains.
    var names = ['_ym_uid', '_ym_d', '_ym_isad', '_ym_visorc', '_ym_retryReqs',
      'yandexuid', 'ymex', 'i', 'yabs-sid'];
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (/^_ym_/.test(name) && names.indexOf(name) === -1) names.push(name);
    });
    var labels = location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < labels.length - 1; i++) {
      var domain = labels.slice(i).join('.');
      if (domain.indexOf('.') !== -1) domains.push(domain, '.' + domain);
    }
    var paths = ['/'];
    var segments = location.pathname.split('/').filter(Boolean);
    var path = '';
    segments.slice(0, -1).forEach(function (segment) {
      path += '/' + segment;
      paths.push(path, path + '/');
    });
    names.forEach(function (name) {
      domains.forEach(function (domain) {
        paths.forEach(function (cookiePath) {
          document.cookie = name + '=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + cookiePath + (domain ? '; domain=' + domain : '') + '; SameSite=Lax';
        });
      });
    });
  }
  function save(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    choice = value;
    if (value === 'accepted') startAnalytics();
    if (value === 'rejected') {
      clearAnalyticsCookies();
    }
    if (value === 'rejected' && active) {
      // Reload without initializing Metrika. Prevents continued tracking after withdrawal.
      window.location.reload();
      return;
    }
    update();
  }
  function render() {
    var banner = document.createElement('section');
    banner.id = 'bc-cookie-banner';
    banner.className = 'bc-cookie-banner';
    banner.setAttribute('aria-label', 'Настройки аналитических cookies');
    var prefix = location.pathname.indexOf('/blog/') !== -1 ? '../' : '';
    banner.innerHTML = '<div class="bc-cookie-banner__text"><strong>Конфиденциальность</strong><p>Мы используем необязательные аналитические cookies Яндекс.Метрики только с вашего согласия. Подробнее — в <a href="' + prefix + 'privacy.html">политике конфиденциальности</a>.</p></div><div class="bc-cookie-banner__actions"><button type="button" data-bc-reject>Отклонить</button><button type="button" data-bc-accept>Принять аналитику</button></div>';
    document.body.appendChild(banner);
    banner.querySelector('[data-bc-accept]').addEventListener('click', function () { save('accepted'); });
    banner.querySelector('[data-bc-reject]').addEventListener('click', function () { save('rejected'); });
    document.querySelectorAll('[data-bc-cookie-settings]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        choice = null; // Open choices without changing the stored preference until a choice is made.
        update();
        banner.querySelector('[data-bc-reject]').focus();
      });
    });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
