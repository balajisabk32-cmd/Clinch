/**
 * CLINCH DealFlow360 — Master Application & Motion Controller (LIGHT THEME)
 * Features:
 * 1. Full-Page Intro Video Synchronization & Timeline Progress
 * 2. Signature FLIP Flight Transition ("Sit back to top right")
 * 3. Bidirectional Replay Engine
 * 4. Web Audio API Haptic Sound Synthesizer (Swoosh + Dock Chime)
 * 5. Interactive Quotation Builder & SHAP Risk Scorer Cockpit
 * 6. Warehouse Fulfillment Optimizer Mode Toggle
 * 7. Product Flow Diagram Lightbox
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // DOM Elements
  // ------------------------------------------------------------------------
  const introStage = document.getElementById('intro-stage');
  const introVideo = document.getElementById('intro-video');
  const introProgressFill = document.getElementById('intro-progress-fill');
  const btnEnterPlatform = document.getElementById('btn-enter-platform');
  const btnSkipIntro = document.getElementById('btn-skip-intro');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundToggleText = document.getElementById('sound-toggle-text');

  // Flight & Dock Elements
  const flyingLogo = document.getElementById('flying-logo-container');
  const flyingLogoImg = document.getElementById('flying-logo-img');
  const brandDock = document.getElementById('brand-dock');
  const dockLogoAnchor = document.getElementById('dock-logo-anchor');
  const dockLogoImg = document.getElementById('dock-logo-img');
  const dockReplayBtn = document.getElementById('dock-replay-btn');
  const landingContent = document.getElementById('landing-content');

  // Interactive Cockpit Elements
  const discountSlider = document.getElementById('discount-slider');
  const discountValBadge = document.getElementById('discount-val-badge');
  const marginBarFill = document.getElementById('margin-bar-fill');
  const marginValText = document.getElementById('margin-val-text');
  const scoreNumber = document.getElementById('score-number');
  const scoreStatus = document.getElementById('score-status');
  const shapServiceDelta = document.getElementById('shap-service-delta');
  const shapServiceItem = document.getElementById('shap-service-item');
  const shapZscore = document.getElementById('shap-zscore');
  const shapZscoreItem = document.getElementById('shap-zscore-item');
  const stepVpFinance = document.getElementById('step-vp-finance');
  const stepVpText = document.getElementById('step-vp-text');

  // Warehouse Split Elements
  const btnModeShipments = document.getElementById('btn-mode-shipments');
  const btnModeCost = document.getElementById('btn-mode-cost');
  const whAustinUnits = document.getElementById('wh-austin-units');
  const whChicagoUnits = document.getElementById('wh-chicago-units');
  const whSeattleUnits = document.getElementById('wh-seattle-units');
  const whMetricCost = document.getElementById('wh-metric-cost');
  const whMetricShipments = document.getElementById('wh-metric-shipments');

  // Lightbox Modal
  const btnViewFlow = document.getElementById('btn-view-flow');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxClose = document.getElementById('lightbox-close');

  // State
  let isSoundEnabled = true;
  let hasTransitioned = false;
  let isTransitioning = false;

  // ------------------------------------------------------------------------
  // Web Audio API Sound Engine (Procedural Haptics)
  // ------------------------------------------------------------------------
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Sci-fi flight swoosh
  function playFlightSwoosh() {
    if (!isSoundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1300, audioCtx.currentTime + 0.6);
      filter.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 1.1);

      osc.frequency.setValueAtTime(160, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, audioCtx.currentTime + 0.4);
      osc.frequency.exponentialRampToValueAtTime(240, audioCtx.currentTime + 1.1);

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.15);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Harmonic crystal chime for docking
  function playDockChime() {
    if (!isSoundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      [880, 1320, 1760].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.001, now + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.15 / (i + 1), now + i * 0.05 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.55);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Sound toggle
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      if (soundToggleText) {
        soundToggleText.textContent = isSoundEnabled ? 'Sound: On' : 'Sound: Muted';
      }
      soundToggleBtn.style.borderColor = isSoundEnabled ? 'var(--accent-cyan)' : 'var(--border-light)';
      initAudio();
    });
  }

  // ------------------------------------------------------------------------
  // Session Check: Play Intro Only Once, Do Not Repeat on Reload or Navigation
  // ------------------------------------------------------------------------
  const hasSeenIntro = (() => {
    try {
      return (
        sessionStorage.getItem('clinch_showcase_intro_seen') === 'true' ||
        localStorage.getItem('clinch_showcase_intro_seen') === 'true'
      );
    } catch (e) {
      return false;
    }
  })();

  if (hasSeenIntro) {
    hasTransitioned = true;
    isTransitioning = false;
    if (introStage) {
      introStage.classList.add('dismissed');
      introStage.style.display = 'none';
    }
    if (landingContent) {
      landingContent.classList.add('visible');
    }
    if (dockLogoImg) {
      dockLogoImg.classList.add('visible');
    }
    if (introVideo) {
      introVideo.pause();
      introVideo.currentTime = 0;
    }
  } else {
    // ------------------------------------------------------------------------
    // Video Playback & Auto-Progress Tracking (Runs exactly ONCE on initial load)
    // ------------------------------------------------------------------------
    if (introVideo) {
      introVideo.loop = false;
      const playPromise = introVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.log('Autoplay waiting for user gesture');
        });
      }

      const VIDEO_TRIM_SECONDS = 3.5; // Video animation duration trimmed to 3.5s

      introVideo.addEventListener('timeupdate', () => {
        // Automatically trigger flight when video reaches trimmed duration (3.5s)
        if (introVideo.currentTime >= VIDEO_TRIM_SECONDS && !hasTransitioned && !isTransitioning) {
          triggerFlightTransition();
        }
      });

      introVideo.addEventListener('ended', () => {
        if (!hasTransitioned && !isTransitioning) {
          triggerFlightTransition();
        }
      });

      // Safety ceiling: never trap user or allow repeating beyond 3.8s
      setTimeout(() => {
        if (!hasTransitioned && !isTransitioning) {
          triggerFlightTransition();
        }
      }, 3800);
    }
  }

  // Calculate pixel-exact rendered logo bounding rect inside fullscreen video
  function getCenteredLogoBounds() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const videoAspect = 16 / 9;
    let renderedW, renderedH;

    if (vw / vh > videoAspect) {
      renderedH = vh;
      renderedW = vh * videoAspect;
    } else {
      renderedW = vw;
      renderedH = vw / videoAspect;
    }

    // Inside the 1920x1080 video, the CLINCH logo is horizontally and vertically centered
    const logoW = Math.min(renderedW * 0.64, 850);
    const logoH = logoW * (680 / 2223);
    const left = (vw - logoW) / 2;
    const top = (vh - logoH) / 2;

    return { left, top, width: logoW, height: logoH };
  }

  // ------------------------------------------------------------------------
  // THE SIGNATURE FLIP FLIGHT TRANSITION ("Sit back to top right")
  // ------------------------------------------------------------------------
  function triggerFlightTransition() {
    if (isTransitioning) return;
    isTransitioning = true;
    hasTransitioned = true;

    // Halt video immediately and persist completion so it never repeats
    if (introVideo) {
      introVideo.pause();
    }
    try {
      sessionStorage.setItem('clinch_showcase_intro_seen', 'true');
      localStorage.setItem('clinch_showcase_intro_seen', 'true');
    } catch (e) {}

    initAudio();
    playFlightSwoosh();

    // The center logo coordinates matching the video position exactly
    const sourceRect = getCenteredLogoBounds();

    // Target rect: top right dock logo anchor
    const targetRect = dockLogoAnchor.getBoundingClientRect();

    // Prepare flying container with light theme transparent logo
    flyingLogo.style.display = 'block';
    flyingLogo.style.transition = 'none';
    flyingLogo.style.left = `${sourceRect.left}px`;
    flyingLogo.style.top = `${sourceRect.top}px`;
    flyingLogo.style.width = `${sourceRect.width}px`;
    flyingLogo.style.height = `${sourceRect.height}px`;
    flyingLogo.style.opacity = '1';
    flyingLogo.style.transform = 'translate3d(0, 0, 0) scale(1)';

    // Transparent logo with deep navy letters and cyan swoosh
    flyingLogoImg.src = 'CLINCH_LOGO_TRANSPARENT.png';

    // Dismiss intro stage
    introStage.classList.add('dismissed');

    // Reveal landing page content
    landingContent.classList.add('visible');

    // Force reflow
    void flyingLogo.offsetWidth;

    // Calculate translation deltas
    const deltaX = targetRect.left - sourceRect.left;
    const deltaY = targetRect.top - sourceRect.top;
    const scaleX = targetRect.width / sourceRect.width;

    // Execute flight animation with custom spring cubic-bezier
    const flightDuration = 1050; // ms
    flyingLogo.style.transition = `
      transform ${flightDuration}ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity ${flightDuration}ms ease
    `;
    
    // Scale and translate into top-right dock
    flyingLogo.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX})`;

    // Complete docking
    setTimeout(() => {
      playDockChime();

      // Show docked logo
      dockLogoImg.classList.add('visible');

      // Create docking ripple effect on brand dock
      const ripple = document.createElement('div');
      ripple.className = 'dock-ripple';
      brandDock.appendChild(ripple);
      setTimeout(() => ripple.remove(), 900);

      // Hide flying proxy
      flyingLogo.style.display = 'none';
      isTransitioning = false;

      // Pause intro video to save GPU
      if (introVideo) introVideo.pause();
    }, flightDuration);
  }

  // ------------------------------------------------------------------------
  // REVERSE FLIGHT: REPLAY INTRO
  // ------------------------------------------------------------------------
  function replayIntro() {
    if (isTransitioning) return;
    isTransitioning = true;
    hasTransitioned = false;

    initAudio();
    playFlightSwoosh();

    const videoOuter = document.querySelector('.intro-video-outer');
    const sourceRect = dockLogoAnchor.getBoundingClientRect();
    const targetRect = videoOuter ? videoOuter.getBoundingClientRect() : {
      left: window.innerWidth / 2 - 250,
      top: window.innerHeight / 2 - 140,
      width: 500,
      height: 280
    };

    // Hide docked logo image
    dockLogoImg.classList.remove('visible');

    // Setup flying logo at top-right dock position
    flyingLogo.style.display = 'block';
    flyingLogo.style.transition = 'none';
    flyingLogo.style.left = `${targetRect.left}px`;
    flyingLogo.style.top = `${targetRect.top}px`;
    flyingLogo.style.width = `${targetRect.width}px`;
    flyingLogo.style.height = `${targetRect.height}px`;

    const startDeltaX = sourceRect.left - targetRect.left;
    const startDeltaY = sourceRect.top - targetRect.top;
    const startScale = sourceRect.width / targetRect.width;

    flyingLogo.style.transform = `translate3d(${startDeltaX}px, ${startDeltaY}px, 0) scale(${startScale})`;
    flyingLogo.style.opacity = '1';

    // Show intro stage again
    introStage.classList.remove('dismissed');

    void flyingLogo.offsetWidth;

    // Fly back to center stage
    const flightDuration = 950;
    flyingLogo.style.transition = `
      transform ${flightDuration}ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity ${flightDuration}ms ease
    `;
    flyingLogo.style.transform = 'translate3d(0, 0, 0) scale(1)';

    setTimeout(() => {
      flyingLogo.style.display = 'none';
      isTransitioning = false;

      // Restart video
      if (introVideo) {
        introVideo.currentTime = 0;
        introVideo.play().catch(() => {});
      }
    }, flightDuration);
  }

  // Trigger listeners: Clicking anywhere on the fullscreen video intro proceeds to the landing page
  if (introStage) {
    introStage.addEventListener('click', () => {
      if (!hasTransitioned && !isTransitioning) {
        triggerFlightTransition();
      }
    });
  }

  if (btnEnterPlatform) {
    btnEnterPlatform.addEventListener('click', triggerFlightTransition);
  }
  if (btnSkipIntro) {
    btnSkipIntro.addEventListener('click', triggerFlightTransition);
  }

  // Keyboard shortcut: Press any key to proceed past the fullscreen intro
  window.addEventListener('keydown', (e) => {
    if (!hasTransitioned && !isTransitioning) {
      triggerFlightTransition();
    }
  });

  // ------------------------------------------------------------------------
  // INTERACTIVE DEMO 1: LIVE DISCOUNT SLIDER & DYNAMIC RISK SCORER
  // ------------------------------------------------------------------------
  if (discountSlider) {
    discountSlider.addEventListener('input', (e) => {
      const discount = parseInt(e.target.value, 10);
      discountValBadge.textContent = `${discount}% Off`;

      // Live Blended Margin calculation: Base 64% - (discount * 0.92)%
      const calculatedMargin = Math.max(24, Math.round(64 - discount * 0.92));
      marginValText.textContent = `${calculatedMargin}%`;
      marginBarFill.style.width = `${calculatedMargin}%`;

      // Risk score calculation (0 to 100)
      const baseRisk = 12;
      const riskScore = Math.min(96, Math.round(baseRisk + Math.pow(discount, 1.4) * 0.55));
      scoreNumber.textContent = riskScore;

      // Recolor Margin & Risk Score based on threshold tiers
      if (calculatedMargin >= 52) {
        // Safe Zone
        marginBarFill.style.background = 'var(--color-success)';
        marginBarFill.style.boxShadow = '0 0 12px var(--color-success-glow)';
        scoreNumber.style.color = 'var(--color-success)';
        scoreStatus.textContent = 'Safe Margin • Auto-Approved';
        scoreStatus.style.color = 'var(--text-pure)';

        shapServiceItem.classList.remove('flagged');
        shapServiceDelta.textContent = `Within category limit (${discount}% <= 15%)`;
        shapServiceDelta.className = 'shap-delta positive';

        shapZscoreItem.classList.remove('flagged');
        shapZscore.textContent = `+0.4σ (Normal Rep Range)`;
        shapZscore.className = 'shap-delta positive';

        stepVpFinance.className = 'step-node';
        stepVpText.textContent = 'Bypassed (Safe)';
        stepVpText.style.color = 'var(--text-muted)';
      } else if (calculatedMargin >= 42) {
        // Warning Zone
        marginBarFill.style.background = 'var(--color-warning)';
        marginBarFill.style.boxShadow = '0 0 12px var(--color-warning-glow)';
        scoreNumber.style.color = 'var(--color-warning)';
        scoreStatus.textContent = 'Moderate Risk • Manager Escalation';
        scoreStatus.style.color = 'var(--color-warning)';

        shapServiceItem.classList.add('flagged');
        shapServiceDelta.textContent = `+${discount - 15} pts over category threshold`;
        shapServiceDelta.className = 'shap-delta negative';

        shapZscoreItem.classList.remove('flagged');
        shapZscore.textContent = `+1.5σ (Approaching Limit)`;
        shapZscore.className = 'shap-delta';

        stepVpFinance.className = 'step-node';
        stepVpText.textContent = 'Pending Review';
        stepVpText.style.color = 'var(--color-warning)';
      } else {
        // Critical High Risk Zone
        marginBarFill.style.background = 'var(--color-danger)';
        marginBarFill.style.boxShadow = '0 0 12px var(--color-danger-glow)';
        scoreNumber.style.color = 'var(--color-danger)';
        scoreStatus.textContent = 'High Deal Risk • VP Approval Required';
        scoreStatus.style.color = 'var(--color-danger)';

        shapServiceItem.classList.add('flagged');
        shapServiceDelta.textContent = `+${discount - 15} pts over limit (Severe Margin Erosion)`;
        shapServiceDelta.className = 'shap-delta negative';

        shapZscoreItem.classList.add('flagged');
        shapZscore.textContent = `+2.8σ (Statistical Anomaly Flagged)`;
        shapZscore.className = 'shap-delta negative';

        stepVpFinance.className = 'step-node escalated';
        stepVpText.textContent = 'Auto-Escalated to VP Finance';
        stepVpText.style.color = 'var(--color-danger)';
      }
    });
  }

  // ------------------------------------------------------------------------
  // INTERACTIVE DEMO 2: WAREHOUSE SPLIT OPTIMIZER TOGGLE
  // ------------------------------------------------------------------------
  function setOptimizerMode(mode) {
    if (mode === 'shipments') {
      btnModeShipments.classList.add('active');
      btnModeCost.classList.remove('active');

      whAustinUnits.textContent = '40 Units';
      whChicagoUnits.textContent = '10 Units';
      whSeattleUnits.textContent = '0 Units';

      whMetricCost.textContent = '$140 Freight';
      whMetricShipments.textContent = '2 Consolidated Shipments';
    } else {
      btnModeCost.classList.add('active');
      btnModeShipments.classList.remove('active');

      whAustinUnits.textContent = '20 Units';
      whChicagoUnits.textContent = '18 Units';
      whSeattleUnits.textContent = '12 Units';

      whMetricCost.textContent = '$88 Freight';
      whMetricShipments.textContent = '3 Optimized Local Hubs';
    }
  }

  if (btnModeShipments && btnModeCost) {
    btnModeShipments.addEventListener('click', () => setOptimizerMode('shipments'));
    btnModeCost.addEventListener('click', () => setOptimizerMode('cost'));
  }

  // ------------------------------------------------------------------------
  // ARCHITECTURE FLOW DIAGRAM LIGHTBOX MODAL
  // ------------------------------------------------------------------------
  function openLightbox() {
    if (lightboxModal) {
      lightboxModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeLightbox() {
    if (lightboxModal) {
      lightboxModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (btnViewFlow) {
    btnViewFlow.addEventListener('click', openLightbox);
  }
  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // ------------------------------------------------------------------------
  // INTERACTIVE MULTI-PERSONA WORKSPACE CONTROLLER (Customer, Manager, Rep, Admin)
  // ------------------------------------------------------------------------
  const personaButtons = document.querySelectorAll('.persona-choice-btn');
  const personaDetailCard = document.getElementById('persona-detail-display');

  const PERSONA_DATA = {
    CUSTOMER: {
      title: 'Customer Workspace — John Acme (Acme Corp)',
      badge: 'Verified GOLD Tier Contract',
      badgeColor: '#d97706',
      desc: 'Self-service Magic Link checkout portal. Automatically views exclusive Gold Tier contract pricing (20% off master catalog), real-time inventory reservations, and 1-click quote acceptance.',
      creds: 'customer@acmecorp.com (Passwordless Magic Link Token)',
      primaryAction: { label: 'Launch Customer Portal', url: 'http://localhost:5000' },
      secondaryAction: { label: 'View Portal Feature Guide', scrollTarget: '#portal-section' }
    },
    MANAGER: {
      title: 'Sales Operations Manager Desk — Bob Manager',
      badge: 'Margin Governance & Approval Authority',
      badgeColor: '#4f46e5',
      desc: 'Supervises sales reps, reviews deals triggering margin escalation (15%–25% discount band), evaluates blended SHAP risk indicators, and approves/rejects quotation queues.',
      creds: 'manager@dealflow360.com • Pass: Password123!',
      primaryAction: { label: 'Open Deal Health Suite (:4000)', url: 'http://localhost:4000' },
      secondaryAction: { label: 'Open Manager Bench (:5000)', url: 'http://localhost:5000' }
    },
    REP: {
      title: 'Sales Representative Cockpit — Alice Sales',
      badge: 'Dynamic CPQ & Quotation Builder',
      badgeColor: '#0284c7',
      desc: 'Assembles multi-line quotes across Hardware, Services, and Subscriptions. Receives automated ML risk calculations, real-time margin warnings, and suggested add-on recommendations.',
      creds: 'rep@dealflow360.com • Pass: Password123!',
      primaryAction: { label: 'Test Live Risk Cockpit', scrollTarget: '#demo-cockpit' },
      secondaryAction: { label: 'Open Rep CPQ Bench (:5000)', url: 'http://localhost:5000' }
    },
    ADMIN: {
      title: 'RevOps Administrator Console — Dave Admin',
      badge: 'Master Platform Control',
      badgeColor: '#00a3e0',
      desc: 'Full administrative rights across the DealFlow360 platform: configure pricing rules, approval policies, warehouse split thresholds, and customer tiers.',
      creds: 'admin@dealflow360.com • Pass: Password123!',
      primaryAction: { label: 'Open Admin Portal (:5173/app/admin)', url: 'http://localhost:5173/app/admin' },
      secondaryAction: { label: 'Sign In via Workspace (:5173/login)', url: 'http://localhost:5173/login' }
    }
  };

  function renderPersonaDetails(roleKey) {
    const data = PERSONA_DATA[roleKey];
    if (!data || !personaDetailCard) return;

    personaButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-role') === roleKey);
    });

    personaDetailCard.innerHTML = `
      <div class="persona-detail-info">
        <div class="persona-detail-role">
          ${data.title}
          <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: ${data.badgeColor}18; color: ${data.badgeColor}; border: 1px solid ${data.badgeColor}40; font-weight: 700;">
            ${data.badge}
          </span>
        </div>
        <p class="persona-detail-desc">${data.desc}</p>
        <div class="persona-detail-creds">
          <span style="font-weight: 600;">Credentials:</span>
          <strong>${data.creds}</strong>
        </div>
      </div>
      <div class="persona-detail-actions">
        ${data.primaryAction.url 
          ? `<a href="${data.primaryAction.url}" target="_blank" class="persona-action-btn primary">${data.primaryAction.label}</a>` 
          : `<button class="persona-action-btn primary" onclick="document.querySelector('${data.primaryAction.scrollTarget}').scrollIntoView({behavior: 'smooth'})">${data.primaryAction.label}</button>`}
        ${data.secondaryAction.url 
          ? `<a href="${data.secondaryAction.url}" target="_blank" class="persona-action-btn secondary">${data.secondaryAction.label}</a>` 
          : `<button class="persona-action-btn secondary" onclick="document.querySelector('${data.secondaryAction.scrollTarget}').scrollIntoView({behavior: 'smooth'})">${data.secondaryAction.label}</button>`}
      </div>
    `;
  }

  personaButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-role');
      renderPersonaDetails(role);
    });
  });

  // Render initial default (Customer as requested)
  renderPersonaDetails('CUSTOMER');
});
