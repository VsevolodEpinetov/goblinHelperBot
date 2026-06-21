import type { Scenes, Telegraf } from 'telegraf';

import { registerKickstarterActions } from './actions';
import { registerKickstarterAdminCommands } from './admin-routes';
import { registerKickstarterCommands } from './routes';
import { costScene } from './scenes/add/cost';
import { creatorScene } from './scenes/add/creator';
import { filesScene } from './scenes/add/files';
import { linkScene } from './scenes/add/link';
import { nameScene } from './scenes/add/name';
import { photosScene } from './scenes/add/photos';
import { reviewScene } from './scenes/add/review';
import { ALL_EDIT_SCENES } from './scenes/edit-scenes';

export function getKickstarterScenes(): Scenes.BaseScene<Scenes.SceneContext>[] {
  return [
    ...ALL_EDIT_SCENES,
    nameScene,
    creatorScene,
    linkScene,
    costScene,
    photosScene,
    filesScene,
    reviewScene,
  ];
}

export function register(bot: Telegraf): void {
  registerKickstarterCommands(bot);
  registerKickstarterAdminCommands(bot);
  registerKickstarterActions();
}

export { sendKickstarterPromo } from './promo';
