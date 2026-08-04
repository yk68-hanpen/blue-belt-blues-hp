/**
 * Blue Belt Blues - Interactivity & Logic Script
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. Sticky Navigation Bar Scroll Effect
  // ==========================================
  const header = document.getElementById('main-header');
  const scrollThreshold = 50;

  const handleScroll = () => {
    if (window.scrollY > scrollThreshold) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Initial check


  // ==========================================
  // 2. Mobile Menu Toggle
  // ==========================================
  const menuToggle = document.getElementById('menu-toggle');
  const mainNav = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.nav-link');

  const toggleMenu = () => {
    menuToggle.classList.toggle('active');
    mainNav.classList.toggle('active');
    
    // Toggle body scrolling when menu is open
    const isOpen = mainNav.classList.contains('active');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    menuToggle.setAttribute('aria-expanded', isOpen);
  };

  menuToggle.addEventListener('click', toggleMenu);

  // Close mobile menu when a nav link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mainNav.classList.contains('active')) {
        toggleMenu();
      }
    });
  });


  // ==========================================
  // 3. Scroll Reveal Animations (Intersection Observer)
  // ==========================================
  const revealElements = document.querySelectorAll(
    '.scroll-reveal, .scroll-reveal-up, .scroll-reveal-left, .scroll-reveal-right'
  );

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Unobserve after revealing to prevent repeated animations
        observer.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));


  // ==========================================
  // 4. Contact Form Validation & Submission
  // ==========================================
  const form = document.getElementById('contact-form');
  const submitBtn = document.getElementById('form-submit-btn');
  const successModal = document.getElementById('success-modal');

  // Discord webhook that receives instant notifications of new submissions.
  const DISCORD_WEBHOOK_URL =
    'https://discord.com/api/webhooks/1534182564036874351/RiNeCzoyW1Id_uUpJpnpq27zxlVwjjQOSYHYuStSdnBgv0KUDHa1NTrxTsuVVTSsQMeE';
  
  // Modal toggle elements
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalBackdrop = document.getElementById('modal-close-backdrop');

  // Input elements matching the new Blue Belt Blues Form
  const fields = {
    name: {
      input: document.getElementById('form-name'),
      group: document.getElementById('form-name').parentElement,
      validate: (val) => val.trim().length > 0
    },
    email: {
      input: document.getElementById('form-email'),
      group: document.getElementById('form-email').parentElement,
      validate: (val) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(val.trim());
      }
    },
    experience: {
      input: document.getElementById('form-experience'),
      group: document.getElementById('form-experience').parentElement,
      validate: (val) => val !== ''
    },
    consent: {
      input: document.getElementById('form-consent-check'),
      group: document.getElementById('form-consent-check').closest('.form-consent-bbb'),
      validate: (val, inputEl) => inputEl.checked
    }
  };

  // Helper to remove invalid styling
  const clearInvalidState = (fieldKey) => {
    fields[fieldKey].group.classList.remove('is-invalid');
  };

  // Helper to mark field invalid
  const markInvalidState = (fieldKey) => {
    fields[fieldKey].group.classList.add('is-invalid');
  };

  // Real-time validation listeners on input
  Object.keys(fields).forEach(key => {
    const field = fields[key];
    const eventType = field.input.tagName === 'SELECT' || field.input.type === 'checkbox' ? 'change' : 'input';
    
    field.input.addEventListener(eventType, () => {
      if (field.validate(field.input.value, field.input)) {
        clearInvalidState(key);
      }
    });
  });

  // Form submission handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let isFormValid = true;
    
    // Check all fields
    Object.keys(fields).forEach(key => {
      const field = fields[key];
      const isValid = field.validate(field.input.value, field.input);
      
      if (!isValid) {
        markInvalidState(key);
        isFormValid = false;
      } else {
        clearInvalidState(key);
      }
    });

    if (isFormValid) {
      // Set submit button to loading state
      const originalText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `送信中... <i class="fa-solid fa-spinner fa-spin icon-right"></i>`;

      // Build a formatted Discord notification from the current form values.
      const expSelect = document.getElementById('form-experience');
      const experienceText = expSelect.options[expSelect.selectedIndex]?.text || '(未選択)';
      const discordPayload = {
        username: 'Blue Belt Blues 体験申込',
        embeds: [{
          title: '🥋 新しい体験・見学の申込',
          color: 0x1e60d8,
          fields: [
            { name: 'お名前', value: fields.name.input.value.trim() || '(未入力)' },
            { name: 'メールアドレス', value: fields.email.input.value.trim() || '(未入力)' },
            { name: '経験有無', value: experienceText },
            { name: 'メッセージ', value: document.getElementById('form-message').value.trim() || '(なし)' }
          ]
        }]
      };

      // Notify Discord (fire-and-forget). The webhook URL is exposed in this
      // static page by design; regenerate it in Discord if it is ever abused.
      const notifyDiscord = fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload)
      }).catch(() => {});

      // Submit to Formspree (email record). The recipient address is configured
      // on the Formspree side, so it is never exposed in this page. Success of
      // this request gates the confirmation modal.
      const submitFormspree = fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      Promise.allSettled([submitFormspree, notifyDiscord])
        .then(([formspreeResult]) => {
          const ok = formspreeResult.status === 'fulfilled' && formspreeResult.value.ok;
          if (ok) {
            openModal();
            form.reset();
          } else {
            alert('送信に失敗しました。時間をおいて再度お試しください。');
          }
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.innerText = originalText;
        });
    } else {
      // Scroll to the first invalid field for better UX
      const firstInvalid = document.querySelector('.is-invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });


  // ==========================================
  // 5. Modal Functions (Success Handling)
  // ==========================================
  const openModal = () => {
    successModal.classList.add('active');
    successModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Stop background scroll
    modalConfirmBtn.focus();
  };

  const closeModal = () => {
    successModal.classList.remove('active');
    successModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Resume background scroll
  };

  // Modal events
  modalCloseBtn.addEventListener('click', closeModal);
  modalConfirmBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && successModal.classList.contains('active')) {
      closeModal();
    }
  });
});
