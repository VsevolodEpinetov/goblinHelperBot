import type { Scenes, Telegraf } from 'telegraf';

import { registerAdminActions } from './actions';
import { registerAdminCommands } from './routes';
import { addMonthScene } from './scenes/add-month';
import { changeBalanceScene } from './scenes/change-balance';
import { grantRoleScene } from './scenes/grant-role';
import { grantScrollScene } from './scenes/grant-scroll';
import { setMonthChatScene } from './scenes/set-month-chat';

export function getAdminScenes(): Scenes.BaseScene<Scenes.SceneContext>[] {
  return [grantRoleScene, grantScrollScene, changeBalanceScene, addMonthScene, setMonthChatScene];
}

export function register(bot: Telegraf): void {
  registerAdminCommands(bot);
  registerAdminActions();
}
