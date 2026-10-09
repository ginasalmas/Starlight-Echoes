import { CosmicBackground } from './src/three-bg.js';
import * as api from './src/api.js';
import gsap from 'gsap';

// ═══════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════
const CONFIG = {
  ORBIT_BASE_RADIUS: 200,
  ORBIT_RING_GAP: 80,
  STARS_PER_RING: 6,
  ORBIT_SPEED_BASE: 0.0012,
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
const addOrbitBtn = $('add-orbit-btn');

// Modal
const orbitModalOverlay = $('orbit-modal-overlay');
const orbitModalTitle = $('orbit-modal-title');
const orbitLabelInput = $('orbit-label-input');
const orbitMessageInput = $('orbit-message-input');
const orbitPhotoPreview = $('orbit-photo-preview');
const orbitPhotoUploadBtn = $('orbit-photo-upload-btn');
const orbitPhotoFile$ = $('orbit-photo-file');
const orbitModalCancel = $('orbit-modal-cancel');
const orbitModalSave = $('orbit-modal-save');
const orbitSaveText = $('orbit-save-text');
const orbitSaveLoading = $('orbit-save-loading');
const skipLoginBtn = $('skip-login-btn');

// Detail popup
const detailPopup = $('orbit-detail-popup');
const detailCloseBtn = $('detail-close-btn');
const detailPhoto = $('detail-photo');
const detailLabel = $('detail-label');
const detailMessage = $('detail-message');
const detailEditBtn = $('detail-edit-btn');
const detailDeleteBtn = $('detail-delete-btn');

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
      o.angle += o.speed;
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
  userDisplayName.textContent = currentUser.displayName;
  if (currentUser.avatarUrl) {
    userAvatar.src = currentUser.avatarUrl;
  }

  // Load canvas data
  try {
    canvasData = await api.getCanvas();
    diaryTitleText.textContent = canvasData.title_text || 'Starlight Echoes';
    centerName.textContent = canvasData.center_name || 'My Universe';
    if (canvasData.center_photo_url) {
      centerPhoto.src = canvasData.center_photo_url;
    }
    if (canvasData.pan_x || canvasData.pan_y) {
      targetPanX = canvasData.pan_x || 0;
      targetPanY = canvasData.pan_y || 0;
    }
  } catch (e) {
    console.warn('Could not load canvas:', e.message);
  }

  // Load orbit items
  try {
    orbitItems = await api.getOrbitItems();
    renderOrbitRings();
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

  // --- Skip Login (Dev Mode) ---
  if (skipLoginBtn) {
    skipLoginBtn.addEventListener('click', () => {
      currentUser = { displayName: 'Dev User', avatarUrl: '' };
      canvasData = { title_text: 'Dev Mode Diary', center_name: 'Local Universe' };
      orbitItems = [
        { id: 1, label: 'First Memory', message: 'Hello from dev mode!', photo_url: null }
      ];
      showApp();
    });
  }

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

  // --- Add orbit item ---
  addOrbitBtn.addEventListener('click', openAddOrbitModal);

  // --- Orbit modal ---
  orbitModalCancel.addEventListener('click', closeOrbitModal);
  orbitModalOverlay.addEventListener('click', (e) => {
    if (e.target === orbitModalOverlay) closeOrbitModal();
  });
  orbitModalSave.addEventListener('click', saveOrbitItem);
  orbitPhotoUploadBtn.addEventListener('click', () => orbitPhotoFile$.click());
  orbitPhotoFile$.addEventListener('change', onOrbitPhotoSelect);

  // --- Detail popup ---
  detailCloseBtn.addEventListener('click', closeDetailPopup);
  detailEditBtn.addEventListener('click', onDetailEdit);
  detailDeleteBtn.addEventListener('click', onDetailDelete);

  // Close detail on click outside
  document.addEventListener('click', (e) => {
    if (!detailPopup.classList.contains('hidden') &&
        !detailPopup.contains(e.target) &&
        !e.target.closest('.orbit-item')) {
      closeDetailPopup();
    }
  });
}

// ═══════════════════════════════════
// INFINITE CANVAS PANNING
// ═══════════════════════════════════
function onPanStart(e) {
  // Don't pan if clicking interactive elements
  if (e.target.closest('button, input, textarea, .orbit-item, .profile-avatar-wrapper, a, #center-name-wrapper')) return;
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
// INLINE EDITING
// ═══════════════════════════════════
function startInlineEdit(displayEl, inputEl, onSave) {
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
    displayEl.textContent = newValue;
    inputEl.removeEventListener('blur', finish);
    inputEl.removeEventListener('keydown', onKeydown);
    try {
      await onSave(newValue);
    } catch (e) {
      console.error('Save failed:', e);
      displayEl.textContent = currentValue;
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
  } catch (err) {
    console.error('Upload failed:', err);
    alert('Failed to upload photo. Please try again.');
  }

  centerPhotoUpload.value = '';
}

// ═══════════════════════════════════
// ORBIT RINGS
// ═══════════════════════════════════
function renderOrbitRings() {
  orbitContainer.innerHTML = '';
  const numRings = Math.max(1, Math.ceil(orbitItems.length / CONFIG.STARS_PER_RING) + 1);

  for (let i = 0; i < numRings; i++) {
    const r = CONFIG.ORBIT_BASE_RADIUS + i * CONFIG.ORBIT_RING_GAP;
    const ring = document.createElement('div');
    ring.className = 'orbit-ring';
    ring.style.width = `${r * 2}px`;
    ring.style.height = `${r * 2}px`;
    ring.style.animationDelay = `${i * 0.5}s`;
    orbitContainer.appendChild(ring);
  }
}

// ═══════════════════════════════════
// ORBIT ITEMS RENDERING
// ═══════════════════════════════════
function renderOrbitItems() {
  starsContainer.innerHTML = '';
  orbitAnimations = [];

  orbitItems.forEach((item, idx) => {
    const el = createOrbitElement(item);
    starsContainer.appendChild(el);

    const ringIndex = Math.floor(idx / CONFIG.STARS_PER_RING);
    const radius = CONFIG.ORBIT_BASE_RADIUS + ringIndex * CONFIG.ORBIT_RING_GAP;
    const angle = item.angle || (idx % CONFIG.STARS_PER_RING) * (Math.PI * 2 / CONFIG.STARS_PER_RING);
    const speedMultiplier = 1 / (1 + ringIndex * 0.4);
    const direction = Math.random() > 0.5 ? 1 : -1;
    const speed = CONFIG.ORBIT_SPEED_BASE * speedMultiplier * direction;

    orbitAnimations.push({ el, angle, radius, speed, item });

    // Entry animation
    gsap.fromTo(el, 
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, delay: idx * 0.08, ease: 'elastic.out(1, 0.6)' }
    );
  });
}

function createOrbitElement(item) {
  const el = document.createElement('div');
  el.className = 'orbit-item';
  el.dataset.id = item.id;

  if (item.photo_url) {
    el.innerHTML = `
      <div class="orbit-item-photo-wrapper">
        <img class="orbit-item-photo" src="${item.photo_url}" alt="${item.label}" />
      </div>
      <span class="orbit-item-label">${item.label}</span>
    `;
  } else {
    el.innerHTML = `
      <div class="orbit-item-photo-wrapper">
        <div class="orbit-item-star"></div>
      </div>
      <span class="orbit-item-label">${item.label}</span>
    `;
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    showDetailPopup(item, el);
  });

  return el;
}

