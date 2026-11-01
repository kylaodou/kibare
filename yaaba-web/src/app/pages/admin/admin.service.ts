import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommentItem, Contribution, PlatformStats, Tale } from '../../core/models';
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

  contributions() {
    return this.http.get<Contribution[]>(`${this.api}/contributions`);
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

  tales() {
    return this.http.get<AdminTaleRow[]>(`${this.api}/tales`);
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

  addAudio(slug: string, lang: string, narrator: string, file: File) {
    const form = new FormData();
    form.append('audio', file);
    form.append('lang', lang);
    form.append('narrator', narrator);
    return this.http.post(`${this.api}/tales/${slug}/audio`, form);
  }

  deleteAudio(id: number) {
    return this.http.delete(`${this.api}/audio/${id}`);
  }

  comments() {
    return this.http.get<CommentItem[]>(`${this.api}/comments`);
  }

  moderateComment(id: number, status: 'VISIBLE' | 'HIDDEN') {
    return this.http.patch<CommentItem>(`${this.api}/comments/${id}`, null, { params: { status } });
  }

  deleteComment(id: number) {
    return this.http.delete(`${environment.apiUrl}/comments/${id}`);
  }

  users() {
    return this.http.get<AdminUserRow[]>(`${this.api}/users`);
  }

  updateUser(id: number, params: { active?: boolean; role?: string }) {
    return this.http.patch(`${this.api}/users/${id}`, null, { params: params as Record<string, string | boolean> });
  }
}
