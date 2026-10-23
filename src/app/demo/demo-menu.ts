import type { NavItem } from '../components/ui/sidebar/nav-item';

export const DEMO_MENU: NavItem[] = [
  { id: 'portada', label: 'Portada', icon: 'home' },
  {
    id: 'equipos',
    label: 'Equipos',
    icon: 'nodes',
    children: [
      {
        id: 'videovigilancia',
        label: 'Videovigilancia',
        children: [
          { id: 'cctv', label: 'Cámaras CCTV' },
          { id: 'ptz', label: 'Cámaras PTZ' },
          { id: 'lpr', label: 'Cámaras LPR' },
        ],
      },
      {
        id: 'control',
        label: 'Control y señalización',
        children: [
          { id: 'semaforos', label: 'Semáforos' },
          { id: 'paneles', label: 'Paneles' },
          { id: 'viales', label: 'Señalización variable' },
        ],
      },
      {
        id: 'deteccion',
        label: 'Detección y aforo',
        children: [
          { id: 'sensores', label: 'Sensores' },
          { id: 'contadores', label: 'Contadores' },
          { id: 'zonas', label: 'Zonas' },
        ],
      },
    ],
  },
  { id: 'planes', label: 'Planes', icon: 'copy' },
  { id: 'analitica', label: 'Analítica', icon: 'pie' },
];

export const DEMO_FOOTER: NavItem[] = [
  { id: 'configuracion', label: 'Configuración', icon: 'settings' },
  { id: 'ayuda', label: 'Ayuda & soporte', icon: 'image' },
];
