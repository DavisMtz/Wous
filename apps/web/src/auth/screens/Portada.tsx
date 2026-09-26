import { useGSAP } from '@gsap/react';
import { useRef, useState } from 'react';
import { ROUTES } from '../../app/router.tsx';
import { PERSONAS, RACK_OUTFITS } from '../../game/rendering/looks.ts';
import { Puesto } from '../../ui/components/Puesto.tsx';
import { EnlaceTrazo, Estrella, Rotulo } from '../../ui/components/Tianguis.tsx';
import { entrance } from '../../ui/motion.ts';
import { Perchero } from '../../ui/scene/Perchero.tsx';

function pickPersona() {
  return PERSONAS[Math.floor(Math.random() * PERSONAS.length)] ?? PERSONAS[0];
}

/**
 * Portada: el puesto bajo la lona rosa. Demuestra el mecanismo en la primera
 * vista: descuelgas ropa del perchero y tu personaje se la prueba.
 */
export function Portada() {
  const root = useRef<HTMLDivElement>(null);
  const [persona] = useState(pickPersona);

  useGSAP(
    () => {
      entrance(
        (tl) => {
          tl.from('.rotulo__letras', {
            clipPath: 'inset(0% 100% 0% 0%)',
            duration: 1,
            ease: 'power2.inOut',
          })
            .from('.portada__lema', { y: 22, opacity: 0 }, '-=0.45')
            .from('.portada__texto', { y: 14, opacity: 0 }, '<0.12')
            .from(
              '.portada .estrella',
              { scale: 0.55, rotation: -24, opacity: 0, ease: 'back.out(2.1)', duration: 0.75 },
              '-=0.5',
            )
            .from('.portada .cartulina--trazo', { y: 10, opacity: 0 }, '<0.2')
            .from(
              '.perchero__gancho',
              {
                rotation: (i: number) => (i % 2 === 0 ? -26 : 22),
                ease: 'elastic.out(1, 0.3)',
                duration: 1.6,
                stagger: 0.09,
              },
              0.15,
            )
            .from(
              '.perchero__letrero',
              { y: -12, rotation: -8, opacity: 0, ease: 'back.out(2)' },
              0.9,
            );
        },
        {
          clear: [
            '.rotulo__letras',
            '.portada__lema',
            '.portada__texto',
            '.portada .estrella',
            '.portada .cartulina--trazo',
            '.perchero__gancho',
            '.perchero__letrero',
          ],
        },
      );
    },
    { scope: root },
  );

  return (
    <Puesto firma={false} className="puesto--portada">
      <div className="portada" ref={root}>
        <section className="portada__pregon" aria-labelledby="portada-titulo">
          <h1 className="visually-hidden" id="portada-titulo">
            Wous: arma tu look y sal a la plaza
          </h1>
          <Rotulo className="rotulo--grande" />
          <p className="portada__lema">
            Arma tu look.
            <br />
            Sal a la plaza.
          </p>
          <p className="portada__texto">
            Un mundo en pixel art para pasar el rato con tu banda. Tu personaje, tu ropa, tu estilo.
          </p>
          <div className="portada__acciones">
            <Estrella grande="¡Pásale!" chica="Crea tu cuenta" to={ROUTES.register} />
            <EnlaceTrazo to={ROUTES.login}>Ya tengo cuenta</EnlaceTrazo>
          </div>
        </section>
        <section className="portada__escaparate" aria-label="Perchero: pruébate la ropa">
          <Perchero persona={persona} outfits={RACK_OUTFITS} />
        </section>
      </div>
      <p className="portada__pie">Alpha cerrada · Solo para mayores de 16</p>
    </Puesto>
  );
}
