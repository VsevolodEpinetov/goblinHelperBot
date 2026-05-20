import { Scenes } from 'telegraf';

import { logger } from '../../../core/observability';
import type { EditableField } from '../repo';
import { updateField } from '../service';

export type Validator = (input: string) => string | number | null;

export interface EditFieldConfig {
  /** Scene id, e.g., `ks:edit:name`. */
  id: string;
  /** DB column name to update. */
  field: EditableField;
  /** User-visible prompt. */
  prompt: string;
  /** Throws on invalid input. Returns the value to write (string, number, or null). */
  validate: Validator;
}

/**
 * One factory that replaces the four near-identical edit scenes in the legacy code.
 * Each call returns a Telegraf scene whose only state is `{ kickstarterId: number }`.
 */
export function makeEditFieldScene(config: EditFieldConfig): Scenes.BaseScene<Scenes.SceneContext> {
  const scene = new Scenes.BaseScene<Scenes.SceneContext>(config.id);

  scene.enter(async (ctx) => {
    await ctx.reply(config.prompt);
  });

  scene.command('cancel', async (ctx) => {
    ctx.scene.state = {};
    await ctx.scene.leave();
    await ctx.reply('Отменено.');
  });

  scene.on('text', async (ctx) => {
    const state = ctx.scene.state as { kickstarterId?: number };
    if (!state.kickstarterId) {
      await ctx.reply('Не вижу kickstarter id. Зайди заново через админ-меню.');
      await ctx.scene.leave();
      return;
    }
    try {
      const value = config.validate(ctx.message.text);
      await updateField(state.kickstarterId, config.field, value);
      await ctx.reply('✅ Обновлено.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неверный ввод.';
      await ctx.reply(msg);
      logger.debug({ err, field: config.field }, 'edit-field validation failed');
      return; // Stay in scene so user can retry.
    }
    await ctx.scene.leave();
  });

  return scene;
}
