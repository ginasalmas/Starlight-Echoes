import { CosmicBackground } from './src/three-bg.js';
import * as api from './src/api.js';
import gsap from 'gsap';

// ═══════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════
const CONFIG = {
  ORBIT_BASE_RADIUS: 180,
  ORBIT_RING_GAP: 65,
  STARS_PER_RING: 6,
  ORBIT_SPEED_BASE: 0.0015,
  PAN_SAVE_DEBOUNCE: 1000,
  PARALLAX_SCALE: 0.5,
};

// ═══════════════════════════════════
// APP STATE
// ═══════════════════════════════════
let currentUser = null;
let canvasData = null;
let orbitItems = [];
let orbitElements = [];     // DOM elements for orbit items
let orbitAnimations = [];   // { el, angle, radius, speed, item }

// Panning state
let isPanning = false;
let panStartX = 0, panStartY = 0;
let panX = 0, panY = 0;
let targetPanX = 0, targetPanY = 0;
let panSaveTimeout = null;

// Editing state
let editingOrbitId = null;
let orbitPhotoFile = null;

// 3D Background
let cosmicBg = null;

// ═══════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════
const $ = id => document.getElementById(id);
const loadingOverlay = $('loading-overlay');
const loginOverlay = $('login-overlay');
const googleLoginBtn = $('google-login-btn');
const userHeader = $('user-header');
const diaryTitleText = $('diary-title-text');
const diaryTitleInput = $('diary-title-input');
const editTitleBtn = $('edit-title-btn');
const userAvatar = $('user-avatar');
const userDisplayName = $('user-display-name');
const editNameBtn = $('edit-name-btn');
const userNameInput = $('user-name-input');
const logoutBtn = $('logout-btn');
const canvasWorld = $('canvas-world');
const orbitContainer = $('orbit-container');
const starsContainer = $('stars-container');
const centerPhoto = $('center-photo');
const changeCenterPhotoBtn = $('change-center-photo-btn');
const centerPhotoUpload = $('center-photo-upload');
const centerName = $('center-name');
const editCenterNameBtn = $('edit-center-name-btn');
const centerNameInput = $('center-name-input');
const openModalBtn = $('open-modal-btn');

// Boarding Pass Modal
const modalContainer = $('message-modal-container');
const modal = $('message-modal');
const modalContent = $('modal-content');
const modalLeftPanel = $('modal-left-panel');
const uploadTriggerBtn = $('upload-trigger-btn');
const photoUpload = $('photo-upload');
const previewImage = $('preview-image');
const sendBtn = $('send-btn');
const messageInput = $('message-input');

// Tooltip
const tooltip = $('star-tooltip');
const tooltipImg = $('tooltip-img');
const tooltipText = $('tooltip-text');

// Detail Popup
const detailPopup = $('detail-popup');
const detailTimestamp = $('detail-timestamp');
const detailImg = $('detail-img');
const detailText = $('detail-text');
const detailEditBtn = $('detail-edit-btn');
const detailDeleteBtn = $('detail-delete-btn');
const detailCloseBtn = $('detail-close-btn');

let currentImageSrc = null;
let currentImageFile = null;

// ═══════════════════════════════════
// INIT
// ═══════════════════════════════════
async function init() {
  // 1. Start 3D background
  cosmicBg = new CosmicBackground($('three-container'));
  startRenderLoop();

  // 2. Check authentication
  try {
    currentUser = await api.getCurrentUser();
    showApp();
  } catch (e) {
    if (e.status === 401) {
      showLogin();
    } else {
      // API might not be available (local dev without vercel)
      console.warn('API not available, showing login:', e.message);
      showLogin();
    }
  }

  // 3. Dismiss loading
  loadingOverlay.classList.add('fade-out');
  setTimeout(() => loadingOverlay.remove(), 700);

  // 4. Set up event listeners
  setupEventListeners();
}

// ═══════════════════════════════════
// RENDER LOOP (Three.js + orbit animation)
// ═══════════════════════════════════
function startRenderLoop() {
  function animate() {
    requestAnimationFrame(animate);

    // Smooth canvas panning
    panX += (targetPanX - panX) * 0.1;
    panY += (targetPanY - panY) * 0.1;
    canvasWorld.style.transform = `translate(${panX}px, ${panY}px)`;

    // Sync 3D background (inverted + scaled for parallax)
    cosmicBg.setTarget(-panX * CONFIG.PARALLAX_SCALE, panY * CONFIG.PARALLAX_SCALE);

    // Animate orbit items
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    orbitAnimations.forEach(o => {
      o.radius += (o.targetRadius - o.radius) * 0.03;
      if (!o.isPaused) {
        o.angle += o.speed;
      }
      const px = cx + Math.cos(o.angle) * o.radius;
      const py = cy + Math.sin(o.angle) * o.radius;
      o.el.style.left = `${px}px`;
      o.el.style.top = `${py}px`;
    });

    // Update 3D
    cosmicBg.update();
  }
  animate();
}

