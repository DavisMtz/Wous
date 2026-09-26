// Plantillas transaccionales de Wous (§7) en el mundo del tianguis.
//
//   node scripts/correo/plantillas.mjs            → escribe el HTML en apps/worker/email-templates
//   node scripts/correo/plantillas.mjs --subir    → además crea/actualiza en Brevo el remitente,
//                                                   las plantillas y los webhooks (imprime los IDs)
//
// La llave de Brevo se lee de apps/worker/secrets.shared.json (ignorado por git) y nunca se imprime.
// Correo en tablas y estilos en línea: sin SVG, sin CSS externo, legible sin imágenes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'apps/worker/email-templates');
const SENDER = { name: 'Wous', email: 'wous@logidma.com' };

const LONAS = {
  rosa: { lona: '#e8267f', hondo: '#a10f57' },
  azul: { lona: '#1e4bd2', hondo: '#0f2c86' },
  verde: { lona: '#0f8a4a', hondo: '#075a2f' },
  amarilla: { lona: '#f5c518', hondo: '#b98a00' },
  naranja: { lona: '#ee5f16', hondo: '#a8390a' },
};

const P = (name) => `{{ params.${name} }}`;

/** Cada plantilla: su lona, su asunto y su hoja. Los enlaces los arma el Worker. */
const TEMPLATES = [
  {
    type: 'EMAIL_VERIFY',
    lona: 'rosa',
    subject: 'Confirma tu correo para entrar a Wous',
    preheader: `Un toque y listo: el enlace vale ${P('expiresMinutes')} minutos.`,
    title: `¡Ya casi, ${P('displayName')}!`,
    intro: 'Para activar tu cuenta, confirma que este correo es tuyo.',
    cta: 'Confirmar mi correo',
    url: 'verificationUrl',
    note: `El enlace vale ${P('expiresMinutes')} minutos y funciona una sola vez. Si tú no creaste una cuenta en Wous, ignora este correo y no pasa nada.`,
    reason: 'Te escribimos porque alguien creó una cuenta en Wous con esta dirección.',
  },
  {
    type: 'WELCOME_EMAIL',
    lona: 'naranja',
    subject: `¡Ya eres del barrio, ${P('displayName')}!`,
    preheader: 'Tu cuenta está activa. Arma tu look y sal a la plaza.',
    title: '¡Ya eres del barrio!',
    intro: `Tu cuenta quedó activa, ${P('displayName')}. Arma tu look y sal a la plaza: tu banda te está esperando.`,
    image: {
      file: 'banda.png',
      width: 320,
      height: 180,
      alt: 'Tres personajes de Wous en pixel art',
    },
    cta: 'Entrar a Wous',
    url: 'appUrl',
    note: 'Wous está en alpha cerrada: puede haber fallas y el mundo puede reiniciarse. Si algo se ve raro, cuéntanos.',
    reason: 'Te escribimos porque confirmaste tu cuenta en Wous.',
  },
  {
    type: 'PASSWORD_RESET',
    lona: 'amarilla',
    subject: 'Tu enlace para crear una contraseña nueva',
    preheader: `Vale ${P('expiresMinutes')} minutos. Si no lo pediste, ignóralo.`,
    title: '¿Olvidaste tu contraseña?',
    intro: `Hola, ${P('displayName')}. Alguien (ojalá tú) pidió cambiar la contraseña de tu cuenta.`,
    cta: 'Crear contraseña nueva',
    url: 'resetUrl',
    note: `El enlace vale ${P('expiresMinutes')} minutos y funciona una sola vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.`,
    reason: 'Te escribimos porque se pidió recuperar la contraseña de tu cuenta de Wous.',
  },
  {
    type: 'PASSWORD_CHANGED',
    lona: 'azul',
    subject: 'Tu contraseña de Wous cambió',
    preheader: 'Cerramos tu sesión en todos tus dispositivos por seguridad.',
    title: 'Cambiaste tu contraseña',
    intro: `Hola, ${P('displayName')}. La contraseña de tu cuenta se cambió y, por seguridad, cerramos tu sesión en todos tus dispositivos.`,
    cta: 'No fui yo: recuperar mi cuenta',
    url: 'securityUrl',
    note: 'Si fuiste tú, no tienes que hacer nada más. Si no, recupera tu cuenta ahora mismo con el botón.',
    reason: 'Este aviso de seguridad no se puede desactivar.',
  },
  {
    type: 'FRIEND_REQUEST',
    lona: 'verde',
    subject: `${P('actorDisplayName')} quiere ser tu amigo en Wous`,
    preheader: 'Acepta o rechaza la solicitud cuando quieras.',
    title: '¡Tienes una solicitud!',
    intro: `${P('actorDisplayName')} quiere agregarte como amigo en Wous, ${P('displayName')}.`,
    cta: 'Ver solicitud',
    url: 'friendsUrl',
    note: 'Puedes dejar de recibir estos avisos desde las preferencias de tu cuenta.',
    reason: 'Te escribimos porque tienes activados los avisos de solicitudes de amistad.',
  },
  {
    type: 'FRIEND_ACCEPTED',
    lona: 'verde',
    subject: `${P('actorDisplayName')} aceptó tu solicitud en Wous`,
    preheader: 'Ya pueden encontrarse en la plaza.',
    title: '¡Ya son amigos!',
    intro: `${P('actorDisplayName')} aceptó tu solicitud de amistad, ${P('displayName')}. Ya pueden encontrarse en la plaza.`,
    cta: 'Ir a Wous',
    url: 'friendsUrl',
    note: 'Puedes dejar de recibir estos avisos desde las preferencias de tu cuenta.',
    reason: 'Te escribimos porque tienes activados los avisos de amistades aceptadas.',
  },
];

