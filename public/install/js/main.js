/* ================================================
   ClassMate PWA Installation Landing Page
   Robust PWA Install Manager & Page Interactions
   ================================================ */

(function () {
  'use strict';

  /* ------------------------------------------------
     1. Development Debug Logger
     ------------------------------------------------ */
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const hasDebugQuery = location.search.includes('debug=1');
  const DEBUG = window.__CLASSMATE_DEBUG__ || isLocal || hasDebugQuery;

  function log(event, data) {
    if (DEBUG) {
      if (data !== undefined) {
        console.log(`%c[ClassMate Install]%c ${event}`, 'color: #2dd4bf; font-weight: bold;', 'color: inherit;', data);
      } else {
        console.log(`%c[ClassMate Install]%c ${event}`, 'color: #2dd4bf; font-weight: bold;', 'color: inherit;');
      }
    }
  }

  /* ------------------------------------------------
     2. State Machine & Variables
     ------------------------------------------------ */
  const States = {
    LOADING: 'loading',
    INSTALLABLE: 'installable',
    INSTALLING: 'installing',
    INSTALLED: 'installed',
    ALREADY_INSTALLED: 'alreadyInstalled',
    IOS_MANUAL: 'iosManualInstall',
    ANDROID_MANUAL: 'androidManual',
    IN_APP_BROWSER: 'inAppBrowser',
    UNSUPPORTED: 'unsupported'
  };

  let currentState = States.LOADING;
  let deferredPrompt = window.__CLASSMATE_INSTALL__?.deferredPrompt || null;
  let isPageLoaded = document.readyState === 'complete';
  let initialPromptWaitTimer = null;
  let activeModal = null;
  let toastTimer = null;
  let hasNavigatedToApp = false;

  function goToMainApp(useReplace = false) {
    if (hasNavigatedToApp) return;
    hasNavigatedToApp = true;
    log('Navigating to Main ClassMate App at /');
    if (useReplace) {
      window.location.replace('/');
    } else {
      window.location.href = '/';
    }
  }

  // Track experience section
  let experienceTimer = null;
  let currentExperienceStep = 0;
  const totalExperienceSteps = 4;

  /* ------------------------------------------------
     3. DOM Element References
     ------------------------------------------------ */
  const installButtons = document.querySelectorAll('[data-install-btn]');
  const installStateContainers = {
    installable: document.querySelector('[data-install-state="installable"]'),
    installed: document.querySelector('[data-install-state="installed"]'),
    manual: document.querySelector('[data-install-state="manual"]')
  };
  const installStateNote = document.getElementById('installStateNote');
  const scrollIndicator = document.getElementById('scrollIndicator');
  const toastEl = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  const modals = {
    android: document.getElementById('androidModal'),
    ios: document.getElementById('iosModal'),
    inApp: document.getElementById('inAppModal'),
    desktop: document.getElementById('desktopModal')
  };

  /* ------------------------------------------------
     4. Platform & Environment Detection
     ------------------------------------------------ */
  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    // Detect Facebook App (FBAN/FBAV), Instagram, Line, Twitter/X, WeChat, Snapchat, Pinterest, and generic Android WebView (wv)
    return /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|MicroMessenger|Pinterest/i.test(ua) ||
           (/\bwv\b/.test(ua) && /Android/i.test(ua));
  }

  function isStandalone() {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches ||
                            window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                            window.matchMedia('(display-mode: fullscreen)').matches ||
                            window.matchMedia('(display-mode: minimal-ui)').matches;
    const iosStandalone = window.navigator.standalone === true;
    const androidTwa = typeof document !== 'undefined' && document.referrer.includes('android-app://');

    return Boolean(standaloneMedia || iosStandalone || androidTwa);
  }

  /* ------------------------------------------------
     5. Toast Notification Helper
     ------------------------------------------------ */
  function showToast(message, isSuccess = false) {
    if (!toastEl || !toastMsg) return;
    clearTimeout(toastTimer);

    toastMsg.textContent = message;
    if (toastIcon) {
      if (isSuccess) {
        toastIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      } else {
        toastIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      }
    }

    toastEl.hidden = false;
    toastEl.offsetHeight; // reflow
    toastEl.classList.add('toast--visible');

    toastTimer = setTimeout(() => {
      toastEl.classList.remove('toast--visible');
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 3200);
  }

  /* ------------------------------------------------
     6. Modal Management (with accessibility & escape)
     ------------------------------------------------ */
  function openModal(modalKey) {
    const modal = modals[modalKey];
    if (!modal) return;

    if (activeModal && activeModal !== modal) {
      closeModal(activeModal);
    }

    activeModal = modal;
    modal.hidden = false;
    modal.offsetHeight; // force reflow for smooth transition
    modal.classList.add('modal--visible');
    document.body.style.overflow = 'hidden';

    // Focus close button or first action
    const closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) closeBtn.focus();

    log('modal opened:', modalKey);
  }

  function closeModal(targetModal) {
    const modal = targetModal || activeModal;
    if (!modal) return;

    modal.classList.remove('modal--visible');
    document.body.style.overflow = '';
    setTimeout(() => {
      modal.hidden = true;
      if (activeModal === modal) activeModal = null;
    }, 350);
  }

  // Setup modal handlers
  Object.values(modals).forEach(modal => {
    if (!modal) return;
    modal.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(modal);
      });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) {
      closeModal(activeModal);
    }
  });

  /* ------------------------------------------------
     7. UI Synchronization & Button States
     ------------------------------------------------ */
  function updateButtonUI(btn, text, options = {}) {
    if (!btn) return;
    const textSpan = btn.querySelector('.btn__text');
    if (textSpan) {
      textSpan.textContent = text;
    } else {
      btn.textContent = text;
    }

    btn.classList.toggle('btn--loading', Boolean(options.loading));
    btn.classList.toggle('btn--installing', Boolean(options.installing));
    btn.classList.toggle('btn--installed', Boolean(options.installed));

    if (options.installed) {
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'ClassMate is already installed';
    } else {
      btn.removeAttribute('aria-disabled');
      btn.title = text;
    }
  }

  function syncAllButtons(text, options = {}) {
    installButtons.forEach(btn => updateButtonUI(btn, text, options));
  }

  function renderState() {
    log('renderState:', currentState);

    // Hide all install-state card variants first
    Object.values(installStateContainers).forEach(el => {
      if (el) el.hidden = true;
    });

    switch (currentState) {
      case States.ALREADY_INSTALLED:
      case States.INSTALLED: {
        if (installStateContainers.installed) {
          installStateContainers.installed.hidden = false;
        }
        syncAllButtons('Installed', { installed: true });
        break;
      }

      case States.INSTALLING: {
        if (installStateContainers.installable) {
          installStateContainers.installable.hidden = false;
        }
        syncAllButtons('Installing…', { installing: true });
        break;
      }

      case States.INSTALLABLE: {
        if (installStateContainers.installable) {
          installStateContainers.installable.hidden = false;
        }
        syncAllButtons('Install ClassMate');
        if (installStateNote) {
          installStateNote.textContent = isAndroid()
            ? 'Tap to install ClassMate directly on your Android device.'
            : 'Install ClassMate on your device and launch it like a native app.';
        }
        break;
      }

      case States.LOADING: {
        if (installStateContainers.installable) {
          installStateContainers.installable.hidden = false;
        }
        syncAllButtons('Install ClassMate');
        break;
      }

      case States.IOS_MANUAL:
      case States.ANDROID_MANUAL:
      case States.IN_APP_BROWSER:
      case States.UNSUPPORTED:
      default: {
        if (installStateContainers.installable) {
          installStateContainers.installable.hidden = false;
        }
        syncAllButtons('Install ClassMate');
        if (installStateNote) {
          if (isAndroid()) {
            installStateNote.textContent = 'Tap to install ClassMate via Chrome.';
          } else if (isIOS()) {
            installStateNote.textContent = 'Tap to view quick install steps for Safari on iPhone.';
          } else {
            installStateNote.textContent = 'Install once. Keep ClassMate one tap away.';
          }
        }
        break;
      }
    }
  }

  function setState(nextState) {
    if (currentState === nextState) return;
    log(`State transition: ${currentState} -> ${nextState}`);
    currentState = nextState;
    renderState();
  }

  /* ------------------------------------------------
     8. Fallback Guide Dispatcher
     ------------------------------------------------ */
  function showFallbackGuide() {
    log('fallback selected');

    if (isInAppBrowser()) {
      openModal('inApp');
      return;
    }

    if (isIOS()) {
      openModal('ios');
      return;
    }

    if (isAndroid()) {
      openModal('android');
      return;
    }

    openModal('desktop');
  }

  /* ------------------------------------------------
     9. Install Action Handler (User Click)
     ------------------------------------------------ */
  async function handleInstallClick(e) {
    if (e) e.preventDefault();
    log('install button clicked');

    // 1. If already installed, give clean feedback and navigate to app
    if (currentState === States.ALREADY_INSTALLED || currentState === States.INSTALLED || isStandalone()) {
      showToast('ClassMate is already installed on your device.', true);
      setTimeout(() => {
        goToMainApp();
      }, 500);
      return;
    }

    // 2. Prevent duplicate concurrent prompt calls
    if (currentState === States.INSTALLING) {
      log('Install currently in progress, ignoring duplicate tap');
      return;
    }

    // 3. If native prompt is ready, trigger it
    if (deferredPrompt) {
      await triggerNativePrompt();
      return;
    }

    // 4. If prompt is not yet ready, handle appropriately
    if (isInAppBrowser()) {
      openModal('inApp');
      return;
    }

    if (isIOS()) {
      openModal('ios');
      return;
    }

    // On Android or Desktop Chrome, beforeinstallprompt might still be preparing
    if (currentState === States.LOADING) {
      log('Prompt not yet cached, temporarily waiting for beforeinstallprompt...');
      syncAllButtons('Preparing install…', { loading: true });

      // Wait up to 1000ms for beforeinstallprompt
      const promptArrived = await new Promise((resolve) => {
        let timer = null;
        const checkHandler = (e) => {
          clearTimeout(timer);
          resolve(e);
        };

        if (window.__CLASSMATE_INSTALL__) {
          window.__CLASSMATE_INSTALL__.listeners.push(checkHandler);
        }

        timer = setTimeout(() => {
          resolve(null);
        }, 1000);
      });

      if (promptArrived && deferredPrompt) {
        log('Prompt arrived during wait period!');
        await triggerNativePrompt();
        return;
      }
    }

    // 5. If beforeinstallprompt is unavailable, open the fallback guide
    // NEVER ALLOW A TAP TO SILENTLY FAIL!
    log('beforeinstallprompt unavailable, opening manual installation instructions');
    renderState();
    showFallbackGuide();
  }

  /* ------------------------------------------------
     10. Native Prompt Execution
     ------------------------------------------------ */
  async function triggerNativePrompt() {
    if (!deferredPrompt) return;

    try {
      setState(States.INSTALLING);
      log('prompt called');

      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      log('userChoice result:', choiceResult?.outcome);

      if (choiceResult && choiceResult.outcome === 'accepted') {
        log('User accepted installation');
        deferredPrompt = null;
        if (window.__CLASSMATE_INSTALL__) {
          window.__CLASSMATE_INSTALL__.deferredPrompt = null;
        }
        setState(States.INSTALLED);
        showToast('ClassMate installed successfully!', true);
        setTimeout(() => {
          goToMainApp();
        }, 600);
      } else {
        log('User dismissed install prompt');
        // Once prompted, Chromium consumes the event and it cannot be reused
        deferredPrompt = null;
        if (window.__CLASSMATE_INSTALL__) {
          window.__CLASSMATE_INSTALL__.deferredPrompt = null;
        }
        // Fall back to manual guide state so the button remains helpful
        if (isAndroid()) {
          setState(States.ANDROID_MANUAL);
        } else if (isIOS()) {
          setState(States.IOS_MANUAL);
        } else {
          setState(States.UNSUPPORTED);
        }
      }
    } catch (err) {
      console.warn('[ClassMate Install] prompt error:', err);
      deferredPrompt = null;
      setState(isAndroid() ? States.ANDROID_MANUAL : States.UNSUPPORTED);
      showFallbackGuide();
    }
  }

  /* ------------------------------------------------
     11. Event Listeners for PWA Installability
     ------------------------------------------------ */
  function onPromptCaptured(e) {
    e.preventDefault();
    deferredPrompt = e;
    log('beforeinstallprompt fired');
    log('deferred prompt stored');

    if (currentState !== States.INSTALLED && currentState !== States.ALREADY_INSTALLED) {
      setState(States.INSTALLABLE);
    }
  }

  function onAppInstalled() {
    log('appinstalled fired');
    deferredPrompt = null;
    if (window.__CLASSMATE_INSTALL__) {
      window.__CLASSMATE_INSTALL__.deferredPrompt = null;
    }
    setState(States.INSTALLED);
    showToast('ClassMate installed successfully!', true);
    setTimeout(() => {
      goToMainApp();
    }, 600);
  }

  // Bind early capture listeners from <head>
  if (window.__CLASSMATE_INSTALL__) {
    if (window.__CLASSMATE_INSTALL__.deferredPrompt) {
      onPromptCaptured(window.__CLASSMATE_INSTALL__.deferredPrompt);
    }
    window.__CLASSMATE_INSTALL__.listeners.push(onPromptCaptured);
    window.__CLASSMATE_INSTALL__.installedListeners.push(onAppInstalled);
  }

  // Standard window listeners (in case head script wasn't present or for future events)
  window.addEventListener('beforeinstallprompt', onPromptCaptured);
  window.addEventListener('appinstalled', onAppInstalled);

  // Bind all install buttons
  installButtons.forEach(btn => {
    btn.addEventListener('click', handleInstallClick);
  });

  /* ------------------------------------------------
     12. Service Worker Registration
     ------------------------------------------------ */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Support both standalone installer and same-origin /install deployment
      const isInstallSubpath = location.pathname.startsWith('/install');
      const swPath = isInstallSubpath ? '/firebase-messaging-sw.js' : 'sw.js';
      const swScope = isInstallSubpath ? '/' : './';

      const register = () => {
        navigator.serviceWorker.register(swPath, { scope: swScope })
          .then((reg) => {
            log('ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            log('ServiceWorker registration error:', err);
          });
      };

      if (document.readyState === 'complete') {
        register();
      } else {
        window.addEventListener('load', register);
      }
    }
  }

  /* ------------------------------------------------
     13. Experience Showcase Auto-Cycle
     ------------------------------------------------ */
  function initExperienceFlow() {
    const flow = document.querySelector('.experience__flow');
    const steps = document.querySelectorAll('.experience__step');
    const indicators = document.querySelectorAll('.experience__indicator');

    if (!flow || steps.length === 0) return;

    function goToStep(index) {
      currentExperienceStep = index;
      flow.style.transform = `translateX(-${index * 100}%)`;

      steps.forEach((step, i) => {
        step.classList.toggle('experience__step--active', i === index);
      });

      indicators.forEach((ind, i) => {
        ind.classList.toggle('experience__indicator--active', i === index);
      });
    }

    function startCycle() {
      if (experienceTimer) clearInterval(experienceTimer);
      experienceTimer = setInterval(() => {
        const next = (currentExperienceStep + 1) % totalExperienceSteps;
        goToStep(next);
      }, 3200);
    }

    function stopCycle() {
      if (experienceTimer) {
        clearInterval(experienceTimer);
        experienceTimer = null;
      }
    }

    indicators.forEach(ind => {
      ind.addEventListener('click', () => {
        const target = parseInt(ind.dataset.goto, 10);
        stopCycle();
        goToStep(target);
        setTimeout(startCycle, 5000);
      });
    });

    const expObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startCycle();
        } else {
          stopCycle();
        }
      });
    }, { threshold: 0.25 });

    const experienceSection = document.querySelector('.section--experience');
    if (experienceSection) {
      expObserver.observe(experienceSection);
    }
  }

  /* ------------------------------------------------
     14. Scroll Indicator & Navigation Scroll
     ------------------------------------------------ */
  function initNavigation() {
    if (scrollIndicator) {
      scrollIndicator.addEventListener('click', () => {
        const target = document.getElementById('problem');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    const nav = document.querySelector('.nav');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 40) {
            nav.style.background = 'rgba(5, 5, 8, 0.92)';
          } else {
            nav.style.background = 'rgba(5, 5, 8, 0.7)';
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ------------------------------------------------
     15. Scroll Animations (Reduced-Motion aware)
     ------------------------------------------------ */
  function initScrollAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      document.querySelectorAll('.anim-fade-in, .anim-reveal').forEach(el => {
        el.classList.add('is-visible');
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    });

    // Reveal hero immediately
    document.querySelectorAll('.hero .anim-fade-in').forEach(el => {
      setTimeout(() => el.classList.add('is-visible'), 50);
    });

    // Reveal on scroll
    document.querySelectorAll('.anim-reveal').forEach(el => {
      observer.observe(el);
    });
  }

  /* ------------------------------------------------
     16. Initialization
     ------------------------------------------------ */
  function init() {
    log('Initializing ClassMate Install Manager');

    // Check standalone first: if running in standalone mode on /install, redirect to /
    if (isStandalone() && window.location.pathname.startsWith('/install')) {
      log('standalone state detected on /install, redirecting to /');
      goToMainApp(true);
      return;
    }

    if (isStandalone()) {
      log('standalone state detected');
      setState(States.ALREADY_INSTALLED);
    } else if (deferredPrompt) {
      setState(States.INSTALLABLE);
    } else if (isInAppBrowser()) {
      setState(States.IN_APP_BROWSER);
    } else if (isIOS()) {
      setState(States.IOS_MANUAL);
    } else {
      setState(States.LOADING);

      // If beforeinstallprompt hasn't arrived within 2.5 seconds of load, transition to platform manual state
      initialPromptWaitTimer = setTimeout(() => {
        if (currentState === States.LOADING) {
          if (isAndroid()) {
            setState(States.ANDROID_MANUAL);
          } else {
            setState(States.UNSUPPORTED);
          }
        }
      }, 2500);
    }

    registerServiceWorker();
    initNavigation();
    initExperienceFlow();
    initScrollAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
