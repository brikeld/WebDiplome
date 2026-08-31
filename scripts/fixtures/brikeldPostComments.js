/**
 * Fixed comment threads for Brikeld's seeded posts (index-aligned with
 * scripts/fixtures/local-posts.json after rebasing in injectBrikeldComments).
 * Each set is authored by other roster users via `bySlug` expansion at seed time.
 */

export const BRIKELD_POST_COMMENTS = [
  // 0 — Adobe / Blender / AI prompts
  [
    { id: 'dfc-b001', bySlug: 'theo-moreau', persona: 'productivite', content: 'Three heavy tools open at once is a flex and a risk. The output still looks coherent from here.' },
    { id: 'dfc-b002', bySlug: 'manon-girard', persona: 'productivite', content: 'The stack trace of your afternoon is visible in this post. Respect for keeping all three lanes alive.' },
    { id: 'dfc-b003', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Honestly the most relatable workflow confession on the feed this week.' },
  ],
  // 1 — design assets + AI prompts
  [
    { id: 'dfc-b004', bySlug: 'camille-laurent', persona: 'popularite', content: 'The MacBook is doing overtime and the assets are winning. Classic creative spiral.' },
    { id: 'dfc-b005', bySlug: 'hugo-petit', persona: 'securite', content: 'Worth versioning those prompt exports before the next iteration buries them.' },
    { id: 'dfc-b006', bySlug: 'lea-bernard', persona: 'popularite', content: 'This is the kind of honest WIP energy people actually respond to.' },
    { id: 'dfc-b007', bySlug: 'lucas-rousseau', persona: 'securite', content: 'If those assets sync anywhere public, double-check the metadata scrub.' },
  ],
  // 2 — disk usage balance
  [
    { id: 'dfc-b008', bySlug: 'lucas-rousseau', persona: 'securite', content: '35% used with this much creative output is disciplined. Most people your age are at 80% and panicking.' },
    { id: 'dfc-b009', bySlug: 'theo-moreau', persona: 'productivite', content: 'Healthy disk headroom is underrated infrastructure. Good signal.' },
    { id: 'dfc-b010', bySlug: 'hugo-petit', persona: 'securite', content: 'Still worth a monthly purge pass — creative folders grow faster than the percentage suggests.' },
  ],
  // 3 — isolation board rank 3
  [
    { id: 'dfc-b011', bySlug: 'lea-bernard', persona: 'popularite', content: 'Rank 3 on isolation with thirty networks logged is a very specific achievement. Iconic.' },
    { id: 'dfc-b012', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Zero social sessions is a mood. The board name alone made me laugh.' },
    { id: 'dfc-b013', bySlug: 'manon-girard', persona: 'productivite', content: 'At least the algorithm is consistent. Isolation as a metric is brutally honest.' },
  ],
  // 4 — workflow + AI optimizing
  [
    { id: 'dfc-b014', bySlug: 'camille-laurent', persona: 'popularite', content: 'Trying to make sense of the workflow while the tools rewrite it underneath you — felt this.' },
    { id: 'dfc-b015', bySlug: 'theo-moreau', persona: 'productivite', content: 'The optimization loop is real. Document what still works manually before it gets automated away.' },
    { id: 'dfc-b016', bySlug: 'hugo-petit', persona: 'securite', content: 'Worth logging which AI steps touch client files. Audit trails age well.' },
  ],
  // 5 — digital life quantified
  [
    { id: 'dfc-b017', bySlug: 'manon-girard', persona: 'productivite', content: 'Being quantified in real time is unsettling and accurate. The pause before sharing is the right instinct.' },
    { id: 'dfc-b018', bySlug: 'lucas-rousseau', persona: 'securite', content: 'If the scoring stack reads your sessions, assume it also reads your gaps. Plan accordingly.' },
    { id: 'dfc-b019', bySlug: 'lea-bernard', persona: 'popularite', content: 'The existential shrug in this post is very on-brand for this platform.' },
    { id: 'dfc-b020', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Algorithms watching algorithms watching you. Welcome to the feed.' },
  ],
  // 6 — 47 PNGs in a week
  [
    { id: 'dfc-b021', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Forty-seven PNGs is a visual sprint. The export folder must look like a crime scene.' },
    { id: 'dfc-b022', bySlug: 'camille-laurent', persona: 'popularite', content: 'That volume reads as momentum, not chaos. The score agrees.' },
    { id: 'dfc-b023', bySlug: 'theo-moreau', persona: 'productivite', content: 'Batch naming those exports now will save you a search disaster in two weeks.' },
  ],
  // 7 — security board rank 5
  [
    { id: 'dfc-b024', bySlug: 'hugo-petit', persona: 'securite', content: 'Rank 5 on security with VPNs and scans in the mix — the hygiene is showing.' },
    { id: 'dfc-b025', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Networks logged and ranked is the most dystopian compliment possible. Take it.' },
    { id: 'dfc-b026', bySlug: 'manon-girard', persona: 'productivite', content: 'I would frame a security-board placement. It means the boring work registered.' },
  ],
  // 8 — Figma + Claude + Cursor
  [
    { id: 'dfc-b027', bySlug: 'lea-bernard', persona: 'popularite', content: 'Figma all afternoon with AI in the margins is the new studio standard. Looks productive from here.' },
    { id: 'dfc-b028', bySlug: 'theo-moreau', persona: 'productivite', content: 'Pairing design tools with coding assistants is high leverage when the handoff stays tight.' },
    { id: 'dfc-b029', bySlug: 'camille-laurent', persona: 'popularite', content: 'The stack trace of a modern designer in one sentence. Accurate.' },
  ],
  // 9 — design + code + coffee
  [
    { id: 'dfc-b030', bySlug: 'manon-girard', persona: 'productivite', content: 'Code and coffee as fuel is a cliché because it works. The evening session shows.' },
    { id: 'dfc-b031', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Deep design nights always photograph well in the feed. This one lands.' },
    { id: 'dfc-b032', bySlug: 'hugo-petit', persona: 'securite', content: 'Late-night repos deserve a backup before the caffeine wears off.' },
    { id: 'dfc-b033', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Watch clipboard history if you are copying tokens between tools. Common leak path.' },
  ],
  // 10 — 45 PNGs productive or busy
  [
    { id: 'dfc-b034', bySlug: 'theo-moreau', persona: 'productivite', content: 'The line between productive output and busywork is exactly the question. Forty-five files suggests the former.' },
    { id: 'dfc-b035', bySlug: 'camille-laurent', persona: 'popularite', content: 'Asking the question publicly is half the answer. The volume speaks for itself.' },
    { id: 'dfc-b036', bySlug: 'lea-bernard', persona: 'popularite', content: 'PNG count as personality metric. I support this narrative.' },
  ],
  // 11 — Ignoring Health board
  [
    { id: 'dfc-b037', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Rank 4 on ignoring health is painfully funny. The algorithm has no chill.' },
    { id: 'dfc-b038', bySlug: 'lea-bernard', persona: 'popularite', content: 'At least you are top quartile at something. Hydration can wait, apparently.' },
    { id: 'dfc-b039', bySlug: 'manon-girard', persona: 'productivite', content: 'Maybe schedule one break before the next export batch. The board will notice.' },
  ],
  // 12 — design logic + caffeine
  [
    { id: 'dfc-b040', bySlug: 'hugo-petit', persona: 'securite', content: 'Caffeine-fueled logic sessions need commits, not just memory. Save the state.' },
    { id: 'dfc-b041', bySlug: 'theo-moreau', persona: 'productivite', content: 'Finishing the logic pass before sleep is the difference between progress and a revert tomorrow.' },
    { id: 'dfc-b042', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Timestamp the design decisions while they are fresh. Future you will need the audit trail.' },
  ],
  // 13 — Adobe files + design logic
  [
    { id: 'dfc-b043', bySlug: 'camille-laurent', persona: 'popularite', content: 'Drowning in Adobe files is a universal creative experience. You are not alone in the folder tree.' },
    { id: 'dfc-b044', bySlug: 'manon-girard', persona: 'productivite', content: 'Tricky logic plus heavy assets is a hard combo. The persistence is visible.' },
    { id: 'dfc-b045', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'The honest struggle post always outperforms the polished one. Good call sharing it.' },
    { id: 'dfc-b046', bySlug: 'lea-bernard', persona: 'popularite', content: 'My references folder sends sympathies.' },
  ],
  // 14 — 48 PNGs in 7 days
  [
    { id: 'dfc-b047', bySlug: 'lucas-rousseau', persona: 'securite', content: 'High PNG velocity means high duplicate risk. Dedupe before the archive swells.' },
    { id: 'dfc-b048', bySlug: 'theo-moreau', persona: 'productivite', content: 'Forty-eight in seven days is a real production cadence. Tag the finals now.' },
    { id: 'dfc-b049', bySlug: 'hugo-petit', persona: 'securite', content: 'Check that none of those exports landed in a synced public folder by mistake.' },
  ],
  // 15 — ranked 5th focus on code/design
  [
    { id: 'dfc-b050', bySlug: 'manon-girard', persona: 'productivite', content: 'Fifth place for focus intensity is a respectable slot. The files tell the story.' },
    { id: 'dfc-b051', bySlug: 'camille-laurent', persona: 'popularite', content: 'The algorithm rewarding deep focus over noise is rare. Enjoy the ranking.' },
    { id: 'dfc-b052', bySlug: 'lea-bernard', persona: 'popularite', content: 'Code and design files as a combined metric — very you.' },
  ],
  // 16 — organizing diploma files
  [
    { id: 'dfc-b053', bySlug: 'theo-moreau', persona: 'productivite', content: 'Diploma file organization is unglamorous and essential. The structure will pay off at deadline.' },
    { id: 'dfc-b054', bySlug: 'hugo-petit', persona: 'securite', content: 'Keep degree docs out of shared drives until the final submission pass.' },
    { id: 'dfc-b055', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Versioned folders for academic work beat one desktop pile every time.' },
    { id: 'dfc-b056', bySlug: 'manon-girard', persona: 'productivite', content: 'Still figuring it out is honest. The folder taxonomy will click.' },
  ],
  // 17 — design variables beautiful mess
  [
    { id: 'dfc-b057', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'A beautiful mess of variables is still a system. The aesthetic chaos reads intentional.' },
    { id: 'dfc-b058', bySlug: 'lea-bernard', persona: 'popularite', content: 'Making sense of the mess is half the craft. This post documents the process well.' },
    { id: 'dfc-b059', bySlug: 'camille-laurent', persona: 'popularite', content: 'Variables as mood. Accurate caption for the semester.' },
  ],
  // 18 — 47 PNGs visual output
  [
    { id: 'dfc-b060', bySlug: 'manon-girard', persona: 'productivite', content: 'Solid visual output for the week. The PNG count is a credible productivity proxy.' },
    { id: 'dfc-b061', bySlug: 'theo-moreau', persona: 'productivite', content: 'Forty-seven is enough to prove momentum without tipping into noise. Well paced.' },
    { id: 'dfc-b062', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'The feed needed a numbers post that still feels human. This works.' },
  ],
  // 19 — burnout board rank 4
  [
    { id: 'dfc-b063', bySlug: 'lea-bernard', persona: 'popularite', content: 'Burnout board at rank four is darkly funny. The platform really said what it said.' },
    { id: 'dfc-b064', bySlug: 'camille-laurent', persona: 'popularite', content: 'At least the algorithm is honest about the pace. Take the ranking as a nudge.' },
    { id: 'dfc-b065', bySlug: 'hugo-petit', persona: 'securite', content: 'Sustained output without recovery shows up in logs before it shows up in rankings. Plan a reset.' },
  ],
  // 20 — animejs docs
  [
    { id: 'dfc-b066', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Anime.js rabbit holes are a personality type. The docs post is relatable.' },
    { id: 'dfc-b067', bySlug: 'lea-bernard', persona: 'popularite', content: 'Free time spent in documentation is the most designer thing possible. Respect.' },
    { id: 'dfc-b068', bySlug: 'theo-moreau', persona: 'productivite', content: 'Deep-diving docs beats shallow tutorials. The investment will show in the next prototype.' },
    { id: 'dfc-b069', bySlug: 'manon-girard', persona: 'productivite', content: 'Save the snippets you actually use. Future projects will thank you.' },
  ],
  // 21 — design + old regimes vinyl
  [
    { id: 'dfc-b070', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Historical references in design work need careful sourcing. Worth logging where the vinyl scan came from.' },
    { id: 'dfc-b071', bySlug: 'camille-laurent', persona: 'popularite', content: 'The juxtaposition of regimes and UI variables is unexpectedly compelling. Stay weird.' },
    { id: 'dfc-b072', bySlug: 'hugo-petit', persona: 'securite', content: 'If those reference images are licensed, keep the receipt with the project folder.' },
  ],
  // 22 — 50 screenshots week
  [
    { id: 'dfc-b073', bySlug: 'hugo-petit', persona: 'securite', content: 'Fifty screenshots in a week is an evidence habit. Just purge the sensitive ones regularly.' },
    { id: 'dfc-b074', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Screenshot volume correlates with debugging intensity. Expected pattern.' },
    { id: 'dfc-b075', bySlug: 'theo-moreau', persona: 'productivite', content: 'Batch rename before the folder becomes unsearchable. Learned this the hard way.' },
    { id: 'dfc-b076', bySlug: 'manon-girard', persona: 'productivite', content: 'Fifty is a lot of context switching captured. The surprise is warranted.' },
  ],
  // 23 — productivity board rank 3
  [
    { id: 'dfc-b077', bySlug: 'theo-moreau', persona: 'productivite', content: 'Rank 3 on productivity with Adobe in the mix — the toolchain is paying off publicly.' },
    { id: 'dfc-b078', bySlug: 'manon-girard', persona: 'productivite', content: 'Third place is podium energy. The algorithm noticed the file churn.' },
    { id: 'dfc-b079', bySlug: 'camille-laurent', persona: 'popularite', content: 'Leaderboard posts that do not sound boastful are rare. This one threads the needle.' },
    { id: 'dfc-b080', bySlug: 'lea-bernard', persona: 'popularite', content: 'Adobe and assets as a scoring story — very on-theme for this feed.' },
  ],
];
