# Victoria Bot VIP

Bot de Telegram que vende acesso a um **grupo VIP privado (18+)** com pagamento em **Telegram Stars**.

## Planos

| Plano     | Duração  | Preço ref. | Stars (inicial) |
|-----------|----------|------------|-----------------|
| Semanal   | 7 dias   | R$ 9,99    | 100 ⭐ |
| Mensal    | 30 dias  | R$ 19,99   | 200 ⭐ |
| Vitalício | sem fim  | R$ 29,99   | 300 ⭐ |

Os preços ficam na tabela `Plan`. O valor em Stars é uma estimativa — ajuste
direto no banco (`priceStars`) sem precisar de deploy. O seed não sobrescreve `priceStars`.

## Fluxo

1. `/start` → confirmação 18+ e aceite dos termos.
2. Escolha do plano → invoice em Stars (`XTR`).
3. `pre_checkout_query` valida dono, valor, plano e status.
4. `successful_payment` → transação idempotente (lock `FOR UPDATE`) marca pago e cria/estende assinatura.
5. Bot envia link pessoal com **pedido de entrada** (24h). O bot só aprova quem tem assinatura ativa — link vazado não funciona.
6. Job a cada 5 min: avisa 24h antes do vencimento e remove do grupo quem expirou.

## Stack

Node 20+, TypeScript, Telegraf 4, Prisma 6, PostgreSQL, Zod, Pino.

## Estrutura

```
prisma/              schema + migrations
src/
  config/env.ts      validação das variáveis (Zod)
  lib/               logger, prisma, formatação
  domain/types.ts    tipos e erros de domínio
  services/          regras de negócio (usuário, plano, pagamento, assinatura, grupo)
  bot/               middlewares, teclados, mensagens, handlers
  jobs/              expiração de assinaturas
  scripts/seed.ts    cria/atualiza os planos
  main.ts            bootstrap + graceful shutdown
```

## Configuração

1. **@BotFather**: `/newbot`, guarde o token. Opcional: `/setjoingroups` → Disable.
2. **Grupo privado**: adicione o bot como **administrador** com permissões
   *Convidar usuários* e *Banir usuários*.
3. **ID do grupo**: começa com `-100` (use um bot como @RawDataBot ou os logs).
4. **Banco**: crie um PostgreSQL (ex.: Neon) e copie a URL com `sslmode=require`.
5. **Hospedagem** (Railway/Render): conecte este repo e configure as variáveis de `.env.example`.
   - Build: `npm ci && npm run build`
   - Start: `npm start` (roda migrations, seed e o bot)
6. **Rode só 1 instância** — o job de expiração e o rate limit são em memória.

## Comandos

Usuário: `/start`, `/planos`, `/assinatura`, `/termos`, `/paysupport`

Admin (IDs em `ADMIN_IDS`, só no privado): `/admin`, `/stats`,
`/liberar <id> <plano>`, `/banir <id>`, `/desbanir <id>`, `/reembolsar <chargeId>`

Visual de vendas (editável pelo próprio Telegram, sem deploy):
- Responder a uma foto/vídeo com `/boasvindas` → mídia da tela inicial (a legenda vira o texto)
- Responder a uma foto/vídeo com `/addprevia` → prévia (máx. 10, enviadas com `protect_content`)
- `/textoboasvindas <texto>`, `/textopadrao`, `/removermidia`, `/limparprevias`, `/vercomocliente`

Remarketing (quem passou pelo 18+ e nunca comprou; máx. 5 mensagens, com botão de descadastro):
- Responder a uma foto/vídeo com `/remarketing <horas>` ou `/remarketing <horas> <texto>`
- `/verremarketing`, `/testarremarketing <n>`, `/removerremarketing <n>`
- Quem está atrasado recebe só a mensagem mais recente devida (sem rajadas). Remover/reordenar passos desloca a contagem.

Posts automáticos no grupo VIP (horário de Brasília):
- `/agendar 25/12 20:00 [texto]` (respondendo a mídia ou só texto) — máx. 60 dias à frente
- `/fila [texto]` + `/horarios 12:00,20:00` → posta 1 item da fila por horário; `/horarios off` pausa
- `/agendados`, `/cancelarpost <código>`

## Segurança

- Segredos só em variáveis de ambiente (validadas na inicialização, nunca logadas).
- Webhook protegido por `secret_token`; sem webhook, usa long polling.
- Acesso liberado **apenas** após `successful_payment`, com idempotência por payload e `chargeId` únicos.
- Entrada no grupo via join request validada contra assinatura ativa.
- Rate limit por usuário (nunca aplicado a updates de pagamento).
- Texto do usuário escapado antes de HTML.
