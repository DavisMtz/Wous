import type { CollisionGrid, Vec } from '@wous/game-core';
import type { MapDef, MapObject } from '@wous/world-data';
import type Phaser from 'phaser';
import { campanada as campanadaDe, danzantesEncendidas } from '../ambiente/hora.ts';
import {
  lugaresDeParvada,
  PARVADAS,
  type Parvada,
  quienAsusta,
  RADIO_SUSTO,
  rumboDeHuida,
} from '../ambiente/palomas.ts';
import { PREGON_MS, PREGON_PAUSA_MS, PREGON_RADIO, pregonDe } from '../ambiente/pregones.ts';
import { campanaSola, campanasDeCatedral, huecoDeCampana } from '../world-art/catedral.ts';
import { CUADROS_PALOMA, type CuadroPaloma, PINTAS, paloma } from '../world-art/fauna.ts';
import { cuadrosDe, type ObjectArt, paintObject } from '../world-art/objects.ts';
import { hash, painter } from '../world-art/paint.ts';
import { AGUA, TILE } from '../world-art/world-palette.ts';
import { paintGlobo } from './globo.ts';
import { addCanvasTexture, NAME_DEPTH, NAME_FONT } from './persona.ts';

/**
 * El ambiente de la Plaza (docs/plaza/HANDOFF.md §8): el agua de las fuentes
 * que corre, las fuentes danzantes con su horario, las palomas, los pregones
 * de los vendedores y las campanadas de cada hora. Todo es del cliente: lo que
 * depende de la hora sale del reloj del servidor, así que en todos los
 * teléfonos pasa a la vez; lo demás (las palomas, los pregones) cada quien lo
 * ve a su modo. Con movimiento reducido (`quiet`) nada se mueve: el agua queda
 * en su cuadro quieto, las palomas posadas y no hay pregones ni campanadas.
 */

type Animada = {
  object: MapObject;
  image: Phaser.GameObjects.Image;
  base: string;
  cuadros: number;
  /** Cada fuente a su tiempo, para que no vayan todas al compás. */
  fase: number;
  danzante: boolean;
  clave: string;
};

type Paloma = {
  sprite: Phaser.GameObjects.Image;
  casa: Vec;
  /** En pixeles del mundo (volando se sale de la rejilla). */
  x: number;
  y: number;
  v: Vec;
  pinta: number;
  cuadro: CuadroPaloma;
  /** Cuándo cambia lo que está haciendo (posada). */
  siguiente: number;
};

type ParvadaViva = {
  def: Parvada;
  palomas: Paloma[];
  estado: 'posada' | 'volando' | 'fuera' | 'llegando';
  desde: number;
  regreso: number;
};

type Vendedor = {
  object: MapObject;
  ancla: Vec;
  ultimo: number;
  vez: number;
  globo: { image: Phaser.GameObjects.Image; key: string; hasta: number } | null;
};

type Gota = {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  muere: number;
};

const AGUA_MS = 170;
const DANZA_MS = 130;
const VUELO_MS = 1_400;
const LLEGADA_MS = 900;
const ALETEO_MS = 90;
const VUELO_DEPTH = 150_000;
const CAMPANADA_DEPTH = NAME_DEPTH - 10;
const MARCA_DEPTH = NAME_DEPTH - 1;
const GLOBO_FADE_MS = 300;
/** La boca de la campana grande (px), para que las ondas salgan de su centro. */
const BOCA_CAMPANA = 18;

export type AmbienteOpciones = {
  scene: Phaser.Scene;
  map: MapDef;
  grid: CollisionGrid;
  quiet: boolean;
  /** Hora del servidor (época, ms) para un instante de la escena. */
  reloj: (localNow: number) => number;
};

export class Ambiente {
  private readonly scene: Phaser.Scene;
  private readonly map: MapDef;
  private readonly quiet: boolean;
  private readonly reloj: (localNow: number) => number;
  private readonly animadas: Animada[] = [];
  private readonly parvadas: ParvadaViva[] = [];
  private readonly vendedores: Vendedor[] = [];
  private readonly gotas: Gota[] = [];
  /** El yugo de cada campana grande (px del mundo) y la profundidad de la Catedral. */
  private campanas: Vec[] = [];
  private catedralDepth = 0;
  private campanasVivas: { hueco: Phaser.GameObjects.Image; campana: Phaser.GameObjects.Image }[] =
    [];
  private ultimaCampanada: string | null = null;
  private encendidas = true;
  private revisado = Number.NEGATIVE_INFINITY;
  private pisadaAnterior: Vec | null = null;
  private ultimaGota = 0;

