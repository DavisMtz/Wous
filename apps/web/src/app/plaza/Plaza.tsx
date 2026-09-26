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
  const appearance = session.character?.appearance;
  const look = useMemo(() => (appearance ? lookFromAppearance(appearance) : null), [appearance]);
  if (!look) return null;
  return <PlazaJuego look={look} onSalir={() => navigate(ROUTES.home)} />;
}
