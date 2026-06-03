import { describe, expect, it } from 'vitest';
import {
  forgetHostedAccountDeletion,
  getHostedAccountState,
  recordHostedAccountDeletion,
  resetHostedAccountState,
} from '../server/lib/hostedAccountDeletion.js';

describe('hostedAccountDeletion', () => {
  it('can remove a recreated profile slug from the deleted list', () => {
    resetHostedAccountState();
    recordHostedAccountDeletion(['brikeld-hoxha-8472025d', 'old-user-12345678']);

    forgetHostedAccountDeletion('brikeld-hoxha-8472025d');

    expect(getHostedAccountState().deletedProfileIds).toEqual(['old-user-12345678']);
  });
});