// ═══════════════════════════════════
// AUTH FLOW
// ═══════════════════════════════════
function showLogin() {
  loginOverlay.classList.remove('hidden');
  userHeader.classList.add('hidden');
  canvasWorld.classList.add('hidden');
}

async function showApp() {
  loginOverlay.classList.add('hidden');
  userHeader.classList.remove('hidden');
  canvasWorld.classList.remove('hidden');

  // Populate user info
  userDisplayName.textContent = currentUser.displayName || 'User';
  userAvatar.src = currentUser.avatarUrl || '/default-avatar.jpg';

  // Load canvas data
  try {
    canvasData = await api.getCanvas();
    diaryTitleText.textContent = canvasData.title_text || 'Starlight Echoes';
    centerName.textContent = canvasData.center_name || 'My Universe';
    centerPhoto.src = canvasData.center_photo_url || '/default-avatar.jpg';
    if (canvasData.pan_x || canvasData.pan_y) {
      targetPanX = canvasData.pan_x || 0;
      targetPanY = canvasData.pan_y || 0;
    }
  } catch (e) {
    console.warn('Could not load canvas:', e.message);
    centerPhoto.src = '/default-avatar.jpg';
  }

  // Load orbit items
  try {
    orbitItems = await api.getOrbitItems();
    updateOrbitLines();
    renderOrbitItems();
  } catch (e) {
    console.warn('Could not load orbits:', e.message);
  }
}

// ═══════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════
function setupEventListeners() {
  // --- Login ---
  googleLoginBtn.addEventListener('click', () => {
    window.location.href = api.getLoginUrl();
  });

  // --- Logout ---
  logoutBtn.addEventListener('click', async () => {
    try { await api.logout(); } catch (e) { /* ok */ }
    currentUser = null;
    showLogin();
  });

  // --- Canvas Panning ---
  canvasWorld.addEventListener('pointerdown', onPanStart);
  window.addEventListener('pointermove', onPanMove);
  window.addEventListener('pointerup', onPanEnd);

  // --- Edit diary title ---
  editTitleBtn.addEventListener('click', () => startInlineEdit(diaryTitleText, diaryTitleInput, async (val) => {
    diaryTitleText.textContent = val;
    await api.updateCanvas({ title_text: val });
  }));

  diaryTitleText.addEventListener('dblclick', () => editTitleBtn.click());

  // --- Edit user display name ---
  editNameBtn.addEventListener('click', () => startInlineEdit(userDisplayName, userNameInput, async (val) => {
    userDisplayName.textContent = val;
    await api.updateProfile({ displayName: val });
  }));

  // --- Edit center name ---
  editCenterNameBtn.addEventListener('click', () => startInlineEdit(centerName, centerNameInput, async (val) => {
    centerName.textContent = val;
    await api.updateCanvas({ center_name: val });
  }));

  centerName.addEventListener('dblclick', () => editCenterNameBtn.click());

  // --- Change center photo ---
  changeCenterPhotoBtn.addEventListener('click', () => centerPhotoUpload.click());
  centerPhotoUpload.addEventListener('change', onCenterPhotoChange);

  // --- Open Boarding Pass Modal ---
  if (openModalBtn) openModalBtn.addEventListener('click', openBoardingPassModal);

  // --- Close modals on click outside ---
  if (modalContainer) {
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) modalContainer.classList.add('hidden');
    });
  }

  if (detailPopup) {
    detailPopup.addEventListener('click', (e) => {
      if (e.target === detailPopup) detailPopup.classList.add('hidden');
    });
  }

  if (detailCloseBtn) {
    detailCloseBtn.addEventListener('click', () => detailPopup.classList.add('hidden'));
  }

  // --- Photo upload trigger ---
  if (uploadTriggerBtn) uploadTriggerBtn.addEventListener('click', () => photoUpload.click());
  if (photoUpload) photoUpload.addEventListener('change', onPhotoSelected);

  // --- Send message ---
  if (sendBtn) sendBtn.addEventListener('click', onSendMessage);
}

