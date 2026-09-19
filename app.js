(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (menuButton && nav) {
    const close = () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    };
    menuButton.addEventListener('click', () => {
      const opening = !nav.classList.contains('open');
      nav.classList.toggle('open', opening);
      menuButton.setAttribute('aria-expanded', String(opening));
      document.body.classList.toggle('menu-open', opening);
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  const euro = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const decimal = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  const estimateForm = document.querySelector('#estimate-form');
  if (estimateForm) {
    const STANDARD_TEAM = 2;
    const hours = document.querySelector('#hours');
    const kilometres = document.querySelector('#kilometres');
    const calculate = () => {
      const moverCount = STANDARD_TEAM;
      const hourCount = Math.min(24, Math.max(1, Number(hours.value) || 1));
      const kmCount = Math.min(1000, Math.max(0, Number(kilometres.value) || 0));
      const labour = moverCount * hourCount * 29.5;
      const vehicle = hourCount <= 4 ? 95 : 125;
      const travel = kmCount * .65;
      const subtotal = labour + vehicle + travel;
      const vat = subtotal * .21;
      const total = subtotal + vat;
      document.querySelector('#labour-total').textContent = euro.format(labour);
      document.querySelector('#vehicle-total').textContent = euro.format(vehicle);
      document.querySelector('#vehicle-label').textContent = hourCount <= 4 ? 'Bestelbus · opdracht t/m 4 uur' : 'Verhuiswagen · opdracht langer dan 4 uur';
      document.querySelector('#travel-total').textContent = euro.format(travel);
      document.querySelector('#subtotal').textContent = euro.format(subtotal);
      document.querySelector('#vat-total').textContent = euro.format(vat);
      document.querySelector('#grand-total').textContent = euro.format(total);
      document.querySelector('#estimate-note').textContent = `Indicatie op basis van ${hourCount.toLocaleString('nl-NL')} uur en ${kmCount.toLocaleString('nl-NL')} gereden km en de bevestigde tarieven. Busje komt zo bepaalt de definitieve inzet en offerte; dit is geen vaste offerte.`;
      const params = new URLSearchParams({ kilometres: String(kmCount) });
      document.querySelector('#estimate-quote-link').href = `offerte.html?${params}`;
    };
    estimateForm.addEventListener('input', calculate);
    estimateForm.addEventListener('change', calculate);
    calculate();
  }

  const quoteForm = document.querySelector('#quote-form');
  if (!quoteForm) return;

  const inventoryData = window.BCZ_INVENTORY_DATA || [];

  const inventoryRoot = quoteForm.querySelector('#inventory-categories');
  const inventorySearch = quoteForm.querySelector('#inventory-search');
  const inventorySearchStatus = quoteForm.querySelector('#inventory-search-status');
  const customVolume = quoteForm.querySelector('#custom-volume');
  const volumeOutput = quoteForm.querySelector('#inventory-volume-output');
  const inventorySummaryOutput = quoteForm.querySelector('#inventory-summary-output');
  const steps = [...quoteForm.querySelectorAll('.form-step')];
  const progress = [...quoteForm.querySelectorAll('.form-progress span')];
  const previous = quoteForm.querySelector('#prev-step');
  const next = quoteForm.querySelector('#next-step');
  const submit = quoteForm.querySelector('#submit-quote');
  const error = quoteForm.querySelector('.form-error');
  const stopoverToggle = quoteForm.querySelector('#has-stopover');
  const stopoverFields = quoteForm.querySelector('#stopover-fields');
  let current = 0;

  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/bcz-icons.svg#${name}"></use></svg>`;

  if (inventoryRoot) {
    inventoryRoot.innerHTML = inventoryData.map((group, groupIndex) => `
      <details class="inventory-group" ${groupIndex === 0 ? 'open' : ''}>
        <summary><span class="inventory-group-icon">${icon(group.icon)}</span><span><strong>${group.name}</strong><small><span data-category-count="${groupIndex}">0</span> items geselecteerd</small></span></summary>
        <div class="inventory-items">
          ${group.items.map(([name, volume], itemIndex) => `
            <div class="inventory-row" data-volume="${volume}" data-group="${groupIndex}">
              <div><strong>${name}</strong><small>${decimal.format(volume)} m³ per stuk</small></div>
              <div class="quantity-control">
                <button type="button" data-action="minus" aria-label="Eén ${name} minder">−</button>
                <input type="number" min="0" max="99" value="0" inputmode="numeric" aria-label="Aantal ${name}" data-item="${groupIndex}-${itemIndex}">
                <button type="button" data-action="plus" aria-label="Eén ${name} meer">+</button>
              </div>
            </div>`).join('')}
        </div>
      </details>`).join('');
  }

  const filterInventory = () => {
    const query = (inventorySearch?.value || '').trim().toLocaleLowerCase('nl-NL');
    let visibleCount = 0;
    inventoryRoot?.querySelectorAll('.inventory-group').forEach((group) => {
      let groupMatches = 0;
      group.querySelectorAll('.inventory-row').forEach((row) => {
        const matches = !query || row.textContent.toLocaleLowerCase('nl-NL').includes(query);
        row.hidden = !matches;
        if (matches) groupMatches += 1;
      });
      group.hidden = groupMatches === 0;
      if (query && groupMatches) group.open = true;
      visibleCount += groupMatches;
    });
    if (inventorySearchStatus) {
      inventorySearchStatus.textContent = query
        ? `${visibleCount} ${visibleCount === 1 ? 'resultaat' : 'resultaten'} voor “${inventorySearch.value.trim()}”.`
        : 'Alle inventarisgroepen worden getoond.';
    }
  };

  const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const getPlanning = () => {
    const volume = clampNumber(volumeOutput?.value, 0, 300);
    const km = clampNumber(quoteForm.querySelector('#route-km')?.value, 0, 1000);
    if (volume <= 0) return { volume, km, movers: 0, hours: 0, low: 0, high: 0 };
    const movers = volume <= 12 ? 2 : volume <= 28 ? 3 : 4;
    const floorFrom = clampNumber(quoteForm.querySelector('#floor-from')?.value, 0, 30);
    const floorTo = clampNumber(quoteForm.querySelector('#floor-to')?.value, 0, 30);
    const liftFrom = quoteForm.querySelector('#lift-from')?.checked;
    const liftTo = quoteForm.querySelector('#lift-to')?.checked;
    const walking = clampNumber(quoteForm.querySelector('#walking-distance')?.value, 0, 1);
    const accessHours = (liftFrom ? 0 : Math.min(2.5, floorFrom * .3)) + (liftTo ? 0 : Math.min(2.5, floorTo * .3)) + walking;
    const hours = Math.min(24, Math.ceil(Math.max(2, volume / (movers * 2.6) + accessHours) * 2) / 2);
    const labour = movers * hours * 29.5;
    const vehicle = hours <= 4 ? 95 : 125;
    const subtotal = labour + vehicle + km * .65;
    const total = subtotal * 1.21;
    return { volume, km, movers, hours, low: total * .9, high: total * 1.15 };
  };

  const updatePlanning = () => {
    const plan = getPlanning();
    const team = plan.movers ? `${plan.movers} verhuizers` : '—';
    const hours = plan.hours ? `circa ${decimal.format(plan.hours)} uur` : '—';
    const range = plan.volume ? `${euro.format(plan.low)} – ${euro.format(plan.high)}` : 'Vul eerst uw inboedel in';
    const setText = (selector, value) => {
      const node = quoteForm.querySelector(selector);
      if (node) node.textContent = value;
    };
    setText('#team-recommendation', team);
    setText('#hours-recommendation', hours);
    setText('#final-volume', `${decimal.format(plan.volume)} m³`);
    setText('#final-team', team);
    setText('#final-hours', hours);
    setText('#final-km', `${decimal.format(plan.km)} km`);
    setText('#quote-estimate-range', range);
  };

  const calculateInventory = () => {
    let volume = clampNumber(customVolume?.value, 0, 200);
    let itemCount = 0;
    const selectedItems = [];
    const groupCounts = new Map();
    quoteForm.querySelectorAll('.inventory-row').forEach((row) => {
      const input = row.querySelector('input');
      const quantity = clampNumber(input.value, 0, 99);
      if (String(quantity) !== input.value) input.value = String(quantity);
      volume += quantity * Number(row.dataset.volume);
      itemCount += quantity;
      if (quantity > 0) selectedItems.push(`${row.querySelector('strong')?.textContent || 'Item'} × ${quantity}`);
      groupCounts.set(row.dataset.group, (groupCounts.get(row.dataset.group) || 0) + quantity);
    });
    const roundedVolume = Math.round(volume * 10) / 10;
    volumeOutput.value = String(roundedVolume);
    if (inventorySummaryOutput) inventorySummaryOutput.value = selectedItems.join('; ');
    quoteForm.querySelector('#inventory-volume').textContent = decimal.format(roundedVolume);
    quoteForm.querySelector('#inventory-count').textContent = itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'} toegevoegd` : 'Nog geen items toegevoegd';
    quoteForm.querySelectorAll('[data-category-count]').forEach((node) => {
      node.textContent = String(groupCounts.get(node.dataset.categoryCount) || 0);
    });
    updatePlanning();
  };

  inventoryRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const input = button.parentElement.querySelector('input');
    const delta = button.dataset.action === 'plus' ? 1 : -1;
    input.value = String(clampNumber(Number(input.value) + delta, 0, 99));
    calculateInventory();
  });
  inventoryRoot?.addEventListener('input', calculateInventory);
  inventorySearch?.addEventListener('input', filterInventory);
  customVolume?.addEventListener('input', calculateInventory);
  quoteForm.querySelector('#clear-inventory')?.addEventListener('click', () => {
    quoteForm.querySelectorAll('.inventory-row input').forEach((input) => { input.value = '0'; });
    customVolume.value = '0';
    calculateInventory();
  });
  quoteForm.querySelectorAll('#route-km, #floor-from, #floor-to, #lift-from, #lift-to, #walking-distance').forEach((field) => {
    field.addEventListener('input', updatePlanning);
    field.addEventListener('change', updatePlanning);
  });

  const updateStopover = () => {
    if (!stopoverToggle || !stopoverFields) return;
    const enabled = stopoverToggle.checked;
    stopoverFields.hidden = !enabled;
    stopoverFields.disabled = !enabled;
    stopoverFields.querySelectorAll('[data-stopover-required]').forEach((field) => {
      field.required = enabled;
      if (!enabled) field.removeAttribute('aria-invalid');
    });
  };
  stopoverToggle?.addEventListener('change', updateStopover);
  updateStopover();

  const params = new URLSearchParams(location.search);
  const service = params.get('service');
  const supportedServices = new Set(['particulier', 'zakelijk', 'spoed', 'opslag']);
  if (service && supportedServices.has(service)) {
    [...quoteForm.querySelectorAll('input[name="service"]')].forEach((option) => {
      option.checked = option.value === service;
    });
  }
  const kmParam = params.get('kilometres');
  if (kmParam && quoteForm.querySelector('#route-km')) quoteForm.querySelector('#route-km').value = String(clampNumber(kmParam, 0, 1000));
  const volumeParam = params.get('volume');
  if (volumeParam && customVolume) customVolume.value = String(clampNumber(volumeParam, 0, 200));
  const dateField = quoteForm.querySelector('input[type="date"]');
  if (dateField) dateField.min = new Date().toISOString().slice(0, 10);

  const render = (focusHeading = true) => {
    steps.forEach((step, index) => {
      step.classList.toggle('active', index === current);
      step.hidden = index !== current;
    });
    progress.forEach((item, index) => {
      item.classList.toggle('active', index <= current);
      if (index === current) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    previous.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
    next.textContent = current === 1 ? 'Naar m³ calculator' : 'Volgende stap';
    error.hidden = true;
    if (focusHeading) steps[current].querySelector('h2')?.focus({ preventScroll: true });
    updatePlanning();
  };

  const validate = () => {
    let firstInvalid;
    [...steps[current].querySelectorAll('[required]')].forEach((field) => {
      const valid = field.type === 'checkbox' ? field.checked : field.checkValidity();
      field.setAttribute('aria-invalid', String(!valid));
      if (!valid && !firstInvalid) firstInvalid = field;
    });
    if (steps[current].classList.contains('inventory-step') && Number(volumeOutput.value) <= 0) {
      error.textContent = 'Voeg minimaal één item of extra volume toe om verder te gaan.';
      error.hidden = false;
      inventoryRoot.querySelector('button, input')?.focus();
      return false;
    }
    if (firstInvalid) {
      error.textContent = 'Controleer de gemarkeerde velden.';
      error.hidden = false;
      firstInvalid.focus();
      return false;
    }
    error.hidden = true;
    return true;
  };

  next.addEventListener('click', () => {
    if (!validate()) return;
    current += 1;
    render();
    quoteForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  previous.addEventListener('click', () => {
    current -= 1;
    render();
    quoteForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  quoteForm.addEventListener('submit', (event) => {
    if (!validate()) {
      event.preventDefault();
      return;
    }
    if (quoteForm.dataset.submitMode === 'live') {
      submit.disabled = true;
      submit.textContent = 'Aanvraag verzenden…';
      return;
    }
    event.preventDefault();
    const plan = getPlanning();
    quoteForm.innerHTML = `<div class="success-state" role="status"><p class="eyebrow">Lokale controle voltooid</p><h2>Uw aanvraag bevat ${decimal.format(plan.volume)} m³ aan geschatte inboedel.</h2><p>De indicatieve prijsband is <strong>${euro.format(plan.low)} – ${euro.format(plan.high)}</strong> inclusief 21% btw. Deze prototypeversie heeft niets verzonden.</p><a class="button" href="index.html">Terug naar home</a></div>`;
  });

  calculateInventory();
  render(false);
})();
