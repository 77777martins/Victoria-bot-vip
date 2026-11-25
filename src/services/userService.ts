import { prisma } from '../lib/prisma';
import type { UserDTO } from '../domain/types';

interface TelegramFrom {
  id: number;
  username?: string;
  first_name?: string;
}

export const userService = {
  async upsertFromTelegram(from: TelegramFrom): Promise<UserDTO> {
    return prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      update: { username: from.username ?? null, firstName: from.first_name ?? null },
      create: {
        telegramId: BigInt(from.id),
        username: from.username ?? null,
        firstName: from.first_name ?? null,
      },
    });
  },

  async findByTelegramId(telegramId: number): Promise<UserDTO | null> {
    return prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  },

  async confirmAgeAndTerms(userId: string): Promise<void> {
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { ageConfirmedAt: now, termsAcceptedAt: now },
    });
  },

  async setBanned(userId: string, isBanned: boolean): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { isBanned } });
  },
};
