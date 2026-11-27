import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    BOT_TOKEN: z.string().regex(/^\d+:[\w-]{30,}$/, 'BOT_TOKEN inválido'),
    DATABASE_URL: z.string().url(),
    GROUP_CHAT_ID: z.string().regex(/^-100\d+$/, 'GROUP_CHAT_ID deve começar com -100'),
    ADMIN_IDS: z
      .string()
      .min(1)
      .transform((v) => v.split(',').map((id) => id.trim()).filter(Boolean))
      .pipe(z.array(z.string().regex(/^\d+$/)).min(1)),
    WEBHOOK_DOMAIN: z
      .string()
      .regex(/^[a-z0-9.-]+$/i, 'WEBHOOK_DOMAIN sem https:// e sem barra')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/, 'WEBHOOK_SECRET: 32+ chars [A-Za-z0-9_-]')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    PORT: z.coerce.number().int().positive().default(3000),
    /** PIX manual (opcional). Chave no nome da cliente: CPF, CNPJ, e-mail, +55 telefone ou aleatória. */
    PIX_KEY: z
      .string()
      .trim()
      .min(5)
      .max(77)
      .regex(/^\S+$/, 'PIX_KEY sem espaços')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    PIX_MERCHANT_NAME: z
      .string()
      .trim()
      .min(1)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    PIX_MERCHANT_CITY: z
      .string()
      .trim()
      .min(1)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    SUPPORT_USERNAME: z
      .string()
      .regex(/^[A-Za-z0-9_]{5,32}$/)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((e) => !e.PIX_KEY || (e.PIX_MERCHANT_NAME && e.PIX_MERCHANT_CITY), {
    message: 'PIX_MERCHANT_NAME e PIX_MERCHANT_CITY são obrigatórios quando PIX_KEY está definido',
    path: ['PIX_MERCHANT_NAME'],
  })
  .refine((e) => !e.WEBHOOK_DOMAIN || e.WEBHOOK_SECRET, {
    message: 'WEBHOOK_SECRET é obrigatório quando WEBHOOK_DOMAIN está definido',
    path: ['WEBHOOK_SECRET'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Mostra só os nomes/mensagens dos campos — nunca os valores (podem ser segredos).
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Variáveis de ambiente inválidas:\n${issues}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  GROUP_CHAT_ID: Number(parsed.data.GROUP_CHAT_ID),
  ADMIN_IDS: new Set(parsed.data.ADMIN_IDS.map(Number)),
};
