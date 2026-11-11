(function () {
  'use strict';

  var root = document.documentElement;
  var desktopNav = window.matchMedia('(min-width: 1040px)');

  /* ---------- Шапка: фон после прокрутки ---------- */

  var header = document.querySelector('[data-header]');

  function updateHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  /* ---------- Мобильное меню ---------- */

  var nav = document.querySelector('[data-nav]');
  var navToggle = document.querySelector('[data-nav-toggle]');

  function setNavOpen(open) {
    root.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }

  navToggle.addEventListener('click', function () {
    setNavOpen(!root.classList.contains('nav-open'));
  });

  nav.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      setNavOpen(false);
      closeSubmenus();
    }
  });

  desktopNav.addEventListener('change', function () {
    // Без анимации, иначе при смене раскладки меню на мгновение «мигает»
    nav.style.transition = 'none';
    setNavOpen(false);
    closeSubmenus();
    window.setTimeout(function () {
      nav.style.transition = '';
    }, 50);
  });

  /* ---------- Подменю «Услуги» ---------- */

  var submenus = Array.prototype.slice.call(document.querySelectorAll('[data-submenu]'));

  function setSubmenuOpen(item, open) {
    item.classList.toggle('is-open', open);
    item.querySelector('[data-submenu-toggle]').setAttribute('aria-expanded', String(open));
  }

  function closeSubmenus() {
    submenus.forEach(function (item) {
      setSubmenuOpen(item, false);
    });
  }

  submenus.forEach(function (item) {
    item.querySelector('[data-submenu-toggle]').addEventListener('click', function () {
      setSubmenuOpen(item, !item.classList.contains('is-open'));
    });

    // На десктопе закрываем, когда фокус с клавиатуры ушёл из подменю
    item.addEventListener('focusout', function (event) {
      if (desktopNav.matches && !item.contains(event.relatedTarget)) {
        setSubmenuOpen(item, false);
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (desktopNav.matches && !event.target.closest('[data-submenu]')) {
      closeSubmenus();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    var openItem = submenus.filter(function (item) {
      return item.classList.contains('is-open');
    })[0];

    if (openItem && desktopNav.matches) {
      setSubmenuOpen(openItem, false);
      openItem.querySelector('[data-submenu-toggle]').focus();
    } else if (root.classList.contains('nav-open')) {
      setNavOpen(false);
      closeSubmenus();
      navToggle.focus();
    }
  });

  /* ---------- Форма запроса ---------- */

  var form = document.querySelector('[data-request-form]');
  var status = form.querySelector('[data-form-status]');
  var submitButton = form.querySelector('[type="submit"]');
  var serviceSelect = form.elements.service;

// Соответствие карточек услуг русским названиям
  var serviceNames = {
    realty: 'Недвижимость в Бразилии',
    legal: 'Легализация и иммиграция',
    business: 'Открытие бизнеса в Бразилии',
    tax: 'Налоги и налоговое планирование',
    other: 'Другой вопрос'
  };

  // Автоматически выбираем направление при переходе из карточки
  document.querySelectorAll('[data-service]').forEach(function (link) {
    link.addEventListener('click', function () {
      var key = link.getAttribute('data-service');
      serviceSelect.value = serviceNames[key] || '';
    });
  });

  function setStatus(state, message) {
    status.textContent = message;
    if (state) {
      status.setAttribute('data-state', state);
    } else {
      status.removeAttribute('data-state');
    }
  }

  function setFieldError(field, invalid) {
    var error = form.querySelector('[data-error-for="' + field.id + '"]');
    field.setAttribute('aria-invalid', String(invalid));
    if (error) {
      error.hidden = !invalid;
      if (invalid) {
        field.setAttribute('aria-describedby', error.id || (error.id = field.id + '-error'));
      } else {
        field.removeAttribute('aria-describedby');
      }
    }
  }

  function validate() {
    var firstInvalid = null;

    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (field) {
      var invalid = !field.value.trim();
      setFieldError(field, invalid);
      if (invalid && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  form.addEventListener('input', function (event) {
    if (event.target.getAttribute('aria-invalid') === 'true' && event.target.value.trim()) {
      setFieldError(event.target, false);
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus(null, '');

    if (!validate()) return;

    var endpoint = form.getAttribute('data-endpoint');

    if (!endpoint) {
      setStatus('info', 'Форма работает в демо-режиме: отправка заявок ещё не подключена.');
      return;
    }

    submitButton.disabled = true;
    setStatus('info', 'Отправляем…');

    fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        form.reset();
        setStatus('success', 'Спасибо! Запрос отправлен — мы свяжемся с вами.');
      })
      .catch(function () {
        setStatus('error', 'Не удалось отправить запрос. Проверьте соединение и попробуйте ещё раз.');
      })
      .then(function () {
        submitButton.disabled = false;
      });
  });

  /* ---------- Появление блоков при прокрутке ---------- */

  var revealItems = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add('is-visible');
    });
  }

  /* ---------- Год в подвале ---------- */

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
