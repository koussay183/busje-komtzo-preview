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

  // Measurement: one dataLayer event per contact action, read by Google Tag Manager.
  // Tags in GTM decide what is sent to GA4 / Google Ads, and only with consent.
  window.dataLayer = window.dataLayer || [];
  // Admin preview on the live site (?bcz_preview=1) must never count as a real lead or click.
  const isPreview = document.documentElement.hasAttribute('data-bcz-preview');
  const track = (data) => { if (!isPreview) window.dataLayer.push(data); };
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  const placeOf = (el) => {
    if (el.closest('.mobile-actions')) return 'sticky_bar';
    if (el.closest('.site-header')) return 'header';
    if (el.closest('.site-footer')) return 'footer';
    if (el.closest('.pack-card')) return 'package_' + (el.closest('.pack-card').id || '').replace('pakket-', '');
    if (el.closest('.inner-hero, .hero')) return 'hero';
    if (el.closest('.contact-band')) return 'contact_band';
    if (el.closest('#quote-form, .success-state')) return 'quote_form';
    return 'content';
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    const method = href.startsWith('https://wa.me/') ? 'whatsapp'
      : href.startsWith('tel:') ? 'phone'
      : href.startsWith('mailto:') ? 'email' : '';
    if (!method) return;
    track({ event: 'bcz_contact', contact_method: method, contact_location: placeOf(link) });
  });

  // Where the visitor came from (campaign tags only, no click IDs stored), sent with the lead
  // so the owner can see which enquiries came from Google Ads.
  const params = new URLSearchParams(location.search);
  if (!store.get('bcz_src')) {
    const src = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term']
      .map((k) => params.get(k) ? `${k.replace('utm_', '')}=${params.get(k).slice(0, 60)}` : '')
      .filter(Boolean);
    if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) src.push('google_ads=ja');
    store.set('bcz_src', (src.join(', ') || 'direct/organic') + `, landing=${location.pathname}`);
  }

  // Thank-you page: count the lead once, right after a real submission (not on refresh).
  if (document.body.classList.contains('page-bedankt') && store.get('bcz_lead_pending')) {
    let userData = {};
    try { userData = JSON.parse(store.get('bcz_lead_ud') || '{}'); } catch (e) { userData = {}; }
    track({ event: 'bcz_lead_success', lead_type: 'quote_form', user_data: userData });
    store.del('bcz_lead_pending');
    store.del('bcz_lead_ud');
  }
  if (document.body.classList.contains('page-bedankt')) store.del('bcz_form_draft');

  // Short lead form (offerte): capture contact fast, no prices or volume required.
  const quoteForm = document.querySelector('#quote-form');
  if (!quoteForm) return;

  const tsField = quoteForm.querySelector('[name="bcz_ts"]');
  if (tsField) tsField.value = String(Date.now());
  const srcField = quoteForm.querySelector('[name="bcz_source"]');
  if (srcField) srcField.value = store.get('bcz_src') || '';
  let formStarted = false;
  quoteForm.addEventListener('focusin', () => {
    if (formStarted) return;
    formStarted = true;
    track({ event: 'bcz_form_start', lead_type: 'quote_form' });
  });

  // Server-side validation errors come back as ?fout=<code>.
  const serverErrors = {
    velden: 'Controleer de gemarkeerde velden en probeer het opnieuw.',
    contact: 'Vul uw telefoonnummer of e-mailadres in, dan kunnen we u bereiken.',
    fotos: "Een of meer foto's konden niet worden verwerkt. Probeer minder of kleinere foto's, of stuur ze via WhatsApp.",
    groot: "De foto's zijn samen te groot. Probeer minder foto's, of stuur ze via WhatsApp.",
    druk: 'Er zijn net veel aanvragen verstuurd. Probeer het over een paar minuten opnieuw of bel ons.',
    mail: 'Uw aanvraag kon niet worden verstuurd. Bel of app ons, dan helpen we u direct.',
  };

  const error = quoteForm.querySelector('.form-error:not(.step-error)');
  const stepError = quoteForm.querySelector('.step-error');
  const phone = quoteForm.querySelector('[name="phone"]');
  const email = quoteForm.querySelector('[name="email"]');

  const dateField = quoteForm.querySelector('input[type="date"]');
  if (dateField) dateField.min = new Date().toISOString().slice(0, 10);

  // Photos: thumbnails, remove, drag & drop, client-side compression (light uploads)
  // and, on phones, the native share sheet so photos can go straight to WhatsApp.
  // At go-live the form posts as multipart/form-data and the photos are emailed to the owner.
  const photos = quoteForm.querySelector('input[name="photos[]"]');
  const photoStatus = quoteForm.querySelector('#photo-status');
  const previews = quoteForm.querySelector('#photo-previews');
  const shareBtn = quoteForm.querySelector('#photo-share');
  const drop = quoteForm.querySelector('.photo-drop');
  const MAX_FILES = 10;
  let picked = [];

  const compress = (file) => new Promise((resolve) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob && blob.size < file.size
        ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
        : file), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const syncInput = () => {
    if (!photos || typeof DataTransfer === 'undefined') return;
    const dt = new DataTransfer();
    picked.forEach((f) => dt.items.add(f));
    photos.files = dt.files;
  };

  const renderPhotos = (note = '') => {
    if (!previews) return;
    previews.querySelectorAll('img').forEach((im) => URL.revokeObjectURL(im.src));
    previews.innerHTML = picked.map((f, i) => `<figure class="photo-thumb"><img src="${URL.createObjectURL(f)}" alt="Foto ${i + 1}">`
      + `<button type="button" data-remove="${i}" aria-label="Verwijder foto ${i + 1}">×</button></figure>`).join('');
    if (photoStatus) photoStatus.textContent = picked.length ? `${picked.length} foto${picked.length === 1 ? '' : "'s"} toegevoegd${note}` : '';
    if (shareBtn) shareBtn.hidden = !(picked.length && navigator.canShare && navigator.canShare({ files: picked }));
  };

  const addFiles = async (list) => {
    const incoming = [...(list || [])].filter((f) => f.type.startsWith('image/'));
    const accepted = incoming.slice(0, Math.max(0, MAX_FILES - picked.length));
    picked = picked.concat(await Promise.all(accepted.map(compress)));
    syncInput();
    renderPhotos(incoming.length > accepted.length ? ` (maximaal ${MAX_FILES})` : '');
  };

  if (photos) photos.addEventListener('change', () => addFiles(photos.files));
  previews?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove]');
    if (!btn) return;
    picked.splice(Number(btn.dataset.remove), 1);
    syncInput();
    renderPhotos();
  });
  if (drop) {
    ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, () => drop.classList.remove('is-drag')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer?.files); });
  }
  shareBtn?.addEventListener('click', () => {
    navigator.share({
      files: picked,
      title: "Foto's voor mijn verhuizing",
      text: "Hallo Busje komt zo, hierbij foto's van mijn woning voor mijn verhuizing.",
    }).catch(() => {});
  });

  // Prefill the type of home from ?service= when linked from a service card.
  const housingRadios = [...quoteForm.querySelectorAll('[name="housing-type"]')];
  const service = (params.get('service') || '').toLowerCase();
  if (service) {
    const wanted = service.startsWith('zakelijk') || service.startsWith('kantoor') ? 'kantoor' : service;
    const match = housingRadios.find((r) => r.value.toLowerCase().includes(wanted));
    if (match) match.checked = true;
  }

  // Two steps: an easy first question (no personal data), then contact details.
  // Without JavaScript both steps simply show as one form.
  const steps = [...quoteForm.querySelectorAll('.lead-step')];
  const progressLabel = quoteForm.querySelector('.lead-progress-label');
  const summary = quoteForm.querySelector('.lead-summary');
  const showStep = (n, focus = true) => {
    steps.forEach((st) => { st.hidden = st.dataset.step !== String(n); });
    quoteForm.dataset.step = String(n);
    if (progressLabel) progressLabel.innerHTML = n === 1 ? 'Stap <b>1</b> van 2' : 'Stap <b>2</b> van 2 · bijna klaar';
    if (n === 2 && summary) {
      const housing = housingRadios.find((r) => r.checked);
      const timing = quoteForm.querySelector('[name="timing"]:checked');
      summary.querySelector('span').textContent = [housing && housing.value, timing && timing.value].filter(Boolean).join(' · ');
      summary.hidden = !housing;
    }
    if (focus) {
      quoteForm.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const target = n === 2 ? quoteForm.querySelector('[name="name"]') : (housingRadios.find((r) => r.checked) || housingRadios[0]);
      if (target) setTimeout(() => target.focus({ preventScroll: true }), 250);
    }
  };
  const goToStep2 = () => {
    if (!housingRadios.some((r) => r.checked)) {
      if (stepError) { stepError.textContent = 'Kies het type woning om verder te gaan.'; stepError.hidden = false; }
      housingRadios[0]?.focus();
      return;
    }
    if (stepError) stepError.hidden = true;
    track({ event: 'bcz_form_step', lead_type: 'quote_form', form_step: 2 });
    showStep(2);
  };
  if (steps.length === 2) {
    quoteForm.classList.add('is-stepped');
    showStep(1, false);
    quoteForm.querySelector('.lead-next')?.addEventListener('click', goToStep2);
    quoteForm.querySelectorAll('.lead-back').forEach((b) => b.addEventListener('click', () => showStep(1)));
    housingRadios.forEach((r) => r.addEventListener('change', () => { if (stepError) stepError.hidden = true; }));
  }

  // Keep what the visitor typed if the server sends them back with an error (?fout=…).
  const DRAFT_FIELDS = ['name', 'phone', 'email', 'date', 'from-city', 'to-city', 'scope'];
  const saveDraft = () => {
    const d = {};
    DRAFT_FIELDS.forEach((n) => { const el = quoteForm.querySelector(`[name="${n}"]`); if (el && el.value) d[n] = el.value; });
    ['housing-type', 'timing'].forEach((n) => { const el = quoteForm.querySelector(`[name="${n}"]:checked`); if (el) d[n] = el.value; });
    store.set('bcz_form_draft', JSON.stringify(d));
  };
  const restoreDraft = () => {
    let d = {};
    try { d = JSON.parse(store.get('bcz_form_draft') || '{}'); } catch (e) { d = {}; }
    DRAFT_FIELDS.forEach((n) => { const el = quoteForm.querySelector(`[name="${n}"]`); if (el && d[n]) el.value = d[n]; });
    ['housing-type', 'timing'].forEach((n) => {
      const el = [...quoteForm.querySelectorAll(`[name="${n}"]`)].find((r) => r.value === d[n]);
      if (el) el.checked = true;
    });
  };

  const showError = (message, field) => {
    if (error) { error.textContent = message; error.hidden = false; }
    if (field) field.focus();
  };

  const serverError = params.get('fout');
  if (serverError) {
    // The submission did not go through: no conversion may be counted for it.
    store.del('bcz_lead_pending');
    store.del('bcz_lead_ud');
  }
  if (serverError && error) {
    restoreDraft();
    if (steps.length === 2) showStep(housingRadios.some((r) => r.checked) ? 2 : 1, false);
    error.textContent = serverErrors[serverError] || serverErrors.velden;
    error.hidden = false;
    requestAnimationFrame(() => quoteForm.scrollIntoView({ block: 'start' }));
  }

  quoteForm.addEventListener('input', (event) => {
    if (event.target && event.target.removeAttribute) event.target.removeAttribute('aria-invalid');
  });

  quoteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (error) error.hidden = true;

    if (!housingRadios.some((r) => r.checked)) {
      if (steps.length === 2) showStep(1);
      if (stepError) { stepError.textContent = 'Kies het type woning om verder te gaan.'; stepError.hidden = false; }
      return;
    }

    const hasPhone = phone && phone.value.trim();
    const hasEmail = email && email.value.trim();
    if (!hasPhone && !hasEmail) {
      phone && phone.setAttribute('aria-invalid', 'true');
      email && email.setAttribute('aria-invalid', 'true');
      return showError('Vul uw telefoonnummer of e-mailadres in, dan kunnen we u bereiken.', phone || email);
    }
    if (hasEmail && !email.checkValidity()) {
      email.setAttribute('aria-invalid', 'true');
      return showError('Dit e-mailadres lijkt niet te kloppen. Controleer het even.', email);
    }
    const digitCount = hasPhone ? phone.value.replace(/\D/g, '').length : 0;
    if (hasPhone && (digitCount < 8 || digitCount > 15)) {
      phone.setAttribute('aria-invalid', 'true');
      return showError('Dit telefoonnummer lijkt niet te kloppen. Controleer het even.', phone);
    }

    if (quoteForm.dataset.submitMode === 'live') {
      // For Google Ads enhanced conversions: normalised contact details, used once on the
      // thank-you page (and only sent on by GTM when the visitor allowed marketing cookies).
      const ud = {};
      if (hasEmail) ud.email = email.value.trim().toLowerCase();
      if (hasPhone) {
        let digits = phone.value.replace(/[^\d+]/g, '');
        if (digits.startsWith('00')) digits = '+' + digits.slice(2);
        else if (digits.startsWith('0')) digits = '+31' + digits.slice(1);
        ud.phone_number = digits;
      }
      saveDraft();
      store.set('bcz_lead_pending', '1');
      store.set('bcz_lead_ud', JSON.stringify(ud));
      track({ event: 'bcz_form_submit', lead_type: 'quote_form', photo_count: picked.length });
      const submit = quoteForm.querySelector('#submit-quote');
      if (submit) { submit.disabled = true; submit.textContent = 'Versturen…'; }
      quoteForm.submit();
      return;
    }

    const name = (quoteForm.querySelector('[name="name"]')?.value || '').trim();
    quoteForm.innerHTML = `<div class="success-state" role="status">`
      + `<p class="eyebrow">Aanvraag ontvangen</p>`
      + `<h2>Bedankt${name ? `, ${name}` : ''}! We nemen snel contact met u op.</h2>`
      + `<p>Busje komt zo belt of appt u persoonlijk om uw verhuizing door te nemen, vrijblijvend. Sneller schakelen? App of bel ons direct.</p>`
      + `<div class="contact-hooks">`
      + `<a class="button button-whatsapp" href="https://wa.me/31634755656?text=Hallo%2C%20ik%20heb%20zojuist%20mijn%20aanvraag%20ingevuld%20bij%20Busje%20komt%20zo." target="_blank" rel="noopener">WhatsApp ons</a>`
      + `<a class="button" href="tel:+31850508282">Bel 085 050 8282</a>`
      + `</div><p class="prototype-note">Ontwerpconcept: deze versie verzendt nog geen gegevens.</p></div>`;
    quoteForm.scrollIntoView({ block: 'start' });
  });

  // Deep link from the mobile "Aanvraag" button: land on the form, ready to fill.
  if (location.hash === '#quote-form') {
    requestAnimationFrame(() => quoteForm.scrollIntoView({ block: 'start' }));
  }
})();
