import {
  type CharacterView,
  CreateCharacterRequest,
  resolveAppearance,
  type SessionResponse,
} from '@wous/contracts';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { appearanceFromLook } from '../../game/rendering/appearance.ts';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../../game/rendering/palette.ts';
import type { Look } from '../../game/rendering/pixel-character.ts';
import { api } from '../../services/api.ts';
import { Campo, erroresDeCampo, mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Icono } from '../../ui/components/Icono.tsx';
import { Puesto } from '../../ui/components/Puesto.tsx';
import { Aviso, Cartulina, Hoja } from '../../ui/components/Tianguis.tsx';
import { Espejo } from '../../ui/scene/Espejo.tsx';
import { Miniatura, RECORTES, type Recorte } from '../../ui/scene/Miniatura.tsx';
import { useSession } from '../session.tsx';
import { coloresDe, ESTILOS, lookAlAzar, NOMBRES, PEINADOS_SIN_GORRA } from './opciones.ts';

type Seccion = 'cuerpo' | 'pelo' | 'arriba' | 'abajo' | 'zapatos' | 'extra';

const SECCIONES: { id: Seccion; nombre: string }[] = [
  { id: 'cuerpo', nombre: 'Cuerpo' },
  { id: 'pelo', nombre: 'Pelo' },
  { id: 'arriba', nombre: 'Arriba' },
  { id: 'abajo', nombre: 'Abajo' },
  { id: 'zapatos', nombre: 'Zapatos' },
  { id: 'extra', nombre: 'Extra' },
];

type Opcion = {
  id: string;
  nombre: string;
  muestra: ReactNode;
  bloqueo?: string | undefined;
};

