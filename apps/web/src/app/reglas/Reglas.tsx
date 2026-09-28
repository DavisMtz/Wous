import { Mostrador } from '../../auth/Mostrador.tsx';
import { Icono } from '../../ui/components/Icono.tsx';
import { EnlaceTrazo, Hoja } from '../../ui/components/Tianguis.tsx';
import { ROUTES } from '../router.tsx';
import { useSession } from '../session.tsx';
import { REGLAS } from './textos.ts';

/**
 * `/reglas`: lo que se acepta al crear la cuenta, qué pasa si alguien las
 * rompe y qué datos guarda Wous (§30). Se lee sin sesión.
 */
export function Reglas() {
  const { state } = useSession();
  const conSesion = state.status === 'authenticated';
  return (
    <Mostrador etiqueta={null}>
      <Hoja titulo="Reglas de convivencia" id="reglas-titulo">
        <p className="hoja__entrada">
          Wous está en alpha cerrada: somos poca gente, invitada, probando un mundo que todavía
          cambia. Para que la plaza sea un buen lugar, esto es lo que aceptas al crear tu cuenta.
        </p>
        <ul className="hoja__pasos reglas-pagina__lista">
          {REGLAS.map((regla) => (
            <li key={regla}>
              <Icono name="palomita" size={20} />
              <span>{regla}</span>
            </li>
          ))}
        </ul>

        <section className="reglas-pagina__seccion" aria-labelledby="reglas-molestan">
          <h2 className="hoja__subtitulo" id="reglas-molestan">
            Si alguien te molesta
          </h2>
          <p>
            Toca a esa persona en la plaza, o su nombre en el chat. Bloquear es inmediato: dejas de
            leerla y ella a ti, sin que se entere. Reportar le avisa a la caseta.
          </p>
        </section>

        <section className="reglas-pagina__seccion" aria-labelledby="reglas-caseta">
          <h2 className="hoja__subtitulo" id="reglas-caseta">
            Qué hace la caseta
          </h2>
          <p>
            Una persona revisa cada reporte con lo que la sala repartió en ese momento, no con
            capturas. Según lo que pasó, puede silenciar el chat de alguien unas horas o días,
            suspender su cuenta un tiempo o cerrarla. Quien está suspendido ve hasta cuándo al
            intentar entrar.
          </p>
        </section>

        <section className="reglas-pagina__seccion" aria-labelledby="reglas-datos">
          <h2 className="hoja__subtitulo" id="reglas-datos">
            Tus datos
          </h2>
          <ul className="reglas-pagina__datos">
            <li>
              Tu correo sirve para entrar y recuperar la cuenta; en la plaza solo se ve el nombre de
              tu personaje.
            </li>
            <li>Tu contraseña se guarda protegida: nadie puede leerla, ni siquiera la caseta.</li>
            <li>
              El chat no se guarda. Cada sala recuerda unos minutos para poder atender reportes y lo
              borra al vaciarse; solo un mensaje reportado, con poquito contexto, queda para quien
              modera.
            </li>
            <li>
              Usamos una sola cookie, la de tu sesión. Los avisos de amistad por correo se apagan en
              tu banda.
            </li>
          </ul>
        </section>

        <p className="hoja__pie">Wous es para mayores de 16 años.</p>
        <EnlaceTrazo to={ROUTES.home} icono="regresar">
          {conSesion ? 'Volver a tu casa' : 'Volver al inicio'}
        </EnlaceTrazo>
      </Hoja>
    </Mostrador>
  );
}
