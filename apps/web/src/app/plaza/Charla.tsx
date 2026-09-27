import { CHAT } from '@wous/config';
import { chatLength, sanitizeChat } from '@wous/contracts';
import type { InputMethod } from '@wous/game-core';
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TOUCH_CONTROL_ATTR } from '../../game/input/controls.ts';
import type { ChatEntry } from '../../game/network/chat-log.ts';
import { Icono } from '../../ui/components/Icono.tsx';

/** Cuánto se queda una línea en la tira antes de despegarse, y cuántas caben (menos en teléfono). */
const TIRA_MS = 11_000;
const DESPEGUE_MS = 1_200;
const TIRA_MAX = 4;
const TIRA_MAX_TACTIL = 3;
/** El aviso de la sala (flood, vacío, silencio) se despega solo. */
const AVISO_MS = 4_200;

export type LineaDeChat = Extract<ChatEntry, { kind: 'line' }>;

type Props = {
  entradas: readonly ChatEntry[];
  /** Sala actual del registro: solo lo dicho aquí se puede reportar. */
  sala: string | null;
  metodo: InputMethod;
  abierta: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  /** Devuelve false si no hay conexión (el texto se conserva). */
  onDecir: (texto: string) => boolean;
  onNombre: (linea: LineaDeChat) => void;
  aviso: { n: number; texto: string } | null;
  silencioHasta: number | null;
};

function horaCorta(ms: number): string {
  return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' }).format(ms);
}

/**
 * El chat de la sala (§18), en papel. Cerrado es una tira: las últimas
 * líneas pegadas abajo a la izquierda que se despegan solas. Abierto (Enter,
 * o «Hablar» en táctil) es una hoja con el registro y la cartulina para
 * escribir. El texto se pinta como texto: nada de lo que alguien escriba se
 * interpreta como HTML.
 */
