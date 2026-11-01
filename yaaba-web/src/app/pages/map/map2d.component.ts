import { AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { DataService } from '../../core/data.service';
import { I18nService } from '../../core/i18n.service';
import { Tale } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { featureRings } from '../../shared/geo';
import { COLORS, REGION_TONES_DARK, REGION_TONES_LIGHT, labelSpot, pinHtml, spread } from './map-shared';

const TILES = {
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
};

@Component({
  selector: 'app-map2d',
  template: `<div #el class="leaflet-host" role="application" aria-label="Carte 2D du Burkina Faso"></div>`,
  styles: `
    :host { display: block; }
    .leaflet-host { width: 100%; height: 100%; }
  `,
})
export class Map2dComponent implements AfterViewInit, OnDestroy {
  private data = inject(DataService);
  private i18n = inject(I18nService);
  private theme = inject(ThemeService);

  readonly tales = input.required<Tale[]>();
  readonly selectedRegion = input<string | null>(null);
  readonly selectedTale = input<string | null>(null);
  readonly regionSelect = output<string>();
  readonly taleSelect = output<string>();

  private el = viewChild.required<ElementRef<HTMLDivElement>>('el');
  private map?: L.Map;
  private tiles?: L.TileLayer;
  private regions?: L.GeoJSON;
  private markers = L.layerGroup();
  private markerBySlug = new Map<string, L.Marker>();
  private names = L.layerGroup();
  private water?: L.GeoJSON;
  private shown: Tale[] = [];
  private homeBounds?: L.LatLngBounds;
  private hovered: string | null = null;
  private ready = signal(false);

  constructor() {
    effect(() => {
      if (!this.ready()) return;
      const dark = this.theme.dark();
      untracked(() => {
        this.tiles?.setUrl(dark ? TILES.dark : TILES.light);
        this.restyle();
      });
    });

    effect(() => {
      const rivers = this.data.rivers();
      if (!this.ready() || !rivers || this.water) return;
      untracked(() => {
        this.water = L.geoJSON(rivers, {
          interactive: false,
          style: { color: '#5F9CAE', weight: 2.5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' },
        }).addTo(this.map!);
        this.water.bringToFront();
        // nom des grands cours d'eau, au milieu de leur plus long tronçon
        for (const f of rivers.features) {
          const runs = (f.geometry as GeoJSON.MultiLineString).coordinates;
          const run = [...runs].sort((a, b) => b.length - a.length)[0];
          if (run.length < 40) continue;
          const [lon, lat] = run[Math.floor(run.length / 2)];
          L.marker([lat, lon], {
            pane: 'names',
            interactive: false,
            keyboard: false,
            icon: L.divIcon({ className: 'y-name-wrap', html: `<span class="y-river">${f.properties?.['name']}</span>`, iconSize: [0, 0] }),
          }).addTo(this.map!);
        }
      });
    });

    effect(() => {
      if (!this.ready()) return;
      const tales = this.tales();
      const active = this.selectedTale();
      this.i18n.lang();
      untracked(() => this.buildMarkers(tales, active));
    });

    effect(() => {
      if (!this.ready()) return;
      const region = this.selectedRegion();
      const tale = this.selectedTale();
      untracked(() => {
        this.restyle();
        this.focus(region, tale);
      });
    });
  }

  ngAfterViewInit() {
    const geo = this.data.geo();
    if (!geo) return;
    const map = L.map(this.el().nativeElement, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 6,
      maxZoom: 12,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 90,
    });
    this.map = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    this.tiles = L.tileLayer(this.theme.dark() ? TILES.dark : TILES.light, {
      attribution: 'Fond &copy; Esri, HERE, Garmin, &copy; OpenStreetMap · Limites : geoBoundaries',
      maxZoom: 16,
    }).addTo(map);

    this.regions = L.geoJSON(geo, {
      style: (f) => this.styleFor(f),
      onEachFeature: (f, layer) => {
        const code = f.properties.code as string;
        layer.bindTooltip(f.properties.name, { sticky: true, className: 'region-tip', direction: 'top', offset: [0, -8] });
        layer.on({
          mouseover: () => {
            this.hovered = code;
            this.restyle();
          },
          mouseout: () => {
            this.hovered = null;
            this.restyle();
          },
          click: () => this.regionSelect.emit(code),
        });
      },
    }).addTo(map);

    this.homeBounds = this.regions.getBounds();
    map.setMaxBounds(this.homeBounds.pad(0.6));
    map.fitBounds(this.homeBounds, { padding: [30, 30] });
    map.createPane('names').style.zIndex = '640';
    map.getPane('names')!.style.pointerEvents = 'none';
    this.names.addTo(map);
    this.markers.addTo(map);
    map.on('zoomend', () => this.placeMarkers());
    setTimeout(() => map.invalidateSize(), 50);
    this.ready.set(true);
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private styleFor(f?: GeoJSON.Feature): L.PathOptions {
    const code = f?.properties?.['code'] as string;
    const dark = this.theme.dark();
    const idx = this.data.regions().findIndex((r) => r.code === code);
    const tones = dark ? REGION_TONES_DARK : REGION_TONES_LIGHT;
    const selected = this.selectedRegion() === code;
    const hover = this.hovered === code;
    const dim = !!this.selectedRegion() && !selected;
    return {
      color: dark ? '#13110e' : '#ffffff',
      weight: selected ? 3 : 1.5,
      fillColor: selected ? COLORS.red : hover ? COLORS.yellow : tones[Math.max(0, idx) % tones.length],
      fillOpacity: selected ? 0.32 : hover ? 0.55 : dim ? 0.45 : 0.78,
    };
  }

  private restyle() {
    this.regions?.setStyle((f) => this.styleFor(f));
  }

  private buildMarkers(tales: Tale[], active: string | null) {
    this.markers.clearLayers();
    this.markerBySlug.clear();
    for (const t of tales) {
      const title = taleText(t, this.i18n.lang()).title;
      const m = L.marker(t.coords, {
        icon: L.divIcon({ className: 'y-pin-wrap', html: pinHtml(t, title, t.slug === active), iconSize: [36, 44], iconAnchor: [18, 44] }),
        keyboard: true,
        title,
        riseOnHover: true,
        zIndexOffset: t.slug === active ? 1000 : 0,
      });
      m.bindTooltip(title, { direction: 'top', offset: [0, -46], className: 'region-tip' });
      m.on('click', () => this.taleSelect.emit(t.slug));
      m.on('keypress', (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === 'Enter') this.taleSelect.emit(t.slug);
      });
      m.addTo(this.markers);
      this.markerBySlug.set(t.slug, m);
    }
    this.shown = tales;
    this.placeMarkers();
    this.buildNames(tales);
  }

  /** Écarte les épingles qui se chevauchent à l'échelle courante (30 px). */
  private placeMarkers() {
    const map = this.map;
    if (!map) return;
    const px = this.shown.map((t) => map.latLngToLayerPoint(t.coords));
    const out = spread(px.map((p) => [p.x / 15, p.y / 15] as [number, number]), 2.6);
    this.shown.forEach((t, i) => {
      const [x, y] = out[i];
      this.markerBySlug.get(t.slug)?.setLatLng(map.layerPointToLatLng([x * 15, y * 15]));
    });
  }

  /** Noms des régions, posés à l'écart des épingles. */
  private buildNames(tales: Tale[]) {
    this.names.clearLayers();
    for (const f of this.data.geo()?.features ?? []) {
      const code = f.properties?.['code'] as string;
      const ring = [...featureRings(f)].sort((a, b) => b.length - a.length)[0];
      if (!ring) continue;
      const pins = tales.filter((t) => t.region === code).map((t) => [t.coords[1] * 10, t.coords[0] * 10] as [number, number]);
      const [x, y] = labelSpot(ring.map(([lon, lat]) => [lon * 10, lat * 10] as [number, number]), pins);
      L.marker([y / 10, x / 10], {
        pane: 'names',
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'y-name-wrap', html: `<span class="y-label">${f.properties?.['name']}</span>`, iconSize: [0, 0] }),
      }).addTo(this.names);
    }
  }

  private focus(region: string | null, tale: string | null) {
    const map = this.map;
    if (!map || !this.regions) return;
    if (tale) {
      const m = this.markerBySlug.get(tale);
      if (m) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 8.5), { duration: 0.8 });
      return;
    }
    if (region) {
      this.regions.eachLayer((layer) => {
        const f = (layer as L.Polygon).feature as GeoJSON.Feature;
        if (f.properties?.['code'] === region) map.flyToBounds((layer as L.Polygon).getBounds(), { padding: [120, 120], maxZoom: 8, duration: 0.8 });
      });
      return;
    }
    if (this.homeBounds) map.flyToBounds(this.homeBounds, { padding: [30, 30], duration: 0.8 });
  }
}
