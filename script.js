const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const progressBar = document.querySelector(".scroll-progress");
const cursorGlow = document.querySelector(".cursor-glow");
const parallaxLayers = [...document.querySelectorAll(".parallax-layer")];
const sections = [...document.querySelectorAll(".era")];
const revealTargets = [...document.querySelectorAll(".reveal, .timeline li")];
const canvases = [...document.querySelectorAll(".particle-canvas")];

let scrollY = window.scrollY;
let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let ticking = false;
let particleSystems = [];

/**
 * Lightweight deterministic particle engine. Each canvas owns only the particles
 * needed for its current section, keeping animation work small and predictable.
 */
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.type = canvas.dataset.particles;
    this.particles = [];
    this.bounds = canvas.closest(".era").getBoundingClientRect();
    this.visible = false;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seedParticles();
  }

  seedParticles() {
    const density = {
      stars: 90,
      network: 46,
      data: 72,
      space: 130
    }[this.type] || 60;

    const count = Math.round(density * Math.min(1.25, Math.max(0.72, this.width / 1200)));
    this.particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * (this.type === "network" ? 0.42 : 0.18),
      vy: (Math.random() - 0.5) * (this.type === "space" ? 0.28 : 0.18),
      r: Math.random() * (this.type === "space" ? 2.4 : 1.8) + 0.45,
      phase: Math.random() * Math.PI * 2,
      hue: index % 3
    }));
  }

  update(time) {
    if (!this.visible) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < -20) particle.x = this.width + 20;
      if (particle.x > this.width + 20) particle.x = -20;
      if (particle.y < -20) particle.y = this.height + 20;
      if (particle.y > this.height + 20) particle.y = -20;

      const twinkle = 0.52 + Math.sin(time * 0.002 + particle.phase) * 0.36;
      const color = particle.hue === 0 ? "72, 248, 255" : particle.hue === 1 ? "255, 79, 216" : "255, 209, 102";

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${Math.max(0.18, twinkle)})`;
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.type === "network") this.drawConnections();
    if (this.type === "data") this.drawDataStreams(time);
  }

  drawConnections() {
    const ctx = this.ctx;
    const maxDistance = Math.min(150, this.width * 0.16);

    for (let i = 0; i < this.particles.length; i += 1) {
      for (let j = i + 1; j < this.particles.length; j += 1) {
        const a = this.particles[i];
        const b = this.particles[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > maxDistance) continue;

        ctx.strokeStyle = `rgba(72, 248, 255, ${0.18 * (1 - distance / maxDistance)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  drawDataStreams(time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 9; i += 1) {
      const x = ((time * 0.035 + i * 137) % (this.width + 240)) - 120;
      const y = (i * this.height) / 9 + Math.sin(time * 0.001 + i) * 22;
      const gradient = ctx.createLinearGradient(x - 120, y, x + 120, y);
      gradient.addColorStop(0, "rgba(72, 248, 255, 0)");
      gradient.addColorStop(0.5, "rgba(72, 248, 255, 0.32)");
      gradient.addColorStop(1, "rgba(255, 79, 216, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 120, y);
      ctx.lineTo(x + 120, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function initTypewriter() {
  const target = document.querySelector("[data-typewriter]");
  if (!target) return;

  const text = target.dataset.typewriter;
  let index = 0;

  const type = () => {
    target.textContent = text.slice(0, index);
    index += 1;
    if (index <= text.length && !prefersReducedMotion) {
      window.setTimeout(type, 38);
    } else {
      target.textContent = text;
    }
  };

  type();
}

function updateScene() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
  progressBar.style.transform = `scaleX(${progress})`;

  const centerOffsetX = (pointerX / window.innerWidth - 0.5) * 2;
  const centerOffsetY = (pointerY / window.innerHeight - 0.5) * 2;

  if (cursorGlow) {
    cursorGlow.style.left = `${pointerX}px`;
    cursorGlow.style.top = `${pointerY}px`;
  }

  for (const layer of parallaxLayers) {
    const depth = Number(layer.dataset.depth || 0);
    const section = layer.closest(".era");
    const rect = section.getBoundingClientRect();
    const localProgress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
    const scrollMove = (localProgress - 0.5) * depth * 190;
    const mouseMoveX = centerOffsetX * depth * 18;
    const mouseMoveY = centerOffsetY * depth * 14;

    layer.style.transform = `translate3d(${mouseMoveX}px, ${scrollMove + mouseMoveY}px, 0)`;
  }

  for (const section of sections) {
    if (!section.classList.contains("era-city")) continue;
    const rect = section.getBoundingClientRect();
    const amount = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    section.style.setProperty("--light-shift", amount.toFixed(3));
  }

  ticking = false;
}

function requestSceneUpdate() {
  scrollY = window.scrollY;
  if (!ticking) {
    window.requestAnimationFrame(updateScene);
    ticking = true;
  }
}

function animateParticles(time) {
  for (const system of particleSystems) {
    system.update(time);
  }
  if (!prefersReducedMotion) window.requestAnimationFrame(animateParticles);
}

function observeElements() {
  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
      }
    }
  }, { threshold: 0.22 });

  for (const target of revealTargets) revealObserver.observe(target);
  for (const section of sections) revealObserver.observe(section);

  const canvasObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const system = particleSystems.find((candidate) => candidate.canvas === entry.target);
      if (system) system.visible = entry.isIntersecting;
    }
  }, { rootMargin: "180px" });

  for (const canvas of canvases) canvasObserver.observe(canvas);
}

function handleResize() {
  for (const system of particleSystems) {
    system.resize();
  }
  requestSceneUpdate();
}

function init() {
  particleSystems = canvases.map((canvas) => new ParticleSystem(canvas));
  initTypewriter();
  observeElements();
  requestSceneUpdate();

  if (!prefersReducedMotion) {
    window.requestAnimationFrame(animateParticles);
  }
}

window.addEventListener("scroll", requestSceneUpdate, { passive: true });
window.addEventListener("resize", handleResize);
window.addEventListener("pointermove", (event) => {
  pointerX = event.clientX;
  pointerY = event.clientY;
  requestSceneUpdate();
}, { passive: true });

init();
