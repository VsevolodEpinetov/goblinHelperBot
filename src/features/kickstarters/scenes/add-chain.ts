import { defineChain } from '../../../core/scenes';

export const KS_ADD_CHAIN = defineChain([
  'ks:add:name',
  'ks:add:creator',
  'ks:add:link',
  'ks:add:cost',
  'ks:add:photos',
  'ks:add:files',
  'ks:add:review',
] as const);

export interface KsAddDraft {
  name?: string;
  creator?: string | null;
  link?: string | null;
  cost?: number;
  pledgeName?: string | null;
  pledgeCost?: number | null;
  photoFileIds?: string[];
  fileFileIds?: string[];
}
