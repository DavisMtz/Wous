import type { MapDef, MapObject } from '@wous/world-data';
import Phaser from 'phaser';
import { lucesDeCatedral, nocheDe } from '../ambiente/hora.ts';
import type { ObjectArt } from '../world-art/objects.ts';
import { hash, painter } from '../world-art/paint.ts';
import { TILE } from '../world-art/world-palette.ts';
import { addCanvasTexture, NAME_DEPTH } from './persona.ts';

/**
 * El día y la noche de la Plaza, con la hora de Morelia (la del servidor):
 * al ponerse el sol baja un velo azul de noche, se encienden los faroles (cada
 * pieza de arte dice dónde tiene los suyos), las luminarias del piso y la
 * iluminación de la Catedral, cálida con la portada en azul
 * (investigacion.md §1.6). Los sábados a las 21:00 son las «Luces de
 * Catedral»: se apaga, estallan los fuegos y la luz vuelve poco a poco.
 *
 * Es ambiente del cliente, como el resto (ver `ambiente.ts`): todos lo ven a
 * la vez porque sale de la hora del servidor. Con movimiento reducido la
 * noche llega igual, pero sin fuegos. En el Café (bajo techo) no hay noche.
 */

/** El velo va sobre el mundo y debajo de los nombres, los globos y la marca. */
const VELO_DEPTH = NAME_DEPTH - 20;
const LUZ_DEPTH = VELO_DEPTH + 1;
const FUEGO_DEPTH = VELO_DEPTH + 2;
/** Qué tanto oscurece la noche cerrada. */
const VELO_MAX = 0.5;
const VELO_COLOR = 0x0b0f2e;
/** Cada cuánto se revisa la hora (ms): la noche cambia de a poco. */
const REVISION_MS = 500;
/** Un cohete cada tanto (ms), el mismo en todos los teléfonos. */
const COHETE_MS = 480;
const COLORES_FUEGO = ['#ffd23f', '#3a78d8', '#e8384f', '#35c77a'] as const;

type Halo = { image: Phaser.GameObjects.Image; fuerza: number };
type Chispa = {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  nace: number;
  muere: number;
};

export type NocheOpciones = {
  scene: Phaser.Scene;
  map: MapDef;
  quiet: boolean;
  reloj: (localNow: number) => number;
};

export class Noche {
  private readonly scene: Phaser.Scene;
  private readonly quiet: boolean;
  private readonly reloj: (localNow: number) => number;
  private readonly activa: boolean;
  private readonly velo: Phaser.GameObjects.Rectangle | null = null;
  private readonly halos: Halo[] = [];
  private readonly chispas: Chispa[] = [];
  private lavado: Phaser.GameObjects.Image | null = null;
  /** La fachada de la Catedral (px del mundo): de ahí salen los cohetes. */
  private catedral: { x: number; w: number; pie: number } | null = null;
  private revisado = Number.NEGATIVE_INFINITY;
  private noche = 0;
  private encendida = 1;
  private fuegos = false;
  private ultimoCohete = Number.NaN;

  constructor(o: NocheOpciones) {
    this.scene = o.scene;
    this.quiet = o.quiet;
    this.reloj = o.reloj;
    this.activa = o.map.id === 'plaza';
    if (!this.activa) return;
    addCanvasTexture(o.scene, 'halo-farol', () => halo(64, '255 214 150', '255 176 90'));
    addCanvasTexture(o.scene, 'halo-piso', () => halo(32, '230 244 255', '170 205 255'));
    this.velo = o.scene.add
      .rectangle(0, 0, 8, 8, VELO_COLOR)
      .setOrigin(0, 0)
      .setDepth(VELO_DEPTH)
      .setAlpha(0);
    // Las luminarias del piso, alrededor de las fuentes: una luz fría hacia arriba.
    for (const forma of o.map.paint) {
      if (forma.kind !== 'luminaria' || !('polygon' in forma)) continue;
      const n = forma.polygon.length;
      const x = forma.polygon.reduce((s, [px]) => s + px, 0) / n;
      const y = forma.polygon.reduce((s, [, py]) => s + py, 0) / n;
      this.agregarHalo('halo-piso', x * TILE, y * TILE, 10, 0.8);
    }
  }

