import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * priceStars é uma estimativa inicial. A cotação real de Stars varia por
 * loja (Apple/Google) e país — ajuste no banco após testar o valor final
 * que o comprador paga.
 */
const plans = [
  { slug: 'semanal', name: 'Semanal (7 dias)', durationDays: 7, priceCents: 999, priceStars: 100, sortOrder: 1 },
  { slug: 'mensal', name: 'Mensal (30 dias)', durationDays: 30, priceCents: 1999, priceStars: 200, sortOrder: 2 },
  { slug: 'vitalicio', name: 'Vitalício', durationDays: null, priceCents: 2999, priceStars: 300, sortOrder: 3 },
];

async function main(): Promise<void> {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { name: plan.name, durationDays: plan.durationDays, priceCents: plan.priceCents, sortOrder: plan.sortOrder },
      create: plan,
    });
  }
  console.log(`Seed concluído: ${plans.length} planos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
