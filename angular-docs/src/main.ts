import { ApplicationConfig, InjectionToken, Type, effect, inject, signal, ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, Router, RouterLink, RouterOutlet } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { CommonModule, NgIf, NgFor, NgOptimizedImage } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { provideStore, createAction, createReducer, on, props, createFeatureSelector, createSelector } from '@ngrx/store';
import { provideEffects, Actions, createEffect, ofType } from '@ngrx/effects';
import { provideRouterStore, routerNavigatedAction } from '@ngrx/router-store';
import { filter, map, tap, withLatestFrom } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { environment } from './environments/environment';

/******************************
 * Configuration + Contracts
 ******************************/
export type HeaderLink = { label: 'Repository' | 'Nexus' | 'Cluster' | 'Permission' | 'Announcement' | 'Help'; url: string };
export const ENV_CONFIG = new InjectionToken<{ logoUrl: string; headerLinks: HeaderLink[] }>('ENV_CONFIG');

export type DocMeta = {
  id: string;
  title: string;
  section: string;
  order: number;
  component?: Type<any>;
};
export const DOCS = new InjectionToken<DocMeta[]>('DOCS'); // multi

/******************************
 * Registry Service
 ******************************/
class RegistryService {
  private allDocs = inject(DOCS, { optional: true }) ?? [];

  readonly ordered: DocMeta[] = [...this.allDocs].sort((a, b) =>
    a.section === b.section ? a.order - b.order : a.section.localeCompare(b.section)
  );
  readonly byId = new Map(this.ordered.map((d) => [d.id, d] as const));

  sections(): string[] { return Array.from(new Set(this.ordered.map((d) => d.section))); }
  bySection(section: string): DocMeta[] { return this.ordered.filter((d) => d.section === section); }
  first(): DocMeta | undefined { return this.ordered[0]; }
  nextOf(id: string): DocMeta | undefined { const i = this.ordered.findIndex(d => d.id === id); return i >= 0 && i + 1 < this.ordered.length ? this.ordered[i + 1] : undefined; }
  prevOf(id: string): DocMeta | undefined { const i = this.ordered.findIndex(d => d.id === id); return i > 0 ? this.ordered[i - 1] : undefined; }
}

/******************************
 * NgRx State
 ******************************/
export type DocsState = {
  docs: DocMeta[];
  byId: Record<string, DocMeta>;
  currentId: string | null;
  tocCollapsed: boolean;
  tocWidth: number; // px
};

const initialState: DocsState = {
  docs: [],
  byId: {},
  currentId: null,
  tocCollapsed: (localStorage.getItem('tocCollapsed') ?? 'false') === 'true',
  tocWidth: Number(localStorage.getItem('tocWidth') ?? 320)
};

const setDocs = createAction('[Docs] Set Docs', props<{ docs: DocMeta[] }>());
const enterDoc = createAction('[Docs] Enter Doc', props<{ id: string }>());
const navigateNext = createAction('[Docs] Navigate Next');
const navigatePrev = createAction('[Docs] Navigate Prev');
const toggleToc = createAction('[Docs] Toggle TOC');
const setTocCollapsed = createAction('[Docs] Set TOC Collapsed', props<{ collapsed: boolean }>());
const setTocWidth = createAction('[Docs] Set TOC Width', props<{ width: number }>());

const docsReducer = createReducer(
  initialState,
  on(setDocs, (state, { docs }) => ({
    ...state,
    docs,
    byId: docs.reduce((acc, d) => ({ ...acc, [d.id]: d }), {} as Record<string, DocMeta>)
  })),
  on(enterDoc, (state, { id }) => ({ ...state, currentId: id })),
  on(toggleToc, (state) => ({ ...state, tocCollapsed: !state.tocCollapsed })),
  on(setTocWidth, (state, { width }) => ({ ...state, tocWidth: width }))
);

