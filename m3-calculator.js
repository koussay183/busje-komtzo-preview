(() => {
  const calculator = document.querySelector('#m3-calculator');
  if (!calculator) return;

  const data = window.BCZ_INVENTORY_DATA || [];
  const inventory = calculator.querySelector('#m3-inventory-categories');
  const extra = calculator.querySelector('#m3-extra-volume');
  const total = calculator.querySelector('#m3-total');
  const selected = calculator.querySelector('#m3-selected');
  const boxes = calculator.querySelector('#m3-box-equivalent');
  const selectionList = calculator.querySelector('#m3-selection-list');
  const quoteLink = calculator.querySelector('#m3-quote-link');
  const search = calculator.querySelector('#m3-inventory-search');
  const searchStatus = calculator.querySelector('#m3-search-status');
  const boxCount = document.querySelector('#m3-box-count');
  const boxVolume = document.querySelector('#m3-box-volume');
  const addBoxes = document.querySelector('#m3-add-boxes');
  const boxStatus = document.querySelector('#m3-box-action-status');
  const lengthInput = document.querySelector('#m3-length');
  const widthInput = document.querySelector('#m3-width');
  const heightInput = document.querySelector('#m3-height');
  const dimensionVolume = document.querySelector('#m3-dimension-volume');
  const addDimensions = document.querySelector('#m3-add-dimensions');
  const dimensionStatus = document.querySelector('#m3-dimension-status');
  const decimal = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const precise = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/bcz-icons.svg#${name}"></use></svg>`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  inventory.innerHTML = data.map((group, groupIndex) => `
    <details class="inventory-group" ${groupIndex === 0 ? 'open' : ''}>
      <summary>
        <span class="inventory-group-icon">${icon(group.icon)}</span>
        <span><strong>${group.name}</strong><small><span data-m3-category="${groupIndex}">0</span> items geselecteerd</small></span>
      </summary>
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

  const filterInventory = () => {
    const query = (search?.value || '').trim().toLocaleLowerCase('nl-NL');
    let visibleCount = 0;
    inventory.querySelectorAll('.inventory-group').forEach((group) => {
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
    if (searchStatus) {
      searchStatus.textContent = query
        ? `${visibleCount} ${visibleCount === 1 ? 'resultaat' : 'resultaten'} voor “${search.value.trim()}”.`
        : 'Alle inventarisgroepen worden getoond.';
    }
  };

  const calculate = () => {
    let volume = clamp(extra.value, 0, 200);
    let itemCount = 0;
    const selectedItems = [];
    const categoryCounts = new Map();
    calculator.querySelectorAll('.inventory-row').forEach((row) => {
      const input = row.querySelector('input');
      const quantity = clamp(input.value, 0, 99);
      if (String(quantity) !== input.value) input.value = String(quantity);
      volume += quantity * Number(row.dataset.volume);
      itemCount += quantity;
      if (quantity) selectedItems.push(`${row.querySelector('strong').textContent} × ${quantity}`);
      categoryCounts.set(row.dataset.group, (categoryCounts.get(row.dataset.group) || 0) + quantity);
    });
    const rounded = Math.round(volume * 10) / 10;
    total.textContent = `${decimal.format(rounded)} m³`;
    selected.textContent = itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'} geselecteerd` : 'Nog geen items geselecteerd';
    boxes.textContent = rounded ? `ongeveer ${Math.round(rounded / .1)} standaard verhuisdozen` : 'ongeveer 10 standaard verhuisdozen per m³';
    const extraVolume = clamp(extra.value, 0, 200);
    const summaryItems = [...selectedItems, ...(extraVolume ? [`Extra volume · ${decimal.format(extraVolume)} m³`] : [])];
    selectionList.innerHTML = summaryItems.length
      ? summaryItems.map((item) => `<li>${item}</li>`).join('')
      : '<li>Nog geen inventaris toegevoegd.</li>';
    calculator.querySelectorAll('[data-m3-category]').forEach((node) => {
      node.textContent = String(categoryCounts.get(node.dataset.m3Category) || 0);
    });
    quoteLink.href = rounded ? `offerte.html?volume=${rounded}#quote-form` : 'offerte.html#quote-form';
    quoteLink.textContent = rounded ? `Neem ${decimal.format(rounded)} m³ mee naar de offerte` : 'Ga verder naar de offerte';
  };

  const updateBoxConverter = () => {
    if (!boxCount || !boxVolume || !addBoxes) return;
    const quantity = Math.round(clamp(boxCount.value, 0, 99));
    boxCount.value = String(quantity);
    boxVolume.textContent = `${quantity} ${quantity === 1 ? 'doos' : 'dozen'} ≈ ${decimal.format(quantity * .1)} m³`;
    addBoxes.textContent = quantity ? `Voeg ${quantity} ${quantity === 1 ? 'doos' : 'dozen'} toe` : 'Kies eerst een aantal dozen';
    addBoxes.disabled = quantity === 0;
  };

  boxCount?.addEventListener('input', () => {
    updateBoxConverter();
    if (boxStatus) boxStatus.textContent = 'De knop voegt het aantal toe aan de inventarislijst hierboven.';
  });
  addBoxes?.addEventListener('click', () => {
    const quantity = Math.round(clamp(boxCount.value, 0, 99));
    const boxRow = [...calculator.querySelectorAll('.inventory-row')].find((row) => row.querySelector('strong')?.textContent === 'Verhuisdoos');
    if (!quantity || !boxRow) return;
    const input = boxRow.querySelector('input');
    const nextQuantity = Math.min(99, Number(input.value) + quantity);
    input.value = String(nextQuantity);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (boxStatus) boxStatus.textContent = `${quantity} ${quantity === 1 ? 'doos is' : 'dozen zijn'} toegevoegd aan de inventarislijst.`;
  });

  const measuredVolume = () => {
    const length = clamp(lengthInput?.value, 0, 1000);
    const width = clamp(widthInput?.value, 0, 1000);
    const height = clamp(heightInput?.value, 0, 1000);
    return (length * width * height) / 1000000;
  };
  const updateDimensions = () => {
    if (!dimensionVolume || !addDimensions) return;
    const volume = measuredVolume();
    const rounded = Math.round(volume * 10) / 10;
    dimensionVolume.textContent = `${precise.format(volume)} m³`;
    addDimensions.textContent = rounded > 0 ? `Voeg ${decimal.format(rounded)} m³ toe` : 'Vul geldige afmetingen in';
    addDimensions.disabled = rounded <= 0;
  };
  [lengthInput, widthInput, heightInput].forEach((field) => field?.addEventListener('input', () => {
    updateDimensions();
    if (dimensionStatus) dimensionStatus.textContent = 'Meet de grootste buitenmaten. De uitkomst blijft een laadvolume-indicatie.';
  }));
  addDimensions?.addEventListener('click', () => {
    const addition = Math.round(measuredVolume() * 10) / 10;
    if (!addition) return;
    const next = Math.round(clamp(Number(extra.value) + addition, 0, 200) * 10) / 10;
    extra.value = String(next);
    extra.dispatchEvent(new Event('input', { bubbles: true }));
    if (dimensionStatus) dimensionStatus.textContent = `${decimal.format(addition)} m³ is toegevoegd als extra volume.`;
  });

  inventory.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const input = button.parentElement.querySelector('input');
    input.value = String(clamp(Number(input.value) + (button.dataset.action === 'plus' ? 1 : -1), 0, 99));
    calculate();
  });
  inventory.addEventListener('input', calculate);
  search?.addEventListener('input', filterInventory);
  extra.addEventListener('input', calculate);
  calculator.querySelector('#m3-clear').addEventListener('click', () => {
    calculator.querySelectorAll('.inventory-row input').forEach((input) => { input.value = '0'; });
    extra.value = '0';
    calculate();
    inventory.querySelector('summary')?.focus();
  });
  calculate();
  updateBoxConverter();
  updateDimensions();
})();
