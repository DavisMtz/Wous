import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from '../../app/router.tsx';
import { seeded } from '../../game/rendering/looks.ts';
import { type IconName, Icono } from './Icono.tsx';

// ─── Orilla de la lona ───────────────────────────────────────────────────

/**
 * El borde frontal de la lona: dobladillo cosido, ojillos de metal cada tramo
 * y la tela colgando en curvas entre amarres.
 */
export function OrillaDeLona() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { path, stitch, grommets } = useMemo(() => {
    const hem = 22;
    const sag = 16;
    const count = Math.max(3, Math.round(width / 150));
    const step = width / count;
    let d = `M0 0H${width}V${hem}`;
    const eyes: number[] = [];
    for (let i = count; i > 0; i--) {
      const x1 = i * step;
      const x0 = (i - 1) * step;
      d += `Q${(x0 + x1) / 2} ${hem + sag * 2} ${x0} ${hem}`;
      eyes.push(x0);
    }
    d += 'Z';
    return {
      path: d,
      stitch: `M0 ${hem - 7}H${width}`,
      grommets: eyes.filter((x) => x > 4 && x < width - 4),
    };
  }, [width]);

  return (
    <div className="orilla" ref={ref} aria-hidden="true">
      <svg
        width="100%"
        height="56"
        viewBox={`0 0 ${width} 56`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={path} className="orilla__tela" />
        <path d={stitch} className="orilla__costura" />
        {grommets.map((x) => (
          <g key={x} transform={`translate(${x} 13)`}>
            <circle r="5.5" className="orilla__ojillo" />
            <circle r="2.4" className="orilla__ojillo-hueco" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Rótulo ──────────────────────────────────────────────────────────────

/** El nombre pintado a mano sobre la lona, con su sombra de rotulista. */
export function Rotulo({ as: Tag = 'p', className = '' }: { as?: 'h1' | 'p'; className?: string }) {
  return (
    <Tag className={`rotulo ${className}`}>
      <span className="rotulo__letras">Wous</span>
    </Tag>
  );
}

// ─── Estrella de cartulina ───────────────────────────────────────────────

function starPoints(seed: number, spikes = 17): string {
  const rng = seeded(seed);
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? 96 + rng() * 6 : 74 + rng() * 5;
    points.push(
      `${(100 + Math.cos(angle) * radius).toFixed(1)},${(100 + Math.sin(angle) * radius).toFixed(1)}`,
    );
  }
  return points.join(' ');
}

type EstrellaProps = {
  grande: string;
  chica?: string;
  to?: string;
  onClick?: () => void;
  color?: 'naranja' | 'amarillo' | 'verde' | 'rosa';
  className?: string;
};

/**
 * La estrella fosforescente de precio del tianguis, rotulada con plumón.
 * Es la acción principal de la portada; se hunde al presionarla.
 */
export function Estrella({
  grande,
  chica,
  to,
  onClick,
  color = 'naranja',
  className = '',
}: EstrellaProps) {
  const points = useMemo(() => starPoints(grande.length * 31 + 7), [grande]);
  const body = (
    <>
      <span className="estrella__masking" aria-hidden="true" />
      <span className="estrella__cuerpo">
        <svg viewBox="0 0 200 200" className="estrella__forma" aria-hidden="true">
          <polygon points={points} />
        </svg>
        <span className="estrella__texto">
          <span className="estrella__grande">{grande}</span>
          {chica ? <span className="estrella__chica">{chica}</span> : null}
        </span>
      </span>
    </>
  );
  const classes = `estrella estrella--${color} ${className}`;
  if (to) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {body}
    </button>
  );
}

// ─── Botones de cartulina ────────────────────────────────────────────────

type CartulinaProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  cargando?: boolean;
  variante?: 'fosfo' | 'trazo';
  icono?: IconName;
};

/**
 * Botón de cartulina pegada: fosforescente para la acción principal, a trazo
 * de plumón para las secundarias. Al presionarlo se hunde contra la tabla.
 */
export function Cartulina({
  cargando = false,
  variante = 'fosfo',
  icono,
  children,
  className = '',
  disabled,
  ...rest
}: CartulinaProps) {
  return (
    <button
      className={`cartulina cartulina--${variante} ${className}`}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...rest}
    >
      {icono ? <Icono name={icono} /> : null}
      <span className="cartulina__texto">{children}</span>
      {cargando ? (
        <span className="cartulina__puntos" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : null}
    </button>
  );
}

export function EnlaceTrazo({
  to,
  children,
  icono,
}: {
  to: string;
  children: ReactNode;
  icono?: IconName;
}) {
  return (
    <Link to={to} className="cartulina cartulina--trazo">
      {icono ? <Icono name={icono} /> : null}
      <span className="cartulina__texto">{children}</span>
    </Link>
  );
}

// ─── Hoja colgada ────────────────────────────────────────────────────────

function Pinza({ lado }: { lado: 'izq' | 'der' }) {
  return (
    <svg className={`pinza pinza--${lado}`} viewBox="0 0 22 58" aria-hidden="true">
      <path className="pinza__madera" d="M3 2.5h7.2l.6 53.2H4.1Z" />
      <path className="pinza__madera pinza__madera--atras" d="M11.8 2.5H19l-1.1 53.2h-6.7Z" />
      <path className="pinza__resorte" d="M1.8 25.5h18.4M2.2 29.2h17.6" />
    </svg>
  );
}

/**
 * Una hoja de cartulina blanca colgada con pinzas de un tendedero. Es el
 * contenedor de todos los formularios: se lee como papel, no como tarjeta.
 */
export function Hoja({
  children,
  titulo,
  id,
}: {
  children: ReactNode;
  titulo: string;
  id: string;
}) {
  return (
    <div className="tendido">
      <svg
        className="tendido__cuerda"
        viewBox="0 0 600 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M-10 12 Q300 34 610 12" />
      </svg>
      <section className="hoja" aria-labelledby={id}>
        <Pinza lado="izq" />
        <Pinza lado="der" />
        <h1 className="hoja__titulo" id={id}>
          {titulo}
        </h1>
        {children}
      </section>
    </div>
  );
}

// ─── Sello y aviso ───────────────────────────────────────────────────────

/** Sello de goma de la nota de venta: aparece cuando algo queda hecho. */
export function Sello({ children }: { children: ReactNode }) {
  return (
    <p className="sello" role="status">
      <span className="sello__tinta">{children}</span>
    </p>
  );
}

/** Aviso escrito con plumón rojo sobre la hoja: el problema y qué hacer. */
export function Aviso({
  children,
  tono = 'error',
}: {
  children: ReactNode;
  tono?: 'error' | 'ok';
}) {
  return (
    <div className={`aviso aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <Icono name={tono === 'error' ? 'alerta' : 'palomita'} size={20} />
      <div>{children}</div>
    </div>
  );
}