const selectFeature = createFeatureSelector<DocsState>('docs');
const selectDocsOrdered = createSelector(selectFeature, (s) => s.docs);
const selectCurrentId = createSelector(selectFeature, (s) => s.currentId);
const selectCurrentIndex = createSelector(selectDocsOrdered, selectCurrentId, (docs, id) => docs.findIndex(d => d.id === id));
const selectPrevDoc = createSelector(selectDocsOrdered, selectCurrentIndex, (docs, i) => i > 0 ? docs[i - 1] : null);
const selectNextDoc = createSelector(selectDocsOrdered, selectCurrentIndex, (docs, i) => i >= 0 && i + 1 < docs.length ? docs[i + 1] : null);
const selectTocCollapsed = createSelector(selectFeature, (s) => s.tocCollapsed);

class DocsEffects {
  private actions$ = inject(Actions);
  private router = inject(Router);
  private registry = inject(RegistryService);
  private store = inject(Store);

  routeToDoc$ = createEffect(() => this.actions$.pipe(
    ofType(routerNavigatedAction),
    map(() => {
      const url = this.router.url;
      const id = url.match(/\/docs\/([^/?#]+)/)?.[1];
      return id ?? this.registry.first()?.id ?? null;
    }),
    filter((id): id is string => !!id),
    map((id) => enterDoc({ id }))
  ));

  navNext$ = createEffect(() => this.actions$.pipe(
    ofType(navigateNext),
    withLatestFrom(this.store.select(selectNextDoc)),
    tap(([_, next]) => { if (next) this.router.navigate(['/docs', next.id]); })
  ), { dispatch: false });

  navPrev$ = createEffect(() => this.actions$.pipe(
    ofType(navigatePrev),
    withLatestFrom(this.store.select(selectPrevDoc)),
    tap(([_, prev]) => { if (prev) this.router.navigate(['/docs', prev.id]); })
  ), { dispatch: false });
}

/******************************
 * Header Component
 ******************************/
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatButtonModule, MatIconModule, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <mat-toolbar color="primary" style="position:fixed;top:0;left:0;right:0;z-index:1000;background: var(--app-primary); color: var(--app-primary-contrast);">
    <div style="display:flex;align-items:center;gap:12px;width:100%;">
      <button mat-icon-button (click)="toggle()" aria-label="Toggle table of contents" style="color:var(--app-primary-contrast)">
        <mat-icon>menu</mat-icon>
      </button>
      <img [ngSrc]="config.logoUrl" alt="Company Logo" width="28" height="28" priority style="border-radius:6px;" />
      <span style="font-weight:600;letter-spacing:0.2px;">On-Prem Docs</span>
      <span style="flex:1"></span>
      <ng-container *ngFor="let link of config.headerLinks">
        <a class="focus-ring" [href]="link.url" target="_blank" rel="noopener noreferrer" style="color:var(--app-primary-contrast);text-decoration:none;padding:6px 10px;border-radius:8px;">
          {{ link.label }}
        </a>
      </ng-container>
    </div>
  </mat-toolbar>
  `
})
class HeaderComponent {
  config = inject(ENV_CONFIG);
  private store = inject(Store);
  toggle() { this.store.dispatch(toggleToc()); }
}

/******************************
 * Docs Shell (TOC + Content)
 ******************************/
@Component({
  selector: 'app-doc-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, MatSidenavModule, MatListModule, MatButtonModule, MatIconModule, MatExpansionModule, MatDividerModule, NgIf, NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display:block; }
    .layout { display:grid; grid-template-columns: var(--toc-width, 320px) 1fr; gap: 0; }
    .toc { height: calc(100vh - 64px); position: sticky; top: 64px; overflow:auto; border-right: 1px solid rgba(0,0,0,0.06); background: #ffffff; }
    .content { min-height: calc(100vh - 64px); padding: 24px 32px; }
    .toc .section-title { font-weight:600; color:#0f1720; padding: 14px 16px; }
    .toc a { display:block; color:#0f1720; text-decoration:none; padding:8px 16px; border-radius:8px; margin:2px 8px; }
    .toc a[aria-current="page"] { background: rgba(0, 137, 123, 0.12); color: #00695c; font-weight:600; }
    .resizer { width: 6px; cursor: col-resize; background: transparent; position: relative; }
    .resizer::after { content: ""; position:absolute; top:0; bottom:0; left:2px; width:2px; background: rgba(15,23,32,0.06); }
    .bottom-nav { position: sticky; bottom: 0; display:flex; justify-content: space-between; gap: 12px; padding: 16px 0; background: linear-gradient(to bottom, transparent, rgba(247,250,249,0.9) 30%, rgba(247,250,249,1)); }
    h1 { line-height: 1.2; margin: 0 0 16px 0; }
    .doc-container { max-width: min(72ch, 100%); }
  `],
  template: `
    <app-header />
    <div style="height:64px"></div>

    <div class="layout" [style.gridTemplateColumns]="tocCollapsed() ? '0 1fr' : 'var(--toc-width, 320px) 1fr'">
      <ng-container *ngIf="!tocCollapsed()">
        <nav class="toc" [style.width.px]="tocWidth()" aria-label="Table of contents">
          <div class="section" *ngFor="let section of sections()">
            <div class="section-title">{{ section }}</div>
            <a *ngFor="let d of docsBySection(section); trackBy: trackById"
              [routerLink]="['/docs', d.id]"
              [attr.aria-current]="currentId() === d.id ? 'page' : null">
              {{ d.title }}
            </a>
          </div>
        </nav>
        <div class="resizer" (mousedown)="startResize($event)"></div>
      </ng-container>

      <main class="content">
        <div class="doc-container">
          <h1 id="doc-heading" tabindex="-1">{{ currentDoc()?.title }}</h1>
          <ng-container *ngIf="currentComponent() as cmp">
            <ng-container *ngComponentOutlet="cmp"></ng-container>
          </ng-container>

          <div class="bottom-nav">
            <button mat-stroked-button color="primary" *ngIf="prevDoc()" (click)="goPrev()" aria-label="Previous: {{ prevDoc()?.title }}">
              <mat-icon aria-hidden="true">arrow_back</mat-icon>
              <span style="margin-left:8px">Prev: {{ prevDoc()?.title }}</span>
            </button>
            <span></span>
            <button mat-flat-button color="primary" *ngIf="nextDoc()" (click)="goNext()" aria-label="Next: {{ nextDoc()?.title }}" style="background: var(--app-primary); color: var(--app-primary-contrast);">
              <span style="margin-right:8px">Next: {{ nextDoc()?.title }}</span>
              <mat-icon aria-hidden="true">arrow_forward</mat-icon>
            </button>
          </div>
        </div>
      </main>
    </div>
  `
})
class DocShellComponent {
  private store = inject(Store);
  private router = inject(Router);
  private registry = inject(RegistryService);

