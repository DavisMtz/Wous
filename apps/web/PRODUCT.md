# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jóvenes y adultos de 16 años en adelante, hispanohablantes de México, que entran desde PC o
teléfono a pasar tiempo con otras personas en un mundo compartido. Durante la alpha cerrada
el público real es un círculo invitado; el lanzamiento abierto y sus reglas de edad siguen sin
decidir (§30 del plan).

## Product Purpose

Wous es un mundo social online 2D en pixel art con personajes humanos. La persona se registra,
verifica su correo, crea su personaje, entra a una Plaza compartida, camina, ve a los demás en
tiempo real, habla, usa emotes y cruza a un Café. Más adelante: amigos, ropa, monedas,
minijuegos y espacios propios.

Éxito del primer hito: dos personas verificadas, en dispositivos distintos, se ven en la misma
Plaza, chatean, usan un emote y cruzan juntas al Café, con el servidor como autoridad.

## Positioning

Lo que Wous hace distinto: **expresarte con tu personaje**. La identidad de cada quien —su
personaje humano, su ropa y, después, su espacio— es el centro de la experiencia; el mundo es
el escenario donde esa identidad se ve y se encuentra con otras.

## Operating Context

- Se entra desde el navegador, en PC (teclado y ratón) o teléfono (táctil, jugando en
  horizontal). Tablets e híbridos cambian de método de entrada en caliente.
- Flujo de cuenta: registro con correo, usuario y contraseña → correo de verificación (Brevo) →
  creación de personaje → mundo. Recuperación de contraseña por correo.
- El mundo se dibuja con Phaser; cuentas, menús, chat y paneles son UI de React encima.

## Capabilities and Constraints

- Arquitectura en `PLAN_CONSTRUCCION_WOUS.md` (fuente de verdad técnica) y `docs/adr/`.
- Pixel art: tiles de ~32×32 en pantalla y personajes compuestos por capas (cuerpo, piel,
  cabello, color de cabello, parte de arriba, de abajo, zapatos, accesorio).
- La UI móvil no depende de hover; el juego solo recibe entrada normalizada.
- Sin economía, tienda, minijuegos ni casas en el MVP.
- Correo transaccional desde `wous@logidma.com`; producción en `wous.logidma.com`.
- Idioma: **solo español (México)** en el MVP.

## Brand Commitments

- Nombre: **Wous**. No existe logotipo ni identidad visual previa.

## Evidence on Hand

No hay usuarios, capturas, testimonios, cifras ni prensa. No inventar ninguna de esas cosas.

## Product Principles

1. **Tu personaje es tu voz.** Cada decisión de producto se pregunta si ayuda a que la persona
   se exprese y sea reconocible.
2. **El servidor manda, la experiencia se siente inmediata.** Predicción y animación en el
   cliente; verdad en el servidor.
3. **Llegar al mundo rápido.** Cuenta, correo y personaje son un umbral corto hacia la Plaza,
   no un trámite.
4. **Seguro por defecto.** Sin enumeración de cuentas, sin HTML de usuarios, con bloqueo y
   reporte antes de la beta pública.

## Accessibility & Inclusion

- Controles por teclado completos en PC y táctiles con áreas generosas en teléfono.
- Respeto de `prefers-reduced-motion` en la UI.
- Texto de UI legible sobre el mundo en pixel art (el pixel art es para el mundo, no para
  párrafos).
