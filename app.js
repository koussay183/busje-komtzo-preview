(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  const menuOpen = () => !!nav && nav.classList.contains('open');
  if (menuButton && nav) {
    // H5 (WCAG 2.4.3): while the menu is open the page behind it is inert, so Tab stays in the header,
    // the menu and the bottom bar. Closing returns focus to the menu button.
    const behind = () => document.querySelectorAll('main, .authority-band, .site-footer');
    const close = () => {
      const wasOpen = menuOpen();
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      behind().forEach((el) => el.removeAttribute('inert'));
      if (wasOpen && nav.contains(document.activeElement)) menuButton.focus();
    };
    menuButton.addEventListener('click', () => {
      const opening = !menuOpen();
      if (!opening) { close(); return; }
      // The mobile menu is fixed right under the header, whatever its current height.
      const siteHeader = document.querySelector('.site-header');
      if (siteHeader) document.documentElement.style.setProperty('--hdr', `${Math.round(siteHeader.getBoundingClientRect().bottom)}px`);
      nav.classList.add('open');
      menuButton.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      behind().forEach((el) => el.setAttribute('inert', ''));
      requestAnimationFrame(() => nav.querySelector('a')?.focus());
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) close();
    });
    // The bottom bar stays usable while the menu is open: a tap there also closes the menu.
    document.querySelector('.mobile-actions')?.addEventListener('click', (event) => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuOpen()) close();
    });
    // Rotating or resizing to the desktop layout hides the button: never leave the page inert.
    const desktop = window.matchMedia('(min-width: 1061px)');
    const onDesktop = () => { if (desktop.matches && menuOpen()) close(); };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
  }

  // Touch screens wide enough for the desktop menu cannot hover: the first tap on
  // "Diensten" opens its submenu, a second tap follows the link.
  const touchWide = window.matchMedia('(hover: none) and (min-width: 1061px)');
  document.querySelectorAll('.nav-item.has-sub').forEach((item) => {
    item.querySelector(':scope > a')?.addEventListener('click', (event) => {
      if (!touchWide.matches || item.classList.contains('is-open')) return;
      event.preventDefault();
      item.classList.add('is-open');
    });
    // M-A2 (1.4.13): Escape hides the open desktop submenu; it comes back once the pointer or focus has left.
    item.addEventListener('mouseleave', () => item.classList.remove('is-dismissed'));
    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget)) item.classList.remove('is-dismissed');
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menuOpen()) return;
    document.querySelectorAll('.nav-item.has-sub').forEach((item) => {
      if (!item.matches(':hover, :focus-within, .is-open')) return;
      const hadFocus = item.contains(document.activeElement);
      item.classList.remove('is-open');
      item.classList.add('is-dismissed');
      if (hadFocus) item.querySelector(':scope > a')?.focus();
    });
  });
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.nav-item.is-open').forEach((item) => {
      if (!item.contains(event.target)) item.classList.remove('is-open');
    });
  });

  // H6 (WCAG 2.2.2): the reviews marquee can be paused with a button (it already pauses on hover/focus).
  // The button ships hidden (no use without JavaScript); CSS keeps it hidden where the marquee does not run.
  document.querySelectorAll('.reel-toggle').forEach((button) => {
    const reel = button.nextElementSibling && button.nextElementSibling.classList.contains('reviews-reel')
      ? button.nextElementSibling : document.querySelector('.reviews-reel');
    button.hidden = false;
    button.addEventListener('click', () => {
      const paused = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(paused));
      if (reel) reel.classList.toggle('is-paused', paused);
    });
  });

  // While a text field has focus the bottom bar steps aside (CSS: body.is-typing), so it never covers
  // the field above the keyboard. The class goes 0.4s after the field loses focus: a tap that blurs the
  // field (for example on the form's own button) still lands where the finger was.
  const typingField = (el) => !!el && typeof el.matches === 'function'
    && el.matches('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="file"]):not([type="hidden"])');
  let typingTimer = 0;
  const typingCheck = () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (!typingField(document.activeElement)) document.body.classList.remove('is-typing');
    }, 400);
  };
  document.addEventListener('focusin', (event) => {
    if (!typingField(event.target)) return;
    clearTimeout(typingTimer);
    document.body.classList.add('is-typing');
  });
  document.addEventListener('focusout', (event) => { if (typingField(event.target)) typingCheck(); });
  // A form that replaces its fields on submit removes the focused field without a focusout.
  document.addEventListener('submit', typingCheck, true);

  // Header gets a firmer edge once the page scrolls.
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Video band: the muted loop only plays while visible (never for reduced motion);
  // the play button opens the full clip in a dialog.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = document.querySelector('.video-loop');
  // Phones and tablets get the 640x360 loop and poster (about a quarter of the bytes); swapped before
  // anything loads (preload="none", lazy poster).
  if (loop && window.matchMedia('(max-width: 820px)').matches) {
    if (loop.dataset.smallSrc) loop.src = loop.dataset.smallSrc;
    if (loop.dataset.smallPoster) loop.dataset.poster = loop.dataset.smallPoster;
  }
  // Posters load only when the video comes near the viewport (keeps the first load light).
  const lazyPosters = [...document.querySelectorAll('video[data-poster]')];
  const showPoster = (v) => { if (!v.poster) v.poster = v.dataset.poster; };
  if ('IntersectionObserver' in window) {
    const posterIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { showPoster(entry.target); posterIo.unobserve(entry.target); } });
    }, { rootMargin: '600px 0px' });
    lazyPosters.filter((v) => !v.closest('dialog')).forEach((v) => posterIo.observe(v));
  } else {
    lazyPosters.forEach(showPoster);
  }
  // H7 (WCAG 2.2.2): the loop has a pause button. Save-Data starts paused (the button then plays it).
  const loopToggle = document.querySelector('.loop-toggle');
  const canLoop = !!loop && !reduceMotion && 'IntersectionObserver' in window;
  let userPaused = !!(navigator.connection && navigator.connection.saveData);
  let loopVisible = false;
  if (loopToggle) {
    loopToggle.hidden = !canLoop;
    loopToggle.setAttribute('aria-pressed', String(userPaused));
    loopToggle.addEventListener('click', () => {
      userPaused = !userPaused;
      loopToggle.setAttribute('aria-pressed', String(userPaused));
      if (userPaused) loop.pause();
      else if (loopVisible) loop.play().catch(() => {});
    });
  }
  if (canLoop) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        loopVisible = entry.isIntersecting;
        if (entry.isIntersecting && !userPaused) loop.play().catch(() => {});
        else loop.pause();
      });
    }, { threshold: 0.25 }).observe(loop);
  }
  const modal = document.querySelector('#video-modal');
  const playBtn = document.querySelector('.video-play');
  if (modal && playBtn && typeof modal.showModal === 'function') {
    const film = modal.querySelector('video');
    const closeModal = () => { if (film) film.pause(); if (modal.open) modal.close(); };
    playBtn.addEventListener('click', () => {
      if (film) showPoster(film);
      modal.showModal();
      if (film) film.play().catch(() => {});
    });
    modal.querySelector('.video-close')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.addEventListener('close', () => { if (film) film.pause(); });
  } else if (playBtn) {
    playBtn.hidden = true;
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
    if (el.closest('.inner-hero, .hero, .service-hero, .clear-hero, .quote-hero')) return 'hero';
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

  // Thank-you page: count the lead once, right after a real submission (not on refresh). The server adds
  // ?s=0 when it dropped the post (honeypot or too fast): that is never counted (H1).
  if (document.body.classList.contains('page-bedankt')) {
    if (store.get('bcz_lead_pending') && params.get('s') !== '0') {
      let userData = {};
      try { userData = JSON.parse(store.get('bcz_lead_ud') || '{}'); } catch (e) { userData = {}; }
      track({ event: 'bcz_lead_success', lead_type: 'quote_form', user_data: userData });
    }
    store.del('bcz_lead_pending');
    store.del('bcz_lead_ud');
    store.del('bcz_form_draft');
  }

  // Short lead form (offerte): capture contact fast, no prices or volume required.
  const quoteForm = document.querySelector('#quote-form');
  if (!quoteForm) return;

  const tsField = quoteForm.querySelector('[name="bcz_ts"]');
  if (tsField) tsField.value = String(Date.now());
  const srcField = quoteForm.querySelector('[name="bcz_source"]');
  if (srcField) srcField.value = store.get('bcz_src') || '';
  // Funnel: bcz_form_start always comes first (also on a tap or a keyboard-free change, and before the
  // step event of a deep link that opens step 2).
  let formStarted = false;
  const startForm = () => {
    if (formStarted) return;
    formStarted = true;
    track({ event: 'bcz_form_start', lead_type: 'quote_form' });
  };
  ['focusin', 'pointerdown', 'change'].forEach((type) => quoteForm.addEventListener(type, startForm));

  // Server-side validation errors come back as ?fout=<code>.
  const serverErrors = {
    velden: 'Controleer de gemarkeerde velden en probeer het opnieuw.',
    contact: 'Vul uw telefoonnummer of e-mailadres in, dan kunnen we u bereiken.',
    fotos: "Een of meer foto's konden niet worden verwerkt. Probeer minder of kleinere foto's, of stuur ze via WhatsApp.",
    groot: "De foto's zijn samen te groot. Probeer minder foto's, of stuur ze via WhatsApp.",
    druk: 'Er zijn net veel aanvragen verstuurd. Probeer het over een paar minuten opnieuw of bel ons.',
    mail: 'Uw aanvraag kon niet worden verstuurd. Bel of app ons, dan helpen we u direct.',
  };

  const error = quoteForm.querySelector('.form-error:not(.step-error):not(.server-error)');
  const stepError = quoteForm.querySelector('.step-error');
  // Server errors get their own alert above both steps, so it is visible whichever step is shown.
  const serverBox = quoteForm.querySelector('.server-error') || error;
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

  // Prefill the type of home from ?service= when linked from a service card or the
  // homepage quick-start card (which already answered step 1, so it adds &stap=2).
  const housingRadios = [...quoteForm.querySelectorAll('[name="housing-type"]')];
  const service = (params.get('service') || '').toLowerCase();
  let prefilled = false;
  if (service) {
    const wanted = service.startsWith('zakelijk') || service.startsWith('kantoor') ? 'kantoor' : service;
    const match = housingRadios.find((r) => r.value.toLowerCase().includes(wanted));
    if (match) { match.checked = true; prefilled = true; }
  }

  // "Plan een bezichtiging" links (?bezichtiging=ja) preselect the home visit.
  if (params.get('bezichtiging')) {
    const visit = quoteForm.querySelector('[name="pricing"][value="Bezichtiging aan huis"]');
    if (visit) visit.checked = true;
  }

  // With "Bezichtiging aan huis" chosen, the heading, the step 2 intro and the button talk about the visit.
  const pageTitle = document.querySelector('main h1');
  const step2Intro = quoteForm.querySelector('[data-step="2"] .lead-step-sub');
  const submitButton = quoteForm.querySelector('#submit-quote');
  const generic = {
    title: pageTitle ? pageTitle.innerHTML : '',
    intro: step2Intro ? step2Intro.textContent : '',
    button: submitButton ? submitButton.textContent : '',
  };
  const wantsVisit = () => (quoteForm.querySelector('[name="pricing"]:checked') || {}).value === 'Bezichtiging aan huis';
  const submitLabel = () => (wantsVisit() ? 'Vraag de bezichtiging aan' : generic.button);
  const visitCopy = () => {
    const visit = wantsVisit();
    if (pageTitle) pageTitle.innerHTML = visit ? 'Plan een bezichtiging aan huis.' : generic.title;
    if (step2Intro) step2Intro.textContent = visit ? 'De eigenaar belt of appt u om een moment voor de bezichtiging af te spreken. Vrijblijvend.' : generic.intro;
    if (submitButton && !submitButton.disabled) submitButton.textContent = submitLabel();
  };
  quoteForm.querySelectorAll('[name="pricing"]').forEach((r) => r.addEventListener('change', visitCopy));
  visitCopy();

  // Coming from the m³ calculator (?volume=12.5): note the estimate in the optional details.
  const volume = (params.get('volume') || '').replace(',', '.');
  const scopeField = quoteForm.querySelector('[name="scope"]');
  if (/^\d{1,3}(\.\d{1,2})?$/.test(volume) && scopeField && !scopeField.value) {
    scopeField.value = `Geschat verhuisvolume: ${volume.replace('.', ',')} m³ (via de m³ calculator)`;
    const more = scopeField.closest('details');
    if (more) more.open = true;
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
      const pricing = quoteForm.querySelector('[name="pricing"]:checked');
      summary.querySelector('span').textContent = [housing && housing.value, timing && timing.value, pricing && pricing.value].filter(Boolean).join(' · ');
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
    if (prefilled && params.get('stap') === '2' && !params.get('fout')) {
      startForm();
      track({ event: 'bcz_form_step', lead_type: 'quote_form', form_step: 2 });
      showStep(2, false);
    }
  }

  // Keep what the visitor typed if the server sends them back with an error (?fout=…).
  const DRAFT_FIELDS = ['name', 'phone', 'email', 'date', 'from-city', 'to-city', 'scope'];
  const saveDraft = () => {
    const d = {};
    DRAFT_FIELDS.forEach((n) => { const el = quoteForm.querySelector(`[name="${n}"]`); if (el && el.value) d[n] = el.value; });
    ['housing-type', 'timing', 'pricing'].forEach((n) => { const el = quoteForm.querySelector(`[name="${n}"]:checked`); if (el) d[n] = el.value; });
    store.set('bcz_form_draft', JSON.stringify(d));
  };
  const restoreDraft = () => {
    let d = {};
    try { d = JSON.parse(store.get('bcz_form_draft') || '{}'); } catch (e) { d = {}; }
    DRAFT_FIELDS.forEach((n) => { const el = quoteForm.querySelector(`[name="${n}"]`); if (el && d[n]) el.value = d[n]; });
    ['housing-type', 'timing', 'pricing'].forEach((n) => {
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
  if (serverError && serverBox) {
    restoreDraft();
    visitCopy();
    if (steps.length === 2) showStep(housingRadios.some((r) => r.checked) ? 2 : 1, false);
    serverBox.textContent = serverErrors[serverError] || serverErrors.velden;
    serverBox.hidden = false;
    if (serverError === 'contact') {
      if (phone) phone.setAttribute('aria-invalid', 'true');
      if (email) email.setAttribute('aria-invalid', 'true');
    }
    // Announce and focus the message (it is a role="alert" region with tabindex="-1").
    serverBox.tabIndex = -1;
    requestAnimationFrame(() => {
      quoteForm.scrollIntoView({ block: 'start' });
      serverBox.focus({ preventScroll: true });
    });
  }

  quoteForm.addEventListener('input', (event) => {
    if (event.target && event.target.removeAttribute) event.target.removeAttribute('aria-invalid');
  });

  // Back from /bedankt/ (page restored from the back/forward cache): the button is usable again and no
  // conversion is pending.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitLabel(); }
    store.del('bcz_lead_pending');
    store.del('bcz_lead_ud');
  });

  quoteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (error) error.hidden = true;
    if (serverBox && serverBox !== error) serverBox.hidden = true;

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
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Versturen…'; }
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
      + `</div></div>`;
    quoteForm.scrollIntoView({ block: 'start' });
  });

  // Deep link from the mobile "Aanvraag" button: land on the form, ready to fill.
  if (location.hash === '#quote-form') {
    requestAnimationFrame(() => quoteForm.scrollIntoView({ block: 'start' }));
  }
})();