  constructor(o: AmbienteOpciones) {
    this.scene = o.scene;
    this.map = o.map;
    this.quiet = o.quiet;
    this.reloj = o.reloj;
    this.encendidas = danzantesEncendidas(o.reloj(o.scene.time.now));
    for (const def of PARVADAS[o.map.id] ?? []) this.posarParvada(def, o.grid);
  }

  /** Un objeto recién puesto en la escena: el agua se anima, los puestos pregonan. */
  registrar(object: MapObject, image: Phaser.GameObjects.Image, art: ObjectArt): void {
    const cuadros = cuadrosDe(object);
    if (cuadros > 0) {
      const danzante = object.kind === 'chorros';
      const animada: Animada = {
        object,
        image,
        base: image.texture.key,
        cuadros,
        fase: hash(Math.round(object.x), Math.round(object.y), 61) * cuadros,
        danzante,
        clave: image.texture.key,
      };
      this.animadas.push(animada);
      // Las danzantes apagadas se ven apagadas desde el principio, aun quietas.
      if (danzante && !this.encendidas) this.ponerCuadro(animada, 0);
    }
    if (object.kind === 'puesto' && pregonDe(object.variant, 0)) {
      this.vendedores.push({
        object,
        ancla: { x: image.x + art.canvas.width / 2, y: image.y + 3 },
        ultimo: Number.NEGATIVE_INFINITY,
        vez: 0,
        globo: null,
      });
    }
    if (object.kind === 'catedral') {
      this.catedralDepth = art.depth;
      this.campanas = campanasDeCatedral(object.w, object.h).map((c) => ({
        x: image.x + c.x,
        y: image.y + c.y,
      }));
    }
  }

  /** Cada cuadro: `yo` en tiles; `gente`, a quién ven las palomas (tú incluida). */
  update(time: number, delta: number, yo: Vec, gente: readonly Vec[]): void {
    const ahora = this.reloj(time);
    if (time - this.revisado > 1000) {
      this.revisado = time;
      const encendidas = danzantesEncendidas(ahora);
      if (encendidas !== this.encendidas) {
        this.encendidas = encendidas;
        for (const a of this.animadas) if (a.danzante) this.ponerCuadro(a, 0);
      }
    }
    if (this.quiet) return;
    for (const a of this.animadas) {
      const periodo = a.danzante ? DANZA_MS : AGUA_MS;
      const cuadro = Math.floor(time / periodo + a.fase) % a.cuadros;
      this.ponerCuadro(a, cuadro);
    }
    this.salpicar(time, delta, yo);
    for (const parvada of this.parvadas) this.vivirParvada(parvada, time, delta, gente);
    this.pregonar(time, yo);
    this.campanear(ahora);
  }

  // ─── El agua ────────────────────────────────────────────────────────────

  private ponerCuadro(a: Animada, cuadro: number): void {
    const apagada = a.danzante && !this.encendidas;
    const clave = apagada ? `${a.base}:apagada` : cuadro === 0 ? a.base : `${a.base}:c${cuadro}`;
    if (clave === a.clave) return;
    addCanvasTexture(this.scene, clave, () => {
      const art = paintObject(a.object, apagada ? 0 : cuadro, !apagada);
      if (!art) throw new Error(`Sin arte para ${a.object.id}`);
      return art.canvas;
    });
    a.image.setTexture(clave);
    a.clave = clave;
  }

  /** Quien camina entre las fuentes danzantes prendidas salpica. */
  private salpicar(time: number, delta: number, yo: Vec): void {
    const antes = this.pisadaAnterior;
    this.pisadaAnterior = { ...yo };
    const camina = antes !== null && Math.hypot(yo.x - antes.x, yo.y - antes.y) > 0.001;
    if (this.encendidas && camina && time - this.ultimaGota > 90) {
      const chorros = this.map.objects.find(
        (o) =>
          o.kind === 'chorros' &&
          yo.x >= o.x &&
          yo.x <= o.x + o.w &&
          yo.y >= o.y &&
          yo.y <= o.y + o.h,
      );
      if (chorros) {
        this.ultimaGota = time;
        addCanvasTexture(this.scene, 'gota', () => {
          const p = painter(2, 2);
          p.rect(0, 0, 2, 2, AGUA.light);
          p.px(0, 0, AGUA.foam);
          return p.canvas;
        });
        for (let i = 0; i < 3; i++) {
          const x = yo.x * TILE + (Math.random() - 0.5) * 8;
          const y = yo.y * TILE;
          const image = this.scene.add.image(x, y, 'gota').setDepth(yo.y * TILE + 1);
          this.gotas.push({
            image,
            x,
            y,
            vx: (Math.random() - 0.5) * 50,
            vy: -40 - Math.random() * 50,
            muere: time + 420,
          });
        }
      }
    }
    const dt = delta / 1000;
    for (let i = this.gotas.length - 1; i >= 0; i--) {
      const g = this.gotas[i];
      if (!g) continue;
      if (time >= g.muere) {
        g.image.destroy();
        this.gotas.splice(i, 1);
        continue;
      }
      g.vy += 260 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.image.setPosition(Math.round(g.x), Math.round(g.y));
    }
  }