  sections = signal<string[]>(this.registry.sections());
  docsBySection = (s: string) => this.registry.bySection(s);

  tocWidth = signal<number>(Number(localStorage.getItem('tocWidth') ?? 320));
  tocCollapsed = signal<boolean>(false);
  private resizing = false;

  currentId = () => this._currentId;
  private _currentId: string | null = null;

  currentDoc = () => (this._currentId ? this.registry.byId.get(this._currentId) ?? null : null);
  currentComponent = () => (this.currentDoc()?.component ?? null);
  prevDoc = () => (this._currentId ? this.registry.prevOf(this._currentId) ?? null : null);
  nextDoc = () => (this._currentId ? this.registry.nextOf(this._currentId) ?? null : null);

  constructor() {
    this.store.select(selectCurrentId).subscribe((id) => {
      this._currentId = id;
      setTimeout(() => document.getElementById('doc-heading')?.focus(), 0);
    });

    this.store.select(selectTocCollapsed).subscribe(v => this.tocCollapsed.set(v));

    effect(() => {
      const w = this.tocWidth();
      localStorage.setItem('tocWidth', String(w));
      this.store.dispatch(setTocWidth({ width: w }));
    });
  }

  trackById(_: number, d: DocMeta) { return d.id; }

  startResize(ev: MouseEvent) {
    ev.preventDefault();
    this.resizing = true;
    const startX = ev.clientX;
    const startWidth = this.tocWidth();

    const move = (e: MouseEvent) => {
      if (!this.resizing) return;
      const dx = e.clientX - startX;
      const width = Math.min(Math.max(220, startWidth + dx), 520);
      this.tocWidth.set(width);
      document.documentElement.style.setProperty('--toc-width', width + 'px');
    };
    const up = () => {
      this.resizing = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  goPrev() { this.store.dispatch(navigatePrev()); }
  goNext() { this.store.dispatch(navigateNext()); }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === '[') { this.goPrev(); }
    else if (e.key === 'ArrowRight' || e.key === ']') { this.goNext(); }
  }
}

