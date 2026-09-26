import { useEffect } from 'react';
import { OlvideContrasena, RestablecerContrasena } from '../auth/screens/Contrasena.tsx';
import { Entrar } from '../auth/screens/Entrar.tsx';
import { Portada } from '../auth/screens/Portada.tsx';
import { Registro } from '../auth/screens/Registro.tsx';
import { RevisaCorreo } from '../auth/screens/RevisaCorreo.tsx';
import { VerificarCorreo } from '../auth/screens/VerificarCorreo.tsx';
import { CortinaDeLona } from '../ui/components/CortinaDeLona.tsx';
import type { LonaColor } from '../ui/components/Puesto.tsx';
import { OrillaDeLona, Rotulo } from '../ui/components/Tianguis.tsx';
import { Casa } from './Casa.tsx';
import { ROUTES, RouterProvider, useRouter } from './router.tsx';
import { SessionProvider, useSession } from './session.tsx';

/** Cada puesto, su lona. */
const LONA_POR_RUTA: Record<string, LonaColor> = {
  [ROUTES.home]: 'rosa',
  [ROUTES.register]: 'rosa',
  [ROUTES.login]: 'azul',
  [ROUTES.checkEmail]: 'verde',
  [ROUTES.verifyEmail]: 'verde',
  [ROUTES.forgotPassword]: 'amarilla',
  [ROUTES.resetPassword]: 'amarilla',
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

  useEffect(() => {
    if (autenticado && SOLO_SIN_SESION.has(path)) navigate(ROUTES.home, { replace: true });
  }, [autenticado, path, navigate]);

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
      default:
        screen = state.status === 'authenticated' ? <Casa session={state.session} /> : <Portada />;
    }
  }

  return (
    <>
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
