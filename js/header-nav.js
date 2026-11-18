/* Unified navigation for inner pages (v0.147). */
(function () {
  'use strict';
  var nav = document.querySelector('[data-nav]');
  var toggle = document.querySelector('[data-nav-toggle]');
  if (!nav || !toggle) return;
  var root = document.documentElement;
  var desktop = window.matchMedia('(min-width: 1200px)');
  var items = Array.prototype.slice.call(nav.querySelectorAll('[data-submenu]'));
  function closeSubmenus() { items.forEach(function (item) { item.classList.remove('is-open'); var btn=item.querySelector('[data-submenu-toggle]'); if(btn)btn.setAttribute('aria-expanded','false'); }); }
  function setOpen(open) { root.classList.toggle('nav-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');if(!open)closeSubmenus(); }
  toggle.addEventListener('click',function(){setOpen(!root.classList.contains('nav-open'));});
  nav.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false);});
  items.forEach(function(item){var btn=item.querySelector('[data-submenu-toggle]');if(btn)btn.addEventListener('click',function(){var open=!item.classList.contains('is-open');closeSubmenus();item.classList.toggle('is-open',open);btn.setAttribute('aria-expanded',String(open));});});
  desktop.addEventListener('change',function(){setOpen(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&root.classList.contains('nav-open')){setOpen(false);toggle.focus();}});
  document.addEventListener('click',function(e){if(desktop.matches&&!e.target.closest('[data-submenu]'))closeSubmenus();});
})();
