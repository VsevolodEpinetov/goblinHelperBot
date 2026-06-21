import { Markup } from 'telegraf';

/**
 * Shared inline-button navigation for the add-kickstarter wizard, so steps are
 * driven by taps instead of typing «пропустить» / «далее». The same callback
 * ids are reused across steps — only the active scene handles them, so each
 * scene registers its own skip/done logic and the cancel is wired via
 * registerCancel({ action: KS_ADD_CANCEL }).
 */
export const KS_ADD_CANCEL = 'ks:add:cancel';
export const KS_ADD_SKIP = 'ks:add:skip';
export const KS_ADD_DONE = 'ks:add:done';

const cancelButton = Markup.button.callback('« Отмена', KS_ADD_CANCEL);

/** A lone «Отмена» — for required steps with nothing to skip. */
export function cancelKb(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[cancelButton]]);
}

/** «Пропустить» + «Отмена» — for optional steps. */
export function skipCancelKb(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Пропустить ⏭', KS_ADD_SKIP)],
    [cancelButton],
  ]);
}

/** «Готово» + «Отмена» — for the photo/file collection steps. */
export function doneCancelKb(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Готово ✅', KS_ADD_DONE)],
    [cancelButton],
  ]);
}