export function Charla({
  entradas,
  sala,
  metodo,
  abierta,
  onAbrir,
  onCerrar,
  onDecir,
  onNombre,
  aviso,
  silencioHasta,
}: Props) {
  const tactil = metodo === 'TOUCH';
  const inputRef = useRef<HTMLInputElement>(null);
  const registroRef = useRef<HTMLOListElement>(null);
  const ultimoEnviado = useRef('');
  const [texto, setTexto] = useState('');
  const [avisoVisible, setAvisoVisible] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // La tira se recalcula cada segundo solo mientras tiene algo que despegar.
  useEffect(() => {
    const vigente = () => entradas.some((e) => Date.now() - e.recibido < TIRA_MS + DESPEGUE_MS);
    if (!vigente()) return;
    const timer = window.setInterval(() => {
      setAhora(Date.now());
      if (!vigente()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [entradas]);

  // Enter abre el chat desde el juego (nunca desde un botón o un campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.repeat) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, button, a[href], [role="button"], .ficha')) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lo que contestó la sala: se dice junto a la cartulina y, si el campo quedó
  // vacío, vuelve lo último que escribiste para no perderlo.
  const avisoN = aviso?.n;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reacciona a un aviso nuevo
  useEffect(() => {
    if (!aviso) return;
    setAvisoVisible(aviso.texto);
    setTexto((actual) => actual || ultimoEnviado.current);
    const timer = window.setTimeout(() => setAvisoVisible(null), AVISO_MS);
    return () => window.clearTimeout(timer);
  }, [avisoN]);

  // Abierta, el registro se queda en lo más nuevo.
  useLayoutEffect(() => {
    const lista = registroRef.current;
    if (abierta && lista && entradas.length > 0) lista.scrollTop = lista.scrollHeight;
  }, [abierta, entradas]);

  const silenciado = silencioHasta !== null && silencioHasta > ahora;
  const quedan = CHAT.maxChars - chatLength(texto.trim());
  const recientes = new Set(
    entradas
      .filter(
        (e) => e.kind === 'line' && e.room === sala && ahora - e.recibido < TIRA_MS + DESPEGUE_MS,
      )
      .slice(tactil ? -TIRA_MAX_TACTIL : -TIRA_MAX)
      .map((e) => e.key),
  );

  const decir = (e: FormEvent) => {
    e.preventDefault();
    if (silenciado) return;
    const limpio = sanitizeChat(texto);
    if (!limpio.ok) {
      setAvisoVisible(
        limpio.reason === 'EMPTY'
          ? 'Escribe algo primero.'
          : `Cabe hasta ${CHAT.maxChars} caracteres.`,
      );
      return;
    }
    if (!onDecir(limpio.text)) {
      setAvisoVisible('Sin conexión: espera a que vuelva para hablar.');
      return;
    }
    ultimoEnviado.current = texto;
    setTexto('');
    setAvisoVisible(null);
    // Dicho: de vuelta a caminar.
    inputRef.current?.blur();
    onCerrar();
  };

  const placeholder = silenciado
    ? `En pausa hasta las ${horaCorta(silencioHasta ?? 0)}`
    : abierta
      ? 'Escribe algo…'
      : 'Enter para hablar';

  return (
    <section
      className="charla"
      data-abierta={abierta || undefined}
      data-tactil={tactil || undefined}
      aria-label="Chat de la sala"
      onBlur={(e) => {
        const next = e.relatedTarget instanceof Element ? e.relatedTarget : null;
        if (next && (e.currentTarget.contains(next) || next.closest('.ficha'))) return;
        if (abierta) onCerrar();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        inputRef.current?.blur();
        onCerrar();
      }}
    >
      {tactil ? (
        <button
          type="button"
          className="boton-hud charla__hablar"
          {...{ [TOUCH_CONTROL_ATTR]: '' }}
          aria-expanded={abierta}
          onClick={() => {
            // En el mismo toque: así el teléfono sí abre su teclado.
            if (abierta) {
              inputRef.current?.blur();
              onCerrar();
            } else {
              inputRef.current?.focus();
            }
          }}
        >
          <Icono name={abierta ? 'cerrar' : 'globo'} size={20} />
          <span>{abierta ? 'Cerrar' : 'Hablar'}</span>
        </button>
      ) : null}

      <div className="charla__hoja">
        <ol className="charla__registro" ref={registroRef} role="log" aria-live="polite">
          {entradas.length === 0 && abierta ? (
            <li className="charla__vacio">
              {tactil
                ? 'Todavía nadie dice nada. Escribe arriba y toca «Decir».'
                : 'Todavía nadie dice nada. Escribe y presiona Enter.'}
            </li>
          ) : null}
          {entradas.map((entrada) => {
            if (entrada.kind === 'room') {
              return (
                <li key={entrada.key} className="charla__sala">
                  <span>{entrada.name}</span>
                </li>
              );
            }
            const reciente = recientes.has(entrada.key);
            const queda = Math.max(0, TIRA_MS - (ahora - entrada.recibido));
            const actual = entrada.room === sala;
            return (
              <li
                key={entrada.key}
                className="renglon"
                data-mio={entrada.mine || undefined}
                data-reciente={reciente || undefined}
                style={{ '--queda': `${queda}ms` } as CSSProperties}
              >
                {entrada.mine || !actual ? (
                  <span className="renglon__nombre">{entrada.line.name}</span>
                ) : (
                  <button
                    type="button"
                    className="renglon__nombre"
                    aria-haspopup="dialog"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onNombre(entrada)}
                  >
                    {entrada.line.name}
                  </button>
                )}
                <span className="renglon__texto">{entrada.line.text}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <form className="charla__redactor" onSubmit={decir}>
        <label htmlFor="charla-texto" className="visually-hidden">
          Mensaje para la sala
        </label>
        <input
          id="charla-texto"
          ref={inputRef}
          className="charla__entrada"
          type="text"
          value={texto}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="send"
          spellCheck
          maxLength={CHAT.maxChars * 2}
          disabled={silenciado}
          onFocus={onAbrir}
          onChange={(e) => {
            setTexto(Array.from(e.target.value).slice(0, CHAT.maxChars).join(''));
          }}
        />
        {abierta && quedan <= 20 ? (
          <span className="charla__cuenta" data-tope={quedan <= 0 || undefined} aria-live="polite">
            {quedan}
          </span>
        ) : null}
        <button type="submit" className="charla__decir" disabled={silenciado}>
          Decir
        </button>
      </form>

      {avisoVisible || silenciado ? (
        <p className="charla__aviso" role="status">
          <Icono name={silenciado ? 'globo-tachado' : 'alerta'} size={18} />
          <span>
            {silenciado
              ? `Moderación te pidió una pausa en el chat. Vuelves a escribir a las ${horaCorta(silencioHasta ?? 0)}.`
              : avisoVisible}
          </span>
        </p>
      ) : null}
    </section>
  );
}
