import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AudioTrack, CommentItem, Contribution, PageResult, PlatformStats, Tale } from '../../core/models';
import { User } from '../../core/auth.service';

export interface Dashboard {
  totals: PlatformStats;
  daily: { day: string; VIEW: number; LIKE: number; COMMENT: number; CONTRIBUTION: number; SIGNUP: number }[];
  topTales: { slug: string; title: string; views: number; likes: number }[];
  contributionsByStatus: Record<string, number>;
  contributionsByLanguage: Record<string, number>;
  talesByRegion: Record<string, number>;
  viewsByLanguage: Record<string, number>;
  latestContributions: Contribution[];
  latestComments: CommentItem[];
}

export interface AdminTaleRow {
  slug: string;
  title: string;
  type: string;
  region: string;
  language: string;
  origin: 'seed' | 'admin' | 'community';
  published: boolean;
  featured: boolean;
  views: number;
  likes: number;
  comments: number;
  audio: number;
  languages: string[];
  createdAt?: string;
}

/** Paramètres d'une liste paginée côté serveur. */
export interface PageQuery {
  page: number;
  size: number;
  q?: string;
  sort?: string;
  status?: string;
  origin?: string;
}

function params(q: PageQuery): Record<string, string | number> {
  const p: Record<string, string | number> = { page: q.page, size: q.size };
  if (q.q?.trim()) p['q'] = q.q.trim();
  if (q.sort) p['sort'] = q.sort;
  if (q.status) p['status'] = q.status;
  if (q.origin) p['origin'] = q.origin;
  return p;
}

export interface AdminUserRow {
  user: User & { active: boolean };
  contributions: number;
  approved: number;
  comments: number;
  lastLoginAt?: string;
}

/** Appels de l'API d'administration (le jeton est ajouté par l'intercepteur). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private api = environment.apiUrl + '/admin';

  dashboard() {
    return this.http.get<Dashboard>(`${this.api}/dashboard`);
  }

  contributions(q: PageQuery) {
    return this.http.get<PageResult<Contribution>>(`${this.api}/contributions`, { params: params(q) });
  }

  approve(id: number, note?: string) {
    return this.http.post<Contribution>(`${this.api}/contributions/${id}/approve`, { note });
  }

  reject(id: number, note?: string) {
    return this.http.post<Contribution>(`${this.api}/contributions/${id}/reject`, { note });
  }

  deleteContribution(id: number) {
    return this.http.delete(`${this.api}/contributions/${id}`);
  }

  tales(q: PageQuery) {
    return this.http.get<PageResult<AdminTaleRow>>(`${this.api}/tales`, { params: params(q) });
  }

  tale(slug: string) {
    return this.http.get<Tale & { published: boolean; origin: string }>(`${this.api}/tales/${slug}`);
  }

  saveTale(slug: string | null, body: unknown) {
    return slug ? this.http.put<Tale>(`${this.api}/tales/${slug}`, body) : this.http.post<Tale>(`${this.api}/tales`, body);
  }

  publish(slug: string, value: boolean) {
    return this.http.patch(`${this.api}/tales/${slug}/published`, null, { params: { value } });
  }

  deleteTale(slug: string) {
    return this.http.delete(`${this.api}/tales/${slug}`);
  }

  /** Voix d'un paragraphe (sceneId). */
  addAudio(slug: string, sceneId: string, lang: string, narrator: string, file: Blob, fileName = 'voix.webm') {
    const form = new FormData();
    form.append('audio', file, file instanceof File ? file.name : fileName);
    form.append('lang', lang);
    form.append('narrator', narrator);
    form.append('sceneId', sceneId);
    return this.http.post<AudioTrack>(`${this.api}/tales/${slug}/audio`, form);
  }

  /** Vidéo d'un paragraphe : 10 Mo au plus (vérifié aussi par le serveur). */
  uploadVideo(file: File) {
    const form = new FormData();
    form.append('video', file);
    return this.http.post<{ url: string; contentType: string; size: number }>(`${this.api}/media/video`, form);
  }

  deleteAudio(id: number) {
    return this.http.delete(`${this.api}/audio/${id}`);
  }

  comments(q: PageQuery) {
    return this.http.get<PageResult<CommentItem>>(`${this.api}/comments`, { params: params(q) });
  }

  moderateComment(id: number, status: 'VISIBLE' | 'HIDDEN') {
    return this.http.patch<CommentItem>(`${this.api}/comments/${id}`, null, { params: { status } });
  }

  deleteComment(id: number) {
    return this.http.delete(`${environment.apiUrl}/comments/${id}`);
  }

  users(q: PageQuery) {
    return this.http.get<PageResult<AdminUserRow>>(`${this.api}/users`, { params: params(q) });
  }

  updateUser(id: number, params: { active?: boolean; role?: string }) {
    return this.http.patch(`${this.api}/users/${id}`, null, { params: params as Record<string, string | boolean> });
  }
}
