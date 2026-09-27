import type { SVGProps } from 'react';

/**
 * Íconos a trazo de plumón: un solo grosor (2.4), puntas redondas, trazos
 * apenas irregulares. Heredan el color del texto.
 */
const PATHS = {
  ojo: (
    <>
      <path d="M2.8 12.2c2.3-4.3 5.6-6.5 9.3-6.4 3.6 0 6.8 2.2 9.1 6.3-2.3 4.1-5.5 6.2-9.2 6.2-3.6 0-6.9-2-9.2-6.1Z" />
      <circle cx="12" cy="12.1" r="2.9" />
    </>
  ),
  'ojo-tachado': (
    <>
      <path d="M4.6 8.9C3.9 9.9 3.3 11 2.8 12.2c2.3 4.1 5.6 6.1 9.2 6.1 1.4 0 2.8-.3 4-.9M9.5 6.2c.8-.2 1.7-.4 2.6-.4 3.6 0 6.8 2.2 9.1 6.3-.6 1.1-1.3 2.1-2 2.9" />
      <path d="M3.4 3.6 20.7 20.4" />
      <path d="M9.9 10.2a2.9 2.9 0 0 0 4 4" />
    </>
  ),
  regresar: (
    <>
      <path d="M19.6 12.3H5.1" />
      <path d="M10.6 6.1 4.6 12.2l6.1 6" />
    </>
  ),
  sobre: (
    <>
      <path d="M3.3 6.4h17.5l-.2 11.4H3.4Z" />
      <path d="m3.6 6.7 8.5 6.6 8.4-6.7" />
    </>
  ),
  palomita: <path d="m4.4 12.8 4.9 4.6L19.8 6.3" />,
  alerta: (
    <>
      <path d="M12.1 3.5 21 19.6H3.1Z" />
      <path d="M12 9.6v4.3" />
      <path d="M12 16.9v.2" />
    </>
  ),
  salir: (
    <>
      <path d="M14.3 4.2H5.1v15.6h9.1" />
      <path d="M10.2 12.1h10.3" />
      <path d="m16.7 8.1 4 4-4 3.9" />
    </>
  ),
  flecha: <path d="m9.3 5.4 6.5 6.7-6.6 6.4" />,
  girar: (
    <>
      <path d="M19.4 12.2a7.3 7.3 0 1 1-2.2-5.3" />
      <path d="M19.6 4.3v4.4h-4.4" />
    </>
  ),
  caminar: (
    <>
      <circle cx="13.2" cy="4.6" r="1.9" />
      <path d="m9.4 21 2.2-5.4 2.6 2.1.9 3.4M11.6 15.6l.9-5.1 3.2 2.4 2.5.4M12.5 10.5 9.2 11.6l-1.4 3" />
    </>
  ),
  dado: (
    <>
      <path d="M5.1 4.3h13.7l.2 15.2-14 .1Z" />
      <circle cx="8.8" cy="8.2" r=".6" />
      <circle cx="15.2" cy="8.2" r=".6" />
      <circle cx="12" cy="12" r=".6" />
      <circle cx="8.8" cy="15.8" r=".6" />
      <circle cx="15.2" cy="15.8" r=".6" />
    </>
  ),
  gancho: (
    <>
      <path d="M12 7.3V6.1a2 2 0 1 1 2.2-2" />
      <path d="M12 7.3 2.9 15.4c-.6.6-.2 1.6.7 1.6h16.8c.9 0 1.3-1 .7-1.6Z" />
    </>
  ),
  globo: <path d="M4.2 5.3h15.6l-.2 10.1h-8.2l-4.3 3.6.3-3.6H4.4Z" />,
  'globo-tachado': (
    <>
      <path d="M4.2 5.3h15.6l-.2 10.1h-8.2l-4.3 3.6.3-3.6H4.4Z" />
      <path d="M3.6 3.4 20.6 20.3" />
    </>
  ),
  bandera: (
    <>
      <path d="M5.3 21.1V3.5" />
      <path d="M5.4 4.3c3.9-1.7 6.3 1.6 10 .3 1.5-.5 2.6-.8 3.6-.6l-.3 8.7c-3.8-.9-6.2 1.9-9.6.7-1.3-.5-2.5-.6-3.7-.2" />
    </>
  ),
  bloquear: (
    <>
      <path d="M12.1 3.5c4.8 0 8.5 3.8 8.4 8.6-.1 4.7-3.8 8.4-8.6 8.4-4.7-.1-8.4-3.9-8.4-8.6.1-4.7 3.9-8.4 8.6-8.4Z" />
      <path d="M6.2 6.4 17.8 17.8" />
    </>
  ),
  carita: (
    <>
      <path d="M12.1 3.5c4.8 0 8.5 3.8 8.4 8.6-.1 4.7-3.8 8.4-8.6 8.4-4.7-.1-8.4-3.9-8.4-8.6.1-4.7 3.9-8.4 8.6-8.4Z" />
      <path d="M8.3 14c2.1 2.6 5.5 2.6 7.5-.1" />
      <path d="M9.1 9.4v.4M15 9.3v.4" />
    </>
  ),
  cerrar: <path d="M6.1 6.2 17.9 17.9M17.8 6 6.2 18.1" />,
  /** El mismo trazo que la marca de amistad en la plaza (persona.ts). */
  corazon: (
    <path d="M12 19.7c-4.9-3-8.1-6.1-8.1-9.6 0-2.5 1.9-4.4 4.2-4.4 1.7 0 3.1 1 3.9 2.5.9-1.6 2.3-2.5 4-2.5 2.3 0 4.1 1.9 4.1 4.4 0 3.5-3.2 6.6-8.1 9.6Z" />
  ),
  agregar: (
    <>
      <path d="M9.4 5.1c1.6 0 2.9 1.3 2.8 2.9 0 1.6-1.3 2.8-2.9 2.8-1.5 0-2.8-1.3-2.7-2.9 0-1.5 1.3-2.8 2.8-2.8Z" />
      <path d="M3.8 19.4c.5-3.6 2.7-5.5 5.6-5.5 2.8 0 4.9 1.9 5.4 5.5" />
      <path d="M18.3 8.5v6.4M15.2 11.8h6.3" />
    </>
  ),
  gente: (
    <>
      <path d="M9.1 5.1c1.6 0 2.8 1.3 2.8 2.9 0 1.5-1.3 2.8-2.9 2.7-1.5 0-2.7-1.3-2.7-2.8.1-1.6 1.3-2.8 2.8-2.8Z" />
      <path d="M3.6 19.4c.5-3.6 2.7-5.4 5.4-5.4s4.9 1.8 5.4 5.4" />
      <path d="M16.3 6.8c1.3 0 2.3 1 2.2 2.3 0 1.2-1 2.2-2.3 2.1-1.2 0-2.1-1-2.1-2.2 0-1.3 1-2.2 2.2-2.2Z" />
      <path d="M15.1 14.1c2.7-.6 4.8.9 5.4 4.6" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icono({ name, size = 22, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
