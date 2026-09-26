// Bindings opcionales que no se declaran en wrangler.jsonc (solo las pruebas
// los fijan): el tipo generado no los conoce.
declare namespace Cloudflare {
  interface Env {
    ROOM_SOFT_LIMIT?: string;
    ROOM_HARD_LIMIT?: string;
  }
}