  // ─── Las palomas ────────────────────────────────────────────────────────

  private posarParvada(def: Parvada, grid: CollisionGrid): void {
    for (const cuadro of CUADROS_PALOMA) {
      for (let pinta = 0; pinta < PINTAS.length; pinta++) {
        addCanvasTexture(this.scene, `paloma:${cuadro}:${pinta}`, () => paloma(cuadro, pinta));
      }
    }
    const palomas = lugaresDeParvada(def, grid).map((casa, i): Paloma => {
      // Casi todas grises; de vez en cuando una oscura, una blanca o una café.
      const r = hash(i, 5, def.x * 13 + def.y);
      const pinta = r < 0.62 ? 0 : r < 0.82 ? 1 : r < 0.92 ? 3 : 2;
      const sprite = this.scene.add
        .image(casa.x * TILE, casa.y * TILE, `paloma:parada:${pinta}`)
        .setOrigin(0.5, 1)
        .setDepth(casa.y * TILE)
        .setFlipX(hash(i, 6, def.x) < 0.5);
      return {
        sprite,
        casa,
        x: casa.x * TILE,
        y: casa.y * TILE,
        v: { x: 0, y: 0 },
        pinta,
        cuadro: 'parada',
        siguiente: hash(i, 7, def.y) * 1500,
      };
    });
    this.parvadas.push({ def, palomas, estado: 'posada', desde: 0, regreso: 0 });
  }

  private vivirParvada(p: ParvadaViva, time: number, delta: number, gente: readonly Vec[]): void {
    const dt = delta / 1000;
    switch (p.estado) {
      case 'posada': {
        const susto = quienAsusta(
          p.palomas.map((pa) => pa.casa),
          gente,
        );
        if (susto) {
          p.estado = 'volando';
          p.desde = time;
          p.palomas.forEach((pa, i) => {
            pa.v = rumboDeHuida(pa.casa, susto, i + p.def.x);
            pa.sprite.setFlipX(pa.v.x < 0).setDepth(VUELO_DEPTH);
          });
          return;
        }
        for (const [i, pa] of p.palomas.entries()) {
          if (time < pa.siguiente) continue;
          const r = hash(i, Math.floor(time / 97), p.def.x);
          if (pa.cuadro === 'picando' || r < 0.5) {
            // Picotea un rato y vuelve a alzar la cabeza.
            pa.cuadro = pa.cuadro === 'picando' ? 'parada' : 'picando';
            pa.siguiente = time + (pa.cuadro === 'picando' ? 260 : 500 + r * 1400);
          } else if (r < 0.75) {
            pa.sprite.setFlipX(!pa.sprite.flipX);
            pa.siguiente = time + 700 + r * 900;
          } else {
            // Un saltito hacia donde mira, sin irse lejos de su lugar.
            const paso = pa.sprite.flipX ? -2 : 2;
            const lejos = Math.abs(pa.x + paso - pa.casa.x * TILE) > 6;
            pa.x += lejos ? -paso : paso;
            pa.siguiente = time + 400 + r * 1000;
          }
          pa.sprite.setTexture(`paloma:${pa.cuadro}:${pa.pinta}`).setPosition(pa.x, pa.y);
        }
        return;
      }
      case 'volando': {
        const t = time - p.desde;
        for (const pa of p.palomas) {
          pa.x += pa.v.x * dt;
          pa.y += pa.v.y * dt;
          const alas = Math.floor(time / ALETEO_MS) % 2 ? 'alas-arriba' : 'alas-abajo';
          pa.sprite
            .setTexture(`paloma:${alas}:${pa.pinta}`)
            .setPosition(Math.round(pa.x), Math.round(pa.y))
            .setAlpha(Math.max(0, Math.min(1, (VUELO_MS - t) / 500)));
        }
        if (t >= VUELO_MS) {
          p.estado = 'fuera';
          p.desde = time;
          p.regreso = time + 25_000 + hash(p.def.x, p.def.y, Math.floor(time / 1000)) * 20_000;
          for (const pa of p.palomas) pa.sprite.setVisible(false);
        }
        return;
      }
      case 'fuera': {
        if (time < p.regreso) return;
        // No bajan mientras alguien siga ahí.
        const cerca = gente.some(
          (g) => Math.hypot(g.x - p.def.x, g.y - p.def.y) < RADIO_SUSTO * 2 + 1.5,
        );
        if (cerca) {
          p.regreso = time + 5_000;
          return;
        }
        p.estado = 'llegando';
        p.desde = time;
        for (const pa of p.palomas) {
          pa.x = pa.casa.x * TILE + (pa.sprite.flipX ? 40 : -40);
          pa.y = pa.casa.y * TILE - 70;
          pa.sprite.setVisible(true).setAlpha(0).setDepth(VUELO_DEPTH);
        }
        return;
      }
      case 'llegando': {
        const t = Math.min(1, (time - p.desde) / LLEGADA_MS);
        for (const pa of p.palomas) {
          const hx = pa.casa.x * TILE;
          const hy = pa.casa.y * TILE;
          pa.x += (hx - pa.x) * Math.min(1, dt * 6);
          pa.y += (hy - pa.y) * Math.min(1, dt * 6);
          const alas = Math.floor(time / ALETEO_MS) % 2 ? 'alas-arriba' : 'alas-abajo';
          pa.sprite
            .setTexture(`paloma:${t < 1 ? alas : 'parada'}:${pa.pinta}`)
            .setPosition(Math.round(pa.x), Math.round(pa.y))
            .setAlpha(Math.min(1, t * 2));
        }
        if (t >= 1) {
          p.estado = 'posada';
          for (const pa of p.palomas) {
            pa.x = pa.casa.x * TILE;
            pa.y = pa.casa.y * TILE;
            pa.cuadro = 'parada';
            pa.siguiente = time + 600;
            pa.sprite
              .setTexture(`paloma:parada:${pa.pinta}`)
              .setPosition(pa.x, pa.y)
              .setDepth(pa.casa.y * TILE)
              .setAlpha(1);
          }
        }
        return;
      }
    }
  }

