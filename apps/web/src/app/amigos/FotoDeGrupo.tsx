import type { FriendEntry } from '@wous/contracts';
import { type MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { lookFromAppearance } from '../../game/rendering/appearance.ts';
import { FRAME_H, FRAME_W, frameCanvas } from '../../game/rendering/pixel-character.ts';
import { mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Icono } from '../../ui/components/Icono.tsx';
import { Aviso, Cartulina } from '../../ui/components/Tianguis.tsx';
import { canAnimate } from '../../ui/motion.ts';
import { huacal } from '../../ui/scene/huacal.ts';
import { pixelCanvas } from '../../ui/scene/pixel-canvas.ts';
import { type AccionesDeBanda, cuantos, desdeCuando, Retrato } from './piezas.tsx';

/** Hasta 12 por foto; con más, la foto se vuelve álbum. */
export const POR_FOTO = 12;
/** Pixeles de arte: separación en una fila, lo que sube cada fila de atrás y márgenes. */
const PASO = 30;
const ESCALON = 26;
const ORILLA = 9;
const MARGEN = 20;

const LONA = '#0f8a4a';
const LONA_LUZ = '#13a058';
const LONA_PLIEGUE = '#0b7a41';
const LONA_HONDO = '#075a2f';
const OJILLO = '#d8d2dc';
const PISO = '#9c8f95';
const PISO_LUZ = '#b7abb1';
const PISO_JUNTA = '#8b7f86';
const FOSFO_AMARILLO = '#efff3a';

type Lugar = { entry: FriendEntry; x: number; pies: number; fila: number };

export type Foto = {
  ancho: number;
  alto: number;
  /** Pies de la fila de adelante (en el piso). */
  piso: number;
  filas: number;
  lugares: Lugar[];
};

/** 1 a 4 en una fila, hasta 8 en dos y hasta 12 en tres. */
function filasPara(n: number): { filas: number; porFila: number } {
  if (n <= 4) return { filas: 1, porFila: Math.max(n, 1) };
  if (n <= 8) return { filas: 2, porFila: Math.ceil(n / 2) };
  return { filas: 3, porFila: Math.ceil(n / 3) };
}

/**
 * Acomoda a la gente como en una foto de generación: los primeros de la lista
 * (lo más nuevo) adelante, en el piso; los demás, en gradas cada vez más
 * altas. Cada fila se recorre media persona para que las cabezas asomen.
 */
export function componer(gente: readonly FriendEntry[], anchoDisponible = 0): Foto {
  const { filas, porFila } = filasPara(gente.length);
  // Lo mínimo para que quepa la fila más larga; si el marco da más, la foto lo llena.
  const minimo = Math.max(
    128,
    (porFila - 1) * PASO + FRAME_W + 2 * MARGEN + (filas > 1 ? PASO / 2 : 0),
  );
  const ancho = Math.max(minimo, anchoDisponible);
  const piso = ORILLA + 8 + FRAME_H + (filas - 1) * ESCALON + 8;
  const lugares: Lugar[] = [];
  for (let fila = 0; fila < filas; fila++) {
    const enFila = gente.slice(fila * porFila, (fila + 1) * porFila);
    const anchoFila = (enFila.length - 1) * PASO + FRAME_W;
    const corrida = filas > 1 ? (fila % 2 === 0 ? -PASO / 4 : PASO / 4) : 0;
    const inicio = Math.round((ancho - anchoFila) / 2 + corrida);
    enFila.forEach((entry, k) => {
      lugares.push({ entry, x: inicio + k * PASO, pies: piso - fila * ESCALON, fila });
    });
  }
  return { ancho, alto: piso + 9, piso, filas, lugares };
}

/** El estudio: la lona verde de un puesto, su foco, las gradas, el piso y la banda. */
/** El sprite como una sola mancha de color: con él se dibuja el halo de un pixel. */
function silueta(sprite: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sprite.width;
  c.height = sprite.height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * El estudio: la lona verde de un puesto, las gradas, el piso y la banda. El
 * foco pelón cuelga de la orilla sobre la banda y, cuando eliges a alguien,
 * se corre por la orilla hasta quedar encima: su luz cae detrás de esa persona
 * y un halo marcatextos de un pixel la rodea (la Regla del Foco). Sin nadie en
 * la foto no hay foco: nunca cuelga sobre nada.
 */
function pintar(canvas: HTMLCanvasElement, foto: Foto, escala: number, elegido: string | null) {
  const { ancho, alto, piso, filas } = foto;
  const p = pixelCanvas(canvas, ancho, alto, escala);
  const suelo = piso - 5;
  p.clear();
  p.rect(0, 0, ancho, suelo, LONA);
  for (let x = 3; x < ancho; x += 12) {
    p.rect(x, ORILLA, 2, suelo - ORILLA, LONA_LUZ);
    p.rect(x + 7, ORILLA, 1, suelo - ORILLA, LONA_PLIEGUE);
  }
  p.rect(0, 0, ancho, 5, LONA_HONDO);
  for (let x = 0; x < ancho; x += 18) {
    p.rect(x + 2, 5, 14, 2, LONA_HONDO);
    p.rect(x + 5, 7, 8, 1, LONA_HONDO);
    p.rect(x + 1, 2, 1, 1, OJILLO);
  }
  // Piso de banqueta.
  p.rect(0, suelo, ancho, alto - suelo, PISO);
  p.rect(0, suelo, ancho, 1, PISO_LUZ);
  for (let x = 5; x < ancho; x += 23) p.rect(x, suelo + 7, 12, 1, PISO_JUNTA);
  // Gradas de huacal: de la más alta (atrás) a la más baja.
  for (let fila = filas - 1; fila >= 1; fila--) {
    const arriba = piso - fila * ESCALON;
    huacal(p, MARGEN / 2, arriba, ancho - MARGEN, suelo - arriba + 2, 2, 3);
    p.rect(MARGEN / 2, suelo + 2, ancho - MARGEN, 1, 'rgb(43 18 56 / 0.35)');
  }

  const lugarElegido = foto.lugares.find((l) => l.entry.friendshipId === elegido);
  if (foto.lugares.length > 0) {
    // El foco: sobre la banda o, si elegiste a alguien, justo encima de su cabeza.
    const cx = lugarElegido ? lugarElegido.x + FRAME_W / 2 : Math.round(ancho / 2);
    const cabeza = lugarElegido ? lugarElegido.pies - FRAME_H : ORILLA + 14;
    const bombilla = Math.max(ORILLA + 3, cabeza - 9);
    const luzY = lugarElegido ? lugarElegido.pies - FRAME_H / 2 : cabeza + 10;
    const radio = lugarElegido ? FRAME_H * 0.85 : ancho * 0.42;
    const luz = p.ctx.createRadialGradient(
      cx * p.unit,
      luzY * p.unit,
      0,
      cx * p.unit,
      luzY * p.unit,
      radio * p.unit,
    );
    luz.addColorStop(0, `rgb(255 240 178 / ${lugarElegido ? 0.62 : 0.34})`);
    luz.addColorStop(1, 'rgb(255 240 178 / 0)');
    p.ctx.fillStyle = luz;
    p.ctx.fillRect(0, 0, ancho * p.unit, suelo * p.unit);
    p.rect(cx, 0, 1, bombilla, '#2b1238');
    p.rect(cx - 1, bombilla, 3, 2, '#3b3340');
    p.rect(cx - 1, bombilla + 2, 3, 3, '#fff2b8');
  }

  // La banda: atrás primero, para que adelante tape los pies de atrás.
  const orden = [...foto.lugares].sort((a, b) => b.fila - a.fila);
  for (const lugar of orden) {
    p.ctx.fillStyle = 'rgb(43 18 56 / 0.3)';
    p.ctx.beginPath();
    p.ctx.ellipse(
      (lugar.x + FRAME_W / 2) * p.unit,
      (lugar.pies - 0.5) * p.unit,
      6 * p.unit,
      1.4 * p.unit,
      0,
      0,
      Math.PI * 2,
    );
    p.ctx.fill();
    const sprite = frameCanvas(lookFromAppearance(lugar.entry.appearance), 'down', 0);
    const y = lugar.pies - FRAME_H;
    if (lugar === lugarElegido) {
      const halo = silueta(sprite, FOSFO_AMARILLO);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        p.sprite(halo, 0, 0, FRAME_W, FRAME_H, lugar.x + dx, y + dy);
      }
    }
    p.sprite(sprite, 0, 0, FRAME_W, FRAME_H, lugar.x, y);
  }
}

/** Quién está bajo este punto de la foto (en pixeles de arte), de adelante hacia atrás. */
function quienEsta(foto: Foto, x: number, y: number): FriendEntry | null {
  const orden = [...foto.lugares].sort((a, b) => a.fila - b.fila);
  for (const l of orden) {
    if (x >= l.x && x < l.x + FRAME_W && y >= l.pies - FRAME_H && y <= l.pies) return l.entry;
  }
  return null;
}

const NOMBRES_DE_FILA: Record<number, string[]> = {
  1: ['De izquierda a derecha:'],
  2: ['Arriba:', 'Abajo:'],
  3: ['Arriba:', 'En medio:', 'Abajo:'],
};

/** La ficha de alguien de la foto: quitarlo de tu banda o bloquearlo, con confirmación. */
function FichaDeFoto({
  entry,
  acciones,
  onCerrar,
  onHecho,
}: {
  entry: FriendEntry;
  acciones: AccionesDeBanda;
  onCerrar: () => void;
  onHecho: (texto: string) => void;
}) {
  const [paso, setPaso] = useState<'inicio' | 'quitar' | 'bloquear'>('inicio');
  const [espera, setEspera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const confirmar = async () => {
    setEspera(true);
    setError(null);
    try {
      if (paso === 'quitar') {
        await acciones.quitar(entry);
        onHecho(`Quitaste a ${entry.displayName} de tu banda.`);
      } else {
        await acciones.bloquear(entry);
        onHecho(`Bloqueaste a ${entry.displayName}.`);
      }
    } catch (err) {
      setError(mensajeDeError(err));
      setEspera(false);
    }
  };

  return (
    <div
      className="foto__ficha"
      id="ficha-de-foto"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ficha-de-foto-nombre"
    >
      <span className="foto__ficha-masking" aria-hidden="true" />
      <button type="button" className="foto__ficha-cerrar" aria-label="Cerrar" onClick={onCerrar}>
        <Icono name="cerrar" size={18} />
      </button>
      <div className="foto__ficha-quien">
        <span className="retrato retrato--recado">
          <Retrato appearance={entry.appearance} escala={3} />
        </span>
        <div>
          <p className="foto__ficha-nombre" id="ficha-de-foto-nombre">
            {entry.displayName}
          </p>
          <p className="foto__ficha-desde">
            <Icono name="corazon" size={16} />
            {desdeCuando(entry.since).replace(/^d/, 'D')}
          </p>
        </div>
      </div>

      {paso === 'inicio' ? (
        <div className="foto__ficha-botones">
          <Cartulina type="button" variante="trazo" onClick={() => setPaso('quitar')}>
            Quitar
          </Cartulina>
          <Cartulina
            type="button"
            variante="trazo"
            icono="bloquear"
            onClick={() => setPaso('bloquear')}
          >
            Bloquear
          </Cartulina>
        </div>
      ) : (
        <div className="foto__ficha-confirmar">
          <p className="foto__ficha-pregunta">
            {paso === 'quitar'
              ? `¿Quitar a ${entry.displayName} de tu banda?`
              : `¿Bloquear a ${entry.displayName}?`}
          </p>
          <p>
            {paso === 'quitar'
              ? 'Sale de tu foto y tú de la suya. No se le avisa.'
              : 'Sale de tu banda y en la plaza ya no se van a oír ni a ver sus gestos. No se le avisa; lo puedes deshacer desde tu casa.'}
          </p>
          <div className="foto__ficha-botones">
            <Cartulina type="button" cargando={espera} onClick={confirmar}>
              {paso === 'quitar' ? 'Quitar' : 'Bloquear'}
            </Cartulina>
            <Cartulina
              type="button"
              variante="trazo"
              disabled={espera}
              onClick={() => {
                setError(null);
                setPaso('inicio');
              }}
            >
              Cancelar
            </Cartulina>
          </div>
        </div>
      )}
      {error ? <Aviso>{error}</Aviso> : null}
    </div>
  );
}

type Props = {
  /** Tu banda, lo más nuevo primero. null mientras se revela (carga). */
  amigos: FriendEntry[] | null;
  acciones: AccionesDeBanda;
  /** Lo que acaba de pasar, para quien no ve la foto. */
  onHecho: (texto: string) => void;
};

/**
 * La foto de grupo (ADR-0011): tu banda posa en gradas, pegada a la lona con
 * masking y con sus nombres escritos al pie. Tocar a alguien (o su nombre,
 * que es el camino por teclado) abre su ficha. Cuando alguien se une, la foto
 * se vuelve a tomar: truena el flash.
 */
export function FotoDeGrupo({ amigos, acciones, onHecho }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const invocador = useRef<HTMLElement | null>(null);
  /** Ancho del marco en pixeles CSS (0 hasta medirlo). */
  const [marco, setMarco] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);

  const todos = amigos ?? [];
  const paginas = Math.max(1, Math.ceil(todos.length / POR_FOTO));
  const actual = Math.min(pagina, paginas - 1);
  const gente = useMemo(
    () => todos.slice(actual * POR_FOTO, (actual + 1) * POR_FOTO),
    [todos, actual],
  );
  // A escala entera (2 en teléfono, 3 a 5 en escritorio) y a todo lo ancho del marco.
  const minimo = useMemo(() => componer(gente).ancho, [gente]);
  const escala = marco > 0 ? Math.max(2, Math.min(5, Math.floor(marco / minimo))) : 3;
  const anchoArte = marco > 0 ? Math.floor(marco / escala) : minimo;
  const foto = useMemo(() => componer(gente, anchoArte), [gente, anchoArte]);

  useLayoutEffect(() => {
    const caja = marcoRef.current;
    if (!caja) return;
    const medir = () => setMarco(caja.clientWidth);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(caja);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (canvasRef.current) pintar(canvasRef.current, foto, escala, abierta);
  }, [foto, escala, abierta]);

  // Alguien se unió: la foto se vuelve a tomar. Al cargar no hay flash.
  const antes = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!amigos) return;
    const ahora = new Set(amigos.map((a) => a.friendshipId));
    const previo = antes.current;
    antes.current = ahora;
    if (previo && [...ahora].some((id) => !previo.has(id)) && canAnimate()) {
      setFlash((n) => n + 1);
    }
  }, [amigos]);

  const abiertaEntry = todos.find((a) => a.friendshipId === abierta) ?? null;
  // Si quien tenía la ficha abierta ya no está (la quitaste), el foco vuelve al título.
  useEffect(() => {
    if (abierta && !abiertaEntry) {
      setAbierta(null);
      tituloRef.current?.focus({ preventScroll: true });
    }
  }, [abierta, abiertaEntry]);

  const abrir = (entry: FriendEntry, desde: HTMLElement | null) => {
    invocador.current = desde;
    setAbierta((a) => (a === entry.friendshipId ? null : entry.friendshipId));
  };
  const cerrar = () => {
    setAbierta(null);
    const volver = invocador.current;
    if (volver?.isConnected) volver.focus({ preventScroll: true });
  };

  const enFoto = (e: MouseEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    return quienEsta(foto, (e.clientX - caja.left) / escala, (e.clientY - caja.top) / escala);
  };

  const filas = foto.filas;
  // Con una sola persona, «de izquierda a derecha» sobra.
  const etiquetas = gente.length === 1 ? ['En la foto:'] : (NOMBRES_DE_FILA[filas] ?? []);
  const porFila = Array.from({ length: filas }, (_, i) =>
    foto.lugares.filter((l) => l.fila === filas - 1 - i),
  );
  return (
    <div className="foto">
      <figure className="foto__marco">
        <span className="foto__masking foto__masking--izq" aria-hidden="true" />
        <span className="foto__masking foto__masking--der" aria-hidden="true" />
        <div className="foto__imagen" ref={marcoRef}>
          <div className="foto__escena">
            <canvas
              ref={canvasRef}
              className="pixel"
              role="img"
              aria-label={
                gente.length > 0
                  ? `Foto de grupo de tu banda: ${gente.map((g) => g.displayName).join(', ')}.`
                  : 'Foto de grupo de tu banda, todavía sin nadie.'
              }
            />
            {/* Tocar la foto es un atajo: por teclado, la ficha se abre desde los nombres del pie. */}
            <div
              className="foto__toques"
              aria-hidden="true"
              onPointerMove={(e) => {
                if (e.pointerType !== 'mouse') return;
                e.currentTarget.style.cursor = enFoto(e) ? 'pointer' : '';
              }}
              onClick={(e) => {
                const quien = enFoto(e);
                if (quien) abrir(quien, null);
                else if (abierta) cerrar();
              }}
            />
            {flash > 0 ? <span key={flash} className="foto__flash" aria-hidden="true" /> : null}
            {amigos === null ? <p className="foto__revelando">Revelando la foto…</p> : null}
          </div>
        </div>
        <figcaption className="foto__pie">
          <h1 className="foto__titulo" ref={tituloRef} tabIndex={-1}>
            Tu banda
          </h1>
          <p className="foto__cuenta">
            {amigos === null
              ? 'Revisando…'
              : todos.length > 0
                ? cuantos(todos.length, 'amigo', 'amigos')
                : 'Todavía nadie en la foto'}
          </p>
          {gente.length > 0 ? (
            <p className="foto__nombres">
              {porFila.map((fila, i) =>
                fila.length > 0 ? (
                  <span key={etiquetas[i] ?? i} className="foto__renglon">
                    <span className="foto__fila">{etiquetas[i]}</span>{' '}
                    {[...fila]
                      .sort((a, b) => a.x - b.x)
                      .map((l, k, lista) => (
                        <span key={l.entry.friendshipId}>
                          <button
                            type="button"
                            className="foto__nombre"
                            aria-expanded={abierta === l.entry.friendshipId}
                            aria-controls={
                              abierta === l.entry.friendshipId ? 'ficha-de-foto' : undefined
                            }
                            onClick={(e) => abrir(l.entry, e.currentTarget)}
                          >
                            {l.entry.displayName}
                          </button>
                          {k < lista.length - 1 ? ', ' : '. '}
                        </span>
                      ))}
                  </span>
                ) : null,
              )}
            </p>
          ) : amigos !== null ? (
            <p className="foto__nombres">
              En la plaza, toca a alguien (o su nombre en el chat) y elige «Agregar amigo»: aquí
              sale en la foto.
            </p>
          ) : null}
          {paginas > 1 ? (
            <nav className="foto__album" aria-label="Álbum de tu banda">
              <button
                type="button"
                className="foto__hoja foto__hoja--antes"
                disabled={actual === 0}
                onClick={() => {
                  setAbierta(null);
                  setPagina(actual - 1);
                }}
              >
                <Icono name="flecha" size={18} />
                <span className="visually-hidden">Foto anterior</span>
              </button>
              <span className="foto__pagina">
                Foto {actual + 1} de {paginas}
              </span>
              <button
                type="button"
                className="foto__hoja"
                disabled={actual === paginas - 1}
                onClick={() => {
                  setAbierta(null);
                  setPagina(actual + 1);
                }}
              >
                <Icono name="flecha" size={18} />
                <span className="visually-hidden">Foto siguiente</span>
              </button>
            </nav>
          ) : null}
        </figcaption>
      </figure>

      {abiertaEntry ? (
        <FichaDeFoto
          key={abiertaEntry.friendshipId}
          entry={abiertaEntry}
          acciones={acciones}
          onCerrar={cerrar}
          onHecho={onHecho}
        />
      ) : null}
    </div>
  );
}
