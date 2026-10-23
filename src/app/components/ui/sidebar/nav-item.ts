export interface NavItem {
  id: string;
  label: string;
  /** Nombre de icono del sistema (`home`, `nodes`…) o clases PrimeIcons (`pi pi-home`). */
  icon?: string;
  children?: NavItem[];
}
