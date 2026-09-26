import { lazy, Suspense, useEffect } from 'react';
import { OlvideContrasena, RestablecerContrasena } from '../auth/screens/Contrasena.tsx';
import { Entrar } from '../auth/screens/Entrar.tsx';
import { Portada } from '../auth/screens/Portada.tsx';
import { Registro } from '../auth/screens/Registro.tsx';
import { RevisaCorreo } from '../auth/screens/RevisaCorreo.tsx';
import { VerificarCorreo } from '../auth/screens/VerificarCorreo.tsx';
import { CortinaDeLona } from '../ui/components/CortinaDeLona.tsx';
import type { LonaColor } from '../ui/components/Puesto.tsx';
import { FiltrosDelTianguis, OrillaDeLona, Rotulo } from '../ui/components/Tianguis.tsx';
import { Casa } from './Casa.tsx';
import { Creador } from './creador/Creador.tsx';
import { FronteraDeError } from './FronteraDeError.tsx';
import { ROUTES, RouterProvider, useRouter } from './router.tsx';
import { SessionProvider, useSession } from './session.tsx';

// La plaza trae Phaser: se descarga solo cuando alguien entra.
const Plaza = lazy(() => import('./plaza/Plaza.tsx'));

/** Cada puesto, su lona. */
const LONA_POR_RUTA: Record<string, LonaColor> = {
  [ROUTES.home]: 'rosa',
  [ROUTES.register]: 'rosa',
  [ROUTES.login]: 'azul',
  [ROUTES.checkEmail]: 'verde',
  [ROUTES.verifyEmail]: 'verde',
  [ROUTES.forgotPassword]: 'amarilla',
  [ROUTES.resetPassword]: 'amarilla',
  [ROUTES.plaza]: 'naranja',
};

const SOLO_SIN_SESION = new Set<string>([ROUTES.register, ROUTES.login, ROUTES.forgotPassword]);

function Cargando() {
  return (
    <div className="puesto puesto--cargando" aria-busy="true">
      <OrillaDeLona />
      <div className="cargando">
        <Rotulo className="rotulo--chico" />
        <p className="visually-hidden">Cargando Wous…</p>
      </div>
    </div>
  );
}

function Pantallas() {
  const { location, navigate } = useRouter();
  const { state } = useSession();
  const path = location.path;
  const autenticado = state.status === 'authenticated';

  const conPersonaje = state.status === 'authenticated' && state.session.hasCharacter;
  useEffect(() => {
    if (autenticado && SOLO_SIN_SESION.has(path)) navigate(ROUTES.home, { replace: true });
    // A la plaza solo se entra con sesión y personaje.
    if (path === ROUTES.plaza && state.status !== 'loading' && !conPersonaje) {
      navigate(ROUTES.home, { replace: true });
    }
  }, [autenticado, conPersonaje, path, navigate, state.status]);

  let lona: LonaColor = LONA_POR_RUTA[path] ?? 'rosa';
  if (path === ROUTES.home && autenticado) lona = 'naranja';

  let screen: React.ReactNode;
  if (state.status === 'loading') {
    screen = <Cargando />;
  } else {
    switch (path) {
      case ROUTES.register:
        screen = <Registro />;
        break;
      case ROUTES.login:
        screen = <Entrar />;
        break;
      case ROUTES.checkEmail:
        screen = <RevisaCorreo />;
        break;
      case ROUTES.verifyEmail:
        screen = <VerificarCorreo />;
        break;
      case ROUTES.forgotPassword:
        screen = <OlvideContrasena />;
        break;
      case ROUTES.resetPassword:
        screen = <RestablecerContrasena />;
        break;
      case ROUTES.plaza:
        screen =
          state.status === 'authenticated' && state.session.hasCharacter ? (
            <FronteraDeError
              titulo="La plaza no abrió"
              onSalir={() => navigate(ROUTES.home, { replace: true })}
            >
              <Suspense fallback={<Cargando />}>
                <Plaza session={state.session} />
              </Suspense>
            </FronteraDeError>
          ) : (
            <Cargando />
          );
        break;
      default:
        if (state.status !== 'authenticated') screen = <Portada />;
        else if (!state.session.hasCharacter) screen = <Creador session={state.session} />;
        else screen = <Casa session={state.session} />;
    }
  }

  return (
    <>
      <FiltrosDelTianguis />
      {screen}
      <CortinaDeLona lona={lona} />
    </>
  );
}

export function App() {
  return (
    <RouterProvider>
      <SessionProvider>
        <Pantallas />
      </SessionProvider>
    </RouterProvider>
  );
}
