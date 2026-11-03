import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Un objet du village relié à un conte. */
export interface Hotspot {
  id: string;
  /** conte associé (null : le griot propose le conte du soir) */
  slug: string | null;
  label: string;
  icon: string;
  x: number;
  z: number;
  /** hauteur de l'étiquette */
  h: number;
  /** rayon de la zone cliquable et de l'obstacle */
  r: number;
}

export const HOTSPOTS: Hotspot[] = [
  { id: 'griot', slug: null, label: 'Le griot', icon: 'fa-comment-dots', x: 0, z: -2.5, h: 1.75, r: 0.7 },
  { id: 'cheval', slug: 'yennenga', label: 'Le cheval de Yennenga', icon: 'fa-horse', x: -9, z: 5, h: 2.3, r: 1.5 },
  { id: 'masque', slug: 'do-et-les-masques-de-feuilles', label: 'Le masque de feuilles', icon: 'fa-masks-theater', x: -6.5, z: -6.5, h: 3.3, r: 0.8 },
  { id: 'calebasse', slug: 'la-calebasse-qui-avalait-tout', label: 'La calebasse', icon: 'fa-bowl-food', x: 5.5, z: 5, h: 1.5, r: 1 },
  { id: 'crocodile', slug: 'crocodiles-sabou', label: 'Le crocodile sacré', icon: 'fa-water', x: 12, z: 7, h: 1.4, r: 3.4 },
  { id: 'tiebele', slug: 'awa-et-les-murs-de-tiebele', label: 'La case de Tiébélé', icon: 'fa-house-chimney', x: 10, z: -7.5, h: 4.3, r: 2.9 },
  { id: 'puits', slug: 'le-puits-du-lion', label: 'Le puits', icon: 'fa-faucet-drip', x: -12, z: -2, h: 2.8, r: 1.2 },
];

const WALK_RADIUS = 21;
const EYE = 1.6;
const SPEED = 4.2;

/** Bruit déterministe : le village est identique à chaque visite. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
`;

export interface WorldEvents {
  /** un objet du village a été touché */
  select(id: string): void;
  /** le sol a été touché (déplacement) */
  walking?(): void;
  /** 5 fois par seconde : distances pour le son */
  listener?(fire: number, pond: number): void;
}

