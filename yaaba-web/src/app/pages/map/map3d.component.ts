import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { City, MapLevel, Tale } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { BF_CENTER, featureRings } from '../../shared/geo';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { COLORS, REGION_TONES_DARK, REGION_TONES_LIGHT, inside, labelSpot, pinHtml, spread } from './map-shared';

const S = 10;
const K = Math.cos((BF_CENTER.lat * Math.PI) / 180);
const BASE_H = 0.9;
const HOVER_H = 1.5;
const SELECTED_H = 2.2;

interface RegionObj {
  code: string;
  mesh: THREE.Mesh;
  top: THREE.Group;
  label: HTMLElement;
  lbl: CSS2DObject;
  cap: THREE.MeshStandardMaterial;
  side: THREE.MeshStandardMaterial;
  border: THREE.LineBasicMaterial;
  center: THREE.Vector3;
  size: number;
  rings: [number, number][][];
}

interface CamTween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
}

function project(lon: number, lat: number): [number, number] {
  return [(lon - BF_CENTER.lon) * K * S, (lat - BF_CENTER.lat) * S];
}

/** Centre approximatif d'un anneau (moyenne de ses sommets), en [lon, lat]. */
function ringCenter(ring: number[][]): [number, number] {
  if (!ring.length) return [BF_CENTER.lon, BF_CENTER.lat];
  const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return [lon, lat];
}