/******************************
 * Root Component
 ******************************/
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, DocShellComponent, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet></router-outlet>`
})
class AppComponent {}

/******************************
 * Sample Doc Components (Auto-registered)
 ******************************/
@Component({
  selector: 'doc-introduction',
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: DOCS, useValue: { id: 'introduction', title: 'Introduction', section: 'Getting Started', order: 1, component: IntroductionDocComponent }, multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Welcome to the on-prem deployment documentation. This guide helps you plan, install, and operate the cluster in secure environments.</p>
    <h2>What you will learn</h2>
    <ul>
      <li>Core concepts and the deployment topology</li>
      <li>Prerequisites and required permissions</li>
      <li>Step-by-step installation</li>
    </ul>
  `
})
class IntroductionDocComponent {}

@Component({
  selector: 'doc-prerequisites',
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: DOCS, useValue: { id: 'prerequisites', title: 'Prerequisites', section: 'Getting Started', order: 2, component: PrerequisitesDocComponent }, multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Ensure your environment meets the following requirements before installation.</p>
    <h2>System Requirements</h2>
    <ul>
      <li>Linux (Ubuntu 22.04 LTS or RHEL 9)</li>
      <li>CPU: 4+ cores, RAM: 16+ GB, Disk: 100+ GB</li>
      <li>Outbound access to package repositories (or mirrored)</li>
    </ul>
    <h2>Network & Security</h2>
    <ul>
      <li>Firewall rules for control-plane and data-plane</li>
      <li>Internal DNS and TLS certificates available</li>
      <li>Admin access to target nodes</li>
    </ul>
  `
})
class PrerequisitesDocComponent {}

@Component({
  selector: 'doc-installation',
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: DOCS, useValue: { id: 'installation', title: 'Installation', section: 'Getting Started', order: 3, component: InstallationDocComponent }, multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Follow these steps to install the platform on-prem.</p>
    <ol>
      <li>Download the installer bundle from Nexus or your internal mirror.</li>
      <li>Validate checksums and import the signing key.</li>
      <li>Run the bootstrap script and follow prompts.</li>
    </ol>
    <p>See subsequent pages for cluster configuration and validation.</p>
  `
})
class InstallationDocComponent {}

/******************************
 * Routes
 ******************************/
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'docs/introduction' },
  { path: 'docs/:id', component: DocShellComponent },
  { path: '**', redirectTo: 'docs/introduction' }
];

/******************************
 * Bootstrap
 ******************************/
const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideRouterStore(),
    provideAnimations(),
    provideStore({ docs: docsReducer }),
    provideEffects(DocsEffects),
    { provide: ENV_CONFIG, useValue: environment },
    RegistryService
  ]
};

bootstrapApplication(AppComponent, appConfig).then((ref) => {
  const registry = ref.injector.get(RegistryService);
  const store = ref.injector.get(Store);
  store.dispatch(setDocs({ docs: registry.ordered }));

  const router = ref.injector.get(Router);
  const match = router.url.match(/\/docs\/([^/?#]+)/);
  if (!match) {
    const first = registry.first();
    if (first) router.navigateByUrl(`/docs/${first.id}`);
  }
}).catch(err => console.error(err));