// ═══════════════════════════════════
// INFINITE CANVAS PANNING
// ═══════════════════════════════════
function onPanStart(e) {
  // Don't pan if clicking interactive elements
  if (e.target.closest('button, input, textarea, .orbit-item, .star-element, .profile-avatar-wrapper, a, #center-name-wrapper')) return;
  isPanning = true;
  panStartX = e.clientX - targetPanX;
  panStartY = e.clientY - targetPanY;
  canvasWorld.classList.add('grabbing');
  e.preventDefault();
}

function onPanMove(e) {
  if (!isPanning) return;
  targetPanX = e.clientX - panStartX;
  targetPanY = e.clientY - panStartY;
}

function onPanEnd() {
  if (!isPanning) return;
  isPanning = false;
  canvasWorld.classList.remove('grabbing');

  // Debounced save pan position
  clearTimeout(panSaveTimeout);
  panSaveTimeout = setTimeout(async () => {
    try {
      await api.updateCanvas({ pan_x: targetPanX, pan_y: targetPanY });
    } catch (e) {
      console.warn('Could not save pan position:', e.message);
    }
  }, CONFIG.PAN_SAVE_DEBOUNCE);
}

// ═══════════════════════════════════
// TOAST CHIP NOTIFICATIONS
// ═══════════════════════════════════
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const chip = document.createElement('div');
  chip.className = `toast-chip ${type}`;
  chip.innerHTML = `
    <span class="toast-icon">${type === 'error' ? '✕' : '✦'}</span>
    <span class="toast-text">${message}</span>
  `;
  toastContainer.appendChild(chip);

  gsap.fromTo(chip,
    { opacity: 0, y: -20, scale: 0.9 },
    { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.5)' }
  );

  setTimeout(() => {
    gsap.to(chip, {
      opacity: 0,
      y: -15,
      scale: 0.95,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => chip.remove()
    });
  }, 2500);
}

// ═══════════════════════════════════
// INLINE EDITING
// ═══════════════════════════════════
function startInlineEdit(displayEl, inputEl, onSave, itemType = 'Nama') {
  const currentValue = displayEl.textContent;
  inputEl.value = currentValue;
  displayEl.classList.add('hidden');
  inputEl.classList.remove('hidden');
  inputEl.focus();
  inputEl.select();

  const finish = async () => {
    const newValue = inputEl.value.trim() || currentValue;
    inputEl.classList.add('hidden');
    displayEl.classList.remove('hidden');
    inputEl.removeEventListener('blur', finish);
    inputEl.removeEventListener('keydown', onKeydown);

    if (newValue === currentValue) return;

    displayEl.textContent = newValue;
    try {
      await onSave(newValue);
      showToast(`${itemType} berhasil diperbarui`);
    } catch (e) {
      console.error('Save failed:', e);
      displayEl.textContent = currentValue;
      showToast(`Gagal menyimpan: ${e.message}`, 'error');
    }
  };

  const onKeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { inputEl.value = currentValue; finish(); }
  };

  inputEl.addEventListener('blur', finish);
  inputEl.addEventListener('keydown', onKeydown);
}

// ═══════════════════════════════════
// CENTER PHOTO CHANGE
// ═══════════════════════════════════
async function onCenterPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = (ev) => { centerPhoto.src = ev.target.result; };
  reader.readAsDataURL(file);

  // Upload
  try {
    const { url } = await api.uploadImage(file);
    centerPhoto.src = url;
    await api.updateCanvas({ center_photo_url: url });
    showToast('Foto profil berhasil diperbarui');
  } catch (err) {
    console.error('Upload failed:', err);
    showToast(`Gagal mengunggah foto: ${err.message || 'Coba lagi'}`, 'error');
  }

  centerPhotoUpload.value = '';
}

// ═══════════════════════════════════
// ORBITS & STARS (First Commit Physics)
// ═══════════════════════════════════
function getOrbitRadius(rankIndex) {
  return CONFIG.ORBIT_BASE_RADIUS + Math.floor(rankIndex / CONFIG.STARS_PER_RING) * CONFIG.ORBIT_RING_GAP;
}

function updateOrbitLines() {
  orbitContainer.innerHTML = '';
  const numLayers = Math.max(1, Math.floor(orbitItems.length / CONFIG.STARS_PER_RING) + 1);
  for (let i = 0; i < numLayers; i++) {
    const r = CONFIG.ORBIT_BASE_RADIUS + i * CONFIG.ORBIT_RING_GAP;
    const el = document.createElement('div');
    el.className = 'orbit-line';
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    orbitContainer.appendChild(el);
  }
}