/** Générateur pseudo-aléatoire déterministe : les arbres sont toujours au même endroit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

@Component({
  selector: 'app-map3d',
  imports: [TranslatePipe],
  template: `
    <div #host class="host" [class.grab]="!hovering()" [class.point]="hovering()"></div>
    @if (error()) {
      <div class="error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>{{ 'map.noWebgl' | t }}</p>
      </div>
    }
    <div class="hint" [class.hide]="interacted()">
      <span><i class="fa-solid fa-computer-mouse"></i> {{ 'map.hint3d' | t }}</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .host { position: absolute; inset: 0; touch-action: none; }
    .grab { cursor: grab; }
    .grab:active { cursor: grabbing; }
    .point { cursor: pointer; }
    .error { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; text-align: center; color: var(--text-2); padding: 24px; }
    .error i { font-size: 2rem; color: var(--y-red); }
    .hint {
      position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
      padding: 8px 16px; border-radius: 999px; background: var(--text); color: var(--bg);
      font-size: 0.8rem; font-weight: 600; pointer-events: none; white-space: nowrap;
      transition: opacity 0.5s, transform 0.5s;
    }
    .hint.hide { opacity: 0; transform: translate(-50%, 10px); }
    @media (max-width: 600px) { .hint { display: none; } }
  `,
})
export class Map3dComponent implements AfterViewInit, OnDestroy {
  private data = inject(DataService);
  private i18n = inject(I18nService);
  private theme = inject(ThemeService);
  private zone = inject(NgZone);

  readonly tales = input.required<Tale[]>();
  readonly selectedRegion = input<string | null>(null);
  readonly selectedTale = input<string | null>(null);
  /** niveau de détail : régions, provinces, communes ou villes */
  readonly level = input<MapLevel>('region');
  readonly regionSelect = output<string>();
  readonly taleSelect = output<string>();

  readonly error = signal(false);
  readonly hovering = signal(false);
  readonly interacted = signal(false);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private renderer?: THREE.WebGLRenderer;
  private labels?: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  private controls?: OrbitControls;
  private regions: RegionObj[] = [];
  private pins = new Map<string, CSS2DObject>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: string | null = null;
  private tween?: CamTween;
  private raf = 0;
  private clock = new THREE.Clock();
  private resize?: ResizeObserver;
  private down = { x: 0, y: 0 };
  private disposables: { dispose(): void }[] = [];
  private ready = signal(false);
  private homePos = new THREE.Vector3(0, 82, 72);

  constructor() {
    effect(() => {
      if (!this.ready()) return;
      const dark = this.theme.dark();
      untracked(() => this.applyTheme(dark));
    });
    effect(() => {
      if (!this.ready()) return;
      const level = this.level();
      const d = { province: this.data.provinces(), commune: this.data.communes(), city: this.data.cities() };
      untracked(() => this.buildDetail(level, d));
    });
    effect(() => {
      const rivers = this.data.rivers();
      if (!this.ready() || !rivers || this.riversDrawn) return;
      untracked(() => this.buildRivers(rivers));
    });
    effect(() => {
      if (!this.ready()) return;
      const tales = this.tales();
      const active = this.selectedTale();
      this.i18n.lang();
      untracked(() => this.buildPins(tales, active));
    });
    effect(() => {
      if (!this.ready()) return;
      const region = this.selectedRegion();
      const tale = this.selectedTale();
      untracked(() => this.focus(region, tale));
    });
  }

  ngAfterViewInit() {
    const el = this.host().nativeElement;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      this.error.set(true);
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(r.domElement);

    this.labels = new CSS2DRenderer();
    // couche à part : les étiquettes restent au-dessus des épingles mais sous les fenêtres (visite guidée, menus)
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1', isolation: 'isolate' });
    el.appendChild(this.labels.domElement);

    this.camera.position.copy(this.homePos);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      minDistance: 18,
      maxDistance: 150,
      maxPolarAngle: 1.2,
      minPolarAngle: 0.12,
      autoRotate: true,
      autoRotateSpeed: 0.35,
      enablePan: true,
      screenSpacePanning: true,
    });
    this.controls.addEventListener('start', () => {
      this.controls!.autoRotate = false;
      this.tween = undefined;
      if (!this.interacted()) this.zone.run(() => this.interacted.set(true));
    });

    this.buildScene();
    this.applyTheme(this.theme.dark());

    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(el);
    this.onResize();

    r.domElement.addEventListener('pointermove', this.onMove);
    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.domElement.addEventListener('pointerleave', this.onLeave);

    this.zone.runOutsideAngular(() => this.loop());
    this.ready.set(true);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.resize?.disconnect();
    this.controls?.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer?.domElement.removeEventListener('pointermove', this.onMove);
    this.renderer?.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer?.domElement.removeEventListener('pointerup', this.onUp);
    this.renderer?.domElement.removeEventListener('pointerleave', this.onLeave);
    this.renderer?.dispose();
    this.labels?.domElement.remove();
  }

  /* ---------------------------------------------------------------- scène */

  private buildScene() {
    const geo = this.data.geo()!;
    const scene = this.scene;

    scene.add(new THREE.HemisphereLight(0xfff6e5, 0x8a7a63, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-30, 70, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    scene.add(sun);

    const groundGeo = new THREE.PlaneGeometry(600, 600);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.receiveShadow = true;
    scene.add(ground);
    this.disposables.push(groundGeo);

    const treeTrunk = new THREE.CylinderGeometry(0.06, 0.09, 0.45, 6);
    treeTrunk.translate(0, 0.22, 0);
    const treeCrown = new THREE.IcosahedronGeometry(0.34, 0);
    treeCrown.translate(0, 0.62, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, flatShading: true });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x5c7f3b, flatShading: true });
    this.disposables.push(treeTrunk, treeCrown, trunkMat, crownMat);

    geo.features.forEach((f, idx) => {
      const code = f.properties!['code'] as string;
      const rings = [...featureRings(f)].map((ring) => ring.map(([lon, lat]) => project(lon, lat)));
      const shapes: THREE.Shape[] = [];
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys as number[][][][]) {
        const [outer, ...holes] = poly.map((ring) => ring.map(([lon, lat]) => new THREE.Vector2(...project(lon, lat))));
        const shape = new THREE.Shape(outer);
        holes.forEach((h) => shape.holes.push(new THREE.Path(h)));
        shapes.push(shape);
      }

      const geom = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      geom.rotateX(-Math.PI / 2);
      const cap = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true });
      const side = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
      const mesh = new THREE.Mesh(geom, [cap, side]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.scale.y = BASE_H;
      mesh.userData['code'] = code;
      mesh.userData['idx'] = idx;
      this.scene.add(mesh);

      // contour blanc posé sur le dessus
      const border = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
      for (const ring of rings) {
        const pts = ring.map(([x, y]) => new THREE.Vector3(x, 1.002, -y));
        const lg = new THREE.BufferGeometry().setFromPoints(pts);
        mesh.add(new THREE.LineLoop(lg, border));
        this.disposables.push(lg);
      }

      // centre et taille
      geom.computeBoundingBox();
      const bb = geom.boundingBox!;
      const center = new THREE.Vector3((bb.min.x + bb.max.x) / 2, 0, (bb.min.z + bb.max.z) / 2);
      const size = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      const outer = rings[0];
      const cx = outer.reduce((a, p) => a + p[0], 0) / outer.length;
      const cy = outer.reduce((a, p) => a + p[1], 0) / outer.length;

      // groupe posé sur le dessus de la région (épingles, arbres, étiquette)
      const top = new THREE.Group();
      top.position.y = BASE_H;
      this.scene.add(top);

      const rand = rng(idx * 97 + 13);
      let placed = 0;
      for (let tries = 0; tries < 200 && placed < Math.round(size * 0.7); tries++) {
        const x = bb.min.x + rand() * (bb.max.x - bb.min.x);
        const y = -(bb.min.z + rand() * (bb.max.z - bb.min.z));
        if (!inside(x, y, outer)) continue;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(treeTrunk, trunkMat);
        const crown = new THREE.Mesh(treeCrown, crownMat);
        trunk.castShadow = crown.castShadow = true;
        tree.add(trunk, crown);
        tree.position.set(x, 0, -y);
        const s = 0.7 + rand() * 0.6;
        tree.scale.set(s, s, s);
        tree.rotation.y = rand() * Math.PI;
        top.add(tree);
        placed++;
      }

      const label = document.createElement('div');
      label.className = 'y-label';
      label.textContent = f.properties!['name'];
      const lbl = new CSS2DObject(label);
      lbl.position.set(cx, 0.6, -cy);
      top.add(lbl);

      this.regions.push({ code, mesh, top, label, lbl, cap, side, border, center, size, rings });
      this.disposables.push(geom, cap, side, border);
    });
  }

  private riversDrawn = false;
  /** objets du niveau de détail (tracés, noms, villes), retirés à chaque changement */
  private detailObjs: THREE.Object3D[] = [];

  private buildDetail(
    level: MapLevel,
    d: { province: GeoJSON.FeatureCollection | null; commune: GeoJSON.FeatureCollection | null; city: City[] | null },
  ) {
    for (const o of this.detailObjs) {
      o.removeFromParent();
      if (o instanceof THREE.Line) o.geometry.dispose();
    }
    this.detailObjs = [];
    // noms de régions masqués quand on affiche provinces ou communes
    for (const r of this.regions) r.label.style.display = level === 'province' || level === 'commune' ? 'none' : '';
    const dark = this.theme.dark();

    const fc = level === 'province' ? d.province : level === 'commune' ? d.commune : null;
    if (fc) {
      const mat = new THREE.LineBasicMaterial({ color: dark ? 0xe9d5bd : 0x7c3109, transparent: true, opacity: level === 'province' ? 0.85 : 0.45 });
      for (const f of fc.features) {
        const owner = this.regions.find((r) => r.code === f.properties?.['region']);
        if (!owner) continue;
        for (const ring of featureRings(f)) {
          const pts = ring.map(([lon, lat]) => {
            const [x, y] = project(lon, lat);
            return new THREE.Vector3(x, 0.04, -y);
          });
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
          owner.top.add(line);
          this.detailObjs.push(line);
        }
        if (level === 'province') {
          const [lon, lat] = ringCenter(featureRings(f).next().value ?? []);
          const [x, y] = project(lon, lat);
          const el = document.createElement('div');
          el.className = 'y-label small';
          el.textContent = f.properties?.['name'];
          const obj = new CSS2DObject(el);
          obj.position.set(x, 0.5, -y);
          owner.top.add(obj);
          this.detailObjs.push(obj);
        }
      }
    }

    if (level === 'city' && d.city) {
      for (const c of d.city) {
        const owner = this.regions.find((r) => r.code === c.region);
        if (!owner) continue;
        const el = document.createElement('div');
        el.className = c.rank === 'region' ? 'y-city big' : 'y-city';
        el.innerHTML = `<i></i><span>${c.name}</span>`;
        const obj = new CSS2DObject(el);
        const [x, y] = project(c.coords[1], c.coords[0]);
        obj.position.set(x, 0.1, -y);
        owner.top.add(obj);
        this.detailObjs.push(obj);
      }
    }
  }

  /** Cours d'eau : chaque tronçon est rattaché à sa région pour monter avec elle quand on la sélectionne. */
  private buildRivers(rivers: GeoJSON.FeatureCollection) {
    this.riversDrawn = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f9cae, roughness: 0.4 });
    this.disposables.push(mat);
    for (const f of rivers.features) {
      for (const run of (f.geometry as GeoJSON.MultiLineString).coordinates) {
        let seg: THREE.Vector3[] = [];
        let owner: RegionObj | undefined;
        const flush = () => {
          if (owner && seg.length > 1) {
            const curve = new THREE.CatmullRomCurve3(seg);
            const geom = new THREE.TubeGeometry(curve, seg.length * 3, 0.09, 5, false);
            owner.top.add(new THREE.Mesh(geom, mat));
            this.disposables.push(geom);
          }
        };
        for (const [lon, lat] of run) {
          const [x, y] = project(lon, lat);
          const r = this.regions.find((o) => o.rings.some((ring) => inside(x, y, ring)));
          const pt = new THREE.Vector3(x, 0.03, -y);
          if (r !== owner) {
            // le point de passage est partagé pour que la rivière reste continue
            if (seg.length) seg.push(pt);
            flush();
            seg = owner ? [seg[seg.length - 1] ?? pt] : [];
            owner = r;
          }
          seg.push(pt);
        }
        flush();
      }
      const label = document.createElement('div');
      label.className = 'y-river';
      label.textContent = f.properties?.['name'];
      const runs = (f.geometry as GeoJSON.MultiLineString).coordinates;
      const longest = [...runs].sort((a, b) => b.length - a.length)[0];
      if (longest.length < 40) continue;
      const [lon, lat] = longest[Math.floor(longest.length / 2)];
      const [x, y] = project(lon, lat);
      const r = this.regions.find((o) => o.rings.some((ring) => inside(x, y, ring)));
      const obj = new CSS2DObject(label);
      obj.position.set(x, 0.3, -y);
      (r?.top ?? this.scene).add(obj);
    }
  }

  private applyTheme(dark: boolean) {
    this.scene.background = new THREE.Color(dark ? 0x1c1915 : 0xf3eee5);
    const tones = dark ? REGION_TONES_DARK : REGION_TONES_LIGHT;
    for (const r of this.regions) {
      r.mesh.userData['base'] = new THREE.Color(tones[r.mesh.userData['idx'] % tones.length]);
      r.border.color.set(dark ? 0x5a5247 : 0xffffff);
    }
  }

  private buildPins(tales: Tale[], active: string | null) {
    for (const p of this.pins.values()) p.removeFromParent();
    this.pins.clear();
    const spots = spread(tales.map((t) => project(t.coords[1], t.coords[0])));
    for (const r of this.regions) {
      const mine = spots.filter((_, i) => tales[i].region === r.code);
      const [lx, ly] = labelSpot(r.rings[0], mine);
      r.lbl.position.set(lx, 0.6, -ly);
    }
    for (const [i, t] of tales.entries()) {
      const region = this.regions.find((r) => r.code === t.region);
      if (!region) continue;
      const el = document.createElement('div');
      el.innerHTML = pinHtml(t, taleText(t, this.i18n.lang()).title, t.slug === active);
      el.style.pointerEvents = 'auto';
      el.style.marginTop = '-22px';
      el.title = taleText(t, this.i18n.lang()).title;
      const select = () => this.zone.run(() => this.taleSelect.emit(t.slug));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        select();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') select();
      });
      const obj = new CSS2DObject(el);
      const [x, y] = spots[i];
      obj.position.set(x, 0.05, -y);
      region.top.add(obj);
      this.pins.set(t.slug, obj);
    }
  }

  /* ------------------------------------------------------------- caméra */

  private focus(region: string | null, tale: string | null) {
    if (!this.controls) return;
    let target: THREE.Vector3;
    let dist: number;
    if (tale && this.data.tale(tale)) {
      const t = this.data.tale(tale)!;
      const [x, y] = project(t.coords[1], t.coords[0]);
      target = new THREE.Vector3(x, SELECTED_H, -y);
      dist = 24;
    } else if (region) {
      const r = this.regions.find((o) => o.code === region);
      if (!r) return;
      target = r.center.clone().setY(SELECTED_H);
      dist = Math.max(26, r.size * 2.1);
    } else {
      target = new THREE.Vector3(0, 0, 0);
      dist = this.homePos.length();
    }
    const dir = region || tale ? new THREE.Vector3(0, 0.78, 0.63).normalize() : this.homePos.clone().normalize();
    this.controls.autoRotate = !region && !tale && !this.interacted();
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos: target.clone().add(dir.multiplyScalar(dist)),
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      t: 0,
    };
  }

  /* -------------------------------------------------------- interactions */

  private onMove = (e: PointerEvent) => {
    const rect = this.renderer!.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.regions.map((r) => r.mesh), false)[0];
    const code = (hit?.object.userData['code'] as string) ?? null;
    if (code !== this.hovered) {
      this.hovered = code;
      this.zone.run(() => this.hovering.set(!!code));
    }
  };

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return;
    this.onMove(e);
    if (this.hovered) {
      const code = this.hovered;
      this.zone.run(() => {
        this.interacted.set(true);
        this.regionSelect.emit(code);
      });
    }
  };

  private onLeave = () => {
    this.hovered = null;
    this.zone.run(() => this.hovering.set(false));
  };

  private onResize() {
    const el = this.host().nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h || !this.renderer) return;
    this.renderer.setSize(w, h);
    this.labels?.setSize(w, h);
    this.camera.aspect = w / h;
    // recule la caméra sur les écrans étroits pour garder tout le pays visible
    const portrait = h > w;
    this.homePos.set(0, portrait ? 120 : 82, portrait ? 100 : 72);
    this.camera.updateProjectionMatrix();
  }

  /* --------------------------------------------------------------- rendu */

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const k = 1 - Math.pow(0.0015, dt);
    const selected = this.selectedRegion();
    const red = new THREE.Color(COLORS.red);
    const yellow = new THREE.Color(COLORS.yellow);

    for (const r of this.regions) {
      const isSel = r.code === selected;
      const isHover = r.code === this.hovered;
      const targetH = isSel ? SELECTED_H : isHover ? HOVER_H : BASE_H;
      r.mesh.scale.y += (targetH - r.mesh.scale.y) * k;
      r.top.position.y = r.mesh.scale.y;
      const base = r.mesh.userData['base'] as THREE.Color;
      const dim = !!selected && !isSel;
      const goal = isSel ? red : isHover ? base.clone().lerp(yellow, 0.55) : dim ? base.clone().multiplyScalar(this.theme.dark() ? 0.8 : 0.93) : base;
      r.cap.color.lerp(goal, k);
      r.side.color.copy(r.cap.color).multiplyScalar(0.72);
      r.label.classList.toggle('on', isSel || isHover);
      r.label.classList.toggle('dim', dim && !isHover);
    }

    if (this.tween && this.controls) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / 1.1);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
      if (tw.t >= 1) this.tween = undefined;
    }

    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
    this.labels?.render(this.scene, this.camera);
    // les noms de régions restent au-dessus des épingles (les clics les traversent)
    for (const r of this.regions) r.label.style.zIndex = '100000';
  };
}
