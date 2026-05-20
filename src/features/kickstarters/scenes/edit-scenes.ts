import { validateCost, validateLink, validateName } from '../service';

import { makeEditFieldScene } from './edit-field';

export const editNameScene = makeEditFieldScene({
  id: 'ks:edit:name',
  field: 'name',
  prompt: 'Новое имя? Или /cancel.',
  validate: validateName,
});

export const editCreatorScene = makeEditFieldScene({
  id: 'ks:edit:creator',
  field: 'creator',
  prompt: 'Новый автор? Или /cancel.',
  validate: (s) => s.trim(),
});

export const editCostScene = makeEditFieldScene({
  id: 'ks:edit:cost',
  field: 'cost',
  prompt: 'Новая цена (в звёздах)? Или /cancel.',
  validate: validateCost,
});

export const editLinkScene = makeEditFieldScene({
  id: 'ks:edit:link',
  field: 'link',
  prompt: 'Новая ссылка? "пропустить" чтобы убрать. Или /cancel.',
  validate: validateLink,
});

export const editPledgeNameScene = makeEditFieldScene({
  id: 'ks:edit:pledge_name',
  field: 'pledge_name',
  prompt: 'Имя пледжа? "пропустить" для пустого. Или /cancel.',
  validate: (s) => {
    const t = s.trim();
    return /^пропустить$/i.test(t) ? null : t;
  },
});

export const editPledgeCostScene = makeEditFieldScene({
  id: 'ks:edit:pledge_cost',
  field: 'pledge_cost',
  prompt: 'Цена пледжа? "пропустить" для пустого. Или /cancel.',
  validate: (s) => {
    const t = s.trim();
    if (/^пропустить$/i.test(t)) return null;
    return validateCost(t);
  },
});

export const ALL_EDIT_SCENES = [
  editNameScene,
  editCreatorScene,
  editCostScene,
  editLinkScene,
  editPledgeNameScene,
  editPledgeCostScene,
] as const;