const FONT_CARTEL = "'Big Shoulders Display','Arial Narrow','Helvetica Neue',Arial,sans-serif";
const FONT_UI = "'Bricolage Grotesque','Segoe UI',Helvetica,Arial,sans-serif";
const FONT_PLUMON = "'Permanent Marker','Arial Black',Arial,sans-serif";

function orilla({ hondo }) {
  // Dobladillo con costura y festones: la orilla de la lona, sin imágenes.
  const festones = Array.from(
    { length: 6 },
    () =>
      `<td width="100" height="18" style="height:18px;background:${hondo};border-radius:0 0 50% 50%;font-size:0;line-height:0;">&nbsp;</td>`,
  ).join('');
  return `
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="14" style="height:14px;background:${hondo};border-bottom:2px dashed rgba(255,255,255,0.45);font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${festones}</tr></table>
            </td>
          </tr>`;
}

function render(t) {
  const { lona, hondo } = LONAS[t.lona];
  const tinta = t.lona === 'amarilla' ? '#17101b' : '#fffbf1';
  const url = P(t.url);
  const image = t.image
    ? `
              <p style="margin:0 0 24px;text-align:center;">
                <img src="${P('assetsUrl')}/${t.image.file}" width="${t.image.width}" height="${t.image.height}" alt="${t.image.alt}" style="display:inline-block;width:${t.image.width}px;max-width:100%;height:auto;image-rendering:pixelated;border:0;">
              </p>`
    : '';
  return `<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>${t.subject}</title>
    <link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=Bricolage+Grotesque:wght@400;700&family=Permanent+Marker&display=swap" rel="stylesheet">
    <style>
      @media (max-width: 480px) {
        .hoja { padding: 28px 20px 24px !important; }
        .titulo { font-size: 34px !important; }
        .rotulo { font-size: 48px !important; }
      }
      a { color: #17101b; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${lona};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${t.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${lona}" style="background:${lona};">
      <tr>
        <td align="center" style="padding:0 12px 32px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">${orilla({ hondo })}
          <tr>
            <td class="rotulo" style="padding:30px 6px 20px;font-family:${FONT_CARTEL};font-weight:900;font-size:58px;line-height:1;letter-spacing:1px;text-transform:uppercase;color:${tinta};text-shadow:2px 2px 0 ${hondo},4px 4px 0 ${hondo};">Wous</td>
          </tr>
          <tr>
            <td class="hoja" bgcolor="#fffbf1" style="background:#fffbf1;border-radius:6px;padding:38px 36px 30px;box-shadow:0 14px 26px -10px rgba(43,18,56,0.55);">
              <h1 class="titulo" style="margin:0 0 14px;font-family:${FONT_CARTEL};font-weight:900;font-size:40px;line-height:1.04;text-transform:uppercase;color:#17101b;">${t.title}</h1>
              <p style="margin:0 0 24px;font-family:${FONT_UI};font-size:17px;line-height:1.55;color:#4a3a51;">${t.intro}</p>${image}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td bgcolor="#efff3a" style="background:#efff3a;border:3px solid #17101b;border-radius:10px;">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT_PLUMON};font-size:21px;line-height:1.2;color:#17101b;text-decoration:none;">${t.cta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-family:${FONT_UI};font-size:15px;line-height:1.55;color:#4a3a51;">${t.note}</p>
              <p style="margin:0;padding-top:16px;border-top:2px dashed #e9dfc8;font-family:${FONT_UI};font-size:13px;line-height:1.5;color:#4a3a51;">¿El botón no abre? Copia este enlace en tu navegador:<br><a href="${url}" target="_blank" style="color:#17101b;word-break:break-all;">${url}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="8" style="height:8px;background:#9c8f95;border-radius:4px 4px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td bgcolor="#2e2632" style="background:#2e2632;border-radius:0 0 6px 6px;padding:16px 20px 18px;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:#efe7f3;">
                    ${t.reason}<br>Wous · alpha cerrada para mayores de 16.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
for (const t of TEMPLATES) {
  writeFileSync(path.join(OUT, `${t.type}.html`), render(t));
}
console.log(`HTML escrito en ${path.relative(ROOT, OUT)} (${TEMPLATES.length} plantillas)`);

if (!process.argv.includes('--subir')) process.exit(0);

// ─── Brevo ───────────────────────────────────────────────────────────────

const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, 'apps/worker', file), 'utf8'));
const apiKey = readJson('secrets.shared.json').BREVO_API_KEY;
const brevo = async (method, url, body) => {
  const res = await fetch(`https://api.brevo.com/v3${url}`, {
    method,
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

// Remitente del dominio autenticado.
const { senders = [] } = await brevo('GET', '/senders');
if (!senders.some((s) => s.email === SENDER.email)) {
  await brevo('POST', '/senders', SENDER);
  console.log(`remitente creado: ${SENDER.email}`);
} else {
  console.log(`remitente ya existía: ${SENDER.email}`);
}

// Plantillas: se actualizan por nombre; si no existen, se crean.
const { templates = [] } = await brevo('GET', '/smtp/templates?limit=500');
const ids = {};
for (const t of TEMPLATES) {
  const name = `wous · ${t.type}`;
  const payload = {
    templateName: name,
    subject: t.subject,
    htmlContent: render(t),
    sender: SENDER,
    isActive: true,
    tag: 'wous',
  };
  const existing = templates.find((x) => x.name === name);
  if (existing) {
    await brevo('PUT', `/smtp/templates/${existing.id}`, payload);
    ids[t.type] = existing.id;
  } else {
    const created = await brevo('POST', '/smtp/templates', payload);
    ids[t.type] = created.id;
  }
}
console.log('IDs de plantilla:', JSON.stringify(ids));

// Webhooks de entregabilidad, uno por entorno, con su secreto como Bearer.
const EVENTS = [
  'request',
  'delivered',
  'deferred',
  'softBounce',
  'hardBounce',
  'blocked',
  'invalid',
];
const HOOKS = [
  { env: 'staging', url: 'https://wous-staging.logidma.workers.dev/api/v1/webhooks/brevo' },
  { env: 'production', url: 'https://wous.logidma.com/api/v1/webhooks/brevo' },
];
// Sin ningún webhook, Brevo responde 400 document_not_found en vez de una lista vacía.
const { webhooks = [] } = await brevo('GET', '/webhooks?type=transactional').catch((err) => {
  if (String(err.message).includes('document_not_found')) return { webhooks: [] };
  throw err;
});
for (const hook of HOOKS) {
  const secret = readJson(`secrets.${hook.env}.json`).BREVO_WEBHOOK_SECRET;
  const body = {
    url: hook.url,
    description: `Wous ${hook.env}: entregabilidad`,
    events: EVENTS,
    type: 'transactional',
    auth: { type: 'bearer', token: secret },
  };
  const existing = webhooks.find((w) => w.url === hook.url);
  if (existing) {
    await brevo('PUT', `/webhooks/${existing.id}`, {
      description: body.description,
      events: body.events,
      auth: body.auth,
    });
    console.log(`webhook actualizado (${hook.env}): ${existing.id}`);
  } else {
    const created = await brevo('POST', '/webhooks', body);
    console.log(`webhook creado (${hook.env}): ${created.id}`);
  }
}
