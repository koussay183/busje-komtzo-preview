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

  // Short lead form (offerte): capture contact fast, no prices or volume required.
  const quoteForm = document.querySelector('#quote-form');
  if (!quoteForm) return;

  const error = quoteForm.querySelector('.form-error');
  const phone = quoteForm.querySelector('[name="phone"]');
  const email = quoteForm.querySelector('[name="email"]');

  const dateField = quoteForm.querySelector('input[type="date"]');
  if (dateField) dateField.min = new Date().toISOString().slice(0, 10);

  // Photo upload: show the chosen files so it feels real (owner receives them at go-live).
  const photos = quoteForm.querySelector('input[name="photos"]');
  const photoStatus = quoteForm.querySelector('#photo-status');
  if (photos && photoStatus) {
    photos.addEventListener('change', () => {
      const files = [...(photos.files || [])];
      photoStatus.textContent = files.length
        ? `${files.length} foto${files.length === 1 ? '' : "'s"} gekozen: ${files.slice(0, 3).map((f) => f.name).join(', ')}${files.length > 3 ? '…' : ''}`
        : '';
    });
  }

  // Prefill the housing/type select from ?service= when linked from a service card.
  const params = new URLSearchParams(location.search);
  const service = params.get('service');
  const typeSelect = quoteForm.querySelector('[name="housing-type"]');
  if (service && typeSelect) {
    const match = [...typeSelect.options].find((o) => o.value.toLowerCase().includes(service.toLowerCase()));
    if (match) typeSelect.value = match.value;
  }

  const showError = (message, field) => {
    if (error) { error.textContent = message; error.hidden = false; }
    if (field) field.focus();
  };

  quoteForm.addEventListener('input', (event) => {
    if (event.target && event.target.removeAttribute) event.target.removeAttribute('aria-invalid');
  });

  quoteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (error) error.hidden = true;

    const requiredInvalid = [...quoteForm.querySelectorAll('[required]')].filter(
      (f) => (f.type === 'checkbox' ? !f.checked : !f.checkValidity())
    );
    if (requiredInvalid.length) {
      requiredInvalid.forEach((f) => f.setAttribute('aria-invalid', 'true'));
      return showError('Controleer de gemarkeerde velden.', requiredInvalid[0]);
    }

    const hasPhone = phone && phone.value.trim();
    const hasEmail = email && email.value.trim();
    if (!hasPhone && !hasEmail) {
      phone && phone.setAttribute('aria-invalid', 'true');
      email && email.setAttribute('aria-invalid', 'true');
      return showError('Vul uw telefoonnummer óf e-mailadres in, zodat we u kunnen bereiken.', phone || email);
    }
    if (hasEmail && !email.checkValidity()) {
      email.setAttribute('aria-invalid', 'true');
      return showError('Controleer uw e-mailadres.', email);
    }

    if (quoteForm.dataset.submitMode === 'live') {
      const submit = quoteForm.querySelector('#submit-quote');
      if (submit) { submit.disabled = true; submit.textContent = 'Versturen…'; }
      quoteForm.submit();
      return;
    }

    const name = (quoteForm.querySelector('[name="name"]')?.value || '').trim();
    quoteForm.innerHTML = `<div class="success-state" role="status">`
      + `<p class="eyebrow">Aanvraag ontvangen</p>`
      + `<h2>Bedankt${name ? `, ${name}` : ''}! We nemen snel contact met u op.</h2>`
      + `<p>Busje komt zo belt of appt u persoonlijk om uw verhuizing door te nemen — vrijblijvend. Sneller schakelen? App of bel ons direct.</p>`
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
