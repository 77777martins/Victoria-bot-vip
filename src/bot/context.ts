import type { Context } from 'telegraf';
import type { UserDTO } from '../domain/types';
import type { AccessService } from '../services/accessService';

export interface BotContext extends Context {
  /** Usuário do banco — preenchido pelo middleware ensureUser em chats privados. */
  appUser?: UserDTO;
  access: AccessService;
}
