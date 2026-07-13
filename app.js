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
      
      // Simulate API submit latency (1.5 seconds)
      setTimeout(() => {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
        
        // Show success modal
        openModal();
        
        // Reset form inputs
        form.reset();
      }, 1500);
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