function renderOrbitItems() {
  starsContainer.innerHTML = '';
  orbitAnimations = [];

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  orbitItems.forEach((item, idx) => {
    const radius = getOrbitRadius(idx);
    const angle = item.angle !== undefined ? item.angle : (idx % CONFIG.STARS_PER_RING) * (Math.PI * 2 / CONFIG.STARS_PER_RING) + Math.random() * 0.2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;

    const star = createStarElement(item, idx);
    star.style.left = `${px}px`;
    star.style.top = `${py}px`;
    starsContainer.appendChild(star);

    // Entry animation
    gsap.fromTo(star,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, delay: idx * 0.06, ease: 'elastic.out(1, 0.5)' }
    );

    const baseSpeed = 0.0015;
    const speed = (baseSpeed / (1 + Math.floor(idx / CONFIG.STARS_PER_RING) * 0.5)) * (idx % 2 === 0 ? 1 : -1);
    orbitAnimations.push({ el: star, angle, radius, targetRadius: radius, speed, item });
  });
}

function createStarElement(item, rankIndex) {
  const star = document.createElement('div');
  star.className = 'star-element';
  star.dataset.id = item.id;

  // Tooltip on hover
  star.addEventListener('mouseenter', () => {
    const anim = orbitAnimations.find(a => a.el === star);
    if (anim) anim.isPaused = true;

    const r = star.getBoundingClientRect();
    if (item.photo_url) {
      tooltipImg.src = item.photo_url;
      tooltipImg.classList.remove('hidden');
    } else {
      tooltipImg.src = '';
      tooltipImg.classList.add('hidden');
    }
    tooltipText.textContent = item.message || item.label || 'Kenangan di bintang.';
    tooltip.style.left = `${r.left + r.width / 2}px`;
    tooltip.style.top = `${r.top}px`;
    tooltip.classList.remove('hidden');
  });

  star.addEventListener('mouseleave', () => {
    const anim = orbitAnimations.find(a => a.el === star);
    if (anim) anim.isPaused = false;
    tooltip.classList.add('hidden');
  });

  // Click to open detail popup
  star.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Set Timestamp
    if (item.created_at) {
      const date = new Date(item.created_at);
      detailTimestamp.textContent = date.toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } else {
      detailTimestamp.textContent = '';
    }

    // Set Image
    if (item.photo_url) {
      detailImg.src = item.photo_url;
      detailImg.classList.remove('hidden');
    } else {
      detailImg.src = '';
      detailImg.classList.add('hidden');
    }

    // Set Text
    detailText.textContent = item.message || item.label || 'Kenangan tanpa pesan.';

    // Show popup
    detailPopup.classList.remove('hidden');

    // Handle Edit (Not implemented fully, just alert for now or implement if needed)
    detailEditBtn.onclick = () => {
      alert('Fitur edit akan segera hadir!');
    };

    // Handle Delete
    detailDeleteBtn.onclick = async () => {
      if (confirm(`Hapus kenangan ini?`)) {
        detailPopup.classList.add('hidden');
        await deleteStar(item.id, star);
      }
    };
  });

  return star;
}

async function deleteStar(id, starEl) {
  try {
    if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('local-'))) {
      await api.deleteOrbitItem(id);
    }
    gsap.to(starEl, {
      scale: 0,
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        starEl.remove();
        orbitAnimations = orbitAnimations.filter(o => o.item.id !== id);
        orbitItems = orbitItems.filter(i => i.id !== id);
        // Shift remaining stars target radius
        orbitAnimations.forEach((o, idx) => {
          o.targetRadius = getOrbitRadius(idx);
        });
        updateOrbitLines();
      }
    });
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Gagal menghapus: ' + err.message);
  }
}

// ═══════════════════════════════════
// BOARDING PASS MODAL (First Commit)
// ═══════════════════════════════════
function openBoardingPassModal() {
  modalContainer.classList.remove('hidden');
  gsap.set(modal, {
    scale: 1, rotation: 0, skewX: 0, skewY: 0,
    filter: 'blur(0px)', opacity: 1,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
    clearProps: 'transform'
  });
  modalContent.classList.remove('hidden');
  modal.classList.remove('expanded');
  modalLeftPanel.classList.add('hidden');
  currentImageSrc = null;
  currentImageFile = null;
  previewImage.src = '';
  messageInput.value = '';
  messageInput.focus();
}

function onPhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  currentImageFile = file;

  const reader = new FileReader();
  reader.onload = (ev) => {
    currentImageSrc = ev.target.result;
    previewImage.src = currentImageSrc;
    modal.classList.add('expanded');
    setTimeout(() => {
      modalLeftPanel.classList.remove('hidden');
      modalLeftPanel.style.display = 'flex';
      setTimeout(() => { modalLeftPanel.style.opacity = '1'; }, 10);
    }, 400);
  };
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════
// SEND MESSAGE (4-Stage Implosion & Flight Animation)
// ═══════════════════════════════════
async function onSendMessage() {
  const text = messageInput.value.trim();
  if (!text) {
    alert('Silakan tulis pesan terlebih dahulu!');
    messageInput.focus();
    return;
  }

  const photoFile = currentImageFile;
  const localImg = currentImageSrc;

  // Origin coordinates from modal center
  const rect = modal.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  // Stage 1 & 2: Modal skew, twist & blur into glowing vortex
  const tl = gsap.timeline();

  tl.to(modal, {
    scale: 0.35,
    rotation: 50,
    skewX: 18,
    skewY: 18,
    filter: 'blur(10px)',
    boxShadow: '0 0 120px 60px rgba(56, 189, 248, 0.9), inset 0 0 90px rgba(56, 189, 248, 1)',
    duration: 0.5,
    ease: 'power2.in',
  })
  .to(modal, {
    scale: 0,
    opacity: 0,
    duration: 0.2,
    ease: 'power4.in',
    onStart: () => {
      spawnVortexBurst(startX, startY);
    },
    onComplete: () => {
      modalContainer.classList.add('hidden');

      // Shift existing stars outward
      orbitAnimations.forEach((s, idx) => {
        s.targetRadius = getOrbitRadius(idx + 1);
      });

      // Stage 3: Glowing spark projectile shoots out
      const spark = document.createElement('div');
      spark.className = 'spark';
      spark.style.left = `${startX}px`;
      spark.style.top = `${startY}px`;
      document.body.appendChild(spark);

      const radius = getOrbitRadius(0);
      const angle = Math.random() * Math.PI * 2;
      const targetX = cx + Math.cos(angle) * radius;
      const targetY = cy + Math.sin(angle) * radius;

      // Arc trajectory
      gsap.to(spark, { x: targetX - startX, ease: 'power1.inOut', duration: 0.7 });
      gsap.to(spark, {
        y: targetY - startY,
        ease: 'power3.in',
        duration: 0.7,
        onComplete: () => {
          spark.remove();

          // Stage 4: Star pops in with elastic ease!
          const newMsg = {
            id: 'local-' + Date.now(),
            label: text.slice(0, 30),
            message: text,
            photo_url: localImg,
            created_at: new Date().toISOString()
          };

          const star = createStarElement(newMsg, 0);
          star.style.left = `${targetX}px`;
          star.style.top = `${targetY}px`;
          starsContainer.appendChild(star);

          gsap.fromTo(star,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' }
          );

          const baseSpeed = 0.0015;
          const speed = (baseSpeed / (1 + Math.floor(0 / CONFIG.STARS_PER_RING) * 0.5)) * (Math.random() > 0.5 ? 1 : -1);
          orbitAnimations.unshift({ el: star, angle, radius, targetRadius: radius, speed, item: newMsg });
          orbitItems.unshift(newMsg);
          updateOrbitLines();

          // Persist in background
          persistStarInBackground(newMsg, photoFile);
        },
      });
    },
  });
}

function spawnVortexBurst(cx, cy) {
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'spark';
    p.style.width = '4px';
    p.style.height = '4px';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    document.body.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 100;
    const dur = 0.35 + Math.random() * 0.35;

    gsap.to(p, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      scale: 0,
      opacity: 0,
      duration: dur,
      ease: 'power2.out',
      onComplete: () => p.remove(),
    });
  }
}

async function persistStarInBackground(starData, photoFile) {
  try {
    let photoUrl = null;
    if (photoFile) {
      const uploadRes = await api.uploadImage(photoFile);
      photoUrl = uploadRes.url;
      starData.photo_url = photoUrl;
    }
    const created = await api.createOrbitItem({
      label: starData.label,
      message: starData.message,
      photo_url: photoUrl,
    });
    starData.id = created.id;
  } catch (err) {
    console.warn('Background save to API skipped/offline:', err.message);
  }
}

// ═══════════════════════════════════
// BOOT
// ═══════════════════════════════════
init();
