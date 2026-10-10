import * as THREE from 'three';

/**
 * CosmicBackground — 3D parallax starfield using Three.js
 * Features:
 * - 4300 stars across 3 depth layers (foreground, midground, background)
 * - Custom vertex/fragment shaders for twinkling
 * - Infinite wrapping (stars reappear on opposite side)
 * - Nebula fog sprites for atmosphere
 * - Shooting stars
 * - Smooth camera inertia (lerp damping)
 */
export class CosmicBackground {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();

    // Camera target for smooth panning
    this.cameraTarget = { x: 0, y: 0 };
    this.cameraPosition = { x: 0, y: 0 };

    // Star layers
    this.starLayers = [];
    this.shootingStars = [];
    this.nebulaMeshes = [];

    this.init();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 3000);
    this.camera.position.z = 500;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.position = 'fixed';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0';

    // Create scene elements
    this.createStarLayers();
    this.createNebulaSprites();
    this.scheduleShootingStar();

    // Events
    window.addEventListener('resize', () => this.onResize());
  }

  // ═══════════════════════════════════
  // STAR LAYERS (Parallax Depth)
  // ═══════════════════════════════════
  createStarLayers() {
    const layers = [
      // Background: far, small, dim, slow parallax (Sizes Increased!)
      { count: 2000, zMin: -500, zMax: -200, sizeMin: 1.5, sizeMax: 3.0, color: '#8ca9cc', twinkleSpeed: 0.3 },
      // Midground: medium (Sizes Increased!)
      { count: 1500, zMin: -200, zMax: -50, sizeMin: 2.5, sizeMax: 5.0, color: '#bce1fa', twinkleSpeed: 0.5 },
      // Foreground: near, big, bright, fast parallax (Sizes Increased!)
      { count: 800, zMin: -50, zMax: 150, sizeMin: 4.0, sizeMax: 8.0, color: '#ffffff', twinkleSpeed: 0.8 },
    ];

    layers.forEach(opts => this.createStarLayer(opts));
  }

  createStarLayer(opts) {
    const { count, zMin, zMax, sizeMin, sizeMax, color, twinkleSpeed } = opts;
    const spread = 4000;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const brightness = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
      sizes[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
      phases[i] = Math.random() * Math.PI * 2;
      brightness[i] = 0.5 + Math.random() * 0.8; // Boosted base brightness
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uTwinkleSpeed: { value: twinkleSpeed },
      },
      vertexShader: /* glsl */`
        attribute float aSize;
        attribute float aPhase;
        attribute float aBrightness;
        varying float vAlpha;
        varying float vBrightness;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uTwinkleSpeed;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = -mvPosition.z;
          // Scaled up for better visibility
          gl_PointSize = aSize * uPixelRatio * (600.0 / max(depth, 1.0));
          gl_PointSize = clamp(gl_PointSize, 2.0, 20.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Twinkle with multiple sine waves for natural feel
          float twinkle = 0.5 + 0.3 * sin(uTime * uTwinkleSpeed + aPhase)
                              + 0.2 * sin(uTime * uTwinkleSpeed * 1.7 + aPhase * 2.3);
          vAlpha = twinkle * aBrightness;
          vBrightness = aBrightness;
        }
      `,
      fragmentShader: /* glsl */`
        varying float vAlpha;
        varying float vBrightness;
        uniform vec3 uColor;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          // Soft circular glow
          float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;
          
          // Brighter core
          float core = smoothstep(0.3, 0.0, dist) * vBrightness;
          
          vec3 col = uColor + vec3(core);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.starLayers.push({
      points,
      positions,
      spread,
      count,
    });
  }

  // ═══════════════════════════════════
  // NEBULA SPRITES (atmospheric fog)
  // ═══════════════════════════════════
  createNebulaSprites() {
    const nebulaCount = 12;
    const nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = 256;
    nebulaCanvas.height = 256;
    const nCtx = nebulaCanvas.getContext('2d');

    // Create soft radial gradient for nebula
    const gradient = nCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    gradient.addColorStop(0.3, 'rgba(30, 100, 180, 0.08)');
    gradient.addColorStop(0.7, 'rgba(15, 50, 100, 0.03)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nCtx.fillStyle = gradient;
    nCtx.fillRect(0, 0, 256, 256);

    const nebulaTexture = new THREE.CanvasTexture(nebulaCanvas);

    for (let i = 0; i < nebulaCount; i++) {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: nebulaTexture,
        transparent: true,
        opacity: 0.15 + Math.random() * 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.5, 0.4 + Math.random() * 0.2),
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      const scale = 300 + Math.random() * 600;
      sprite.scale.set(scale, scale, 1);
      sprite.position.set(
        (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 3000,
        -400 + Math.random() * 300
      );

      this.scene.add(sprite);
      this.nebulaMeshes.push({
        sprite,
        driftX: (Math.random() - 0.5) * 0.02,
        driftY: (Math.random() - 0.5) * 0.02,
        rotSpeed: (Math.random() - 0.5) * 0.0003,
      });
    }
  }

  // ═══════════════════════════════════
  // SHOOTING STARS
  // ═══════════════════════════════════
  scheduleShootingStar() {
    const delay = 15000 + Math.random() * 40000;
    setTimeout(() => {
      this.spawnShootingStar();
      this.scheduleShootingStar();
    }, delay);
  }

  spawnShootingStar() {
    const geometry = new THREE.BufferGeometry();
    const trailLength = 60;
    const positions = new Float32Array(trailLength * 3);
    const alphas = new Float32Array(trailLength);

    const fromRight = Math.random() > 0.5;
    const startX = this.camera.position.x + (fromRight ? 800 : -800);
    const startY = this.camera.position.y + (Math.random() - 0.3) * 600;
    const startZ = -100 + Math.random() * 200;

    for (let i = 0; i < trailLength; i++) {
      positions[i * 3] = startX;
      positions[i * 3 + 1] = startY;
      positions[i * 3 + 2] = startZ;
      alphas[i] = 1.0 - (i / trailLength);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 1.0 },
      },
      vertexShader: /* glsl */`
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = mix(0.5, 3.0, aAlpha);
        }
      `,
      fragmentShader: /* glsl */`
        varying float vAlpha;
        uniform float uOpacity;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist) * vAlpha * uOpacity;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Points(geometry, material);
    this.scene.add(line);

    this.shootingStars.push({
      mesh: line,
      positions,
      vx: (fromRight ? -1 : 1) * (12 + Math.random() * 8),
      vy: -(2 + Math.random() * 4),
      life: 1.0,
      headX: startX,
      headY: startY,
      headZ: startZ,
      trailLength,
    });
  }

  updateShootingStars() {
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.headX += s.vx;
      s.headY += s.vy;
      s.life -= 0.008;

      // Shift trail
      for (let j = s.trailLength - 1; j > 0; j--) {
        s.positions[j * 3] = s.positions[(j - 1) * 3];
        s.positions[j * 3 + 1] = s.positions[(j - 1) * 3 + 1];
        s.positions[j * 3 + 2] = s.positions[(j - 1) * 3 + 2];
      }
      s.positions[0] = s.headX;
      s.positions[1] = s.headY;
      s.positions[2] = s.headZ;

      s.mesh.geometry.attributes.position.needsUpdate = true;
      s.mesh.material.uniforms.uOpacity.value = Math.max(0, s.life);

      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.shootingStars.splice(i, 1);
      }
    }
  }

  // ═══════════════════════════════════
  // PANNING API
  // ═══════════════════════════════════
  setTarget(x, y) {
    this.cameraTarget.x = x;
    this.cameraTarget.y = y;
  }

  pan(dx, dy) {
    this.cameraTarget.x += dx;
    this.cameraTarget.y += dy;
  }

  // ═══════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════
  update() {
    const elapsed = this.clock.getElapsedTime();

    // Smooth camera follow (lerp damping)
    this.cameraPosition.x += (this.cameraTarget.x - this.cameraPosition.x) * 0.06;
    this.cameraPosition.y += (this.cameraTarget.y - this.cameraPosition.y) * 0.06;

    this.camera.position.x = this.cameraPosition.x;
    this.camera.position.y = this.cameraPosition.y;

    // Subtle deep-space parallax for the galaxy background image
    if (!this.galaxyBackdrop) {
      this.galaxyBackdrop = document.getElementById('galaxy-backdrop');
    }
    if (this.galaxyBackdrop) {
      this.galaxyBackdrop.style.transform = `translate3d(${-this.cameraPosition.x * 0.02}px, ${this.cameraPosition.y * 0.02}px, 0)`;
    }

    // Update star layers
    this.starLayers.forEach(layer => {
      layer.points.material.uniforms.uTime.value = elapsed;

      // Infinite wrapping
      const pos = layer.positions;
      const halfSpread = layer.spread / 2;

      for (let i = 0; i < layer.count; i++) {
        const idx = i * 3;
        // Wrap X relative to camera
        const relX = pos[idx] - this.camera.position.x;
        if (relX > halfSpread) pos[idx] -= layer.spread;
        else if (relX < -halfSpread) pos[idx] += layer.spread;

        // Wrap Y relative to camera
        const relY = pos[idx + 1] - this.camera.position.y;
        if (relY > halfSpread) pos[idx + 1] -= layer.spread;
        else if (relY < -halfSpread) pos[idx + 1] += layer.spread;
      }

      layer.points.geometry.attributes.position.needsUpdate = true;
    });

    // Update nebula drift
    this.nebulaMeshes.forEach(n => {
      n.sprite.position.x += n.driftX;
      n.sprite.position.y += n.driftY;
      n.sprite.material.rotation += n.rotSpeed;

      // Wrap nebula
      const relX = n.sprite.position.x - this.camera.position.x;
      const relY = n.sprite.position.y - this.camera.position.y;
      if (relX > 2000) n.sprite.position.x -= 4000;
      if (relX < -2000) n.sprite.position.x += 4000;
      if (relY > 2000) n.sprite.position.y -= 4000;
      if (relY < -2000) n.sprite.position.y += 4000;
    });

    // Update shooting stars
    this.updateShootingStars();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Update pixel ratio uniform
    this.starLayers.forEach(layer => {
      layer.points.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    });
  }

  dispose() {
    this.starLayers.forEach(l => {
      l.points.geometry.dispose();
      l.points.material.dispose();
    });
    this.nebulaMeshes.forEach(n => {
      n.sprite.material.map?.dispose();
      n.sprite.material.dispose();
    });
    this.shootingStars.forEach(s => {
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    });
    this.renderer.dispose();
  }
}
