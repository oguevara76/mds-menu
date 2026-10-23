import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { TieredMenu } from 'primeng/tieredmenu';
import { Tooltip } from 'primeng/tooltip';
import { IconComponent } from '../icon/icon.component';
import { SidebarSearchDialogComponent } from './sidebar-search-dialog.component';
import type { NavItem } from './nav-item';

interface LevelMotion {
  outKey: string | null;
  inKey: string;
  direction: 'forward' | 'back';
  origin: number;
}

const ITEM_DELAY = 40;
const ITEM_DURATION = 400;

interface LevelFrame {
  key: string;
  items: NavItem[];
  backLabel: string | null;
  activeId: string | null;
}

const PRIME_ICON = /^pi(?:\s+pi-[\w-]+)+$/;
const RECENT_KEY = 'mds-menu.recent-accesses';
const RECENT_LIMIT = 10;
const RECENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

@Component({
  selector: 'mds-sidebar',
  imports: [IconComponent, SidebarSearchDialogComponent, TieredMenu, Tooltip],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-collapsed]': 'collapsed()',
  },
})
export class SidebarComponent {
  readonly items = input<NavItem[]>([]);
  readonly footerItems = input<NavItem[]>([]);
  /** Etiqueta del nivel raíz. El primer subnivel vuelve a ella. */
  readonly rootLabel = input('Portada');
  readonly collapsed = model(false);
  readonly activeId = model<string | null>(null);
  readonly itemSelect = output<NavItem>();

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('backButton') private backButtons?: QueryList<ElementRef<HTMLButtonElement>>;
  @ViewChildren(TieredMenu) private overlays?: QueryList<TieredMenu>;

  readonly query = signal('');
  readonly searchOpen = signal(false);
  readonly openOverlayId = signal<string | null>(null);
  readonly recentIds = signal<string[]>(this.readRecent());
  readonly motion = signal<LevelMotion | null>(null);
  private motionTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly stack = linkedSignal({
    source: this.items,
    computation: (items: NavItem[]): LevelFrame[] => [
      { key: 'level:root', items, backLabel: null, activeId: null },
    ],
  });

  readonly frames = computed(() => this.stack());

  readonly overlayOwners = computed(() =>
    [...this.items(), ...this.footerItems()].filter((item) => !!item.children?.length),
  );

  readonly overlayModels = computed(() => {
    const models = new Map<string, MenuItem[]>();
    for (const item of this.overlayOwners()) {
      models.set(item.id, this.toMenuItems(item.children ?? []));
    }
    return models;
  });

