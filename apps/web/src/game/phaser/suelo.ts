import type { MapDef } from '@wous/world-data';
import type Phaser from 'phaser';
import { groundPainter, TROZO } from '../world-art/ground.ts';
import { addCanvasTexture } from './persona.ts';

type Trozo = { i: number; j: number; x: number; y: number; w: number; h: number; key: string };

/** Margen (px del mundo) alrededor de la vista: lo que está a punto de entrar ya está pintado. */
const MARGEN = 96;

/**
 * El suelo del mapa en trozos de 512 px (ADR-0014): cada trozo es su propia
 * textura y se pinta cuando hace falta. Los que se ven, en el acto; los demás,
 * de a poco (del más cercano a la cámara al más lejano) sin pasarse de un tope
 * de tiempo por cuadro. Las texturas quedan en Phaser: al volver a la sala no
 * se repinta nada.
 */
export class SueloPorTrozos {
  private readonly pendientes: Trozo[] = [];
  private pintor: ReturnType<typeof groundPainter> | null = null;
  private readonly columnas: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapDef,
  ) {
    const w = map.width * 16;
    const h = map.height * 16;
    this.columnas = Math.ceil(w / TROZO);
    for (let j = 0; j * TROZO < h; j++) {
      for (let i = 0; i * TROZO < w; i++) {
        const trozo: Trozo = {
          i,
          j,
          x: i * TROZO,
          y: j * TROZO,
          w: Math.min(TROZO, w - i * TROZO),
          h: Math.min(TROZO, h - j * TROZO),
          key: `suelo:${map.id}:${map.version}:${i}:${j}`,
        };
        if (scene.textures.exists(trozo.key)) this.colocar(trozo);
        else this.pendientes.push(trozo);
      }
    }
  }

  /** ¿Queda algo por pintar? */
  get completo(): boolean {
    return this.pendientes.length === 0;
  }

  /** Pinta ya los trozos que tocan la vista (con margen). */
  pintarVisibles(vista: Phaser.Geom.Rectangle): void {
    for (let k = this.pendientes.length - 1; k >= 0; k--) {
      const t = this.pendientes[k] as Trozo;
      if (
        t.x + t.w < vista.x - MARGEN ||
        t.y + t.h < vista.y - MARGEN ||
        t.x > vista.right + MARGEN ||
        t.y > vista.bottom + MARGEN
      ) {
        continue;
      }
      this.pendientes.splice(k, 1);
      this.pintar(t);
    }
    this.soltarSiTermino();
  }

  /** Pinta los que faltan, del más cercano al centro de la vista, hasta gastar `presupuestoMs`. */
  pintarPendientes(vista: Phaser.Geom.Rectangle, presupuestoMs: number): void {
    if (this.pendientes.length === 0) return;
    const inicio = performance.now();
    const cx = vista.centerX;
    const cy = vista.centerY;
    const lejania = (t: Trozo) => Math.hypot(t.x + t.w / 2 - cx, t.y + t.h / 2 - cy);
    this.pendientes.sort((a, b) => lejania(b) - lejania(a));
    do {
      const t = this.pendientes.pop();
      if (!t) break;
      this.pintar(t);
    } while (performance.now() - inicio < presupuestoMs && this.pendientes.length > 0);
    this.soltarSiTermino();
  }

  private pintar(t: Trozo): void {
    this.pintor ??= groundPainter(this.map);
    const pintor = this.pintor;
    addCanvasTexture(this.scene, t.key, () => pintor.paint(t));
    this.colocar(t);
  }

  /**
   * Cada trozo va un poquito encima del anterior (de izquierda a derecha y de
   * arriba abajo), sin importar en qué orden se pintó: el lienzo de Phaser
   * puede pasarse un pixel en la orilla y así lo tapa siempre el vecino.
   */
  private colocar(t: Trozo): void {
    const orden = t.j * this.columnas + t.i;
    this.scene.add
      .image(t.x, t.y, t.key)
      .setOrigin(0, 0)
      .setDepth(-10 + orden * 0.001);
  }

  private soltarSiTermino(): void {
    if (this.pendientes.length > 0 || !this.pintor) return;
    this.pintor.release();
    this.pintor = null;
  }
}
