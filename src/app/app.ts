import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SidebarComponent } from './components/ui/sidebar/sidebar.component';
import type { NavItem } from './components/ui/sidebar/nav-item';
import { DEMO_FOOTER, DEMO_MENU } from './demo/demo-menu';

@Component({
  selector: 'app-root',
  imports: [SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly items = DEMO_MENU;
  readonly footerItems = DEMO_FOOTER;
  readonly collapsed = signal(false);
  readonly activeId = signal<string | null>('equipos');
  readonly selected = signal<NavItem>(DEMO_MENU[1]);

  onSelect(item: NavItem): void {
    this.selected.set(item);
  }
}