  // ─── Los pregones ───────────────────────────────────────────────────────

  private pregonar(time: number, yo: Vec): void {
    const zoom = this.scene.cameras.main.zoom;
    for (const v of this.vendedores) {
      const o = v.object;
      if (v.globo) {
        const falta = v.globo.hasta - time;
        if (falta <= 0) {
          v.globo.image.destroy();
          if (this.scene.textures.exists(v.globo.key)) this.scene.textures.remove(v.globo.key);
          v.globo = null;
        } else {
          v.globo.image.setScale(1 / zoom).setAlpha(Math.min(1, falta / GLOBO_FADE_MS));
        }
        continue;
      }
      if (time - v.ultimo < PREGON_PAUSA_MS) continue;
      const frente = { x: o.x + o.w / 2, y: o.y + o.h };
      if (Math.hypot(yo.x - frente.x, yo.y - frente.y) > PREGON_RADIO) continue;
      const texto = pregonDe(o.variant, v.vez);
      if (!texto) continue;
      v.ultimo = time;
      v.vez += 1;
      const art = paintGlobo(texto, NAME_FONT);
      const key = `pregon:${o.id}:${v.vez}`;
      addCanvasTexture(this.scene, key, () => art.canvas);
      const image = this.scene.add
        .image(v.ancla.x, v.ancla.y, key)
        .setOrigin(
          (art.width * 0.46 + 1) / art.width,
          (art.height - art.tipFromBottom) / art.height,
        )
        .setScale(1 / zoom)
        .setDepth(NAME_DEPTH + 1);
      v.globo = { image, key, hasta: time + PREGON_MS };
    }
  }

  // ─── Las campanadas ─────────────────────────────────────────────────────

  /**
   * A cada hora en punto, las campanas de las dos torres dan la hora: en
   * cada toque la campana grande se mece en su vano y salen dos ondas.
   */
  private campanear(ahora: number): void {
    if (this.campanas.length === 0) return;
    const toque = campanadaDe(ahora);
    if (!toque || toque.clave === this.ultimaCampanada) return;
    this.ultimaCampanada = toque.clave;
    addCanvasTexture(this.scene, 'onda-campana', ondaDeCampana);
    this.mecerCampanas();
    for (const c of this.campanas) {
      for (const retraso of [0, 220]) {
        const onda = this.scene.add
          .image(c.x, c.y + BOCA_CAMPANA / 2 + 2, 'onda-campana')
          .setDepth(CAMPANADA_DEPTH)
          .setScale(0.5)
          .setAlpha(0);
        this.scene.tweens.add({
          targets: onda,
          scale: 3.2,
          alpha: { from: 0.95, to: 0 },
          delay: retraso,
          duration: 1_500,
          ease: 'Sine.easeOut',
          onComplete: () => onda.destroy(),
        });
      }
    }
  }

