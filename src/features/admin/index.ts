import type { Scenes, Telegraf } from 'telegraf';

import { registerAdminActions } from './actions';
import { registerAdminCommands } from './routes';
import { addMonthScene } from './scenes/add-month';
import { changeBalanceScene } from './scenes/change-balance';
import { findUserScene } from './scenes/find-user';
import { grantMonthScene } from './scenes/grant-month';
import { grantScrollScene } from './scenes/grant-scroll';
import { setMonthChatScene } from './scenes/set-month-chat';

export function getAdminScenes(): Scenes.BaseScene<Scenes.SceneContext>[] {
  return [
    grantScrollScene,
    changeBalanceScene,
    addMonthScene,
    setMonthChatScene,
    findUserScene,
    grantMonthScene,
  ];
}

export function register(bot: Telegraf): void {
  registerAdminCommands(bot);
  registerAdminActions();
}
