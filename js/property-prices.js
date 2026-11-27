(() => {
  'use strict';

  const facts = document.querySelector('.property-facts');
  if (!facts) return;

  const costLabel = [...facts.querySelectorAll('.property-fact-label')]
    .find(el => el.textContent.trim() === 'Стоимость');
  const cost = costLabel?.nextElementSibling;
  const factCurrencies = costLabel?.parentElement.querySelector('.fact-currencies');
  const units = [...document.querySelectorAll('.gran-plans .unit-option[id]')];
  const fmt = value => 'от R$ ' + Math.round(value).toLocaleString('ru-RU');

  function positive(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function clearCurrency(el) {
    if (!el) return;
    delete el.dataset.brl;
    el.querySelectorAll('.currency-extra').forEach(node => node.remove());
    el.classList.remove('currency-wrap');
  }

  function showCost(price, pending = false) {
    if (!cost) return;
    clearCurrency(cost);
    cost.textContent = price ? fmt(price) : pending ? 'Уточняем цену…' : 'По запросу';
    if (factCurrencies) {
      clearCurrency(factCurrencies);
      factCurrencies.hidden = true;
      if (price) factCurrencies.dataset.brl = String(price);
    } else if (price) {
      cost.classList.add('currency-price');
      cost.dataset.brl = String(price);
    }
  }

  function showUnit(unit, price, pending = false) {
    delete unit.dataset.startPrice;
    const label = unit.querySelector(':scope > summary .unit-price');
    if (!label) return;
    clearCurrency(label);
    label.classList.toggle('currency-price', !!price);
    label.classList.toggle('price-unknown', !price);
    if (!price) {
      label.textContent = pending ? 'Уточняем цену…' : 'Цена по запросу';
      return;
    }
    unit.dataset.startPrice = String(price);
    label.dataset.brl = String(price);
    const brl = document.createElement('span');
    brl.className = 'currency-brl';
    const value = document.createElement('span');
    value.className = 'currency-value';
    value.textContent = fmt(price);
    brl.append(value);
    label.replaceChildren(brl);
  }

  showCost(null, true);
  units.forEach(unit => showUnit(unit, null, true));

  // Цены устанавливаются по типу квартиры, а не по отдельному чертежу.
  // Вариант наследует цену своего доступного родительского типа.
  window.bcPropertyPricesReady = fetch(
    './data.json',
    { cache: 'no-store' }
  ).then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(property => {
    if (!property || !Array.isArray(property.plans)) {
      throw new Error('Некорректные данные ЖК');
    }
    const plans = new Map(property.plans.map(plan => [plan.id, plan]));
    const priceOf = plan => {
      if (!plan || plan.available === false) return null;
      const type = plan.parentId ? plans.get(plan.parentId) : plan;
      if (!type || type.parentId || type.available === false) return null;
      return positive(type.priceBrl);
    };
    const prices = property.plans
      .filter(plan => !plan.parentId)
      .map(priceOf)
      .filter(price => price !== null);
    const minimum = prices.length ? Math.min(...prices) : null;
    showCost(minimum);
    units.forEach(unit => showUnit(unit, priceOf(plans.get(unit.id))));
    window.bcRenderCurrencies?.();
    // Калькулятор получает тот же минимум, что и заголовок ЖК.
    return { ...property, priceBrl: minimum };
  }).catch(error => {
    showCost(null);
    units.forEach(unit => showUnit(unit, null));
    console.warn('Не удалось обновить цены ЖК:', error);
    return null;
  });
})();
