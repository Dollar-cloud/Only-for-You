/**
 * CINEMATIC VALENTINE — Vanilla JS
 * Load sequence, 3D hearts, cursor follow, typewriter, interactions
 * 60fps-safe: transform + opacity only
 */

(function () {
  'use strict';

  // --- Config ---
  const TYPEWRITER_TEXT = 'Some feelings don\'t need loud words. They just need to be felt.';
  const TYPEWRITER_DELAY_MS = 70;
  const FLOATING_HEARTS_COUNT = 12;
  const CURSOR_HEARTS_COUNT = 4;
  const BURST_HEARTS_COUNT = 8;
  const LERP = 0.08; // cursor follow smoothness
  const TILT_MAX = 6; // degrees for card tilt

  // --- DOM refs ---
  const body = document.body;
  const page = document.getElementById('page');
  const heartsContainer = document.getElementById('hearts-container');
  const typewriterWrapper = document.getElementById('typewriter-wrapper');
  const typewriterCaret = document.getElementById('typewriter-caret');
  const ctaButton = document.getElementById('cta-button');
  const heartBurstContainer = document.getElementById('heart-burst-container');
  const glowPulse = document.getElementById('glow-pulse');
  const rippleContainer = document.getElementById('ripple-container');
  const cursorHeartsEl = document.getElementById('cursor-hearts');
  const heroScrollBtn = document.getElementById('hero-scroll-btn');
  const messageSection = document.getElementById('message');

  // --- Shared AudioContext (must be resumed on user gesture for mobile) ---
  let audioContext = null;
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  // Unlock audio on first touch/click anywhere (required for mobile)
  function unlockAudio() {
    var ctx = getAudioContext();
    if (ctx.state !== 'running') {
      ctx.resume().catch(function () {});
    }
  }
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('touchend', unlockAudio, { once: true, passive: true });
  document.addEventListener('click', unlockAudio, { once: true });

  function playScrollSound() {
    var ctx = getAudioContext();
    ctx.resume().then(function () {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.08);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } catch (e) {}
    }).catch(function () {});
  }

  // --- Touch / "Feel the Moment" sound — soft romantic chime ---
  function playTouchSound() {
    var ctx = getAudioContext();
    ctx.resume().then(function () {
      try {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99];
        notes.forEach(function (freq, i) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, now);
          osc.type = 'sine';
          const t0 = now + i * 0.06;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
          osc.start(t0);
          osc.stop(t0 + 0.4);
        });
      } catch (e) {}
    }).catch(function () {});
  }

  // --- Hero "Let's click here" button: scroll to next section + sound ---
  if (heroScrollBtn && messageSection) {
    heroScrollBtn.addEventListener('click', function (e) {
      e.preventDefault();
      playScrollSound();
      messageSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // --- Load sequence ---
  function runLoadSequence() {
    // 1. Background fades in
    body.classList.add('loaded');

    // 2. Floating hearts appear slowly (staggered)
    spawnFloatingHearts();

    // 3. Hero content already fades in via CSS when body.loaded
  }

  function spawnFloatingHearts() {
    if (!heartsContainer) return;
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 600;
    const count = isNarrow ? Math.min(6, FLOATING_HEARTS_COUNT) : FLOATING_HEARTS_COUNT;
    const symbols = ['❤️', '💕', '💖', '💗', '💓'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'heart-float';
      el.textContent = symbols[i % symbols.length];
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const z = -150 + Math.random() * 300; // depth for 3D
      el.style.left = x + '%';
      el.style.top = y + '%';
      el.style.setProperty('--z', z + 'px');
      el.style.animationDelay = (i * 0.4) + 's';
      heartsContainer.appendChild(el);
      // Reveal after stagger
      setTimeout(function () {
        el.classList.add('visible');
      }, 800 + i * 120);
    }
  }

  // --- Cursor-follow hearts (desktop, soft follow with 3D depth) ---
  let mouseX = 0, mouseY = 0;
  let cursorHearts = [];
  let rafId = null;

  function initCursorHearts() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    for (let i = 0; i < CURSOR_HEARTS_COUNT; i++) {
      const el = document.createElement('span');
      el.className = 'cursor-heart';
      el.textContent = ['❤️', '💕', '💖', '💗'][i % 4];
      const z = -30 + i * 20;
      el.style.setProperty('--z', z + 'px');
      el.style.left = '50%';
      el.style.top = '50%';
      cursorHeartsEl.appendChild(el);
      cursorHearts.push({ el, x: 0, y: 0, targetX: 0, targetY: 0 });
    }
    document.addEventListener('mousemove', onMouseMove);
    tickCursorHearts();
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function tickCursorHearts() {
    cursorHearts.forEach(function (h, i) {
      const offset = (i - CURSOR_HEARTS_COUNT / 2) * 15;
      h.targetX = mouseX + offset;
      h.targetY = mouseY + offset;
      h.x += (h.targetX - h.x) * LERP;
      h.y += (h.targetY - h.y) * LERP;
      h.el.style.left = h.x + 'px';
      h.el.style.top = h.y + 'px';
    });
    rafId = requestAnimationFrame(tickCursorHearts);
  }

  // --- 3D card tilt (glass cards on mousemove) ---
  const cards = document.querySelectorAll('.glass-card');
  function initCardTilt() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        const rotateX = -dy * TILT_MAX;
        const rotateY = dx * TILT_MAX;
        card.style.transform = 'perspective(1000px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateZ(10px)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  // --- Click: heart ripple (3D pop at cursor) ---
  function onDocumentClick(e) {
    const heart = document.createElement('span');
    heart.className = 'ripple-heart';
    heart.textContent = '❤️';
    heart.style.left = e.clientX + 'px';
    heart.style.top = e.clientY + 'px';
    rippleContainer.appendChild(heart);
    setTimeout(function () {
      heart.remove();
    }, 1100);
  }
  document.addEventListener('click', onDocumentClick);

  // --- Section 3: CTA button — sound + heart burst + glow pulse ---
  var ctaHandled = false;
  function onCtaClick(e) {
    if (ctaHandled) return;
    ctaHandled = true;
    setTimeout(function () { ctaHandled = false; }, 500);
    playTouchSound();
    const rect = ctaButton.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Heart burst (outward from button, with translateZ in CSS)
    for (let i = 0; i < BURST_HEARTS_COUNT; i++) {
      const angle = (i / BURST_HEARTS_COUNT) * Math.PI * 2;
      const dist = 80 + Math.random() * 40;
      const tx = Math.cos(angle) * dist + 'px';
      const ty = Math.sin(angle) * dist + 'px';
      const el = document.createElement('span');
      el.className = 'heart-burst-item';
      el.textContent = ['❤️', '💕', '💖'][i % 3];
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.setProperty('--tx', tx);
      el.style.setProperty('--ty', ty);
      heartBurstContainer.appendChild(el);
      setTimeout(function () {
        el.remove();
      }, 1300);
    }

    // Glow pulse (centered on button)
    if (glowPulse) {
      glowPulse.style.setProperty('--cx', cx + 'px');
      glowPulse.style.setProperty('--cy', cy + 'px');
      glowPulse.classList.remove('animate');
      void glowPulse.offsetWidth;
      glowPulse.classList.add('animate');
      setTimeout(function () {
        glowPulse.classList.remove('animate');
      }, 1600);
    }
  }
  if (ctaButton) {
    ctaButton.addEventListener('click', onCtaClick);
    ctaButton.addEventListener('touchend', function (e) {
      onCtaClick(e);
      e.preventDefault();
    }, { passive: false });
  }

  // --- Typewriter (Section 2), trigger on scroll ---
  let typewriterDone = false;
  function runTypewriter() {
    if (typewriterDone || !typewriterWrapper) return;
    typewriterDone = true;
    typewriterCaret.classList.remove('hidden');
    let i = 0;
    function type() {
      if (i <= TYPEWRITER_TEXT.length) {
        typewriterWrapper.textContent = TYPEWRITER_TEXT.slice(0, i);
        i++;
        setTimeout(type, TYPEWRITER_DELAY_MS);
      } else {
        typewriterCaret.classList.add('hidden');
      }
    }
    type();
  }

  // --- Scroll: fade-up sections (Intersection Observer) ---
  const sections = document.querySelectorAll('.section.message, .section.highlights, .section.interactive, .section.finale');
  const messageCard = document.querySelector('.message .glass-card');
  const interactiveCard = document.querySelector('.interactive .glass-card');

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        entry.target.classList.add('visible');
        if (id === 'message') {
          messageCard && messageCard.classList.add('visible');
          runTypewriter();
        } else if (id === 'interactive') {
          interactiveCard && interactiveCard.classList.add('visible');
        }
      });
    },
    { threshold: 0.2, rootMargin: '0px' }
  );
  sections.forEach(function (s) {
    observer.observe(s);
  });

  // --- Init ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      runLoadSequence();
      initCursorHearts();
      initCardTilt();
    });
  } else {
    runLoadSequence();
    initCursorHearts();
    initCardTilt();
  }
})();
