import { z } from "zod";

// Schema unico de todas as env vars da aplicacao.
// Quando faltar algo critico ou um valor estiver invalido, validateEnv()
// estoura com mensagem clara listando exatamente o que esta errado.

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const positiveIntString = (label: string, defaultValue: number) =>
  z
    .string()
    .default(String(defaultValue))
    .refine((v) => /^\d+$/.test(v), `${label} deve ser um numero inteiro positivo`)
    .transform((v) => Number.parseInt(v, 10))
    .refine((n) => n > 0, `${label} deve ser maior que zero`);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "homolog"]).default("development"),

  // Banco de dados
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL e obrigatoria" })
    .min(1, "DATABASE_URL e obrigatoria")
    .url("DATABASE_URL precisa ser uma URL valida (postgresql://...)"),

  // Sessao admin/operator
  SESSION_COOKIE_NAME: z.string().min(1).default("pdv_session"),
  SESSION_COOKIE_SECURE: booleanString.default("false"),
  CSRF_COOKIE_NAME: z.string().min(1).default("pdv_csrf"),
  NEXT_PUBLIC_CSRF_COOKIE_NAME: z.string().min(1).default("pdv_csrf"),
  SESSION_TTL_HOURS: positiveIntString("SESSION_TTL_HOURS", 12),

  // Sessao do cliente (separada)
  CUSTOMER_SESSION_COOKIE_NAME: z.string().min(1).default("customer_session"),
  CUSTOMER_CSRF_COOKIE_NAME: z.string().min(1).default("customer_csrf"),
  CUSTOMER_SESSION_TTL_HOURS: positiveIntString("CUSTOMER_SESSION_TTL_HOURS", 168),

  // Geral
  APP_TIMEZONE: z.string().min(1).default("America/Sao_Paulo"),
  TZ: z.string().min(1).default("America/Sao_Paulo"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Dela's Vibe PDV"),
  TRUST_PROXY_HEADERS: booleanString.default("false"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // Pedidos web
  WEB_ORDER_PENDING_TTL_MINUTES: positiveIntString("WEB_ORDER_PENDING_TTL_MINUTES", 60),

  // Uploads de imagens de produto
  UPLOADS_DIR: z.string().min(1).default("/app/uploads"),

  // Loja (exibido publicamente)
  NEXT_PUBLIC_STORE_NAME: z
    .string({ required_error: "NEXT_PUBLIC_STORE_NAME e obrigatorio" })
    .min(1, "NEXT_PUBLIC_STORE_NAME e obrigatorio"),
  NEXT_PUBLIC_STORE_ADDRESS: z
    .string({ required_error: "NEXT_PUBLIC_STORE_ADDRESS e obrigatorio" })
    .min(1, "NEXT_PUBLIC_STORE_ADDRESS e obrigatorio"),
  NEXT_PUBLIC_STORE_PHONE: z
    .string({ required_error: "NEXT_PUBLIC_STORE_PHONE e obrigatorio" })
    .min(1, "NEXT_PUBLIC_STORE_PHONE e obrigatorio"),

  // Web Push (admin notifications) — opcionais, mas se uma for definida,
  // todas precisam estar
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Tests
  RATE_LIMIT_DRIVER: z.enum(["memory", "postgres"]).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

function validateVapidGroup(parsed: AppEnv): string[] {
  const issues: string[] = [];
  const some = parsed.VAPID_PUBLIC_KEY || parsed.VAPID_PRIVATE_KEY || parsed.VAPID_SUBJECT;
  const all = parsed.VAPID_PUBLIC_KEY && parsed.VAPID_PRIVATE_KEY && parsed.VAPID_SUBJECT;
  if (some && !all) {
    if (!parsed.VAPID_PUBLIC_KEY)
      issues.push(
        "VAPID_PUBLIC_KEY esta vazio (mas outras VAPID_* estao definidas — todas precisam vir juntas ou nenhuma)",
      );
    if (!parsed.VAPID_PRIVATE_KEY)
      issues.push(
        "VAPID_PRIVATE_KEY esta vazio (mas outras VAPID_* estao definidas — todas precisam vir juntas ou nenhuma)",
      );
    if (!parsed.VAPID_SUBJECT)
      issues.push(
        "VAPID_SUBJECT esta vazio (mas outras VAPID_* estao definidas — todas precisam vir juntas ou nenhuma)",
      );
  }
  return issues;
}

function formatIssue(
  path: (string | number)[],
  message: string,
  receivedValue: unknown,
): string {
  const name = path.join(".") || "(raiz)";
  const hasValue = receivedValue !== undefined && receivedValue !== "";
  const valueHint = hasValue ? ` (recebido: "${String(receivedValue)}")` : " (nao definida)";
  return `  - ${name}: ${message}${valueHint}`;
}

export type ValidateEnvResult =
  | { ok: true; env: AppEnv }
  | { ok: false; messages: string[] };

type RawEnv = Record<string, string | undefined>;

export function validateEnv(rawEnv: RawEnv = process.env): ValidateEnvResult {
  const result = envSchema.safeParse(rawEnv);
  const messages: string[] = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      const received = issue.path.length === 1 ? rawEnv[issue.path[0] as string] : undefined;
      messages.push(formatIssue(issue.path, issue.message, received));
    }
    return { ok: false, messages };
  }

  const vapidIssues = validateVapidGroup(result.data);
  if (vapidIssues.length > 0) {
    return { ok: false, messages: vapidIssues.map((m) => `  - ${m}`) };
  }

  return { ok: true, env: result.data };
}

export function assertEnv(rawEnv: RawEnv = process.env): AppEnv {
  const result = validateEnv(rawEnv);
  if (result.ok) {
    return result.env;
  }

  const header =
    "\n[env] Configuracao de ambiente invalida — corrija os itens abaixo e reinicie:\n";
  const body = result.messages.join("\n");
  const footer =
    "\n\nConsulte .env.example e DEPLOY.md para a lista completa de variaveis.\n";

  // Imprime no stderr e encerra com codigo 1 — fail fast.
  process.stderr.write(`${header}${body}${footer}`);
  process.exit(1);
}
