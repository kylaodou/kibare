import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';

const signedIn: CanActivateFn = (_r, state) => inject(AuthService).loggedIn() || inject(Router).createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
const admin: CanActivateFn = (_r, state) => inject(AuthService).isAdmin() || inject(Router).createUrlTree(['/connexion'], { queryParams: { retour: state.url } });

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage), title: 'KIBARE — Contes & légendes du Burkina Faso' },
  { path: 'carte', loadComponent: () => import('./pages/map/map.page').then((m) => m.MapPage), title: 'Carte — KIBARE' },
  { path: 'contes', loadComponent: () => import('./pages/library/library.page').then((m) => m.LibraryPage), title: 'Contes — KIBARE' },
  { path: 'contes/:slug', loadComponent: () => import('./pages/tale/tale.page').then((m) => m.TalePage) },
  { path: 'langues', loadComponent: () => import('./pages/languages/languages.page').then((m) => m.LanguagesPage), title: 'Langues — KIBARE' },
  { path: 'contribuer', canActivate: [signedIn], loadComponent: () => import('./pages/contribute/contribute.page').then((m) => m.ContributePage), title: 'Contribuer — KIBARE' },
  { path: 'passeport', loadComponent: () => import('./pages/passport/passport.page').then((m) => m.PassportPage), title: 'Mon passeport — KIBARE' },
  { path: 'a-propos', loadComponent: () => import('./pages/about/about.page').then((m) => m.AboutPage), title: 'À propos — KIBARE' },
  { path: 'connexion', loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage), title: 'Connexion — KIBARE', data: { mode: 'login' } },
  { path: 'inscription', loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage), title: 'Inscription — KIBARE', data: { mode: 'register' } },
  { path: 'mot-de-passe-oublie', loadComponent: () => import('./pages/auth/forgot-password.page').then((m) => m.ForgotPasswordPage), title: 'Mot de passe oublié — KIBARE' },
  { path: 'definir-mot-de-passe', loadComponent: () => import('./pages/auth/forgot-password.page').then((m) => m.ForgotPasswordPage), title: 'Choisir mon mot de passe — KIBARE', data: { setup: true } },
  { path: 'verifier-email', loadComponent: () => import('./pages/auth/verify-email.page').then((m) => m.VerifyEmailPage), title: 'Vérification de l’adresse — KIBARE' },
  { path: 'compte', canActivate: [signedIn], loadComponent: () => import('./pages/account/account.page').then((m) => m.AccountPage), title: 'Mon compte — KIBARE' },
  { path: 'contributeurs', loadComponent: () => import('./pages/contributors/contributors.page').then((m) => m.ContributorsPage), title: 'Contributeurs — KIBARE' },
  { path: 'admin', canActivate: [admin], loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.ADMIN_ROUTES), title: 'Administration — KIBARE' },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage), title: 'Page introuvable — KIBARE' },
];
