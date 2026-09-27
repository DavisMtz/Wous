import { INVITATIONS, MODERATION } from '@wous/config';
import { z } from 'zod';
import { AccountStatus, EmailDeliverability, StaffRole } from '../domain/account.ts';
import { AppearanceInput } from '../domain/appearance.ts';
import { ReportReason } from '../domain/chat.ts';
import { AccountId, CharacterId, InvitationId, ReportId } from '../domain/ids.ts';
import { RegistrationMode } from './auth.ts';
import { AppEnv } from './health.ts';

/**
 * La caseta (Fase 9, ADR-0012): moderación, tablero e invitaciones para quien
 * tiene rol en `staff`. Todo vive bajo `/api/v1/admin` y para cualquier otra
 * persona esas rutas no existen (404). Aquí sí viajan IDs de cuenta: solo los
 * ve el staff.
 */

const Count = z.number().int().nonnegative();
const Epoch = z.number().int();

/** Texto libre de quien modera: sin controles y con espacios normales. */
function freeText(min: number, max: number, empty: string) {
  return z
    .string()
    .transform((v) =>
      v
        .normalize('NFC')
        .replace(/\p{Cc}/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .pipe(z.string().min(min, empty).max(max, `Máximo ${max} caracteres.`));
}

/** Motivo de toda acción de la caseta: queda en la bitácora (`audit_log`). */
export const ModerationReason = freeText(
  MODERATION.reasonMinChars,
  MODERATION.reasonMaxChars,
  'Escribe el motivo: queda en la bitácora.',
);

/** Una persona como la ve la caseta: su cuenta y, si ya lo armó, su personaje. */
export const AdminPerson = z.object({
  accountId: AccountId,
  username: z.string(),
  status: AccountStatus,
  characterId: CharacterId.nullable(),
  displayName: z.string().nullable(),
  appearance: AppearanceInput.nullable(),
});
export type AdminPerson = z.infer<typeof AdminPerson>;

// ─── Tablero ─────────────────────────────────────────────────────────────

export const AdminRoomOccupancy = z.object({
  mapId: z.string(),
  /** Nombre de la sala («La Plaza»). */
  name: z.string(),
  instance: z.string(),
  /** Lugares ocupados según el directorio (con quien tiene lugar guardado). */
  count: Count,
  updatedAt: Epoch,
});
export type AdminRoomOccupancy = z.infer<typeof AdminRoomOccupancy>;

/** GET /api/v1/admin/summary — lo que vive en D1 y en los directorios, ahora. */
export const AdminSummary = z.object({
  generatedAt: Epoch,
  environment: AppEnv,
  registration: RegistrationMode,
  population: z.object({ total: Count, rooms: z.array(AdminRoomOccupancy) }),
  accounts: z.object({
    total: Count,
    active: Count,
    pendingEmail: Count,
    suspended: Count,
    banned: Count,
    newLast24h: Count,
    newLast7d: Count,
  }),
  activity: z.object({
    /** Sesiones vigentes (no vencidas ni cerradas). */
    sessionsActive: Count,
    /** Cuentas que usaron Wous en las últimas 24 h / 7 días. */
    accountsLast24h: Count,
    accountsLast7d: Count,
  }),
  moderation: z.object({ openReports: Count, reportsLast7d: Count, mutedNow: Count }),
  email: z.object({
    /** Enviados desde las 00:00 UTC: el cupo diario de Brevo se cuenta así. */
    sentToday: Count,
    failedLast7d: Count,
    /** En camino: pendientes, en la cola o enviándose. */
    inFlight: Count,
    undeliverable: Count,
  }),
  invitations: z.object({ active: Count, usesLeft: Count, accountsLast7d: Count }),
});
export type AdminSummary = z.infer<typeof AdminSummary>;

// ─── Reportes ────────────────────────────────────────────────────────────

export const ReportStatus = z.enum(['OPEN', 'ACTIONED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof ReportStatus>;

/** `?status=` de la lista de reportes. */
export const AdminReportFilter = z.enum(['open', 'all']);
export type AdminReportFilter = z.infer<typeof AdminReportFilter>;

/** Una línea del chat tal como la sala la repartió (ADR-0010). */
export const AdminEvidenceLine = z.object({
  id: z.string(),
  from: z.string(),
  name: z.string(),
  text: z.string(),
  at: Epoch,
});
export type AdminEvidenceLine = z.infer<typeof AdminEvidenceLine>;

export const AdminReportSummary = z.object({
  id: ReportId,
  createdAt: Epoch,
  reason: ReportReason,
  status: ReportStatus,
  /** `mapa:instancia` donde pasó. */
  room: z.string(),
  target: AdminPerson,
  reporter: AdminPerson,
  /** El mensaje reportado, si se eligió uno y la sala lo tenía. */
  messageText: z.string().nullable(),
  /** Reportes abiertos contra la misma persona, este incluido si sigue abierto. */
  openAgainstTarget: Count,
});
export type AdminReportSummary = z.infer<typeof AdminReportSummary>;

/** GET /api/v1/admin/reports */
export const AdminReportListResponse = z.object({ reports: z.array(AdminReportSummary) });
export type AdminReportListResponse = z.infer<typeof AdminReportListResponse>;

/** GET /api/v1/admin/reports/:reportId */
export const AdminReportDetail = AdminReportSummary.extend({
  note: z.string().nullable(),
  evidence: z.object({
    capturedAt: Epoch,
    message: AdminEvidenceLine.nullable(),
    /** Se eligió un mensaje que ya había salido de la ventana de la sala. */
    messageExpired: z.boolean(),
    /** Lo último que dijo la persona reportada (cuando no se eligió mensaje). */
    targetMessages: z.array(AdminEvidenceLine),
    /** Lo que se dijo justo antes. */
    context: z.array(AdminEvidenceLine),
  }),
  resolvedAt: Epoch.nullable(),
  resolution: z.string().nullable(),
});
export type AdminReportDetail = z.infer<typeof AdminReportDetail>;

/** POST /api/v1/admin/reports/:reportId/dismiss */
export const DismissReportRequest = z.strictObject({ reason: ModerationReason });
export type DismissReportRequest = z.infer<typeof DismissReportRequest>;

// ─── Personas ────────────────────────────────────────────────────────────

/** GET /api/v1/admin/accounts?q= — por @usuario, nombre, correo, `acc_…` o `chr_…`. */
export const AdminAccountSearchResponse = z.object({ results: z.array(AdminPerson) });
export type AdminAccountSearchResponse = z.infer<typeof AdminAccountSearchResponse>;

export const AdminAuditEntry = z.object({
  id: z.string(),
  action: z.string(),
  reason: z.string().nullable(),
  at: Epoch,
  /** `@usuario` si fue desde la caseta, el nombre del moderador del script, o null (el sistema). */
  actor: z.string().nullable(),
});
export type AdminAuditEntry = z.infer<typeof AdminAuditEntry>;

/** GET /api/v1/admin/accounts/:accountId */
export const AdminAccountDetail = z.object({
  person: AdminPerson,
  email: z.string(),
  emailVerifiedAt: Epoch.nullable(),
  emailDeliverability: EmailDeliverability,
  createdAt: Epoch,
  chatMutedUntil: Epoch.nullable(),
  suspendedUntil: Epoch.nullable(),
  staffRole: StaffRole.nullable(),
  invitation: z.object({ id: InvitationId, label: z.string() }).nullable(),
  sessions: z.object({ active: Count, lastSeenAt: Epoch.nullable() }),
  reports: z.object({ against: Count, openAgainst: Count, made: Count }),
  /** Lo más reciente contra esta persona. */
  recentReports: z.array(AdminReportSummary),
  audit: z.array(AdminAuditEntry),
});
export type AdminAccountDetail = z.infer<typeof AdminAccountDetail>;

/**
 * Lo que la caseta puede hacerle a una cuenta. Silenciar y suspender llevan
 * horas (suspender sin horas es indefinido); el resto no.
 */
export const SanctionAction = z.enum([
  'MUTE',
  'UNMUTE',
  'SUSPEND',
  'REINSTATE',
  'BAN',
  'END_SESSIONS',
]);
export type SanctionAction = z.infer<typeof SanctionAction>;

/** POST /api/v1/admin/accounts/:accountId/sanction */
export const SanctionRequest = z
  .strictObject({
    action: SanctionAction,
    hours: z.number().int().min(1).max(MODERATION.maxSanctionHours).optional(),
    reason: ModerationReason,
    /** El reporte que motivó la acción: se cierra como atendido. */
    reportId: ReportId.optional(),
    /** Cerrar también los demás reportes abiertos contra esta persona. */
    closeOpenReports: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'MUTE' && value.hours === undefined) {
      ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Di cuántas horas.' });
    }
    if (value.hours !== undefined && value.action !== 'MUTE' && value.action !== 'SUSPEND') {
      ctx.addIssue({
        code: 'custom',
        path: ['hours'],
        message: 'Solo el silencio y la suspensión llevan horas.',
      });
    }
  });
export type SanctionRequest = z.infer<typeof SanctionRequest>;

export const SanctionResponse = z.object({
  account: AdminAccountDetail,
  /** false si la cuenta ya estaba así (repetir no cambia nada). */
  changed: z.boolean(),
});
export type SanctionResponse = z.infer<typeof SanctionResponse>;

// ─── Invitaciones ────────────────────────────────────────────────────────

export const InvitationStatus = z.enum(['ACTIVE', 'USED_UP', 'EXPIRED', 'REVOKED']);
export type InvitationStatus = z.infer<typeof InvitationStatus>;

export const AdminInvitation = z.object({
  id: InvitationId,
  /** `XXXXX-XXXXX`, o null si ya no se puede mostrar (cambió la llave del entorno). */
  code: z.string().nullable(),
  label: z.string(),
  maxUses: Count,
  uses: Count,
  expiresAt: Epoch.nullable(),
  revokedAt: Epoch.nullable(),
  createdAt: Epoch,
  /** `@usuario` de quien la creó. */
  createdBy: z.string().nullable(),
  status: InvitationStatus,
  /** Cuentas que se abrieron con ella. */
  accounts: Count,
});
export type AdminInvitation = z.infer<typeof AdminInvitation>;

/** GET /api/v1/admin/invitations — lo más reciente primero. */
export const AdminInvitationListResponse = z.object({ invitations: z.array(AdminInvitation) });
export type AdminInvitationListResponse = z.infer<typeof AdminInvitationListResponse>;

/** POST /api/v1/admin/invitations */
export const CreateInvitationRequest = z.strictObject({
  /** Para quién o para qué es («Primos», «Taller del jueves»). */
  label: freeText(
    INVITATIONS.labelMinChars,
    INVITATIONS.labelMaxChars,
    'Ponle un nombre: para quién es.',
  ),
  maxUses: z.number().int().min(1).max(INVITATIONS.maxUses),
  expiresInDays: z.number().int().min(1).max(INVITATIONS.maxDays),
});
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequest>;

/** POST /api/v1/admin/invitations/:invitationId/revoke */
export const RevokeInvitationRequest = z.strictObject({ reason: ModerationReason });
export type RevokeInvitationRequest = z.infer<typeof RevokeInvitationRequest>;

export const AdminInvitationResponse = z.object({ invitation: AdminInvitation });
export type AdminInvitationResponse = z.infer<typeof AdminInvitationResponse>;