// ═══════════════════════════════════
// ORBIT DETAIL POPUP
// ═══════════════════════════════════
let selectedOrbitItem = null;

function showDetailPopup(item, el) {
  selectedOrbitItem = item;

  if (item.photo_url) {
    detailPhoto.src = item.photo_url;
    detailPhoto.classList.remove('hidden');
  } else {
    detailPhoto.classList.add('hidden');
  }

  detailLabel.textContent = item.label;
  detailMessage.textContent = item.message || 'No message yet.';

  // Position popup near the element
  const rect = el.getBoundingClientRect();
  const popupWidth = 260;
  let left = rect.left + rect.width / 2 - popupWidth / 2;
  let top = rect.top - 20;

  // Keep in viewport
  left = Math.max(10, Math.min(left, window.innerWidth - popupWidth - 10));
  if (top < 200) {
    top = rect.bottom + 20;
  } else {
    top = rect.top - detailPopup.offsetHeight - 20;
  }

  detailPopup.style.left = `${left}px`;
  detailPopup.style.top = `${Math.max(10, top)}px`;
  detailPopup.classList.remove('hidden');
}

function closeDetailPopup() {
  detailPopup.classList.add('hidden');
  selectedOrbitItem = null;
}

function onDetailEdit() {
  if (!selectedOrbitItem) return;
  closeDetailPopup();
  openEditOrbitModal(selectedOrbitItem);
}