  /** Un objeto recién puesto: sus faroles dan halo de noche; la Catedral, su iluminación. */
  registrar(object: MapObject, image: Phaser.GameObjects.Image, art: ObjectArt): void {
    if (!this.activa) return;
    for (const luz of art.luces ?? []) {
      this.agregarHalo('halo-farol', image.x + luz.x, image.y + luz.y, luz.r ?? 22, 1);
    }
    if (object.kind === 'catedral') {
      const key = `lavado:${object.id}`;
      addCanvasTexture(this.scene, key, () => lavadoDeCatedral(art.canvas));
      this.lavado = this.scene.add
        .image(image.x, image.y, key)
        .setOrigin(0, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(LUZ_DEPTH)
        .setVisible(false);
      this.catedral = { x: image.x, w: art.canvas.width, pie: image.y + art.canvas.height };
    }
  }

  /** Cada cuadro, con lo que ve la cámara (px del mundo). */
  update(time: number, delta: number, vista: Phaser.Geom.Rectangle): void {
    if (!this.activa || !this.velo) return;
    const ahora = this.reloj(time);
    if (time - this.revisado > REVISION_MS) {
      this.revisado = time;
      this.aplicar(ahora);
    }
    if (this.noche > 0.01) {
      this.velo.setPosition(vista.x - 2, vista.y - 2).setSize(vista.width + 4, vista.height + 4);
      // Solo se dibujan los halos que caben en la vista (con margen para su luz).
      const x0 = vista.x - 64;
      const y0 = vista.y - 64;
      const x1 = vista.right + 64;
      const y1 = vista.bottom + 64;
      for (const { image } of this.halos) {
        image.setVisible(image.x > x0 && image.x < x1 && image.y > y0 && image.y < y1);
      }
    }
    if (this.fuegos && !this.quiet) this.lanzarCohetes(ahora);
    this.moverChispas(time, delta);
  }

  /** Qué tan de noche es y en qué va la función de los sábados. */
  private aplicar(ahora: number): void {
    const noche = nocheDe(ahora);
    const show = lucesDeCatedral(ahora);
    // La Catedral se apaga antes de los fuegos y se va encendiendo durante ellos.
    const encendida = !show
      ? 1
      : show.fase === 'oscura'
        ? 0
        : Math.max(0, (show.avance - 0.15) / 0.85);
    this.fuegos = show?.fase === 'fuegos';
    if (noche === this.noche && encendida === this.encendida) return;
    this.noche = noche;
    this.encendida = encendida;
    const hayNoche = noche > 0.01;
    this.velo?.setVisible(hayNoche).setAlpha(VELO_MAX * noche);
    for (const { image, fuerza } of this.halos) {
      image.setAlpha(fuerza * noche);
      if (!hayNoche) image.setVisible(false);
    }
    this.lavado?.setVisible(hayNoche && encendida > 0).setAlpha(0.5 * noche * encendida);
  }

  private agregarHalo(key: string, x: number, y: number, r: number, fuerza: number): void {
    const size = key === 'halo-piso' ? 32 : 64;
    const image = this.scene.add
      .image(Math.round(x), Math.round(y), key)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LUZ_DEPTH)
      .setScale((r * 2) / size)
      .setVisible(false);
    this.halos.push({ image, fuerza });
  }

  // ─── Los fuegos artificiales de los sábados ────────────────────────────

  /**
   * Un cohete cada `COHETE_MS`: sube de detrás de la fachada y revienta frente
   * a las torres (en la vista de 3/4, más arriba no se vería desde el atrio).
   * El color y el lugar salen de la hora: en todos los teléfonos son iguales.
   */
  private lanzarCohetes(ahora: number): void {
    const cat = this.catedral;
    if (!cat) return;
    const turno = Math.floor(ahora / COHETE_MS);
    if (turno === this.ultimoCohete) return;
    this.ultimoCohete = turno;
    const x = cat.x + cat.w * (0.1 + hash(turno, 1, 5) * 0.8);
    const y = cat.pie - 190 - hash(turno, 2, 5) * 190;
    const color = COLORES_FUEGO[Math.floor(hash(turno, 3, 5) * COLORES_FUEGO.length)] ?? '#ffd23f';
    for (const c of COLORES_FUEGO) {
      addCanvasTexture(this.scene, `chispa:${c}`, () => chispa(c));
    }
    const cohete = this.scene.add
      .image(x, cat.pie - 40, `chispa:${color}`)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(FUEGO_DEPTH)
      .setScale(1, 2);
    this.scene.tweens.add({
      targets: cohete,
      y,
      duration: 560,
      ease: 'Quad.easeOut',
      onComplete: () => {
        cohete.destroy();
        this.reventar(x, y, color, this.scene.time.now, turno);
      },
    });
  }