  /**
   * La campana se mece sobre su yugo: un hueco oscuro tapa la del dibujo
   * mientras la suelta va y viene, cada vez menos.
   */
  private mecerCampanas(): void {
    if (this.campanasVivas.length === 0) {
      const sola = campanaSola();
      const hueco = huecoDeCampana();
      addCanvasTexture(this.scene, 'campana-sola', () => sola.canvas);
      addCanvasTexture(this.scene, 'campana-hueco', () => hueco.canvas);
      this.campanasVivas = this.campanas.map((c) => ({
        hueco: this.scene.add
          .image(c.x, c.y, 'campana-hueco')
          .setOrigin(hueco.x / hueco.canvas.width, hueco.y / hueco.canvas.height)
          .setDepth(this.catedralDepth + 0.5)
          .setVisible(false),
        campana: this.scene.add
          .image(c.x, c.y, 'campana-sola')
          .setOrigin(sola.x / sola.canvas.width, sola.y / sola.canvas.height)
          .setDepth(this.catedralDepth + 0.6)
          .setVisible(false),
      }));
    }
    for (const { hueco, campana } of this.campanasVivas) {
      this.scene.tweens.killTweensOf(campana);
      hueco.setVisible(true);
      campana.setVisible(true).setRotation(0);
      this.scene.tweens.chain({
        targets: campana,
        tweens: [0.42, -0.34, 0.22, -0.12, 0].map((rotation) => ({
          rotation,
          duration: 260,
          ease: 'Sine.easeInOut',
        })),
        onComplete: () => {
          hueco.setVisible(false);
          campana.setVisible(false);
        },
      });
    }
  }

  // ─── La marca de lo que está al alcance ─────────────────────────────────

  private marca: Phaser.GameObjects.Image | null = null;

  /**
   * La flechita que señala lo que harías con «E» (la banca, la placa, la
   * puerta): flota sobre ello y sube y baja un poco. `null` la quita.
   */
  marcar(punto: Vec | null, alto: number, time: number): void {
    if (!punto) {
      this.marca?.setVisible(false);
      return;
    }
    if (!this.marca) {
      addCanvasTexture(this.scene, 'marca-accion', marcaDeAccion);
      this.marca = this.scene.add
        .image(0, 0, 'marca-accion')
        .setOrigin(0.5, 1)
        .setDepth(MARCA_DEPTH);
    }
    const vaiven = this.quiet ? 0 : Math.round(Math.sin(time / 170) * 1.5);
    this.marca
      .setVisible(true)
      .setPosition(Math.round(punto.x * TILE), Math.round(punto.y * TILE - alto + vaiven));
  }
}

/**
 * Una onda de campanada: un aro de cartulina con su orilla de plumón (se lee
 * igual sobre la cantera que sobre el cielo), cortado en tramos, como las
 * rayitas con que se dibuja un sonido.
 */
function ondaDeCampana(): HTMLCanvasElement {
  const R = 12;
  const p = painter(R * 2 + 5, R * 2 + 5);
  const c = R + 2;
  for (let a = 0; a < 120; a++) {
    if (a % 15 >= 11) continue;
    const t = (a / 120) * Math.PI * 2;
    const [ux, uy] = [Math.cos(t), Math.sin(t) * 0.75];
    p.px(Math.round(c + ux * (R + 1)), Math.round(c + uy * (R + 1)), 'rgb(23 16 27 / 0.55)');
  }
  for (let a = 0; a < 120; a++) {
    if (a % 15 >= 11) continue;
    const t = (a / 120) * Math.PI * 2;
    p.px(Math.round(c + Math.cos(t) * R), Math.round(c + Math.sin(t) * R * 0.75), '#fffbf1');
  }
  return p.canvas;
}

/** La marca: una flechita hacia abajo, de cartulina con su orilla de plumón. */
function marcaDeAccion(): HTMLCanvasElement {
  const FORMA = ['ooooooo', 'owwwwwo', '.owwwo.', '..owo..', '...o...'];
  const p = painter(7, FORMA.length);
  FORMA.forEach((fila, y) => {
    for (let x = 0; x < 7; x++) {
      if (fila[x] === 'o') p.px(x, y, '#17101b');
      else if (fila[x] === 'w') p.px(x, y, '#fffbf1');
    }
  });
  return p.canvas;
}
