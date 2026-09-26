import { z } from 'zod';

// Zod prueba `Function('')` al construir cada esquema para compilar
// validadores; la CSP (sin 'unsafe-eval') lo bloquea y cada carga dejaba una
// violación en consola. Este módulo va PRIMERO en main.tsx: los esquemas de
// @wous/contracts se construyen al evaluarse sus imports, antes del cuerpo.
z.config({ jitless: true });
