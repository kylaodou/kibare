/** Projection équirectangulaire corrigée (cos φ) — suffisante à l'échelle du Burkina Faso. */

export const BF_CENTER = { lon: -1.55, lat: 12.25 };
const K = Math.cos((BF_CENTER.lat * Math.PI) / 180);

export interface Projected {
  code: string;
  name: string;
  d: string;
  cx: number;
  cy: number;
}

export function bbox(geo: GeoJSON.FeatureCollection) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings(geo)) {
    for (const [lon, lat] of ring) {
      const x = lon * K;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, lat);
      maxY = Math.max(maxY, lat);
    }
  }
  return { minX, minY, maxX, maxY };
}

function* rings(geo: GeoJSON.FeatureCollection): Generator<number[][]> {
  for (const f of geo.features) yield* featureRings(f);
}

export function* featureRings(f: GeoJSON.Feature): Generator<number[][]> {
  const g = f.geometry;
  if (g.type === 'Polygon') yield* g.coordinates as number[][][];
  if (g.type === 'MultiPolygon') for (const p of g.coordinates) yield* p as number[][][];
}

/** Convertit la FeatureCollection en chemins SVG dans un cadre width × height. */
export function projectSvg(geo: GeoJSON.FeatureCollection, width: number, height: number, pad = 8) {
  const b = bbox(geo);
  const scale = Math.min((width - pad * 2) / (b.maxX - b.minX), (height - pad * 2) / (b.maxY - b.minY));
  const ox = (width - (b.maxX - b.minX) * scale) / 2;
  const oy = (height - (b.maxY - b.minY) * scale) / 2;
  const project = (lon: number, lat: number): [number, number] => [ox + (lon * K - b.minX) * scale, oy + (b.maxY - lat) * scale];

  const regions: Projected[] = geo.features.map((f) => {
    let d = '';
    let sx = 0, sy = 0, n = 0;
    for (const ring of featureRings(f)) {
      d += ring.map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        sx += x;
        sy += y;
        n++;
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join('') + 'Z';
    }
    return { code: f.properties?.['code'], name: f.properties?.['name'], d, cx: sx / n, cy: sy / n };
  });
  return { regions, project };
}
