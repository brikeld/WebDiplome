import { hash } from '@/lib/commentMetaStrip.js';
import { DEMO_OTHER_COMMENTER } from '@/lib/demoCommentIdentity.js';

const MOCK_PERSONA = 'securite';

const COMMENT_BANK = {
  productivite: [
    'Solid throughput this cycle — the cadence is paying off in shipped surface area.',
    'You\'re sequencing the work well; the dependency chain looks healthier than last month.',
    'Heads-down output is up, but make sure you\'re leaving room for review passes.',
    'Eighty edits in a week — that\'s a meaningful slope. Keep the streak honest.',
    'The pace is great. Worth tagging the riskiest changes so they get a second pair of eyes.',
  ],
  securite: [
    'Worth double-checking that none of the new endpoints are exposed without auth.',
    'High commit volume is also high blast radius — keep the rollback story tight.',
    'Make sure secrets aren\'t leaking into the recent diffs. Quick scan recommended.',
    'Security hygiene at this velocity matters: pin dependencies and review additions.',
    'Audit log coverage should grow with the surface area you\'re shipping.',
  ],
  popularite: [
    'People are noticing. The cadence reads as confident in public.',
    'You\'ve built a quiet streak — share a snippet and the network will compound.',
    'This is the kind of work that gets quoted later. Let it breathe in public.',
    'Eighty changes is a story in itself. Worth posting the highlight reel.',
    'The momentum is visible. A short retro post would land well right now.',
  ],
};

function pick(bank, seed) {
  return bank[seed % bank.length];
}

/** Single Alex Johnson mock thread comment (suggestions are AI-generated on open). */
export function getMockCommentsFor(postId) {
  const seed = hash(`${postId}|comment|${MOCK_PERSONA}|mock`);
  return {
    comments: [
      {
        persona: MOCK_PERSONA,
        content: pick(COMMENT_BANK[MOCK_PERSONA], seed),
        displayName: DEMO_OTHER_COMMENTER.displayName,
        handle: DEMO_OTHER_COMMENTER.handle,
        avatarSrc: DEMO_OTHER_COMMENTER.avatarSrc,
        avatarInitials: DEMO_OTHER_COMMENTER.avatarInitials,
        personaBadgePersona: DEMO_OTHER_COMMENTER.personaBadgePersona,
        isMock: true,
      },
    ],
  };
}
