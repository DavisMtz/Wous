import type { NotificationPreferences } from '@wous/contracts';
import { useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { Casilla, mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Aviso } from '../../ui/components/Tianguis.tsx';

type Campo = keyof NotificationPreferences;

const ETIQUETA: Record<Campo, string> = {
  friendRequestEmail: 'Cuando alguien me manda solicitud',
  friendAcceptedEmail: 'Cuando alguien acepta la mía',
};

/**
 * Los avisos sociales por correo (§7, ADR-0011), al pie de tu banda: el correo
 * de amistad trae el enlace a esta página. La casilla cambia en el acto y, si
 * el servidor no lo guarda, regresa como estaba y lo dice. Los correos de
 * seguridad no se apagan y no aparecen aquí.
 */
export function AvisosPorCorreo({ className = '' }: { className?: string }) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .get<NotificationPreferences>('/preferences')
      .then((data) => {
        if (vivo) setPrefs(data);
      })
      .catch((err: unknown) => {
        if (vivo) setError(mensajeDeError(err));
      });
    return () => {
      vivo = false;
    };
  }, []);

  const cambiar = async (campo: Campo, valor: boolean) => {
    if (!prefs) return;
    const antes = prefs;
    setError(null);
    setPrefs({ ...prefs, [campo]: valor });
    try {
      const guardadas = await api.post<NotificationPreferences>('/preferences', {
        [campo]: valor,
      });
      setPrefs(guardadas);
      setAnuncio(`${ETIQUETA[campo]}: ${valor ? 'te avisamos' : 'ya no te avisamos'}.`);
    } catch (err) {
      setPrefs(antes);
      setError(mensajeDeError(err));
    }
  };

  return (
    <section className={`avisos ${className}`} aria-labelledby="avisos-titulo">
      <h2 className="avisos__titulo" id="avisos-titulo">
        Avisos por correo
      </h2>
      {prefs ? (
        <div className="avisos__casillas">
          {(Object.keys(ETIQUETA) as Campo[]).map((campo) => (
            <Casilla key={campo} checked={prefs[campo]} onChange={(v) => cambiar(campo, v)}>
              {ETIQUETA[campo]}
            </Casilla>
          ))}
        </div>
      ) : error ? null : (
        <p className="avisos__nota">Revisando…</p>
      )}
      <p className="avisos__nota">
        Los de seguridad (confirmar tu correo, recuperar o cambiar tu contraseña) te llegan siempre.
      </p>
      {error ? <Aviso>{error}</Aviso> : null}
      <p className="visually-hidden" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}
