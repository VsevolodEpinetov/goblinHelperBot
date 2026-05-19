import { Scenes, type Telegraf } from 'telegraf';

import { registerRaidActions } from './actions';
import { registerRaidCommands } from './routes';
import { dateScene } from './scenes/date';
import { descriptionScene } from './scenes/description';
import { linkScene } from './scenes/link';
import { photoScene } from './scenes/photo';
import { priceScene } from './scenes/price';
import { reviewScene } from './scenes/review';
import { titleScene } from './scenes/title';

export function createRaidStage(): Scenes.Stage<Scenes.SceneContext> {
  return new Scenes.Stage<Scenes.SceneContext>([
    titleScene,
    photoScene,
    linkScene,
    priceScene,
    descriptionScene,
    dateScene,
    reviewScene,
  ]);
}

export function register(bot: Telegraf): void {
  registerRaidCommands(bot);
  registerRaidActions();
}
