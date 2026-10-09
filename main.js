import gsap from 'gsap';

// ═══════════════════════════════════
// TWEAKABLE CONFIGURATION
// ═══════════════════════════════════
const CONFIG = {
  // Starfield (overlay on top of bg image)
  STAR_COUNT: 200,
  STAR_MIN_SIZE: 0.3,
  STAR_MAX_SIZE: 1.8,
  BRIGHT_STAR_COUNT: 8,
  STAR_TWINKLE_SPEED: 0.002,

  // Dust particles (mouse interactive)
  DUST_COUNT: 40,
  DUST_MAX_SIZE: 1.0,
  MOUSE_RADIUS: 130,
  MOUSE_REPEL_STRENGTH: 1.5,

  // Shooting stars
  SHOOTING_STAR_INTERVAL_MIN: 20000,
  SHOOTING_STAR_INTERVAL_MAX: 50000,

  // Orbits
  ORBIT_BASE_RADIUS: 180,
  ORBIT_RING_GAP: 65,
  STARS_PER_RING: 6,
};

// ═══════════════════════════════════
// CANVAS SETUP (transparent overlay on top of bg image)
// ═══════════════════════════════════
const canvas = document.getElementById('cosmic-canvas');
const ctx = canvas.getContext('2d');
let W, H;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

// ═══════════════════════════════════
// MOUSE
// ═══════════════════════════════════
let mouseX = W / 2, mouseY = H / 2;
document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

// ═══════════════════════════════════
// 1. STARFIELD (twinkling + cross spikes)
// ═══════════════════════════════════
const bgStars = [];
for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
  bgStars.push({
    x: Math.random() * W,
    y: Math.random() * H,
    size: CONFIG.STAR_MIN_SIZE + Math.random() * (CONFIG.STAR_MAX_SIZE - CONFIG.STAR_MIN_SIZE),
    phase: Math.random() * Math.PI * 2,
    twinkleRate: CONFIG.STAR_TWINKLE_SPEED * (0.5 + Math.random()),
    baseAlpha: 0.2 + Math.random() * 0.6,
    driftX: (Math.random() - 0.5) * 0.06,
    driftY: (Math.random() - 0.5) * 0.03,
  });
}

const brightStars = [];
for (let i = 0; i < CONFIG.BRIGHT_STAR_COUNT; i++) {
  brightStars.push({
    x: 50 + Math.random() * (W - 100),
    y: 50 + Math.random() * (H - 100),
    size: 1.5 + Math.random() * 1.5,
    spikeLen: 10 + Math.random() * 18,
    phase: Math.random() * Math.PI * 2,
    twinkleRate: 0.001 + Math.random() * 0.002,
    driftX: (Math.random() - 0.5) * 0.03,
    driftY: (Math.random() - 0.5) * 0.02,
  });
}

