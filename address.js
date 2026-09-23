/* Address autocomplete + map picker for the offerte Route step.
 *
 * Geocoder: Photon (photon.komoot.io) — a free, CORS-enabled, key-less type-ahead
 * geocoder built on OpenStreetMap data. Used only to look up the address the visitor
 * is typing; the lead/form data itself is never transmitted here.
 * Allowed hosts: photon.komoot.io (autocomplete + reverse),
 * unpkg.com/leaflet (map library, loaded on demand), tile.openstreetmap.org (tiles).
 * The map library only downloads when the visitor actually taps "Kaart", so the page
 * stays fast and dependency-free by default. For WordPress go-live these hosts can be
 * self-hosted or swapped for the official PDOK geocoder behind a small proxy.
 */
(() => {
  const form = document.querySelector('#quote-form');
  if (!form) return;
  const cards = [...form.querySelectorAll('fieldset.address-card')];
  if (!cards.length || !('fetch' in window)) return;

  const PHOTON = 'https://photon.komoot.io';
  const UTRECHT = { lat: 52.0907, lon: 5.1214 };

  const debounce = (fn, ms = 220) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const json = async (url) => {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('geocode ' + r.status);
    return r.json();
  };

  const cityOf = (p) => p.city || p.town || p.village || p.district || p.county || '';
  const streetOf = (p) => p.street || p.name || '';

  const label = (p) => {
    const line1 = [streetOf(p), p.housenumber].filter(Boolean).join(' ');
    const line2 = [p.postcode, cityOf(p)].filter(Boolean).join(' ');
    return [line1, line2].filter(Boolean).join(', ') || p.name || '';
  };

  const norm = (f) => {
    const p = f.properties || {};
    const c = f.geometry?.coordinates || [];
    return {
      label: label(p), street: streetOf(p), hn: p.housenumber || '',
      pc: p.postcode || '', city: cityOf(p), cc: p.countrycode || '',
      lat: c[1], lon: c[0],
    };
  };

  const suggest = async (q) => {
    const url = `${PHOTON}/api?q=${encodeURIComponent(q)}&limit=8&lat=${UTRECHT.lat}&lon=${UTRECHT.lon}`;
    const feats = (await json(url)).features || [];
    const seen = new Set();
    return feats.map(norm)
      .filter((a) => (!a.cc || a.cc === 'NL') && a.label)
      .filter((a) => { const k = a.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 6);
  };
  const reverse = async (lat, lon) => {
    const f = ((await json(`${PHOTON}/reverse?lat=${lat}&lon=${lon}`)).features || [])[0];
    return f ? norm(f) : null;
  };

  const getFields = (card) => ({
    postcode: card.querySelector('.postcode-field input'),
    number: card.querySelector('.number-field input'),
    addition: card.querySelector('.addition-field input'),
    street: card.querySelector('.street-field input'),
    city: card.querySelector('.city-field input'),
  });

  const fillFromAddr = (card, a) => {
    if (!a) return null;
    const f = getFields(card);
    if (f.street && a.street) f.street.value = a.street;
    if (a.hn) {
      const m = /^(\d+)\s*(.*)$/.exec(a.hn);
      if (f.number) f.number.value = m ? m[1] : a.hn;
      if (f.addition && m && m[2]) f.addition.value = m[2].trim();
    }
    if (f.postcode && a.pc) f.postcode.value = a.pc.toUpperCase();
    if (f.city && a.city) f.city.value = a.city;
    if (a.lat != null) { card.dataset.lat = a.lat; card.dataset.lon = a.lon; }
    [f.postcode, f.number, f.street, f.city].forEach((i) => {
      if (!i) return;
      i.removeAttribute('aria-invalid');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return { lat: a.lat, lon: a.lon };
  };

  /* ---------- Autocomplete combobox per address card ---------- */
  cards.forEach((card, index) => {
    const fieldsRow = card.querySelector('.address-fields');
    if (!fieldsRow) return;

    const wrap = document.createElement('div');
    wrap.className = 'addr-search';
    const inputId = `addr-q-${index}`;
    const listId = `addr-list-${index}`;
    wrap.innerHTML =
      `<div class="addr-search-field">` +
        `<label for="${inputId}">Zoek uw adres</label>` +
        `<div class="addr-search-control">` +
          `<svg class="addr-ico" aria-hidden="true"><use href="assets/bcz-icons.svg?v=20260923-seo30#search"></use></svg>` +
          `<input id="${inputId}" type="text" autocomplete="off" spellcheck="false" role="combobox" ` +
            `aria-expanded="false" aria-autocomplete="list" aria-controls="${listId}" ` +
            `placeholder="Straat + huisnr., bv. Vredenburg 40 Utrecht">` +
          `<button type="button" class="addr-map-btn" aria-label="Kies uw adres op de kaart">` +
            `<svg aria-hidden="true"><use href="assets/bcz-icons.svg?v=20260923-seo30#pin"></use></svg><span>Kaart</span></button>` +
        `</div>` +
      `</div>` +
      `<ul class="addr-suggest" id="${listId}" role="listbox" hidden></ul>` +
      `<p class="addr-hint">Kies uw adres — we vullen de velden automatisch in. Handmatig invullen kan ook.</p>`;
    fieldsRow.parentNode.insertBefore(wrap, fieldsRow);

    const input = wrap.querySelector('input');
    const list = wrap.querySelector('.addr-suggest');
    const mapBtn = wrap.querySelector('.addr-map-btn');
    let docs = [];
    let active = -1;

    const closeList = () => {
      list.hidden = true;
      list.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    };

    const highlight = (i) => {
      const items = [...list.children];
      items.forEach((li, n) => li.classList.toggle('is-active', n === i));
      active = i;
      if (items[i]) {
        input.setAttribute('aria-activedescendant', items[i].id);
        items[i].scrollIntoView({ block: 'nearest' });
      }
    };

    const choose = (i) => {
      const a = docs[i];
      if (!a) return;
      closeList();
      input.value = a.label;
      fillFromAddr(card, a);
    };

    const renderList = (found) => {
      docs = found;
      if (!found.length) { closeList(); return; }
      list.innerHTML = found
        .map((a, i) => `<li id="${listId}-${i}" role="option" class="addr-option">` +
          `<svg aria-hidden="true"><use href="assets/bcz-icons.svg?v=20260923-seo30#pin"></use></svg>` +
          `<span>${a.label.replace(/</g, '&lt;')}</span></li>`)
        .join('');
      [...list.children].forEach((li, i) => {
        li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    };

    const run = debounce(async () => {
      const q = input.value.trim();
      if (q.length < 3) { closeList(); return; }
      try { renderList(await suggest(q)); } catch (_) { closeList(); }
    });

    input.addEventListener('input', run);
    input.addEventListener('focus', () => { if (input.value.trim().length >= 3 && docs.length) list.hidden = false; });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      const n = list.children.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight((active + 1) % n); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight((active - 1 + n) % n); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { closeList(); }
    });
    input.addEventListener('blur', () => setTimeout(closeList, 150));

    mapBtn.addEventListener('click', () => openMap(card, input));
  });

  /* ---------- Map picker (Leaflet, loaded only when requested) ---------- */
  let leafletPromise;
  const loadLeaflet = () => {
    if (window.L) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      css.crossOrigin = '';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      s.crossOrigin = '';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return leafletPromise;
  };

  let modal, map, marker, activeCard, activeInput, foundAddr;

  const buildModal = () => {
    modal = document.createElement('div');
    modal.className = 'addr-map-modal';
    modal.hidden = true;
    modal.innerHTML =
      `<div class="addr-map-backdrop" data-close></div>` +
      `<div class="addr-map-dialog" role="dialog" aria-modal="true" aria-label="Kies uw adres op de kaart">` +
        `<div class="addr-map-head"><strong>Zet de speld op uw woning</strong>` +
          `<button type="button" class="addr-map-close" data-close aria-label="Sluiten">×</button></div>` +
        `<div class="addr-map" id="addr-map"></div>` +
        `<div class="addr-map-foot">` +
          `<p class="addr-map-found" aria-live="polite">Tik op de kaart of versleep de speld naar uw adres.</p>` +
          `<div class="addr-map-actions">` +
            `<button type="button" class="button button-secondary" data-close>Annuleren</button>` +
            `<button type="button" class="button" data-use disabled>Gebruik dit adres</button>` +
          `</div>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(modal);
    return modal;
  };

  const closeModal = () => {
    if (modal) modal.hidden = true;
    document.body.classList.remove('addr-map-open');
  };

  const setFound = (a) => {
    foundAddr = a;
    const found = modal.querySelector('.addr-map-found');
    const useBtn = modal.querySelector('[data-use]');
    if (a) { found.textContent = a.label || 'Adres gevonden'; useBtn.disabled = false; }
    else { found.textContent = 'Geen adres gevonden op dit punt — probeer iets dichter bij de woning.'; useBtn.disabled = true; }
  };

  const placeMarker = async (lat, lon) => {
    marker.setLatLng([lat, lon]);
    modal.querySelector('.addr-map-found').textContent = 'Adres opzoeken…';
    modal.querySelector('[data-use]').disabled = true;
    try { setFound(await reverse(lat, lon)); } catch (_) { setFound(null); }
  };

  function openMap(card, input) {
    activeCard = card;
    activeInput = input;
    if (!modal) {
      buildModal();
      modal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeModal(); });
      modal.querySelector('[data-use]').addEventListener('click', () => {
        if (foundAddr) { fillFromAddr(activeCard, foundAddr); if (activeInput) activeInput.value = foundAddr.label; }
        closeModal();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });
    }
    modal.hidden = false;
    document.body.classList.add('addr-map-open');
    modal.querySelector('[data-use]').disabled = true;
    modal.querySelector('.addr-map-found').textContent = 'Kaart laden…';

    const start = card.dataset.lat
      ? { lat: parseFloat(card.dataset.lat), lon: parseFloat(card.dataset.lon) }
      : UTRECHT;
    const zoom = card.dataset.lat ? 18 : 13;

    loadLeaflet().then(() => {
      const L = window.L;
      modal.querySelector('.addr-map-found').textContent = 'Tik op de kaart of versleep de speld naar uw adres.';
      if (!map) {
        map = L.map('addr-map', { zoomControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        const pin = L.divIcon({ className: 'addr-pin', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 28] });
        marker = L.marker([start.lat, start.lon], { draggable: true, icon: pin }).addTo(map);
        marker.on('dragend', () => { const p = marker.getLatLng(); placeMarker(p.lat, p.lng); });
        map.on('click', (e) => placeMarker(e.latlng.lat, e.latlng.lng));
      }
      map.setView([start.lat, start.lon], zoom);
      marker.setLatLng([start.lat, start.lon]);
      setTimeout(() => map.invalidateSize(), 60);
      if (card.dataset.lat) placeMarker(start.lat, start.lon);
    }).catch(() => {
      modal.querySelector('.addr-map-found').textContent = 'De kaart kon niet laden. Vul uw adres hierboven handmatig in.';
    });
  }
})();