  /**
   * El «crisantemo»: un anillo de chispas rápidas y otro de lentas, del mismo
   * color, y un destello tibio en medio que dura un instante.
   */
  private reventar(x: number, y: number, color: string, time: number, semilla: number): void {
    const destello = this.scene.add
      .image(x, y, 'halo-farol')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(FUEGO_DEPTH)
      .setScale(1.6);
    this.scene.tweens.add({
      targets: destello,
      alpha: { from: 1, to: 0 },
      scale: 2.4,
      duration: 260,
      onComplete: () => destello.destroy(),
    });
    for (const [n, lento] of [
      [28, false],
      [14, true],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + hash(semilla, i, lento ? 8 : 9) * 0.25;
        const v = (lento ? 28 : 62) + hash(semilla, i, 10) * (lento ? 18 : 36);
        const image = this.scene.add
          .image(x, y, `chispa:${color}`)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(FUEGO_DEPTH);
        this.chispas.push({
          image,
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v * 0.85,
          nace: time,
          muere: time + (lento ? 1_700 : 1_300) + hash(semilla, i, 11) * 500,
        });
      }
    }
  }

  private moverChispas(time: number, delta: number): void {
    const dt = delta / 1000;
    for (let i = this.chispas.length - 1; i >= 0; i--) {
      const c = this.chispas[i];
      if (!c) continue;
      if (time >= c.muere) {
        c.image.destroy();
        this.chispas.splice(i, 1);
        continue;
      }
      c.vy += 34 * dt;
      c.vx *= 1 - dt * 0.8;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const vida = (time - c.nace) / (c.muere - c.nace);
      c.image
        .setPosition(Math.round(c.x), Math.round(c.y))
        .setAlpha(vida < 0.6 ? 1 : (1 - vida) / 0.4);
    }
  }
}

/** Un halo redondo: luz tibia al centro que se apaga hacia la orilla (se suma con ADD). */
function halo(size: number, centro: string, orilla: string): HTMLCanvasElement {
  const p = painter(size, size);
  const r = size / 2;
  const g = p.ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgb(${centro} / 0.95)`);
  g.addColorStop(0.18, `rgb(${centro} / 0.55)`);
  g.addColorStop(0.5, `rgb(${orilla} / 0.18)`);
  g.addColorStop(1, `rgb(${orilla} / 0)`);
  p.ctx.fillStyle = g;
  p.ctx.fillRect(0, 0, size, size);
  return p.canvas;
}

/** Una chispa de fuego artificial: un punto de color con su centro blanco. */
function chispa(color: string): HTMLCanvasElement {
  const p = painter(3, 3);
  p.rect(0, 1, 3, 1, color);
  p.rect(1, 0, 1, 3, color);
  p.px(1, 1, '#ffffff');
  return p.canvas;
}

/**
 * La iluminación de la Catedral: luz rasante de abajo arriba, cálida y
 * dorada en las torres y el cuerpo central, con la portada en azul frío
 * (investigacion.md §1.6). Son focos al pie de la fachada que abren hacia
 * arriba; se recortan con la silueta de la propia Catedral, así no se salen
 * al cielo.
 */
function lavadoDeCatedral(catedral: HTMLCanvasElement): HTMLCanvasElement {
  const p = painter(catedral.width, catedral.height);
  const ctx = p.ctx;
  const pie = catedral.height;
  // El dibujo de la Catedral mide 640 px de ancho; otro ancho lo centra.
  const dx = Math.round((catedral.width - 640) / 2);
  const foco = (x: number, ancho: number, alto: number, color: string, fuerza: number) => {
    ctx.save();
    ctx.translate(dx + x, pie);
    ctx.scale(1, alto / ancho);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ancho);
    g.addColorStop(0, `rgb(${color} / ${fuerza})`);
    g.addColorStop(0.45, `rgb(${color} / ${fuerza * 0.5})`);
    g.addColorStop(1, `rgb(${color} / 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-ancho, -ancho, ancho * 2, ancho);
    ctx.restore();
  };
  const DORADO = '255 190 110';
  // Dos focos por torre, que suben hasta la linternilla.
  for (const cx of [141, 515]) {
    foco(cx - 38, 80, 560, DORADO, 0.75);
    foco(cx + 38, 80, 560, DORADO, 0.75);
  }
  // El cuerpo central y la cúpula, detrás, más tenue.
  for (const cx of [262, 394]) foco(cx, 70, 300, DORADO, 0.7);
  foco(328, 110, 470, '255 214 150', 0.3);
  // La portada central, en azul.
  foco(328, 52, 170, '120 170 255', 0.8);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(catedral, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return p.canvas;
}