function drawStars(time) {
  bgStars.forEach(s => {
    const alpha = s.baseAlpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase + time * s.twinkleRate)));
    s.x += s.driftX;
    s.y += s.driftY;
    if (s.x < -5) s.x += W + 10;
    if (s.x > W + 5) s.x -= W + 10;
    if (s.y < -5) s.y += H + 10;
    if (s.y > H + 5) s.y -= H + 10;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e0f0ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();

    if (s.size > 1.2) {
      ctx.globalAlpha = alpha * 0.15;
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  brightStars.forEach(s => {
    const alpha = 0.6 + 0.4 * Math.sin(s.phase + time * s.twinkleRate);
    s.x += s.driftX;
    s.y += s.driftY;
    if (s.x < -20) s.x += W + 40;
    if (s.x > W + 20) s.x -= W + 40;
    if (s.y < -20) s.y += H + 40;
    if (s.y > H + 20) s.y -= H + 40;

    const spikeLen = s.spikeLen * (0.7 + 0.3 * alpha);

    // Glow
    ctx.globalAlpha = alpha * 0.12;
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, spikeLen);
    glow.addColorStop(0, 'rgba(186, 230, 253, 0.5)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, spikeLen, 0, Math.PI * 2);
    ctx.fill();

    // Cross spikes
    ctx.globalAlpha = alpha * 0.6;
    const vGrad = ctx.createLinearGradient(s.x, s.y - spikeLen, s.x, s.y + spikeLen);
    vGrad.addColorStop(0, 'rgba(255,255,255,0)');
    vGrad.addColorStop(0.45, 'rgba(220,240,255,0.5)');
    vGrad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    vGrad.addColorStop(0.55, 'rgba(220,240,255,0.5)');
    vGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = vGrad;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(s.x, s.y - spikeLen); ctx.lineTo(s.x, s.y + spikeLen); ctx.stroke();

    const hGrad = ctx.createLinearGradient(s.x - spikeLen, s.y, s.x + spikeLen, s.y);
    hGrad.addColorStop(0, 'rgba(255,255,255,0)');
    hGrad.addColorStop(0.45, 'rgba(220,240,255,0.5)');
    hGrad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    hGrad.addColorStop(0.55, 'rgba(220,240,255,0.5)');
    hGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = hGrad;
    ctx.beginPath(); ctx.moveTo(s.x - spikeLen, s.y); ctx.lineTo(s.x + spikeLen, s.y); ctx.stroke();

    // Core
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════
// 2. COSMIC DUST (mouse-interactive)
// ═══════════════════════════════════
const dustParticles = [];
for (let i = 0; i < CONFIG.DUST_COUNT; i++) {
  dustParticles.push({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    size: 0.3 + Math.random() * CONFIG.DUST_MAX_SIZE,
    alpha: 0.06 + Math.random() * 0.14,
  });
}

function drawDust() {
  dustParticles.forEach(p => {
    const dx = p.x - mouseX, dy = p.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CONFIG.MOUSE_RADIUS && dist > 0) {
      const force = (CONFIG.MOUSE_RADIUS - dist) / CONFIG.MOUSE_RADIUS * CONFIG.MOUSE_REPEL_STRENGTH;
      p.vx += (dx / dist) * force * 0.04;
      p.vy += (dy / dist) * force * 0.04;
    }
    p.vx *= 0.985; p.vy *= 0.985;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;

    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = 'rgba(160, 210, 220, 0.7)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════
// 3. SHOOTING STARS
// ═══════════════════════════════════
let shootingStars = [];

function spawnShootingStar() {
  const fromRight = Math.random() > 0.5;
  shootingStars.push({
    x: fromRight ? W + 10 : -10,
    y: Math.random() * H * 0.6,
    vx: (fromRight ? -1 : 1) * (10 + Math.random() * 5),
    vy: 2 + Math.random() * 3,
    alpha: 1,
    length: 70 + Math.random() * 90,
  });
  const next = CONFIG.SHOOTING_STAR_INTERVAL_MIN + Math.random() * (CONFIG.SHOOTING_STAR_INTERVAL_MAX - CONFIG.SHOOTING_STAR_INTERVAL_MIN);
  setTimeout(spawnShootingStar, next);
}
setTimeout(spawnShootingStar, 4000);

function drawShootingStars() {
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
    s.x += s.vx; s.y += s.vy; s.alpha -= 0.007;
    if (s.alpha <= 0 || s.x < -120 || s.x > W + 120 || s.y > H + 100) { shootingStars.splice(i, 1); continue; }
    const angle = Math.atan2(s.vy, s.vx);
    const tailX = s.x - Math.cos(angle) * s.length;
    const tailY = s.y - Math.sin(angle) * s.length;
    const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
    grad.addColorStop(1, 'rgba(186,230,253,0)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tailX, tailY); ctx.stroke();
    ctx.globalAlpha = s.alpha; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ═══════════════════════════════════
// 4. VORTEX PARTICLES (implosion)
// ═══════════════════════════════════
let vortexParticles = [];

function drawVortex() {
  for (let i = vortexParticles.length - 1; i >= 0; i--) {
    const p = vortexParticles[i];
    p.angle += p.angularVelocity; p.radius -= p.radialVelocity; p.alpha -= 0.02;
    if (p.radius < 5 || p.alpha <= 0) { vortexParticles.splice(i, 1); continue; }
    const px = p.centerX + Math.cos(p.angle) * p.radius;
    const py = p.centerY + Math.sin(p.angle) * p.radius;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════
// 5. ORBIT STAR POSITIONS
// ═══════════════════════════════════
let orbitStars = [];

function drawOrbitTrails() {
  const cx = W / 2, cy = H / 2;
  orbitStars.forEach(s => {
    s.radius += (s.targetRadius - s.radius) * 0.03;
    s.angle += s.speed;
    const px = cx + Math.cos(s.angle) * s.radius;
    const py = cy + Math.sin(s.angle) * s.radius;
    s.el.style.left = `${px}px`;
    s.el.style.top = `${py}px`;

    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.03;
    ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════
// MAIN RENDER LOOP
// ═══════════════════════════════════
function render(time) {
  ctx.clearRect(0, 0, W, H);
  drawStars(time);
  drawDust();
  drawShootingStars();
  drawVortex();
  drawOrbitTrails();
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ═══════════════════════════════════
// APP STATE & DOM REFERENCES
// ═══════════════════════════════════
let messages = [];
let currentImageSrc = null;

const openModalBtn = document.getElementById('open-modal-btn');
const modalContainer = document.getElementById('message-modal-container');
const modal = document.getElementById('message-modal');
const modalContent = document.getElementById('modal-content');
const modalLeftPanel = document.getElementById('modal-left-panel');
const uploadTriggerBtn = document.getElementById('upload-trigger-btn');
const photoUpload = document.getElementById('photo-upload');
const previewImage = document.getElementById('preview-image');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const orbitContainer = document.getElementById('orbit-container');
const starsContainer = document.getElementById('stars-container');
const tooltip = document.getElementById('star-tooltip');
const tooltipImg = document.getElementById('tooltip-img');
const tooltipText = document.getElementById('tooltip-text');

// ═══════════════════════════════════
// MODAL OPEN / CLOSE
// ═══════════════════════════════════
openModalBtn.addEventListener('click', () => {
  modalContainer.classList.remove('hidden');
  gsap.set(modal, {
    scale: 1, rotation: 0, skewX: 0, skewY: 0,
    filter: 'blur(0px)', opacity: 1,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
    clearProps: 'transform'
  });
  modalContent.classList.remove('hidden');
  modal.classList.remove('expanded');
  modalLeftPanel.classList.add('hidden');
  currentImageSrc = null;
  previewImage.src = '';
  messageInput.value = '';
});

modalContainer.addEventListener('click', e => {
  if (e.target === modalContainer) modalContainer.classList.add('hidden');
});

// ═══════════════════════════════════
// PHOTO UPLOAD
// ═══════════════════════════════════
uploadTriggerBtn.addEventListener('click', () => photoUpload.click());

photoUpload.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    currentImageSrc = ev.target.result;
    previewImage.src = currentImageSrc;
    modal.classList.add('expanded');
    setTimeout(() => {
      modalLeftPanel.classList.remove('hidden');
      modalLeftPanel.style.display = 'flex';
      setTimeout(() => { modalLeftPanel.style.opacity = 1; }, 10);
    }, 400);
  };
  reader.readAsDataURL(file);
});

// ═══════════════════════════════════
// ORBITS
// ═══════════════════════════════════
function getOrbitRadius(rankIndex) {
  return CONFIG.ORBIT_BASE_RADIUS + Math.floor(rankIndex / CONFIG.STARS_PER_RING) * CONFIG.ORBIT_RING_GAP;
}

function updateOrbitLines() {
  orbitContainer.innerHTML = '';
  const numLayers = Math.floor(messages.length / CONFIG.STARS_PER_RING) + 1;
  for (let i = 0; i < numLayers; i++) {
    const r = CONFIG.ORBIT_BASE_RADIUS + i * CONFIG.ORBIT_RING_GAP;
    const el = document.createElement('div');
    el.className = 'orbit-line';
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    orbitContainer.appendChild(el);
  }
}

// ═══════════════════════════════════
// SEND MESSAGE (4-stage animation)
// ═══════════════════════════════════
sendBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  const img = currentImageSrc || 'https://i.pravatar.cc/150?img=47';
  if (!text) { alert('Silakan tulis pesan terlebih dahulu!'); return; }

  const newMsg = { text, img };
  messages.unshift(newMsg);

  orbitStars.forEach((s, idx) => { s.targetRadius = getOrbitRadius(idx + 1); });

  const rect = modal.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const cx = W / 2, cy = H / 2;

  const tl = gsap.timeline();

  tl.to(modal, {
    scale: 0.35, rotation: 50, skewX: 18, skewY: 18,
    filter: 'blur(10px)',
    boxShadow: '0 0 120px 60px rgba(56, 189, 248, 0.9), inset 0 0 90px rgba(56, 189, 248, 1)',
    duration: 0.5, ease: 'power2.in',
  })
  .to(modal, {
    scale: 0, opacity: 0, duration: 0.2, ease: 'power4.in',
    onStart: () => {
      for (let i = 0; i < 100; i++) {
        vortexParticles.push({
          centerX: startX, centerY: startY,
          radius: 80 + Math.random() * 140,
          angle: Math.random() * Math.PI * 2,
          angularVelocity: 0.05 + Math.random() * 0.1,
          radialVelocity: 3 + Math.random() * 5,
          size: Math.random() * 2.5 + 0.8, alpha: 1,
        });
      }
    },
    onComplete: () => {
      modalContainer.classList.add('hidden');
      updateOrbitLines();

      const spark = document.createElement('div');
      spark.className = 'spark';
      spark.style.left = `${startX}px`;
      spark.style.top = `${startY}px`;
      document.body.appendChild(spark);

      const radius = getOrbitRadius(0);
      const angle = Math.random() * Math.PI * 2;
      const targetX = cx + Math.cos(angle) * radius;
      const targetY = cy + Math.sin(angle) * radius;

      gsap.to(spark, { x: targetX - startX, ease: 'power1.inOut', duration: 0.7 });
      gsap.to(spark, {
        y: targetY - startY, ease: 'power3.in', duration: 0.7,
        onComplete: () => {
          spark.remove();
          const star = document.createElement('div');
          star.className = 'star-element';
          star.style.left = `${targetX}px`;
          star.style.top = `${targetY}px`;

          gsap.fromTo(star, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });

          star.addEventListener('mouseenter', () => {
            const r = star.getBoundingClientRect();
            tooltipImg.src = newMsg.img;
            tooltipText.textContent = newMsg.text;
            tooltip.style.left = `${r.left + r.width / 2}px`;
            tooltip.style.top = `${r.top}px`;
            tooltip.classList.remove('hidden');
          });
          star.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));

          starsContainer.appendChild(star);

          const baseSpeed = 0.0015;
          const speed = (baseSpeed / (1 + Math.floor(0 / CONFIG.STARS_PER_RING) * 0.5)) * (Math.random() > 0.5 ? 1 : -1);
          orbitStars.unshift({ el: star, angle, radius, targetRadius: radius, speed });
        },
      });
    },
  });
});
