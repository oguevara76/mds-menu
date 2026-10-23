import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { IconComponent } from '../icon/icon.component';
import type { NavItem } from './nav-item';

interface SearchHit {
  item: NavItem;
  ancestors: string[];
}

const PRIME_ICON = /^pi(?:\s+pi-[\w-]+)+$/;
const RECENT_LIMIT = 10;

@Component({
  selector: 'mds-sidebar-search-dialog',
  imports: [Dialog, IconComponent],
  templateUrl: './sidebar-search-dialog.component.html',
  styleUrl: './sidebar-search-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarSearchDialogComponent {
  readonly open = model(false);
  readonly items = input<NavItem[]>([]);
  readonly footerItems = input<NavItem[]>([]);
  readonly recentIds = input<string[]>([]);
  readonly pick = output<NavItem>();
  readonly clearRecent = output<void>();

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  readonly activeIndex = signal(0);
  /** La fila gris fija solo aparece al moverse con el teclado, como el ítem activo del overlay. */
  readonly keyboard = signal(false);

  readonly catalog = computed(() => [...this.flatten(this.items()), ...this.flatten(this.footerItems())]);

  readonly searching = computed(() => this.query().trim().length > 0);

  readonly hits = computed(() => {
    const query = this.query().trim().toLowerCase();
    const catalog = this.catalog();
    if (!query) {
      const byId = new Map(catalog.map((hit) => [hit.item.id, hit]));
      return this.recentIds()
        .slice(0, RECENT_LIMIT)
        .flatMap((id) => {
          const hit = byId.get(id);
          return hit ? [hit] : [];
        });
    }
    return catalog.filter((hit) => hit.item.label.toLowerCase().includes(query));
  });

  readonly heading = computed(() => (this.searching() ? 'Resultados' : 'Últimos accesos'));

  readonly showClear = computed(() => !this.searching() && this.hits().length > 0);

  readonly selected = computed(() => {
    const hits = this.hits();
    if (!hits.length) return null;
    return hits[Math.min(this.activeIndex(), hits.length - 1)];
  });

  onVisible(open: boolean): void {
    this.open.set(open);
  }

  onShow(): void {
    this.query.set('');
    this.activeIndex.set(0);
    this.keyboard.set(false);
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
    this.keyboard.set(false);
  }

  isPrimeIcon(icon: string | undefined): boolean {
    return !!icon && PRIME_ICON.test(icon);
  }

  isSelected(hit: SearchHit): boolean {
    return this.selected()?.item.id === hit.item.id;
  }

  choose(hit: SearchHit): void {
    this.keyboard.set(false);
    const index = this.hits().findIndex((entry) => entry.item.id === hit.item.id);
    if (index >= 0) this.activeIndex.set(index);
  }

  confirm(hit: SearchHit | null): void {
    if (!hit) return;
    this.pick.emit(hit.item);
    this.open.set(false);
  }

  onClear(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeIndex.set(0);
    this.keyboard.set(false);
    this.clearRecent.emit();
  }

  pathLabel(hit: SearchHit): string {
    return hit.ancestors.join(' / ');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof Element && event.target.closest('.clear')) return;
    const hits = this.hits();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!hits.length) return;
      this.keyboard.set(true);
      this.activeIndex.update((index) => (index + 1) % hits.length);
      this.scrollActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!hits.length) return;
      this.keyboard.set(true);
      this.activeIndex.update((index) => (index - 1 + hits.length) % hits.length);
      this.scrollActive();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.confirm(this.selected());
    }
  }

  private scrollActive(): void {
    setTimeout(() => {
      document.querySelector('.mds-search-dialog .result.is-active')?.scrollIntoView({ block: 'nearest' });
    });
  }

  private flatten(items: NavItem[], ancestors: string[] = []): SearchHit[] {
    const hits: SearchHit[] = [];
    for (const item of items) {
      hits.push({ item, ancestors });
      if (item.children?.length) hits.push(...this.flatten(item.children, [...ancestors, item.label]));
    }
    return hits;
  }
}
