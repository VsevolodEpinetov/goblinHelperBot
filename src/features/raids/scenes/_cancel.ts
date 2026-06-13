import type { Scenes } from 'telegraf';
import { Markup } from 'telegraf';

import { registerCancel } from '../../../core/scenes';
import { memberHubKeyboard } from '../../onboarding/menus';

/** Literal callback_data for the inline cancel button on every raid wizard step. */
export const RAID_WIZ_CANCEL = 'raid:wiz:cancel';

/** A bare cancel-button row for steps that compose their own keyboards. */
export function wizardCancelRow(): ReturnType<typeof Markup.button.callback>[] {
  return [Markup.button.callback('« Отмена', RAID_WIZ_CANCEL)];
}

/** A standalone «Отмена» keyboard to attach to wizard step prompts. */
export const raidWizardCancelKb = Markup.inlineKeyboard([wizardCancelRow()]);

/**
 * Wire the shared wizard exits (typed /cancel + the inline «Отмена» button) on
 * a raid-wizard step scene, leaving the member at the hub instead of a dead end.
 */
export function attachWizardCancel(scene: Scenes.BaseScene<Scenes.SceneContext>): void {
  registerCancel(scene, {
    text: '🌑 Бросил затею с рейдом. Черновик порвал.',
    extra: memberHubKeyboard(),
    action: RAID_WIZ_CANCEL,
  });
}