  readonly activeRootId = computed(() => {
    const id = this.activeId();
    if (!id) return null;
    return this.findPath(this.items(), id)?.[0]?.id ?? (this.footerOwns(id) ? id : null);
  });

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.collapsed() || this.motion() || this.stack().length < 2) return;
    this.goBack();
  }

  toggleCollapsed(): void {
    const expand = this.collapsed();
    if (!expand) this.finishMotion();
    this.collapsed.update((value) => !value);
    if (!expand) return;
    const current = this.stack().at(-1);
    if (current) {
      this.playMotion(
        { outKey: null, inKey: current.key, direction: 'forward', origin: 0 },
        current.items.length,
      );
    }
  }

  openSearch(): void {
    this.searchOpen.set(true);
  }

  onSearchPick(item: NavItem): void {
    this.activate(item);
  }

  onClearRecent(): void {
    if (!this.recentIds().length) return;
    this.recentIds.set([]);
    this.writeRecent([]);
  }

  onSearch(value: string): void {
    this.query.set(value);
  }

  onSearchEscape(event: Event): void {
    if (!this.query()) return;
    event.stopPropagation();
    this.query.set('');
  }

  itemsOf(frame: LevelFrame): NavItem[] {
    const frames = this.stack();
    const current = frames[frames.length - 1];
    if (!current || frame.key !== current.key) return frame.items;
    const query = this.query().trim().toLowerCase();
    if (!query) return frame.items;
    return frame.items.filter((item) => item.label.toLowerCase().includes(query));
  }

  isActive(frame: LevelFrame, index: number, itemId: string): boolean {
    if (frame.activeId) return frame.activeId === itemId;
    return index === 0 && this.stack().length === 1 && this.activeId() === itemId;
  }

  isPrimeIcon(icon: string | undefined): boolean {
    return !!icon && PRIME_ICON.test(icon);
  }

  hasChildren(item: NavItem): boolean {
    return !!item.children?.length;
  }

  activate(item: NavItem): void {
    if (this.motion() && !this.collapsed()) return;
    if (this.hasChildren(item)) {
      this.drill(item);
      return;
    }
    this.selectLeaf(item);
  }

  drill(item: NavItem): void {
    if (!item.children?.length || this.motion()) return;
    const frames = this.stack();
    const current = frames[frames.length - 1];
    const visible = this.itemsOf(current);
    const origin = Math.max(0, visible.findIndex((entry) => entry.id === item.id));
    const backLabel = frames.length === 1 ? this.rootLabel() : item.label;
    this.stack.set([
      ...frames.slice(0, -1),
      { ...current, activeId: item.id },
      {
        key: `level:${item.id}`,
        items: item.children,
        backLabel,
        activeId: null,
      },
    ]);
    this.query.set('');
    this.activeId.set(item.id);
    this.itemSelect.emit(item);
    this.remember(item.id);
    this.playMotion(
      { outKey: current.key, inKey: `level:${item.id}`, direction: 'forward', origin },
      Math.max(visible.length, item.children.length),
    );
    setTimeout(() => {
      const buttons = this.backButtons?.toArray() ?? [];
      buttons[buttons.length - 1]?.nativeElement.focus();
    });
  }

  goBack(): void {
    const frames = this.stack();
    if (frames.length < 2 || this.motion()) return;
    const current = frames[frames.length - 1];
    const previous = frames[frames.length - 2];
    this.query.set('');
    this.playMotion(
      { outKey: current.key, inKey: previous.key, direction: 'back', origin: 0 },
      Math.max(current.items.length, previous.items.length),
    );
  }

  toggleOverlay(event: Event, item: NavItem): void {
    const menus = this.overlays?.toArray() ?? [];
    const index = this.overlayOwners().findIndex((owner) => owner.id === item.id);
    menus.forEach((menu, menuIndex) => {
      if (menuIndex === index) menu.toggle(event);
      else menu.hide();
    });
  }

  onOverlayShow(id: string): void {
    this.openOverlayId.set(id);
  }

  onOverlayHide(id: string): void {
    if (this.openOverlayId() === id) this.openOverlayId.set(null);
  }

  private selectLeaf(item: NavItem): void {
    this.activeId.set(item.id);
    this.itemSelect.emit(item);
    this.remember(item.id);
    const path = this.findPath(this.items(), item.id) ?? this.findPath(this.footerItems(), item.id);
    if (!path?.length) return;

    const frames: LevelFrame[] = [
      {
        key: 'level:root',
        items: this.items(),
        backLabel: null,
        activeId: path[0].id,
      },
    ];

    for (let index = 0; index < path.length - 1; index++) {
      const node = path[index];
      if (!node.children?.length) break;
      frames.push({
        key: `level:${node.id}`,
        items: node.children,
        backLabel: index === 0 ? this.rootLabel() : node.label,
        activeId: path[index + 1].id,
      });
    }

    this.query.set('');
    this.stack.set(frames);
  }

  isLevelShown(frame: LevelFrame): boolean {
    const motion = this.motion();
    if (motion && (motion.inKey === frame.key || motion.outKey === frame.key)) return true;
    return this.stack().at(-1)?.key === frame.key;
  }

  motionKind(frame: LevelFrame): 'out-left' | 'out-right' | 'in-right' | 'in-left' | null {
    const motion = this.motion();
    if (!motion) return null;
    if (motion.outKey === frame.key) return motion.direction === 'forward' ? 'out-left' : 'out-right';
    if (motion.inKey === frame.key) return motion.direction === 'forward' ? 'in-right' : 'in-left';
    return null;
  }

  itemDelay(frame: LevelFrame, index: number): string | null {
    const motion = this.motion();
    if (!motion || (motion.inKey !== frame.key && motion.outKey !== frame.key)) return null;
    const steps = motion.direction === 'back' ? index : Math.abs(motion.origin - index);
    return `${steps * ITEM_DELAY}ms`;
  }

  private finishMotion(): void {
    if (this.motionTimer !== null) {
      clearTimeout(this.motionTimer);
      this.motionTimer = null;
    }
    if (this.motion()?.direction === 'back') {
      this.stack.update((frames) => (frames.length > 1 ? frames.slice(0, -1) : frames));
    }
    this.motion.set(null);
  }

  private playMotion(motion: LevelMotion, itemCount: number): void {
    this.finishMotion();
    this.motion.set(motion);
    const wait = ITEM_DURATION + Math.max(0, itemCount - 1) * ITEM_DELAY + 40;
    this.motionTimer = setTimeout(() => {
      this.motionTimer = null;
      if (motion.direction === 'back') {
        this.stack.update((frames) => (frames.length > 1 ? frames.slice(0, -1) : frames));
      }
      if (this.motion() === motion) this.motion.set(null);
    }, wait);
  }

  private toMenuItems(items: NavItem[]): MenuItem[] {
    return items.map((item) => {
      const children = item.children?.length ? this.toMenuItems(item.children) : undefined;
      return {
        label: item.label,
        // PrimeNG pinta la etiqueta con innerHTML si escape no es true.
        escape: true,
        icon: this.isPrimeIcon(item.icon) ? item.icon : undefined,
        items: children,
        command: children ? undefined : () => this.selectLeaf(item),
      };
    });
  }

  private findPath(items: NavItem[], id: string, trail: NavItem[] = []): NavItem[] | null {
    for (const item of items) {
      const next = [...trail, item];
      if (item.id === id) return next;
      if (item.children?.length) {
        const found = this.findPath(item.children, id, next);
        if (found) return found;
      }
    }
    return null;
  }

  private footerOwns(id: string): boolean {
    return this.footerItems().some((item) => item.id === id || this.findPath(item.children ?? [], id));
  }

  private remember(id: string): void {
    const menu = this.items();
    const footer = this.footerItems();
    if (!RECENT_ID.test(id) || (!this.findPath(menu, id) && !this.findPath(footer, id))) return;
    const stored = this.recentIds();
    const current = stored.filter(
      (entry) => RECENT_ID.test(entry) && (this.findPath(menu, entry) || this.findPath(footer, entry)),
    );
    const next = [id, ...current.filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
    if (next.length === stored.length && next.every((entry, index) => entry === stored[index])) return;
    this.recentIds.set(next);
    this.writeRecent(next);
  }

  private readRecent(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((id): id is string => typeof id === 'string' && RECENT_ID.test(id))
        .slice(0, RECENT_LIMIT);
    } catch {
      return [];
    }
  }

  private writeRecent(ids: string[]): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    } catch {
      // El historial es una ayuda local. Si el almacenamiento falla, la sesión sigue en memoria.
    }
  }
}