/** Grupo de opciones con radios nativos: flechas del teclado incluidas. */
function Grupo({
  leyenda,
  valor,
  opciones,
  onCambio,
  tipo = 'pieza',
}: {
  leyenda: string;
  valor: string;
  opciones: Opcion[];
  onCambio(id: string): void;
  tipo?: 'pieza' | 'color';
}) {
  const nombre = useId();
  return (
    <fieldset className={`grupo grupo--${tipo}`}>
      <legend className="grupo__leyenda">{leyenda}</legend>
      <div className="grupo__opciones">
        {opciones.map((o) => {
          const elegida = valor === o.id;
          return (
            <label
              key={o.id}
              className={`opcion ${elegida ? 'opcion--elegida' : ''} ${o.bloqueo ? 'opcion--bloqueada' : ''}`}
              title={o.bloqueo ?? o.nombre}
            >
              <input
                type="radio"
                className="opcion__radio"
                name={nombre}
                value={o.id}
                checked={elegida}
                disabled={Boolean(o.bloqueo)}
                onChange={() => onCambio(o.id)}
              />
              <span className="opcion__muestra">{o.muestra}</span>
              <span className={tipo === 'color' ? 'visually-hidden' : 'opcion__nombre'}>
                {o.nombre}
              </span>
              {o.bloqueo ? <span className="opcion__pronto">{o.bloqueo}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Muestra({ color }: { color: string }) {
  return <span className="muestra" style={{ backgroundColor: color }} aria-hidden="true" />;
}

function piezas(
  look: Look,
  lista: { id: string; bloqueado: boolean }[],
  nombres: Record<string, string>,
  aplicar: (id: string) => Partial<Look>,
  recorte: Recorte,
  escala: number,
  opcionesDeDibujo?: { clothesOnly: boolean },
): Opcion[] {
  return lista.map(({ id, bloqueado }) => ({
    id,
    nombre: nombres[id] ?? id,
    bloqueo: bloqueado ? 'Pronto' : undefined,
    muestra: (
      <Miniatura
        look={{ ...look, ...aplicar(id) }}
        recorte={recorte}
        escala={escala}
        {...(opcionesDeDibujo ? { opciones: opcionesDeDibujo } : {})}
      />
    ),
  }));
}

function colores(
  ids: readonly string[],
  paleta: Record<string, { base: string }>,
  nombres: Record<string, string>,
): Opcion[] {
  return ids.map((id) => ({
    id,
    nombre: nombres[id] ?? id,
    muestra: <Muestra color={paleta[id]?.base ?? '#000'} />,
  }));
}

/** Escala del espejo: grande en escritorio, más chica en teléfono para ver las opciones. */
function useEscalaEspejo(): number {
  const consulta = '(min-width: 821px)';
  const [ancho, setAncho] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setAncho(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return ancho ? 7 : 5;
}

/**
 * El probador del tianguis: arma tu personaje con piezas del catálogo. El
 * cliente solo manda IDs; el servidor valida sesión, catálogo, set inicial y
 * combinación (§10). Aquí se valida lo mismo antes, para avisar en el acto.
 */
export function Creador({ session }: { session: SessionResponse }) {
  const { setSession } = useSession();
  const [look, setLook] = useState<Look>(lookAlAzar);
  const [nombre, setNombre] = useState(session.account.username);
  const [seccion, setSeccion] = useState<Seccion>('cuerpo');
  const [cargando, setCargando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const escalaEspejo = useEscalaEspejo();
  const idBase = useId();

  const cambiar = (parcial: Partial<Look>) => {
    setLook((actual) => {
      const siguiente = { ...actual, ...parcial };
      // La gorra no cabe con peinados de volumen: se la quitamos.
      if (siguiente.accessory === 'gorra' && PEINADOS_SIN_GORRA.has(siguiente.hair)) {
        siguiente.accessory = null;
      }
      return siguiente;
    });
  };

  const moverTab = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + SECCIONES.length) % SECCIONES.length;
    const target = SECCIONES[next];
    if (target) setSeccion(target.id);
    tabs.current[next]?.focus();
  };

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setGeneral(null);
    const body = { displayName: nombre, appearance: appearanceFromLook(look) };
    const parsed = CreateCharacterRequest.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setErrores({ displayName: issue?.message ?? 'Revisa tu nombre.' });
      return;
    }
    const resolved = resolveAppearance(parsed.data.appearance);
    if (!resolved.ok) {
      setGeneral(resolved.problems[0]?.message ?? 'Revisa las piezas de tu personaje.');
      return;
    }
    setErrores({});
    setCargando(true);
    try {
      const character = await api.post<CharacterView>('/characters', parsed.data);
      setSession({ ...session, hasCharacter: true, character });
    } catch (err) {
      setErrores(erroresDeCampo(err));
      setGeneral(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  const panel = (() => {
    switch (seccion) {
      case 'cuerpo':
        return (
          <>
            <Grupo
              leyenda="Complexión"
              valor={look.body}
              onCambio={(id) => cambiar({ body: id as Look['body'] })}
              opciones={piezas(
                look,
                [
                  { id: 'a', bloqueado: false },
                  { id: 'b', bloqueado: false },
                ],
                NOMBRES.body,
                (id) => ({ body: id as Look['body'] }),
                RECORTES.torso,
                3,
              )}
            />
            <Grupo
              leyenda="Tono de piel"
              tipo="color"
              valor={look.skin}
              onCambio={(id) => cambiar({ skin: id as Look['skin'] })}
              opciones={colores(Object.keys(SKIN_TONES), SKIN_TONES, NOMBRES.skin)}
            />
          </>
        );
      case 'pelo':
        return (
          <>
            <Grupo
              leyenda="Peinado"
              valor={look.hair}
              onCambio={(id) => cambiar({ hair: id as Look['hair'] })}
              opciones={piezas(
                look,
                Object.keys(NOMBRES.hair).map((id) => ({ id, bloqueado: false })),
                NOMBRES.hair,
                (id) => ({ hair: id as Look['hair'], accessory: null }),
                RECORTES.cabeza,
                3,
              )}
            />
            <Grupo
              leyenda="Color de pelo"
              tipo="color"
              valor={look.hairColor}
              onCambio={(id) => cambiar({ hairColor: id as Look['hairColor'] })}
              opciones={colores(Object.keys(HAIR_COLORS), HAIR_COLORS, NOMBRES.hairColor)}
            />
          </>
        );
      case 'arriba':
        return (
          <>
            <Grupo
              leyenda="Prenda"
              valor={look.top}
              onCambio={(id) => cambiar({ top: id as Look['top'] })}
              opciones={piezas(
                look,
                ESTILOS.top,
                NOMBRES.top,
                (id) => ({ top: id as Look['top'] }),
                RECORTES.torso,
                3,
                { clothesOnly: true },
              )}
            />
            <Grupo
              leyenda="Color"
              tipo="color"
              valor={look.topColor}
              onCambio={(id) => cambiar({ topColor: id as Look['topColor'] })}
              opciones={colores(coloresDe('top', look.top), CLOTH_COLORS, NOMBRES.color)}
            />
          </>
        );
      case 'abajo':
        return (
          <>
            <Grupo
              leyenda="Prenda"
              valor={look.bottom}
              onCambio={(id) => cambiar({ bottom: id as Look['bottom'] })}
              opciones={piezas(
                look,
                ESTILOS.bottom,
                NOMBRES.bottom,
                (id) => ({ bottom: id as Look['bottom'] }),
                RECORTES.piernas,
                3,
                { clothesOnly: true },
              )}
            />
            <Grupo
              leyenda="Color"
              tipo="color"
              valor={look.bottomColor}
              onCambio={(id) => cambiar({ bottomColor: id as Look['bottomColor'] })}
              opciones={colores(coloresDe('bottom', look.bottom), CLOTH_COLORS, NOMBRES.color)}
            />
          </>
        );
      case 'zapatos':
        return (
          <>
            <Grupo
              leyenda="Calzado"
              valor={look.shoes}
              onCambio={(id) => cambiar({ shoes: id as Look['shoes'] })}
              opciones={piezas(
                look,
                ESTILOS.shoes,
                NOMBRES.shoes,
                (id) => ({ shoes: id as Look['shoes'] }),
                RECORTES.pies,
                4,
              )}
            />
            <Grupo
              leyenda="Color"
              tipo="color"
              valor={look.shoesColor}
              onCambio={(id) => cambiar({ shoesColor: id as Look['shoesColor'] })}
              opciones={colores(coloresDe('shoes', look.shoes), CLOTH_COLORS, NOMBRES.color)}
            />
          </>
        );
      case 'extra': {
        const sinGorra = PEINADOS_SIN_GORRA.has(look.hair);
        const accesorios: Opcion[] = [
          {
            id: 'ninguno',
            nombre: 'Nada',
            muestra: (
              <Miniatura look={{ ...look, accessory: null }} recorte={RECORTES.cabeza} escala={3} />
            ),
          },
          ...piezas(
            look,
            ESTILOS.accessory,
            NOMBRES.accessory,
            (id) => ({ accessory: id as Look['accessory'] }),
            RECORTES.cabeza,
            3,
          ).map((o) =>
            o.id === 'gorra' && sinGorra && !o.bloqueo
              ? { ...o, bloqueo: 'No cabe con tu peinado' }
              : o,
          ),
        ];
        return (
          <>
            <Grupo
              leyenda="Accesorio"
              valor={look.accessory ?? 'ninguno'}
              onCambio={(id) =>
                cambiar({ accessory: id === 'ninguno' ? null : (id as Look['accessory']) })
              }
              opciones={accesorios}
            />
            {look.accessory ? (
              <Grupo
                leyenda="Color"
                tipo="color"
                valor={look.accessoryColor}
                onCambio={(id) => cambiar({ accessoryColor: id as Look['accessoryColor'] })}
                opciones={colores(
                  coloresDe('accessory', look.accessory),
                  CLOTH_COLORS,
                  NOMBRES.color,
                )}
              />
            ) : null}
          </>
        );
      }
    }
  })();

  return (
    <Puesto>
      <div className="probador">
        <div className="probador__espejo">
          <Espejo look={look} escala={escalaEspejo} />
          <button type="button" className="chip chip--azar" onClick={() => setLook(lookAlAzar())}>
            <Icono name="dado" size={20} />
            Otro al azar
          </button>
        </div>
        <div className="probador__hoja">
          <Hoja titulo="Arma tu personaje" id="creador-titulo">
            <p className="hoja__entrada">
              Así te van a ver en la plaza. Después podrás cambiarte de ropa.
            </p>
            <form className="formulario" onSubmit={enviar} noValidate>
              <Campo
                etiqueta="Nombre de tu personaje"
                value={nombre}
                maxLength={20}
                onChange={(e) => setNombre(e.target.value)}
                error={errores.displayName}
                ayuda="De 3 a 20 caracteres. Puede llevar acentos y espacios."
              />
              <div className="pestanas" role="tablist" aria-label="Partes del personaje">
                {SECCIONES.map((s, i) => (
                  <button
                    key={s.id}
                    ref={(el) => {
                      tabs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${idBase}-tab-${s.id}`}
                    aria-selected={seccion === s.id}
                    aria-controls={`${idBase}-panel`}
                    tabIndex={seccion === s.id ? 0 : -1}
                    className={`pestana ${seccion === s.id ? 'pestana--activa' : ''}`}
                    onClick={() => setSeccion(s.id)}
                    onKeyDown={(e) => moverTab(e, i)}
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
              <div
                className="pestanas__panel"
                role="tabpanel"
                id={`${idBase}-panel`}
                aria-labelledby={`${idBase}-tab-${seccion}`}
              >
                {panel}
              </div>
              {general ? <Aviso>{general}</Aviso> : null}
              <Cartulina type="submit" cargando={cargando}>
                ¡Listo, a la plaza!
              </Cartulina>
            </form>
          </Hoja>
        </div>
      </div>
    </Puesto>
  );
}
