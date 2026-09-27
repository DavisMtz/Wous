import { INVITATIONS, MODERATION } from '@wous/config';
import type {
  AdminInvitation,
  AdminInvitationListResponse,
  AdminInvitationResponse,
} from '@wous/contracts';
import { type FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { api } from '../../services/api.ts';
import { Aviso, Cartulina, Sello } from '../../ui/components/Tianguis.tsx';
import { ROUTES } from '../router.tsx';
import { ESTADO_INVITACION, Etiqueta, fecha, usePedido } from './piezas.tsx';

/**
 * Invitaciones de la alpha cerrada (ADR-0012). Se crean aquí y se comparten
 * como enlace (`/register?invitacion=…`); el código se puede volver a copiar
 * mientras la llave del entorno no cambie.
 */

const USOS = [1, 5, 10, 25, INVITATIONS.maxUses] as const;
const DIAS = [7, 30, INVITATIONS.maxDays] as const;

export function enlaceDeInvitacion(code: string): string {
  return `${window.location.origin}${ROUTES.register}?${new URLSearchParams({ invitacion: code })}`;
}

/** Copiar al portapapeles; si el navegador no deja, el texto queda a la vista para copiarlo a mano. */
function useCopiar() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (que: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(que);
    } catch {
      setCopiado(null);
      window.prompt('Copia esto:', texto);
    }
  };
  return { copiado, copiar };
}

