import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { ProgressService } from '../../core/progress.service';
import { MiniMapComponent } from '../../shared/mini-map/mini-map.component';
import { TaleCardComponent } from '../../shared/tale-card/tale-card.component';

interface Badge {
  id: string;
  icon: string;
  earned: boolean;
  progress: string;
}

@Component({
  selector: 'app-passport',
  imports: [FormsModule, RouterLink, MiniMapComponent, TaleCardComponent, TranslatePipe, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './passport.page.html',
  styleUrl: './passport.page.scss',
})
export class PassportPage {
  readonly data = inject(DataService);
  readonly progress = inject(ProgressService);
  private i18n = inject(I18nService);
  private confirm = inject(ConfirmationService);
  private router = inject(Router);

  readonly stamps = computed(() => [...this.progress.stamps()]);
  readonly completed = computed(() => this.progress.completed().length);
  readonly perfectQuizzes = computed(
    () => Object.values(this.progress.state().tales).filter((p) => p.quizTotal && p.quiz === p.quizTotal).length,
  );
  readonly favorites = computed(() => this.data.tales().filter((t) => this.progress.favorites().has(t.slug)));
  readonly ongoing = computed(() => this.progress.inProgress().map((p) => this.data.tale(p.slug)!).filter(Boolean));
  readonly regions = computed(() =>
    this.data.regions().map((r) => ({ ...r, stamped: this.progress.stamps().has(r.code) })),
  );

  readonly badges = computed<Badge[]>(() => {
    const done = this.completed();
    const total = this.data.tales().length;
    const st = this.stamps().length;
    const regionsTotal = this.data.regions().length;
    const q = this.perfectQuizzes();
    const fav = this.favorites().length;
    return [
      { id: 'first', icon: 'fa-seedling', earned: done >= 1, progress: `${Math.min(done, 1)}/1` },
      { id: 'griot', icon: 'fa-drum', earned: done >= 5, progress: `${Math.min(done, 5)}/5` },
      { id: 'elder', icon: 'fa-crown', earned: done >= total, progress: `${done}/${total}` },
      { id: 'traveler', icon: 'fa-route', earned: st >= 5, progress: `${Math.min(st, 5)}/5` },
      { id: 'explorer', icon: 'fa-earth-africa', earned: st >= regionsTotal, progress: `${st}/${regionsTotal}` },
      { id: 'scholar', icon: 'fa-graduation-cap', earned: q >= 3, progress: `${Math.min(q, 3)}/3` },
      { id: 'heart', icon: 'fa-heart', earned: fav >= 3, progress: `${Math.min(fav, 3)}/3` },
    ];
  });

  readonly earned = computed(() => this.badges().filter((b) => b.earned).length);

  setName(v: string) {
    this.progress.setName(v.slice(0, 40));
  }

  openRegion(code: string) {
    void this.router.navigate(['/carte'], { queryParams: { region: code } });
  }

  reset() {
    this.confirm.confirm({
      header: this.i18n.t('pass.resetTitle'),
      message: this.i18n.t('pass.resetText'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.i18n.t('pass.resetYes'),
      rejectLabel: this.i18n.t('pass.resetNo'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.progress.reset(),
    });
  }
}
