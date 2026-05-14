const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

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

const PILL_BANK = ['text', 'text', 'text', 'text', 'text', 'text'];

const SUGGESTION_BANK = {
  productivite: [
    'Strong cadence — keep the queue moving and protect the focus blocks.',
    'Try batching the small edits so the big ones get the attention they need.',
    'Lock in the streak with a short Friday review of what shipped.',
    'The pace is sustainable if you keep the review loop short.',
  ],
  securite: [
    'Run a quick secrets scan over the diff before tagging the release.',
    'Tighten the rollback plan now while the changes are still fresh.',
    'Add a smoke test for the riskiest path so a regression catches itself.',
    'Pin the new deps before they drift on you.',
  ],
  popularite: [
    'Share a one-line summary of the week — small post, big compounding.',
    'A short video of the new flow would land well right now.',
    'Tag the people who unblocked you — quiet credit travels far.',
    'Drop a snippet, watch the network do the rest.',
  ],
};

function hash(str) {
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick(bank, seed) {
  return bank[seed % bank.length];
}

export function getMockCommentsFor(postId) {
  const base = hash(postId);

  const comments = PERSONA_ORDER.map((persona, i) => {
    const seed = hash(`${postId}|comment|${persona}|${i}`);
    return {
      persona,
      content: pick(COMMENT_BANK[persona], seed),
      pills: [
        pick(PILL_BANK, seed + 1),
        pick(PILL_BANK, seed + 2),
        pick(PILL_BANK, seed + 3),
      ],
    };
  });

  const suggestions = PERSONA_ORDER.map((persona, i) => {
    const seed = hash(`${postId}|suggestion|${persona}|${i}`);
    return {
      persona,
      content: pick(SUGGESTION_BANK[persona], seed),
      plusValue: ((seed + base) % 5) + 1,
    };
  });

  return { comments, suggestions };
}