async function onDetailDelete() {
  if (!selectedOrbitItem) return;
  if (!confirm(`Delete "${selectedOrbitItem.label}"?`)) return;

  const id = selectedOrbitItem.id;
  closeDetailPopup();

  try {
    await api.deleteOrbitItem(id);
    orbitItems = orbitItems.filter(i => i.id !== id);
    renderOrbitRings();
    renderOrbitItems();
  } catch (e) {
    console.error('Delete failed:', e);
    alert('Failed to delete. Please try again.');
  }
}

// ═══════════════════════════════════
// ORBIT MODAL (Add / Edit)
// ═══════════════════════════════════
function openAddOrbitModal() {
  editingOrbitId = null;
  orbitPhotoFile = null;
  orbitModalTitle.textContent = 'Add New Memory';
  orbitSaveText.textContent = 'Add Star';
  orbitLabelInput.value = '';
  orbitMessageInput.value = '';
  orbitPhotoPreview.src = '';
  orbitPhotoPreview.classList.add('hidden');
  orbitPhotoUploadBtn.classList.remove('hidden');
  orbitModalOverlay.classList.remove('hidden');
  orbitLabelInput.focus();
}

function openEditOrbitModal(item) {
  editingOrbitId = item.id;
  orbitPhotoFile = null;
  orbitModalTitle.textContent = 'Edit Memory';
  orbitSaveText.textContent = 'Save Changes';
  orbitLabelInput.value = item.label;
  orbitMessageInput.value = item.message || '';

  if (item.photo_url) {
    orbitPhotoPreview.src = item.photo_url;
    orbitPhotoPreview.classList.remove('hidden');
    orbitPhotoUploadBtn.classList.add('hidden');
  } else {
    orbitPhotoPreview.src = '';
    orbitPhotoPreview.classList.add('hidden');
    orbitPhotoUploadBtn.classList.remove('hidden');
  }

  orbitModalOverlay.classList.remove('hidden');
  orbitLabelInput.focus();
}

function closeOrbitModal() {
  orbitModalOverlay.classList.add('hidden');
  editingOrbitId = null;
  orbitPhotoFile = null;
  orbitPhotoFile$.value = '';
}

function onOrbitPhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  orbitPhotoFile = file;

  const reader = new FileReader();
  reader.onload = (ev) => {
    orbitPhotoPreview.src = ev.target.result;
    orbitPhotoPreview.classList.remove('hidden');
    orbitPhotoUploadBtn.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

async function saveOrbitItem() {
  const label = orbitLabelInput.value.trim();
  if (!label) {
    orbitLabelInput.focus();
    orbitLabelInput.style.borderColor = '#f87171';
    setTimeout(() => { orbitLabelInput.style.borderColor = ''; }, 2000);
    return;
  }

  const message = orbitMessageInput.value.trim();

  // Show loading
  orbitSaveText.classList.add('hidden');
  orbitSaveLoading.classList.remove('hidden');
  orbitModalSave.disabled = true;

  try {
    let photoUrl = null;

    // Upload photo if selected
    if (orbitPhotoFile) {
      const uploadResult = await api.uploadImage(orbitPhotoFile);
      photoUrl = uploadResult.url;
    }

    if (editingOrbitId) {
      // Update existing
      const updateData = { label, message };
      if (photoUrl) updateData.photo_url = photoUrl;
      const updated = await api.updateOrbitItem(editingOrbitId, updateData);

      // Update local state
      const idx = orbitItems.findIndex(i => i.id === editingOrbitId);
      if (idx >= 0) orbitItems[idx] = updated;
    } else {
      // Create new
      const newItem = await api.createOrbitItem({
        label,
        message,
        photo_url: photoUrl,
      });
      orbitItems.push(newItem);
    }

    // Re-render
    renderOrbitRings();
    renderOrbitItems();
    closeOrbitModal();
  } catch (e) {
    console.error('Save orbit failed:', e);
    alert('Failed to save. Please try again.');
  } finally {
    orbitSaveText.classList.remove('hidden');
    orbitSaveLoading.classList.add('hidden');
    orbitModalSave.disabled = false;
  }
}

// ═══════════════════════════════════
// BOOT
// ═══════════════════════════════════
init();
