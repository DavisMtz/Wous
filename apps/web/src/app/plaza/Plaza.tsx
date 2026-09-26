import type { SessionResponse } from '@wous/contracts';
import { useMemo } from 'react';
import { lookFromAppearance } from '../../game/rendering/appearance.ts';
import { ROUTES, useRouter } from '../router.tsx';
import { PlazaJuego } from './PlazaJuego.tsx';

/**
 * Ruta /plaza. Se carga aparte (import dinámico desde App): Phaser pesa y las
 * pantallas de acceso no tienen por qué pagarlo.
 */
export default function Plaza({ session }: { session: SessionResponse }) {
  const { navigate } = useRouter();
  // Por contenido, no por identidad: si la sesión se vuelve a pedir con la
  // misma ropa, el juego no se reinicia ni te regresa al punto de entrada.
  const appearanceJson = JSON.stringify(session.character?.appearance ?? null);
  const look = useMemo(() => {
    const appearance = JSON.parse(appearanceJson) as
      | Parameters<typeof lookFromAppearance>[0]
      | null;
    return appearance ? lookFromAppearance(appearance) : null;
  }, [appearanceJson]);
  if (!look) return null;
  return <PlazaJuego look={look} onSalir={() => navigate(ROUTES.home)} />;
}
