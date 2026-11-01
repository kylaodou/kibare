import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', loadComponent: () => import('./overview.page').then((m) => m.OverviewPage), title: 'Tableau de bord — KIBARE' },
      { path: 'contributions', loadComponent: () => import('./contributions.page').then((m) => m.AdminContributionsPage), title: 'Contributions — KIBARE' },
      { path: 'contes', loadComponent: () => import('./tales.page').then((m) => m.AdminTalesPage), title: 'Contes — KIBARE' },
      { path: 'contes/nouveau', loadComponent: () => import('./tale-editor.page').then((m) => m.TaleEditorPage), title: 'Nouveau conte — KIBARE' },
      { path: 'contes/:slug', loadComponent: () => import('./tale-editor.page').then((m) => m.TaleEditorPage), title: 'Éditer un conte — KIBARE' },
      { path: 'commentaires', loadComponent: () => import('./comments.page').then((m) => m.AdminCommentsPage), title: 'Commentaires — KIBARE' },
      { path: 'utilisateurs', loadComponent: () => import('./users.page').then((m) => m.AdminUsersPage), title: 'Utilisateurs — KIBARE' },
    ],
  },
];
