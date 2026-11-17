(function () {
  'use strict';
  var KEY = 'bc_analytics_consent_v1';
  var metrikaId = 114197653;
  var gaId = 'G-XE3XSRQNTN';
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  var active = false;
  // Current consent state, including when the settings banner is reopened.
  window.bcAnalyticsConsentGranted = function () { return choice === 'accepted'; };
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
    // GA4: load only after explicit analytics consent; no pre-consent requests.
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: true });
    var gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(gaScript);
  }
  if (choice === 'accepted') startAnalytics();
  else clearAnalyticsCookies();
  var settingsOpen = false;
  function update() {
    var banner = document.getElementById('bc-cookie-banner');
    if (banner) banner.hidden = !settingsOpen && (choice === 'accepted' || choice === 'rejected');
  }
  function clearAnalyticsCookies() {
    // Remove first-party Yandex and GA cookies that JavaScript can access.
    // Third-party/HttpOnly cookies are controlled by their issuing domains.
    var names = ['_ga', '_gid', '_gat', '_gcl_au', '_ym_uid', '_ym_d', '_ym_isad', '_ym_visorc', '_ym_retryReqs',
      'yandexuid', 'ymex', 'i', 'yabs-sid'];
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if ((/^_ym_/.test(name) || /^_ga_/.test(name) || /^_gac_/.test(name)) && names.indexOf(name) === -1) names.push(name);
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
    settingsOpen = false;
    if (value === 'accepted') startAnalytics();
    if (value === 'rejected') {
      clearAnalyticsCookies();
    }
    if (value === 'rejected' && active) {
      // Reload without initializing either analytics provider after withdrawal.
      window.location.reload();
      return;
    }
    update();
  }
  // Contact conversion goals: count only direct contact links, not editorial channels.
  // Analytics is initialized only after the visitor has consented.
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link || choice !== 'accepted') return;
    var url;
    try { url = new URL(link.href, window.location.href); } catch (e) { return; }
    var host = url.hostname.toLowerCase();
    var goal = null;
    if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'web.whatsapp.com') {
      goal = 'whatsapp_click';
    } else if ((host === 't.me' || host === 'telegram.me') &&
               /^\/katiabrazil\/?$/i.test(url.pathname)) {
      goal = 'telegram_contact_click';
    }
    if (goal) {
      if (typeof window.ym === 'function') window.ym(metrikaId, 'reachGoal', goal);
      if (typeof window.gtag === 'function') window.gtag('event', goal);
    }
  });

  function render() {
    var banner = document.createElement('section');
    banner.id = 'bc-cookie-banner';
    banner.className = 'bc-cookie-banner';
    banner.setAttribute('aria-label', 'Настройки аналитических cookies');
    var prefix = location.pathname.indexOf('/blog/') !== -1 ? '../' : '';
    banner.innerHTML = '<div class="bc-cookie-banner__text"><strong>Конфиденциальность</strong><p>Мы используем необязательные аналитические cookies Яндекс.Метрики и Google Analytics только с вашего согласия. Подробнее — в <a href="' + prefix + 'privacy.html">политике конфиденциальности</a>.</p></div><div class="bc-cookie-banner__actions"><button type="button" data-bc-reject>Отклонить</button><button type="button" data-bc-accept>Принять аналитику</button></div>';
    document.body.appendChild(banner);
    banner.querySelector('[data-bc-accept]').addEventListener('click', function () { save('accepted'); });
    banner.querySelector('[data-bc-reject]').addEventListener('click', function () { save('rejected'); });
    document.querySelectorAll('[data-bc-cookie-settings]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        settingsOpen = true; // Keep the saved consent state until the visitor makes a new choice.
        update();
        banner.querySelector('[data-bc-reject]').focus();
      });
    });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