/** Monde 3D de la Veillée : aucune dépendance à Angular, tout est libéré par dispose(). */
export class VeilleeWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raf = 0;
  private last = performance.now();
  private time = 0;

  /* déplacement */
  private pos = new THREE.Vector3(0, EYE, 10.5);
  private yaw = 0;
  private pitch = -0.07;
  private target: { x: number; z: number; face?: { x: number; z: number; y: number } } | null = null;
  private stuck = 0;
  private lastGap = Infinity;
  private keys = new Set<string>();
  private bob = 0;
  private obstacles: { x: number; z: number; r: number }[] = [];
  private drag: { x: number; y: number; moved: boolean; id: number } | null = null;

  /* animés */
  private flames: THREE.Mesh[] = [];
  private flameMat: THREE.ShaderMaterial[] = [];
  private animated: { u: { value: number } }[] = [];
  private fireLight!: THREE.PointLight;
  private fireBase = 95;
  private griot!: { head: THREE.Object3D; arm: THREE.Object3D; body: THREE.Object3D };
  private horse!: { head: THREE.Object3D; tail: THREE.Object3D };
  private rings = new Map<string, THREE.Mesh>();
  private hits: THREE.Mesh[] = [];
  private labels = new Map<string, HTMLElement>();
  private talking = false;
  private hovered: string | null = null;
  private ray = new THREE.Raycaster();

  /* qualité */
  private low: boolean;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private frames = 0;
  private frameTime = 0;
  private degraded = 0;
  private shadowTick = 0;
  private listenTick = 0;

  private owned: { dispose(): void }[] = [];
  private unbind: (() => void)[] = [];
  private resize: ResizeObserver;
  /** vrai quand le contexte WebGL a été perdu */
  lost = false;

  constructor(
    private host: HTMLElement,
    private events: WorldEvents,
  ) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.low = coarse || (navigator.hardwareConcurrency ?? 8) <= 4;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.low, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.low ? 1.25 : 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.low;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 320);
    this.scene.background = new THREE.Color(0x0b1024);
    this.scene.fog = new THREE.FogExp2(0x0d1328, 0.016);

    this.build();
    this.bind();
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.renderer.shadowMap.needsUpdate = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  /* --------------------------------------------------------- API */

  setLabels(els: Map<string, HTMLElement>) {
    this.labels = els;
  }

  /** Le griot parle-t-il ? */
  setTalking(on: boolean) {
    this.talking = on;
  }

  /** Marche jusqu'à l'objet et se tourne vers lui. */
  walkTo(id: string) {
    const h = HOTSPOTS.find((x) => x.id === id);
    if (!h) return;
    const face = { x: h.x, z: h.z, y: Math.max(0.9, h.h * 0.55) };
    if (id === 'griot') {
      // la place de l'auditeur : le griot est visible à côté des flammes, pas derrière
      this.goTo(3.6, 6.2, face);
      return;
    }
    const dx = this.pos.x - h.x;
    const dz = this.pos.z - h.z;
    const d = Math.hypot(dx, dz) || 1;
    const stop = h.r + 3;
    if (d <= stop + 0.3) this.goTo(this.pos.x, this.pos.z, face);
    else this.goTo(h.x + (dx / d) * stop, h.z + (dz / d) * stop, face);
    this.events.walking?.();
  }

  /** Fixe une destination, repoussée hors des obstacles et des limites du village. */
  private goTo(x: number, z: number, face?: { x: number; z: number; y: number }) {
    const d = Math.hypot(x, z);
    if (d > WALK_RADIUS) {
      x *= WALK_RADIUS / d;
      z *= WALK_RADIUS / d;
    }
    for (const o of this.obstacles) {
      const dx = x - o.x;
      const dz = z - o.z;
      const g = Math.hypot(dx, dz) || 1;
      const min = o.r + 0.6;
      if (g < min) {
        x = o.x + (dx / g) * min;
        z = o.z + (dz / g) * min;
      }
    }
    this.target = { x, z, face };
    this.stuck = 0;
    this.lastGap = Infinity;
  }

  highlight(id: string | null) {
    this.hovered = id;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.unbind.forEach((f) => f());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.owned.forEach((o) => o.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /* ----------------------------------------------------- matériaux */

  private mats = new Map<number, THREE.MeshLambertMaterial>();
  private mat(color: number) {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.mats.set(color, m);
    }
    return m;
  }

  private part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0, s?: [number, number, number]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    if (s) m.scale.set(...s);
    parent.add(m);
    return m;
  }

  /** Cylindre tendu entre deux points (branches, bras, jambes). */
  private limb(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material, seg = 6) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(m);
    return m;
  }

  /* ---------------------------------------------------------- monde */

  private build() {
    const stat = new THREE.Group();
    this.sky();
    this.ground();
    this.lights();
    this.fire(stat);
    this.baobab(stat, 0, -11);
    this.village(stat);
    this.griotAndChildren(stat);
    this.horseAt(-9, 5);
    this.mask(stat, -6.5, -6.5);
    this.calabash(stat, 5.5, 5);
    this.pond(stat, 12, 7);
    this.tiebele(stat, 10, -7.5);
    this.well(stat, -12, -2);
    this.scatter(stat);
    this.fireflies();
    this.hotspotRings();

    // tout le décor immobile fusionné par matériau : une quinzaine d'appels de dessin au lieu de plusieurs centaines
    stat.updateMatrixWorld(true);
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    stat.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const mat = m.material as THREE.Material;
      if (!groups.has(mat)) groups.set(mat, []);
      groups.get(mat)!.push(g);
      m.geometry.dispose();
    });
    for (const [mat, list] of groups) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = mesh.receiveShadow = !this.low;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
  }

  private sky() {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(280, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        vertexShader: `varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying float vY; void main() {
          vec3 low = vec3(0.075, 0.09, 0.2), high = vec3(0.012, 0.018, 0.06);
          vec3 c = mix(low, high, smoothstep(0.0, 0.55, vY));
          c = mix(vec3(0.18, 0.11, 0.13), c, smoothstep(-0.02, 0.1, vY));
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    this.scene.add(dome);

    // étoiles, plus denses le long d'une bande (la Voie lactée)
    const r = rng(7);
    const n = this.low ? 900 : 2200;
    const pos = new Float32Array(n * 3);
    const sz = new Float32Array(n);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const band = i % 3 === 0;
      const th = r() * Math.PI * 2;
      const el = band ? 0.5 + (r() - 0.5) * 0.28 + Math.sin(th) * 0.28 : 0.08 + r() * 1.45;
      pos.set([Math.cos(th) * Math.cos(el) * 250, Math.sin(el) * 250, Math.sin(th) * Math.cos(el) * 250], i * 3);
      sz[i] = 0.8 + r() * r() * 3;
      ph[i] = r() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const uTime = { value: 0 };
    this.animated.push({ u: uTime });
    const dpr = this.renderer.getPixelRatio();
    this.scene.add(
      new THREE.Points(
        g,
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime },
          vertexShader: `attribute float aSize; attribute float aPhase; uniform float uTime; varying float vA;
            void main() { vA = 0.55 + 0.45 * sin(uTime * 1.3 + aPhase); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * ${dpr.toFixed(2)}; }`,
          fragmentShader: `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.9, 0.93, 1.0), vA * (1.0 - d * 2.0)); }`,
        }),
      ),
    );

    // lune et son halo
    const moon = new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf5eed8, fog: false, toneMapped: false }));
    moon.position.set(-70, 95, -130);
    this.scene.add(moon);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(55, 55),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv; void main() { float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.75, 0.8, 1.0), pow(max(0.0, 1.0 - d), 3.0) * 0.5); }`,
      }),
    );
    halo.position.copy(moon.position);
    halo.lookAt(0, 0, 0);
    this.scene.add(halo);
  }

  private ground() {
    const seg = this.low ? 70 : 120;
    const geo = new THREE.PlaneGeometry(320, 320, seg, seg).rotateX(-Math.PI / 2);
    const p = geo.attributes['position'] as THREE.BufferAttribute;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const r = rng(21);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      const edge = Math.max(0, d - 27);
      // sol plat dans le village, collines au loin
      const hill = edge * 0.035 * (Math.sin(x * 0.045) * Math.cos(z * 0.05) + 1.3) * Math.min(1, edge / 30) * 5;
      p.setY(i, hill + (edge > 0 ? (r() - 0.5) * 0.4 : 0));
      const t = Math.min(1, d / 26);
      c.setRGB(0.42 - t * 0.13 + (r() - 0.5) * 0.04, 0.24 - t * 0.05 + (r() - 0.5) * 0.03, 0.13 - t * 0.02);
      if (d < 7) c.lerp(new THREE.Color(0.28, 0.17, 0.11), 1 - d / 7);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.receiveShadow = !this.low;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
  }

  private lights() {
    this.scene.add(new THREE.HemisphereLight(0x6f85c4, 0x3a2416, 1.05));
    const moon = new THREE.DirectionalLight(0xa9bcf0, 0.7);
    moon.position.set(-30, 60, -40);
    this.scene.add(moon);
    this.fireLight = new THREE.PointLight(0xff9a3c, this.fireBase, 42, 1.7);
    this.fireLight.position.set(0, 1.5, 0);
    if (!this.low) {
      this.fireLight.castShadow = true;
      this.fireLight.shadow.mapSize.set(1024, 1024);
      this.fireLight.shadow.camera.near = 0.3;
      this.fireLight.shadow.camera.far = 32;
      this.fireLight.shadow.bias = -0.002;
      this.fireLight.shadow.radius = 3;
    }
    this.scene.add(this.fireLight);
  }

  private fire(stat: THREE.Group) {
    // le cercle de la veillée (feu, griot, enfants) forme un seul obstacle : on en fait le tour
    this.obstacles.push({ x: 0, z: 0, r: 4.2 });
    const stone = this.mat(0x5b5148);
    const r = rng(3);
    const rock = new THREE.IcosahedronGeometry(0.2, 0);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      this.part(stat, rock, stone, Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95, r() * 6, [1 + r() * 0.5, 0.75, 1]);
    }
    const wood = this.mat(0x2d1a0e);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.limb(stat, new THREE.Vector3(Math.cos(a) * 0.72, 0.07, Math.sin(a) * 0.72), new THREE.Vector3(Math.cos(a) * 0.05, 0.55, Math.sin(a) * 0.05), 0.09, 0.05, wood);
    }
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.72, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a14, toneMapped: false }));
    ember.position.y = 0.04;
    this.scene.add(ember);

    // flammes : bruit calculé dans le nuanceur, sur des plans tournés vers la caméra
    const vertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const fragment = `varying vec2 vUv; uniform float uTime; uniform float uSeed; ${NOISE}
      void main() {
        float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
        float n = fbm(vec2(x * 1.6 + uSeed, y * 2.2 - uTime * 1.6));
        float w = (1.0 - y) * 0.8 + 0.04;
        float d = abs(x + (n - 0.5) * y * 1.0);
        float f = (1.0 - smoothstep(w * 0.25, w, d)) * (1.0 - smoothstep(0.15, 1.0, y + n * 0.35)) * smoothstep(0.0, 0.06, y);
        vec3 col = mix(vec3(0.9, 0.17, 0.02), vec3(1.0, 0.62, 0.08), smoothstep(0.1, 0.6, f));
        col = mix(col, vec3(1.0, 0.95, 0.72), smoothstep(0.62, 1.0, f));
        gl_FragColor = vec4(col * 1.6, f);
      }`;
    [[2.3, 3.1, 0], [1.6, 2.4, 3.7]].forEach(([w, h, seed]) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uSeed: { value: seed } },
        vertexShader: vertex,
        fragmentShader: fragment,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat);
      m.position.y = 0.1;
      this.scene.add(m);
      this.flames.push(m);
      this.flameMat.push(mat);
    });

    // étincelles qui montent
    const n = this.low ? 30 : 70;
    const pos = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9], i * 3);
      phase[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const uTime = { value: 0 };
    this.animated.push({ u: uTime });
    const dpr = this.renderer.getPixelRatio();
    const sparks = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime },
        vertexShader: `attribute float aPhase; uniform float uTime; varying float vA;
          void main() {
            float t = fract(uTime * (0.16 + aPhase * 0.14) + aPhase * 7.0);
            vec3 p = position;
            p.y = t * 7.0 + 0.4;
            p.x += sin(t * 9.0 + aPhase * 20.0) * t * 0.8;
            p.z += cos(t * 7.0 + aPhase * 30.0) * t * 0.8;
            vA = (1.0 - t) * smoothstep(0.0, 0.05, t);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = min(5.0, 1.5 + 14.0 / max(1.0, -mv.z)) * ${dpr.toFixed(2)};
          }`,
        fragmentShader: `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.62, 0.2, vA * (1.0 - d * 2.0)); }`,
      }),
    );
    sparks.frustumCulled = false;
    this.scene.add(sparks);
  }

  private baobab(stat: THREE.Group, x: number, z: number) {
    this.obstacles.push({ x, z, r: 2.5 });
    const bark = this.mat(0x6a5546);
    const leaf = this.mat(0x3b6129);
    const profile = [[2.3, 0], [2.0, 0.6], [1.75, 2], [1.7, 3.6], [1.45, 5], [1.05, 6.2], [0.7, 7]].map(([r, y]) => new THREE.Vector2(r, y));
    this.part(stat, new THREE.LatheGeometry(profile, 11), bark, x, 0, z);
    const r = rng(11);
    const top = new THREE.Vector3(x, 6.7, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + r();
      const len = 3.4 + r() * 2.2;
      const tip = new THREE.Vector3(x + Math.cos(a) * len, 8.4 + r() * 2.2, z + Math.sin(a) * len);
      this.limb(stat, top, tip, 0.5, 0.17, bark);
      for (let k = 0; k < 2; k++) {
        const b = (a + (k ? 0.7 : -0.7));
        const twig = tip.clone().add(new THREE.Vector3(Math.cos(b) * 1.6, 0.8 + r(), Math.sin(b) * 1.6));
        this.limb(stat, tip, twig, 0.15, 0.05, bark, 5);
        this.part(stat, new THREE.IcosahedronGeometry(0.95 + r() * 0.65, 0), leaf, twig.x, twig.y + 0.2, twig.z, r() * 6, [1.15, 0.72, 1.15]);
      }
    }
  }

  private hut(stat: THREE.Group, x: number, z: number, radius: number, height: number, wall: number, door: number) {
    this.obstacles.push({ x, z, r: radius + 0.35 });
    const thatch = this.mat(0x9c7a3e);
    this.part(stat, new THREE.CylinderGeometry(radius, radius * 1.05, height, 14), this.mat(wall), x, height / 2, z);
    this.part(stat, new THREE.ConeGeometry(radius * 1.42, height * 1.2, 14), thatch, x, height + height * 0.58, z);
    this.part(stat, new THREE.ConeGeometry(0.1, 0.5, 5), this.mat(0x4c3a1d), x, height * 2.32, z);
    // porte tournée vers le feu
    const a = Math.atan2(-x, -z);
    const dx = Math.sin(a) * radius;
    const dz = Math.cos(a) * radius;
    const lit = door === 1;
    const doorMat = lit ? new THREE.MeshBasicMaterial({ color: 0x7a3d10, toneMapped: false }) : this.mat(0x170d08);
    this.part(stat, new THREE.BoxGeometry(0.8, 1.25, 0.1), doorMat, x + dx, 0.63, z + dz, a);
  }

  private village(stat: THREE.Group) {
    const huts: [number, number, number, number, number, number][] = [
      [-15, 8, 2.1, 2.4, 0x8d5833, 1], [-5.5, 15, 2.4, 2.6, 0x9a6238, 0], [5, 15.5, 2.0, 2.3, 0x8d5833, 1],
      [15, -1, 2.1, 2.4, 0x96603a, 0], [-14.5, -11, 2.3, 2.5, 0x9a6238, 1], [-5, -15, 2.1, 2.3, 0x8d5833, 0],
      [7, -15.5, 2.0, 2.3, 0x96603a, 1], [16.5, -12, 1.8, 2.1, 0x8d5833, 0],
    ];
    huts.forEach(([x, z, r, h, w, d]) => this.hut(stat, x, z, r, h, w, d));

    // greniers sur pilotis et canaris : la vie du village
    const clay = this.mat(0xa56a3f);
    const r = rng(17);
    [[-10.5, 12.5], [12, 12.5], [-10.5, -13.5]].forEach(([x, z]) => {
      this.obstacles.push({ x, z, r: 1.2 });
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.6;
        this.part(stat, new THREE.CylinderGeometry(0.08, 0.1, 0.8, 5), this.mat(0x3a2415), x + Math.cos(a) * 0.65, 0.4, z + Math.sin(a) * 0.65);
      }
      this.part(stat, new THREE.CylinderGeometry(0.95, 0.75, 1.5, 10), clay, x, 1.5, z);
      this.part(stat, new THREE.ConeGeometry(1.25, 1.15, 10), this.mat(0x9c7a3e), x, 2.8, z);
    });
    const pot = new THREE.SphereGeometry(0.34, 9, 6);
    [[-12.5, 6.2], [-3.5, 13], [7, 13.2], [13, 0.5], [-12.5, -9.7]].forEach(([x, z]) => {
      this.part(stat, pot, clay, x, 0.3, z, r() * 6, [1, 0.88, 1]);
      this.part(stat, pot, this.mat(0x6e4427), x + 0.5, 0.22, z + 0.25, r() * 6, [0.7, 0.62, 0.7]);
    });

    // mortier et pilon
    this.part(stat, new THREE.CylinderGeometry(0.34, 0.22, 0.62, 9), this.mat(0x4d2f1b), 7.5, 0.31, 11.7);
    this.limb(stat, new THREE.Vector3(7.5, 0.3, 11.7), new THREE.Vector3(7.85, 1.7, 11.5), 0.055, 0.075, this.mat(0x7a5533));
  }

  /** Personnage assis, face au feu. */
  private seated(parent: THREE.Object3D, s: number, cloth: number, cap: number | null) {
    const skin = this.mat(0x4d2e1c);
    const fabric = this.mat(cloth);
    this.part(parent, new THREE.ConeGeometry(0.34 * s, 0.86 * s, 8), fabric, 0, 0.72 * s, 0);
    this.part(parent, new THREE.IcosahedronGeometry(0.15 * s, 1), skin, 0, 1.22 * s, 0.02 * s);
    if (cap !== null) this.part(parent, new THREE.SphereGeometry(0.155 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(cap), 0, 1.25 * s, 0.01 * s);
    const leg = (dx: number) => {
      this.limb(parent, new THREE.Vector3(dx * s, 0.42 * s, 0), new THREE.Vector3(dx * 1.4 * s, 0.32 * s, 0.42 * s), 0.08 * s, 0.07 * s, fabric);
      this.limb(parent, new THREE.Vector3(dx * 1.4 * s, 0.32 * s, 0.42 * s), new THREE.Vector3(dx * 1.4 * s, 0.05 * s, 0.5 * s), 0.05 * s, 0.05 * s, skin);
    };
    leg(0.13);
    leg(-0.13);
    this.limb(parent, new THREE.Vector3(0.2 * s, 0.98 * s, 0), new THREE.Vector3(0.18 * s, 0.56 * s, 0.26 * s), 0.05 * s, 0.04 * s, fabric);
    this.limb(parent, new THREE.Vector3(-0.2 * s, 0.98 * s, 0), new THREE.Vector3(-0.18 * s, 0.56 * s, 0.26 * s), 0.05 * s, 0.04 * s, fabric);
  }

  private griotAndChildren(stat: THREE.Group) {
    // le griot : animé, donc hors de la fusion
    const g = new THREE.Group();
    g.position.set(0, 0, -2.5);
    g.rotation.y = 0.39; // tourné vers l'auditeur
    const skin = this.mat(0x4d2e1c);
    const boubou = this.mat(0xe6dcc8);
    this.part(g, new THREE.CylinderGeometry(0.28, 0.31, 0.42, 8), this.mat(0x3a2415), 0, 0.21, 0);
    const body = this.part(g, new THREE.ConeGeometry(0.46, 1.1, 8), boubou, 0, 0.92, 0);
    const trim = this.part(g, new THREE.CylinderGeometry(0.16, 0.25, 0.16, 8), this.mat(0xb13a22), 0, 1.32, 0);
    trim.scale.setScalar(1);
    const head = new THREE.Group();
    head.position.set(0, 1.56, 0.02);
    this.part(head, new THREE.IcosahedronGeometry(0.17, 1), skin);
    this.part(head, new THREE.CylinderGeometry(0.15, 0.18, 0.15, 8), this.mat(0xb13a22), 0, 0.14, 0);
    this.part(head, new THREE.ConeGeometry(0.11, 0.2, 6).rotateX(Math.PI), this.mat(0xd6d0c4), 0, -0.2, 0.08);
    g.add(head);
    const arm = new THREE.Group();
    arm.position.set(0.28, 1.28, 0.02);
    this.limb(arm, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.16, -0.14, 0.4), 0.075, 0.05, boubou);
    this.limb(arm, new THREE.Vector3(0.16, -0.14, 0.4), new THREE.Vector3(0.2, -0.1, 0.5), 0.045, 0.04, skin);
    g.add(arm);
    this.limb(g, new THREE.Vector3(-0.28, 1.28, 0.02), new THREE.Vector3(-0.32, 0.72, 0.28), 0.075, 0.05, boubou);
    // son bâton de conteur
    this.limb(g, new THREE.Vector3(-0.42, 0, 0.45), new THREE.Vector3(-0.34, 1.7, 0.3), 0.025, 0.03, this.mat(0x3a2415));
    this.griot = { head, arm, body };
    g.traverse((o) => ((o as THREE.Mesh).castShadow = !this.low));
    this.scene.add(g);

    // enfants : décor fixe, face au griot et au feu
    const kids: [number, number, number, number | null][] = [
      [-3.1, 1.4, 0xbf6a1f, null],
      [-1.5, 3.1, 0x7c3109, null],
      [1.5, 3.1, 0xe2a62e, 0xe2a62e],
      [3.1, 1.4, 0x9c2f24, null],
      [-3.2, -1.6, 0x38506f, null],
      [3.1, -1.8, 0x6a4a7a, 0x6a4a7a],
    ];
    kids.forEach(([x, z, c, cap]) => {
      const p = new THREE.Group();
      p.position.set(x, 0, z);
      p.rotation.y = Math.atan2(-x, -z);
      this.seated(p, 0.8 + (Math.abs(x * 7 + z) % 3) * 0.08, c, cap);
      stat.add(p);
    });
    // nattes sous les enfants
    const mat = this.mat(0xb39150);
    kids.slice(0, 4).forEach(([x, z]) => this.part(stat, new THREE.CylinderGeometry(0.55, 0.55, 0.03, 10), mat, x, 0.02, z));
  }

  private horseAt(x: number, z: number) {
    this.obstacles.push({ x, z, r: 1.45 });
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = 0.9;
    const coat = this.mat(0xe9e2d4);
    const dark = this.mat(0x4a3b30);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.25, 3, 8).rotateZ(Math.PI / 2), coat);
    body.position.y = 1.32;
    g.add(body);
    [[0.65, 0.26], [0.65, -0.26], [-0.65, 0.26], [-0.65, -0.26]].forEach(([dx, dz]) => {
      this.limb(g, new THREE.Vector3(dx, 1.15, dz), new THREE.Vector3(dx, 0.55, dz), 0.11, 0.075, coat);
      this.limb(g, new THREE.Vector3(dx, 0.55, dz), new THREE.Vector3(dx, 0.04, dz), 0.07, 0.07, coat);
      this.part(g, new THREE.CylinderGeometry(0.085, 0.1, 0.09, 6), dark, dx, 0.05, dz);
    });
    // selle rouge de la princesse
    this.part(g, new THREE.CylinderGeometry(0.44, 0.44, 0.75, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), this.mat(0xa82c1e), 0, 1.36, 0, Math.PI / 2);
    const head = new THREE.Group();
    head.position.set(0.95, 1.55, 0);
    this.limb(head, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.38, 0.6, 0), 0.25, 0.15, coat);
    this.limb(head, new THREE.Vector3(0.36, 0.62, 0), new THREE.Vector3(0.82, 0.32, 0), 0.15, 0.09, coat);
    this.part(head, new THREE.ConeGeometry(0.05, 0.2, 5), coat, 0.33, 0.85, 0.08);
    this.part(head, new THREE.ConeGeometry(0.05, 0.2, 5), coat, 0.33, 0.85, -0.08);
    for (let i = 0; i < 5; i++) this.part(head, new THREE.BoxGeometry(0.06, 0.2, 0.05), dark, 0.05 + i * 0.08, 0.2 + i * 0.13, 0, -0.5);
    g.add(head);
    const tail = new THREE.Group();
    tail.position.set(-1.05, 1.5, 0);
    this.limb(tail, new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.22, -0.85, 0), 0.07, 0.03, dark);
    g.add(tail);
    this.horse = { head, tail };
    g.traverse((o) => ((o as THREE.Mesh).castShadow = !this.low));
    this.scene.add(g);
    // piquet d'attache
    const post = this.mat(0x3a2415);
    this.limb(this.scene, new THREE.Vector3(x + 1.45, 0, z - 2), new THREE.Vector3(x + 1.45, 1.35, z - 2), 0.06, 0.05, post);
  }

  /** Motif peint sur une texture : masque et murs de Tiébélé. */
  private canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    this.owned.push(t);
    return t;
  }

  private mask(stat: THREE.Group, x: number, z: number) {
    this.obstacles.push({ x, z, r: 0.75 });
    const tex = this.canvasTexture(128, 256, (g) => {
      g.fillStyle = '#6d3a1b';
      g.fillRect(0, 0, 128, 256);
      g.fillStyle = '#eee3cc';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(0, 16 + i * 26);
        for (let k = 0; k <= 8; k++) g.lineTo(k * 16, 16 + i * 26 + (k % 2 ? 11 : 0));
        g.lineTo(128, 26 + i * 26);
        g.lineTo(0, 26 + i * 26);
        g.fill();
      }
      g.fillStyle = '#a9281a';
      g.fillRect(0, 168, 128, 16);
      g.fillStyle = '#141008';
      g.fillRect(0, 186, 128, 70);
      g.fillStyle = '#eee3cc';
      g.beginPath();
      g.arc(38, 218, 18, 0, 7);
      g.arc(90, 218, 18, 0, 7);
      g.fill();
      g.fillStyle = '#141008';
      g.beginPath();
      g.arc(38, 218, 8, 0, 7);
      g.arc(90, 218, 8, 0, 7);
      g.fill();
    });
    const wood = this.mat(0x3a2415);
    this.part(stat, new THREE.CylinderGeometry(0.09, 0.12, 1.55, 7), wood, x, 0.78, z);
    const a = Math.atan2(-x, -z);
    const face = new THREE.Group();
    face.position.set(x, 2.25, z);
    face.rotation.y = a;
    stat.add(face);
    const lit = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x2a1408 });
    this.part(face, new THREE.BoxGeometry(0.72, 1.45, 0.1), lit);
    this.part(face, new THREE.ConeGeometry(0.2, 0.75, 4), this.mat(0xa9281a), 0, 1.04, 0);
    // jupe de fibres et feuilles
    const fiber = this.mat(0x8c7a38);
    const r = rng(29);
    for (let i = 0; i < 18; i++) {
      const b = (i / 18) * Math.PI * 2;
      this.limb(stat, new THREE.Vector3(x + Math.cos(b) * 0.1, 1.55, z + Math.sin(b) * 0.1), new THREE.Vector3(x + Math.cos(b) * (0.52 + r() * 0.15), 0.1, z + Math.sin(b) * (0.52 + r() * 0.15)), 0.045, 0.015, fiber, 4);
    }
  }

  private calabash(stat: THREE.Group, x: number, z: number) {
    this.obstacles.push({ x, z, r: 0.9 });
    const mat = this.canvasTexture(128, 128, (g) => {
      g.fillStyle = '#a9782f';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#5b3c14';
      g.lineWidth = 3;
      for (let i = 1; i < 8; i++) {
        g.beginPath();
        g.moveTo(0, i * 16);
        g.lineTo(128, i * 16);
        g.stroke();
      }
    }, true);
    const profile = [[0, 0], [0.35, 0.04], [0.63, 0.25], [0.72, 0.55], [0.58, 0.85], [0.3, 1.0], [0.16, 1.2], [0.2, 1.36]].map(([r, y]) => new THREE.Vector2(r, y));
    this.part(stat, new THREE.LatheGeometry(profile, 11), new THREE.MeshLambertMaterial({ map: mat, emissive: 0x2a1a08, flatShading: true }), x, 0.04, z);
    // natte tressée, calebasses plus petites
    this.part(stat, new THREE.CylinderGeometry(1.2, 1.2, 0.03, 16), this.mat(0xa98a4b), x, 0.02, z);
    const small = new THREE.SphereGeometry(0.28, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    this.part(stat, small, this.mat(0x8d6425), x + 0.72, 0.03, z + 0.45);
    this.part(stat, small, this.mat(0x9c7131), x - 0.72, 0.03, z + 0.4, 0, [0.8, 0.8, 0.8]);
  }

  private pond(stat: THREE.Group, x: number, z: number) {
    this.obstacles.push({ x, z, r: 3.4 });
    const shape = new THREE.Mesh(
      new THREE.CircleGeometry(3.3, 24).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        fog: false,
        toneMapped: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vP; uniform float uTime; ${NOISE}
          void main() {
            float n = fbm(vP.xz * 1.8 + vec2(uTime * 0.12, -uTime * 0.09));
            vec3 c = mix(vec3(0.03, 0.08, 0.15), vec3(0.11, 0.2, 0.34), n);
            float glint = smoothstep(0.66, 0.74, n) * 0.5;
            gl_FragColor = vec4(c + vec3(0.65, 0.72, 0.9) * glint, 1.0);
          }`,
      }),
    );
    shape.position.set(x, 0.05, z);
    this.scene.add(shape);
    this.animated.push({ u: (shape.material as THREE.ShaderMaterial).uniforms['uTime'] as { value: number } });

    const bank = this.mat(0x3d2c1d);
    const r = rng(41);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.part(stat, new THREE.IcosahedronGeometry(0.25 + r() * 0.3, 0), bank, x + Math.cos(a) * 3.4, 0.08, z + Math.sin(a) * 3.4, r() * 6, [1.3, 0.45, 1]);
    }
    const reed = this.mat(0x5d6c2c);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 3.0 + r() * 0.8;
      this.limb(stat, new THREE.Vector3(x + Math.cos(a) * d, 0, z + Math.sin(a) * d), new THREE.Vector3(x + Math.cos(a) * (d + 0.1), 0.7 + r() * 0.8, z + Math.sin(a) * (d + 0.1)), 0.035, 0.008, reed, 4);
    }

    // le crocodile sacré, posé sur la berge, tourné vers le village
    const croc = new THREE.Group();
    croc.position.set(x - 2.1, 0.08, z - 1.6);
    croc.rotation.y = -2.3;
    const skin = this.mat(0x3f4f27);
    this.part(croc, new THREE.BoxGeometry(1.5, 0.3, 0.65), skin, 0, 0.26, 0);
    this.part(croc, new THREE.BoxGeometry(0.75, 0.2, 0.42), skin, 1.05, 0.22, 0);
    this.part(croc, new THREE.BoxGeometry(0.34, 0.12, 0.34), this.mat(0xc9c6a8), 1.3, 0.14, 0);
    this.part(croc, new THREE.IcosahedronGeometry(0.075, 0), this.mat(0xd9b53a), 0.85, 0.38, 0.16);
    this.part(croc, new THREE.IcosahedronGeometry(0.075, 0), this.mat(0xd9b53a), 0.85, 0.38, -0.16);
    for (let i = 0; i < 6; i++) {
      this.part(croc, new THREE.BoxGeometry(0.42, 0.2 - i * 0.022, 0.46 - i * 0.065), skin, -0.95 - i * 0.34, 0.22 - i * 0.02, Math.sin(i * 0.9) * 0.12);
      this.part(croc, new THREE.ConeGeometry(0.07, 0.15, 4), skin, -0.95 - i * 0.34, 0.37 - i * 0.03, Math.sin(i * 0.9) * 0.12);
    }
    [[0.45, 0.42], [0.45, -0.42], [-0.45, 0.42], [-0.45, -0.42]].forEach(([dx, dz]) => this.part(croc, new THREE.BoxGeometry(0.2, 0.12, 0.28), skin, dx, 0.09, dz));
    stat.add(croc);
  }

  private tiebele(stat: THREE.Group, x: number, z: number) {
    this.obstacles.push({ x, z, r: 2.95 });
    // murs peints à la main, comme à Tiébélé : losanges, triangles et lignes noirs, blancs et rouges
    const tex = this.canvasTexture(512, 128, (g) => {
      g.fillStyle = '#9d3b24';
      g.fillRect(0, 0, 512, 128);
      for (let i = 0; i < 16; i++) {
        const cx = i * 32 + 16;
        g.fillStyle = i % 2 ? '#111' : '#efe7d4';
        g.beginPath();
        g.moveTo(cx, 26);
        g.lineTo(cx + 16, 58);
        g.lineTo(cx, 90);
        g.lineTo(cx - 16, 58);
        g.fill();
        g.fillStyle = i % 2 ? '#efe7d4' : '#111';
        g.beginPath();
        g.moveTo(cx, 44);
        g.lineTo(cx + 7, 58);
        g.lineTo(cx, 72);
        g.lineTo(cx - 7, 58);
        g.fill();
      }
      g.fillStyle = '#111';
      g.fillRect(0, 0, 512, 12);
      g.fillRect(0, 116, 512, 12);
      g.fillStyle = '#efe7d4';
      for (let i = 0; i < 32; i++) {
        g.beginPath();
        g.moveTo(i * 16, 12);
        g.lineTo(i * 16 + 8, 24);
        g.lineTo(i * 16 + 16, 12);
        g.fill();
        g.beginPath();
        g.moveTo(i * 16, 116);
        g.lineTo(i * 16 + 8, 104);
        g.lineTo(i * 16 + 16, 116);
        g.fill();
      }
    }, true);
    const wall = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x281008 });
    this.part(stat, new THREE.CylinderGeometry(2.6, 2.75, 2.9, 18, 1, true), wall, x, 1.45, z);
    // toit-terrasse en banco, comme à Tiébélé
    const banco = this.mat(0x7a4427);
    this.part(stat, new THREE.CylinderGeometry(2.86, 2.72, 0.32, 18), banco, x, 3.02, z);
    this.part(stat, new THREE.CylinderGeometry(0.42, 0.42, 0.72, 10), banco, x + 0.9, 3.5, z - 0.6);
    this.part(stat, new THREE.ConeGeometry(0.62, 0.55, 10), this.mat(0x9c7a3e), x + 0.9, 4.1, z - 0.6);
    const a = Math.atan2(-x, -z);
    this.part(stat, new THREE.BoxGeometry(0.76, 0.95, 0.12), this.mat(0x130b06), x + Math.sin(a) * 2.68, 0.48, z + Math.cos(a) * 2.68, a);
  }

  private well(stat: THREE.Group, x: number, z: number) {
    this.obstacles.push({ x, z, r: 1.2 });
    const banco = this.mat(0x8c6242);
    const r = rng(53);
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + k * 0.28;
        this.part(stat, new THREE.BoxGeometry(0.48, 0.24, 0.26), banco, x + Math.cos(a) * 0.82, 0.13 + k * 0.25, z + Math.sin(a) * 0.82, -a + Math.PI / 2 + (r() - 0.5) * 0.1);
      }
    }
    this.part(stat, new THREE.CircleGeometry(0.72, 12).rotateX(-Math.PI / 2), this.mat(0x040507), x, 0.65, z);
    const wood = this.mat(0x3a2415);
    this.limb(stat, new THREE.Vector3(x - 0.95, 0, z), new THREE.Vector3(x - 0.95, 2.2, z), 0.08, 0.07, wood);
    this.limb(stat, new THREE.Vector3(x + 0.95, 0, z), new THREE.Vector3(x + 0.95, 2.2, z), 0.08, 0.07, wood);
    this.limb(stat, new THREE.Vector3(x - 1.1, 2.2, z), new THREE.Vector3(x + 1.1, 2.2, z), 0.075, 0.075, wood);
    this.limb(stat, new THREE.Vector3(x, 2.2, z), new THREE.Vector3(x, 1.35, z), 0.012, 0.012, this.mat(0x9c8a5e), 4);
    this.part(stat, new THREE.CylinderGeometry(0.17, 0.12, 0.25, 8), this.mat(0x6c4a2a), x, 1.25, z);
  }

  private scatter(stat: THREE.Group) {
    const r = rng(77);
    // herbes sèches
    const tuft = new THREE.ConeGeometry(0.1, 0.42, 4);
    const grass = [this.mat(0x8b7a3a), this.mat(0x6e6c2d), this.mat(0xa28d4b)];
    const free = (x: number, z: number, m = 0.6) => this.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + m) && Math.hypot(x, z) > 7;
    for (let i = 0; i < (this.low ? 70 : 170); i++) {
      const a = r() * Math.PI * 2;
      const d = 7 + r() * 28;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!free(x, z)) continue;
      const m = grass[Math.floor(r() * 3)];
      for (let k = 0; k < 3; k++) this.part(stat, tuft, m, x + (r() - 0.5) * 0.35, 0.2, z + (r() - 0.5) * 0.35, r() * 6, [1, 0.7 + r() * 0.9, 1]);
    }
    // pierres
    const stone = this.mat(0x4e4339);
    for (let i = 0; i < (this.low ? 16 : 34); i++) {
      const a = r() * Math.PI * 2;
      const d = 8 + r() * 30;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!free(x, z)) continue;
      this.part(stat, new THREE.IcosahedronGeometry(0.15 + r() * 0.32, 0), stone, x, 0.08, z, r() * 6, [1.2, 0.6, 1]);
    }
    // savane au loin : acacias en ombrelle
    const trunk = this.mat(0x251810);
    const crown = this.mat(0x2d4a24);
    const canopy = new THREE.IcosahedronGeometry(2.1, 0);
    for (let i = 0; i < (this.low ? 16 : 34); i++) {
      const a = (i / (this.low ? 16 : 34)) * Math.PI * 2 + r() * 0.15;
      const d = 29 + r() * 34;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const h = 3.2 + r() * 2.2;
      const base = Math.max(0, d - 27) * 0.05;
      this.limb(stat, new THREE.Vector3(x, base, z), new THREE.Vector3(x + (r() - 0.5), base + h, z + (r() - 0.5)), 0.2, 0.09, trunk, 5);
      this.part(stat, canopy, crown, x, base + h + 0.3, z, r() * 6, [1.3 + r() * 0.6, 0.34, 1.3 + r() * 0.6]);
    }
  }

  private fireflies() {
    const r = rng(91);
    const n = this.low ? 30 : 70;
    const pos = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * 17;
      pos.set([Math.cos(a) * d, 0.4 + r() * 2.2, Math.sin(a) * d], i * 3);
      ph[i] = r() * 30;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const uTime = { value: 0 };
    this.animated.push({ u: uTime });
    const dpr = this.renderer.getPixelRatio();
    const p = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime },
        vertexShader: `attribute float aPhase; uniform float uTime; varying float vA;
          void main() { vec3 q = position;
            q.x += sin(uTime * 0.45 + aPhase) * 0.8; q.y += sin(uTime * 0.7 + aPhase * 2.0) * 0.35; q.z += cos(uTime * 0.38 + aPhase) * 0.8;
            vA = pow(max(0.0, sin(uTime * 1.4 + aPhase * 3.0)), 3.0);
            vec4 mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(5.0, 1.5 + 14.0 / max(1.0, -mv.z)) * ${dpr.toFixed(2)}; }`,
        fragmentShader: `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.86, 0.42, vA * (1.0 - d * 2.0)); }`,
      }),
    );
    p.frustumCulled = false;
    this.scene.add(p);
  }

  private hotspotRings() {
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.owned.push(hitMat);
    for (const h of HOTSPOTS) {
      const radius = h.r + 0.5;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.08, radius, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false, fog: false }),
      );
      ring.position.set(h.x, 0.08, h.z);
      ring.renderOrder = 2;
      this.scene.add(ring);
      this.rings.set(h.id, ring);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(h.r + 0.25, h.r + 0.25, h.h + 0.6, 8), hitMat);
      hit.position.set(h.x, (h.h + 0.6) / 2, h.z);
      hit.userData['id'] = h.id;
      this.scene.add(hit);
      this.hits.push(hit);
    }
  }

  /* ------------------------------------------------------ interactions */

  private bind() {
    const el = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(t, f as EventListener);
      this.unbind.push(() => el.removeEventListener(t, f as EventListener));
    };
    on('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      el.setPointerCapture(e.pointerId);
    });
    on('pointermove', (e) => {
      if (this.drag && this.drag.id === e.pointerId) {
        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        if (this.drag.moved || Math.hypot(dx, dy) > 7) {
          this.drag.moved = true;
          this.drag.x = e.clientX;
          this.drag.y = e.clientY;
          this.yaw -= dx * 0.0042;
          this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0034, -0.75, 0.75);
          if (this.target?.face) this.target.face = undefined;
        }
      } else if (e.pointerType === 'mouse') {
        const id = this.pick(e.clientX, e.clientY);
        el.style.cursor = id ? 'pointer' : 'grab';
        this.hovered = id;
      }
    });
    const up = (e: PointerEvent) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || e.type === 'pointercancel') return;
      const id = this.pick(e.clientX, e.clientY);
      if (id) {
        this.walkTo(id);
        this.events.select(id);
        return;
      }
      const g = this.groundAt(e.clientX, e.clientY);
      if (g) {
        this.goTo(g.x, g.z);
        this.events.walking?.();
      }
    };
    on('pointerup', up);
    on('pointercancel', up);
    const contextLost = (e: Event) => {
      e.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.raf);
    };
    el.addEventListener('webglcontextlost', contextLost);
    this.unbind.push(() => el.removeEventListener('webglcontextlost', contextLost));

    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.matches?.('input, select, textarea')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        // les flèches ne déplacent que si le focus n'est pas sur un contrôle de la page
        if (e.code.startsWith('Arrow') && t && t !== document.body && !t.closest('.vl-stage')) return;
        e.preventDefault();
        this.keys.add(e.code);
        this.target = null;
      }
    };
    const release = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    addEventListener('keydown', down);
    addEventListener('keyup', release);
    addEventListener('blur', blur);
    this.unbind.push(() => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', release);
      removeEventListener('blur', blur);
    });
  }

  private ndc(cx: number, cy: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  }

  private pick(cx: number, cy: number): string | null {
    this.ray.setFromCamera(this.ndc(cx, cy), this.camera);
    const hit = this.ray.intersectObjects(this.hits, false)[0];
    return (hit?.object.userData['id'] as string) ?? null;
  }

  private groundAt(cx: number, cy: number) {
    this.ray.setFromCamera(this.ndc(cx, cy), this.camera);
    const p = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!p || p.distanceTo(this.pos) > 34) return null;
    return p;
  }

  /* ------------------------------------------------------------- image */

  private fit() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // en portrait, on élargit le champ pour garder la scène lisible
    this.camera.fov = w < h ? 76 : 62;
    this.camera.updateProjectionMatrix();
  }

  private collide() {
    for (const o of this.obstacles) {
      const dx = this.pos.x - o.x;
      const dz = this.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.35;
      if (d < min && d > 0) {
        this.pos.x = o.x + (dx / d) * min;
        this.pos.z = o.z + (dz / d) * min;
      }
    }
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > WALK_RADIUS) {
      this.pos.x *= WALK_RADIUS / d;
      this.pos.z *= WALK_RADIUS / d;
    }
  }

  private move(dt: number) {
    let mx = 0;
    let mz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    if (this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('KeyD')) mx += 1;
    if (this.keys.has('ArrowLeft')) this.yaw += dt * 1.8;
    if (this.keys.has('ArrowRight')) this.yaw -= dt * 1.8;
    let moving = false;
    if (mx || mz) {
      const l = Math.hypot(mx, mz);
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      this.pos.x += ((mx * cos + mz * sin) / l) * SPEED * dt;
      this.pos.z += ((-mx * sin + mz * cos) / l) * SPEED * dt;
      moving = true;
    } else if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.08) {
        const [sx, sz] = this.steer(dx / d, dz / d, d);
        const step = Math.min(d, SPEED * dt);
        this.pos.x += sx * step;
        this.pos.z += sz * step;
        moving = true;
        // aucun progrès pendant 2 s : destination inaccessible, on s'arrête là
        if (d < this.lastGap - 0.02) {
          this.lastGap = d;
          this.stuck = 0;
        } else if ((this.stuck += dt) > 2) {
          this.target = this.target.face ? { x: this.pos.x, z: this.pos.z, face: this.target.face } : null;
        }
      }
      const arrived = d <= 0.08;
      const face = this.target?.face;
      // regarde où il marche, puis l'objet une fois arrivé
      const look = face && (arrived || d < 3) ? face : !arrived && d > 0.6 ? this.target : null;
      if (look) {
        const want = Math.atan2(-(look.x - this.pos.x), -(look.z - this.pos.z));
        const diff = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
        this.yaw += diff * Math.min(1, dt * 3.5);
        const wantPitch = face && look === face ? Math.atan2(face.y - EYE, Math.hypot(face.x - this.pos.x, face.z - this.pos.z)) : -0.04;
        this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 3);
        if (arrived && Math.abs(diff) < 0.02) this.target = null;
      } else if (arrived) {
        this.target = null;
      }
    }
    this.collide();
    if (moving && !this.reduced) this.bob += dt * 9;
    this.camera.position.set(this.pos.x, EYE + (moving && !this.reduced ? Math.sin(this.bob) * 0.035 : 0), this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Contourne l'obstacle le plus proche sur la route : direction corrigée, toujours unitaire. */
  private steer(ux: number, uz: number, dist: number): [number, number] {
    let best: { o: { x: number; z: number; r: number }; along: number } | null = null;
    for (const o of this.obstacles) {
      const ox = o.x - this.pos.x;
      const oz = o.z - this.pos.z;
      const along = ox * ux + oz * uz;
      if (along < 0 || along > Math.min(dist, o.r + 3.5)) continue;
      const side = Math.abs(ox * uz - oz * ux);
      if (side < o.r + 0.75 && (!best || along < best.along)) best = { o, along };
    }
    if (!best) return [ux, uz];
    const ox = best.o.x - this.pos.x;
    const oz = best.o.z - this.pos.z;
    // passe du côté où la cible est déjà la plus décalée
    const sign = ox * uz - oz * ux >= 0 ? 1 : -1;
    const gap = Math.hypot(ox, oz);
    const tx = (-oz / gap) * -sign;
    const tz = (ox / gap) * -sign;
    const mix = Math.min(1, (best.o.r + 2.2) / Math.max(gap, 0.01));
    const vx = ux * (1 - mix) + tx * mix;
    const vz = uz * (1 - mix) + tz * mix;
    const l = Math.hypot(vx, vz) || 1;
    return [vx / l, vz / l];
  }

  private updateLabels(w: number, h: number) {
    const v = new THREE.Vector3();
    for (const s of HOTSPOTS) {
      const el = this.labels.get(s.id);
      if (!el) continue;
      v.set(s.x, s.h, s.z).project(this.camera);
      const dist = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05 || dist > 30) {
        el.style.visibility = 'hidden';
        continue;
      }
      el.style.visibility = 'visible';
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      el.classList.toggle('near', dist < 15);
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    const raw = now - this.last;
    this.last = now;
    this.time += this.reduced ? dt * 0.35 : dt;
    const t = this.time;

    this.move(dt);

    for (const a of this.animated) a.u.value = t;
    this.flameMat.forEach((m) => (m.uniforms['uTime'].value = t));
    for (const f of this.flames) {
      const dx = this.camera.position.x - f.position.x;
      const dz = this.camera.position.z - f.position.z;
      f.rotation.y = Math.atan2(dx, dz);
    }
    const flicker = this.reduced ? 1 : 0.86 + Math.sin(t * 11.3) * 0.06 + Math.sin(t * 23.1) * 0.05 + Math.sin(t * 4.7) * 0.05;
    this.fireLight.intensity = this.fireBase * flicker;

    // le griot parle et gesticule quand un conte est raconté
    const g = this.griot;
    g.head.rotation.x = this.talking ? Math.sin(t * 5.2) * 0.1 + 0.03 : Math.sin(t * 0.6) * 0.03;
    g.head.rotation.y = this.talking ? Math.sin(t * 1.3) * 0.32 : Math.sin(t * 0.35) * 0.15;
    g.arm.rotation.x = this.talking ? -0.5 + Math.sin(t * 2.6) * 0.32 : Math.sin(t * 0.8) * 0.03;
    g.arm.rotation.z = this.talking ? Math.sin(t * 1.7) * 0.22 : 0;
    this.horse.head.rotation.z = Math.sin(t * 0.5) * 0.05 - (Math.sin(t * 0.13) > 0.75 ? 0.35 : 0);
    this.horse.tail.rotation.z = Math.sin(t * 2.4) * 0.16;
    this.horse.tail.rotation.x = Math.sin(t * 1.9) * 0.2;

    for (const [id, ring] of this.rings) {
      const m = ring.material as THREE.MeshBasicMaterial;
      const on = id === this.hovered;
      m.opacity = on ? 1 : 0.28 + Math.sin(t * 2 + ring.position.x) * 0.12;
      ring.scale.setScalar(on ? 1.05 : 1);
    }

    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.updateLabels(w, h);

    // ombres recalculées rarement : le décor ne bouge pas
    if (this.fireLight.castShadow && ++this.shadowTick % 24 === 0) this.renderer.shadowMap.needsUpdate = true;

    if (++this.listenTick % 12 === 0) {
      this.events.listener?.(Math.hypot(this.pos.x, this.pos.z), Math.hypot(this.pos.x - 12, this.pos.z - 7));
    }

    this.renderer.render(this.scene, this.camera);
    this.adapt(raw);
  };

  /** Qualité réglée d'après la fluidité réelle : l'expérience reste jouable sur tout appareil. */
  private adapt(ms: number) {
    if (document.hidden || ms > 400) return;
    this.frames++;
    this.frameTime += ms;
    if (this.frameTime < 2500) return;
    const avg = this.frameTime / this.frames;
    this.frames = 0;
    this.frameTime = 0;
    if (avg < 30 || this.degraded >= 3) return;
    this.degraded++;
    if (this.fireLight.castShadow) {
      this.fireLight.castShadow = false;
      this.renderer.shadowMap.needsUpdate = true;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) m.needsUpdate = true;
      });
      return;
    }
    this.renderer.setPixelRatio(Math.max(0.65, this.renderer.getPixelRatio() * 0.75));
    this.fit();
  }
}