export function Invitaciones({ onAnuncio }: { onAnuncio(texto: string): void }) {
  const [lista, setLista] = useState<AdminInvitation[] | null>(null);
  const [nueva, setNueva] = useState<AdminInvitation | null>(null);
  const carga = usePedido();

  const cargar = useCallback(async () => {
    const data = await carga.pedir(() =>
      api.get<AdminInvitationListResponse>('/admin/invitations'),
    );
    if (data) setLista(data.invitations);
  }, [carga.pedir]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="caseta-invitaciones">
      <NuevaInvitacion
        onCreada={(inv) => {
          setNueva(inv);
          onAnuncio(`Invitación «${inv.label}» lista para compartir.`);
          void cargar();
        }}
      />
      {nueva?.code ? <RecienHecha invitacion={nueva} /> : null}
      <section className="caseta-hoja" aria-labelledby="invitaciones-titulo">
        <h2 className="caseta-hoja__titulo" id="invitaciones-titulo">
          Invitaciones
        </h2>
        {carga.error ? <Aviso>{carga.error}</Aviso> : null}
        {lista === null && !carga.error ? <p className="caseta__nota">Buscando…</p> : null}
        {lista?.length === 0 ? (
          <p className="caseta__nota">Todavía no hay invitaciones. Crea la primera arriba.</p>
        ) : null}
        {lista && lista.length > 0 ? (
          <ul className="caseta-lista">
            {lista.map((inv) => (
              <FilaDeInvitacion
                key={inv.id}
                invitacion={inv}
                onRevocada={(actual) => {
                  setLista((antes) => antes?.map((i) => (i.id === actual.id ? actual : i)) ?? null);
                  onAnuncio(`Invitación «${actual.label}» revocada.`);
                }}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function NuevaInvitacion({ onCreada }: { onCreada(inv: AdminInvitation): void }) {
  const id = useId();
  const [label, setLabel] = useState('');
  const [usos, setUsos] = useState<number>(5);
  const [dias, setDias] = useState<number>(30);
  const [errorLabel, setErrorLabel] = useState<string | null>(null);
  const { enCurso, error, pedir } = usePedido();

  const crear = async (event: FormEvent) => {
    event.preventDefault();
    if (label.trim().length < INVITATIONS.labelMinChars) {
      setErrorLabel('Ponle un nombre: para quién es.');
      return;
    }
    setErrorLabel(null);
    const data = await pedir(() =>
      api.post<AdminInvitationResponse>('/admin/invitations', {
        label: label.trim(),
        maxUses: usos,
        expiresInDays: dias,
      }),
    );
    if (!data) return;
    setLabel('');
    onCreada(data.invitation);
  };

  return (
    <section className="caseta-hoja" aria-labelledby={`${id}-titulo`}>
      <h2 className="caseta-hoja__titulo" id={`${id}-titulo`}>
        Nueva invitación
      </h2>
      <form className="caseta-sancion" onSubmit={crear} noValidate>
        <div className={`campo ${errorLabel ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor={`${id}-label`}>
            ¿Para quién es?
          </label>
          <input
            id={`${id}-label`}
            className="campo__entrada"
            maxLength={INVITATIONS.labelMaxChars}
            placeholder="Primos, taller del jueves…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-invalid={errorLabel ? true : undefined}
            aria-describedby={errorLabel ? `${id}-label-error` : undefined}
          />
          {errorLabel ? (
            <p className="campo__error" id={`${id}-label-error`}>
              {errorLabel}
            </p>
          ) : null}
        </div>
        <fieldset className="caseta-sancion__grupo">
          <legend className="caseta-sancion__pregunta">¿Cuántas cuentas puede abrir?</legend>
          <div className="caseta-chips">
            {USOS.map((n) => (
              <label key={n} className="caseta-chip">
                <input
                  type="radio"
                  name={`${id}-usos`}
                  checked={usos === n}
                  onChange={() => setUsos(n)}
                />
                <span>{n === 1 ? '1 persona' : `${n} personas`}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="caseta-sancion__grupo">
          <legend className="caseta-sancion__pregunta">¿Hasta cuándo sirve?</legend>
          <div className="caseta-chips">
            {DIAS.map((n) => (
              <label key={n} className="caseta-chip">
                <input
                  type="radio"
                  name={`${id}-dias`}
                  checked={dias === n}
                  onChange={() => setDias(n)}
                />
                <span>{`${n} días`}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error ? <Aviso>{error}</Aviso> : null}
        <Cartulina type="submit" cargando={enCurso}>
          Crear invitación
        </Cartulina>
      </form>
    </section>
  );
}

/** La invitación que se acaba de crear, a la vista y lista para copiar. */
function RecienHecha({ invitacion }: { invitacion: AdminInvitation }) {
  const { copiado, copiar } = useCopiar();
  const code = invitacion.code ?? '';
  const enlace = enlaceDeInvitacion(code);
  return (
    <section className="caseta-hoja caseta-recien" aria-labelledby="recien-titulo">
      <Sello>¡Lista!</Sello>
      <h2 className="caseta-hoja__titulo" id="recien-titulo">
        {invitacion.label}
      </h2>
      <p className="caseta-codigo">{code}</p>
      <p className="caseta__nota caseta-recien__enlace">{enlace}</p>
      <div className="caseta-sancion__botones">
        <Cartulina type="button" icono="sobre" onClick={() => void copiar('enlace', enlace)}>
          {copiado === 'enlace' ? 'Enlace copiado' : 'Copiar el enlace'}
        </Cartulina>
        <Cartulina type="button" variante="trazo" onClick={() => void copiar('codigo', code)}>
          {copiado === 'codigo' ? 'Código copiado' : 'Copiar solo el código'}
        </Cartulina>
      </div>
    </section>
  );
}

function FilaDeInvitacion({
  invitacion,
  onRevocada,
}: {
  invitacion: AdminInvitation;
  onRevocada(inv: AdminInvitation): void;
}) {
  const id = useId();
  const { copiado, copiar } = useCopiar();
  const [revocando, setRevocando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const { enCurso, error, pedir } = usePedido();
  const vigente = invitacion.status === 'ACTIVE';

  const revocar = async (event: FormEvent) => {
    event.preventDefault();
    const limpio = motivo.trim();
    if (limpio.length < MODERATION.reasonMinChars) {
      setErrorMotivo('Escribe por qué: queda en la bitácora.');
      return;
    }
    setErrorMotivo(null);
    const data = await pedir(() =>
      api.post<AdminInvitationResponse>(
        `/admin/invitations/${encodeURIComponent(invitacion.id)}/revoke`,
        { reason: limpio },
      ),
    );
    if (!data) return;
    setRevocando(false);
    onRevocada(data.invitation);
  };

  return (
    <li className="caseta-invitacion">
      <div className="caseta-invitacion__cabeza">
        <span className="caseta-fila__nombre">{invitacion.label}</span>
        <Etiqueta tono={vigente ? 'bien' : 'neutro'}>
          {ESTADO_INVITACION[invitacion.status]}
        </Etiqueta>
      </div>
      <p className="caseta-fila__detalle">
        {invitacion.code ? <span className="caseta-codigo--chico">{invitacion.code}</span> : null}
        {invitacion.code ? ' · ' : 'El código ya no se puede mostrar · '}
        {invitacion.uses} de {invitacion.maxUses} usos · {invitacion.accounts}{' '}
        {invitacion.accounts === 1 ? 'cuenta' : 'cuentas'}
        {invitacion.expiresAt ? ` · vence el ${fecha(invitacion.expiresAt)}` : ''}
        {invitacion.createdBy ? ` · la hizo ${invitacion.createdBy}` : ''}
      </p>
      {vigente ? (
        <div className="caseta-invitacion__botones">
          {invitacion.code ? (
            <Cartulina
              type="button"
              variante="trazo"
              className="caseta-boton-chico"
              onClick={() => void copiar('enlace', enlaceDeInvitacion(invitacion.code ?? ''))}
            >
              {copiado === 'enlace' ? 'Copiado' : 'Copiar enlace'}
            </Cartulina>
          ) : null}
          <Cartulina
            type="button"
            variante="trazo"
            className="caseta-boton-chico"
            aria-expanded={revocando}
            onClick={() => setRevocando((v) => !v)}
          >
            Revocar
          </Cartulina>
        </div>
      ) : null}
      {revocando ? (
        <form className="caseta-descartar" onSubmit={revocar} noValidate>
          <div className={`campo ${errorMotivo ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor={`${id}-motivo`}>
              Por qué se revoca (queda en la bitácora)
            </label>
            <input
              id={`${id}-motivo`}
              className="campo__entrada"
              maxLength={MODERATION.reasonMaxChars}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={errorMotivo ? true : undefined}
              aria-describedby={errorMotivo ? `${id}-motivo-error` : undefined}
            />
            {errorMotivo ? (
              <p className="campo__error" id={`${id}-motivo-error`}>
                {errorMotivo}
              </p>
            ) : null}
          </div>
          {error ? <Aviso>{error}</Aviso> : null}
          <Cartulina type="submit" variante="trazo" cargando={enCurso}>
            Revocar la invitación
          </Cartulina>
        </form>
      ) : null}
    </li>
  );
}
