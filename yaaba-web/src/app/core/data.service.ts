import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, map, of, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { AudioTrack, City, CommentItem, Contribution, ContributionPayload, Contributor, Language, MapLevel, PageResult, PlatformStats, Region, Tale, TaleOption } from './models';

/** Point d'accès unique aux données. */
@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  readonly api = environment.apiUrl;

  readonly tales = signal<Tale[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly languages = signal<Language[]>([]);
  readonly geo = signal<GeoJSON.FeatureCollection | null>(null);
  /** Cours d'eau (Natural Earth, domaine public), découpés aux frontières du pays. */
  readonly rivers = signal<GeoJSON.FeatureCollection | null>(null);
  /** Niveaux de détail de la carte (chargés à la demande) : provinces, communes, villes. */
  readonly provinces = signal<GeoJSON.FeatureCollection | null>(null);
  readonly communes = signal<GeoJSON.FeatureCollection | null>(null);
  readonly cities = signal<City[] | null>(null);
  readonly online = signal(false);
  readonly ready = signal(false);

  readonly regionMap = computed(() => new Map(this.regions().map((r) => [r.code, r])));
  readonly languageMap = computed(() => new Map(this.languages().map((l) => [l.code, l])));
  readonly taleMap = computed(() => new Map(this.tales().map((t) => [t.slug, t])));

  private loading?: Promise<void>;

  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  /** Les données embarquées s'affichent immédiatement ; l'API les enrichit ensuite (vues, likes, audio). */
  private async doLoad() {
    const [tales, regions, languages, geo] = await Promise.all([
      firstValueFrom(this.http.get<Tale[]>('data/tales.json')),
      firstValueFrom(this.http.get<Region[]>('data/regions.json')),
      firstValueFrom(this.http.get<Language[]>('data/languages.json')),
      firstValueFrom(this.http.get<GeoJSON.FeatureCollection>('data/regions.geojson')),
    ]);
    this.tales.set(tales);
    this.regions.set(regions);
    this.languages.set(languages);
    this.geo.set(geo);
    this.ready.set(true);
    this.http.get<GeoJSON.FeatureCollection>('data/rivers.geojson').subscribe({ next: (r) => this.rivers.set(r), error: () => {} });
    void this.sync();
  }

  /** Recharge les contes depuis l'API (après une publication, par exemple). */
  refreshTales() {
    return this.sync();
  }

  private async sync() {
    const fromApi = await firstValueFrom(
      this.http.get<Tale[]>(this.api + '/tales').pipe(
        timeout(4000),
        catchError(() => of(null)),
      ),
    );
    if (!fromApi?.length) return;
    this.online.set(true);
    this.tales.set(fromApi);
  }

  /** Charge une seule fois les données d'un niveau de la carte. */
  loadLevel(level: MapLevel) {
    if (level === 'province' && !this.provinces())
      this.http.get<GeoJSON.FeatureCollection>('data/provinces.geojson').subscribe({ next: (d) => this.provinces.set(d), error: () => {} });
    if (level === 'commune' && !this.communes())
      this.http.get<GeoJSON.FeatureCollection>('data/communes.geojson').subscribe({ next: (d) => this.communes.set(d), error: () => {} });
    if (level === 'city' && !this.cities())
      this.http.get<City[]>('data/cities.json').subscribe({ next: (d) => this.cities.set(d), error: () => {} });
  }

  tale(slug: string) {
    return this.taleMap().get(slug);
  }

  talesOf(region: string) {
    return this.tales().filter((t) => t.region === region);
  }

  /** Pistes audio approuvées (enregistrements de conteurs) pour un conte. */
  async audio(slug: string): Promise<AudioTrack[]> {
    if (!this.online()) return this.tale(slug)?.audio ?? [];
    return firstValueFrom(
      this.http.get<AudioTrack[]>(`${this.api}/tales/${slug}/audio`).pipe(
        map((tracks) => tracks.map((t) => ({ ...t, url: this.mediaUrl(t.url), segments: t.segments?.map((u) => this.mediaUrl(u)) }))),
        catchError(() => of([])),
      ),
    );
  }

  mediaUrl(url: string) {
    return url.startsWith('http') || url.startsWith('data:') ? url : this.api.replace(/\/api$/, '') + url;
  }

  view(slug: string, lang?: string) {
    if (!this.online()) return;
    this.http.post(`${this.api}/tales/${slug}/view`, { lang }).pipe(catchError(() => of(null))).subscribe();
  }

  comments(slug: string) {
    return this.http.get<CommentItem[]>(`${this.api}/tales/${slug}/comments`).pipe(catchError(() => of([] as CommentItem[])));
  }

  addComment(slug: string, text: string, parentId?: number) {
    return this.http.post<CommentItem>(`${this.api}/tales/${slug}/comments`, { text, parentId });
  }

  deleteComment(id: number) {
    return this.http.delete(`${this.api}/comments/${id}`);
  }

  contributors() {
    return this.http.get<Contributor[]>(`${this.api}/contributors`).pipe(catchError(() => of([] as Contributor[])));
  }

  myContributions() {
    return this.http.get<Contribution[]>(`${this.api}/me/contributions`).pipe(catchError(() => of([] as Contribution[])));
  }

  like(slug: string, liked: boolean) {
    if (!this.online()) return;
    this.http
      .post<{ likes: number }>(`${this.api}/tales/${slug}/like`, { liked })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        if (!r) return;
        this.tales.update((list) => list.map((t) => (t.slug === slug ? { ...t, likes: r.likes } : t)));
      });
  }

  stats() {
    return this.http.get<PlatformStats>(`${this.api}/stats`).pipe(catchError(() => of(null)));
  }

  /** Sélecteur de contes : recherche côté serveur, page par page. */
  taleOptions(q: string, page = 0, size = 20) {
    return this.http.get<PageResult<TaleOption>>(`${this.api}/tales/options`, { params: { q: q.trim(), page, size } });
  }

  /** Voix : chaque enregistrement est accompagné de l'identifiant de son paragraphe (sceneIds, même ordre). */
  contribute(payload: ContributionPayload, audio?: Blob, segments: { blob: Blob; sceneId: string }[] = []) {
    const ext = (b: Blob) => (b.type.includes('ogg') ? 'ogg' : b.type.includes('mpeg') ? 'mp3' : 'webm');
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    if (audio) form.append('audio', audio, `voix.${ext(audio)}`);
    // un fichier par paragraphe, dans l'ordre du conte
    segments.forEach((s, i) => {
      form.append('segments', s.blob, `paragraphe-${i + 1}.${ext(s.blob)}`);
      form.append('sceneIds', s.sceneId);
    });
    return this.http.post<Contribution>(`${this.api}/contributions`, form);
  }
}
