/**
 * Authored demo content for the seeded local fake users.
 *
 * Pure data (no I/O): the seed pipeline (buildDemoFakeUsers.js) expands
 * `bySlug` comment references into full identities and converts `ageMinutes`
 * into absolute `createdAt` timestamps at seed time.
 *
 * Voice: first person, professional, in-world COMPLIANT tone — the AI
 * ghost-writes each post from harvested signals, exactly like the real
 * generator. Persona keys are French (productivite/securite/popularite).
 */

const CONTENT_PATH = '/videoDEMO/contentFakePeople';

const MIME_BY_EXT = {
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function extname(filename) {
  const match = String(filename || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

/** Complete attachedAsset for a file in public/videoDEMO/contentFakePeople. */
export function assetFor(filename) {
  const ext = extname(filename);
  const kind = ext === '.pdf' ? 'document' : 'image';
  return {
    kind,
    filename,
    mime: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    url: `${CONTENT_PATH}/${encodeURIComponent(filename)}`,
    relativePath: `public${CONTENT_PATH}/${filename}`,
    ...(kind === 'image' ? { visionAnalysed: true } : {}),
  };
}

export const SEEDED_SLUGS = [
  'camille-laurent',
  'theo-moreau',
  'lea-bernard',
  'hugo-petit',
  'manon-girard',
  'lucas-rousseau',
  'chloe-lefevre',
];

/**
 * 14 fixed posts. `ageMinutes` = minutes before "now" at seed time; values are
 * interleaved with the rebased Brikeld posts (45, 80, 115, … see seed script).
 */
export const DEMO_FAKE_POSTS = [
  {
    authorSlug: 'camille-laurent',
    ageMinutes: 30,
    post: {
      persona: 'popularite',
      content: 'Keeping this lake on the desktop this week. Some views do more for the schedule than the schedule does.',
      sentiment: 'positive',
      attachedAsset: assetFor('lake.webp'),
      inferenceChain: [
        { step: 'data', value: 'A high-resolution nature photo was saved to the desktop and reopened three times in two days.', source: 'Recent files' },
        { step: 'classify', value: 'Lifestyle signal', confidence: 'high' },
        { step: 'infer', value: 'The user curates calming imagery as part of a public-facing personality.', confidence: 'medium', isBiased: true, biasNote: 'Assumes a personal photo habit is intended for an audience.' },
        { step: 'generate', value: 'Keeping this lake on the desktop this week. Some views do more for the schedule than the schedule does.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 84, dataPoints: ['lake.webp', 'Desktop folder'] },
        { label: 'Reopen frequency', weight: 61, dataPoints: ['3 opens in 48h'] },
        { label: 'Persona alignment', weight: 44, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'One nature photo, saved to the desktop and revisited several times this week.' },
        { label: 'THE LEAP', detail: 'Repeated viewing of curated scenery reads as image-building, not idle browsing.' },
        { label: 'WHY THIS POST', detail: 'A calm, shareable moment strengthens the profile’s public tone.' },
      ],
      comments: [
        { id: 'dfc-c01', bySlug: 'lea-bernard', persona: 'popularite', content: 'This is exactly the energy the feed needed today. Saving it to my own references.' },
        { id: 'dfc-c02', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Nice shot. Worth checking the photo metadata before posting location-tagged scenery, though.' },
      ],
    },
  },
  {
    authorSlug: 'theo-moreau',
    ageMinutes: 60,
    post: {
      persona: 'productivite',
      content: 'Refreshed the CV template tonight. Not job hunting — just keeping the paperwork as sharp as the portfolio.',
      sentiment: 'positive',
      attachedAsset: assetFor('cv-template.pdf'),
      inferenceChain: [
        { step: 'data', value: 'A CV template PDF was edited at 23:40, the third edit session this month.', source: 'Recent documents' },
        { step: 'classify', value: 'Career maintenance', confidence: 'high' },
        { step: 'infer', value: 'The user maintains employment-readiness documents outside working hours.', confidence: 'medium', isBiased: true, biasNote: 'Late-night document edits are treated as ambition rather than routine admin.' },
        { step: 'generate', value: 'Refreshed the CV template tonight. Not job hunting — just keeping the paperwork as sharp as the portfolio.' },
      ],
      ingredients: [
        { label: 'Document evidence', weight: 88, dataPoints: ['cv-template.pdf', '3 edit sessions'] },
        { label: 'Time-of-day pattern', weight: 57, dataPoints: ['23:40 edit timestamp'] },
        { label: 'Persona alignment', weight: 41, dataPoints: ['Productivity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'Recurring late-night edits to a CV template across the month.' },
        { label: 'THE LEAP', detail: 'Consistent upkeep of career documents signals discipline worth broadcasting.' },
        { label: 'WHY THIS POST', detail: 'Framing the habit as readiness, not restlessness, keeps the score trending up.' },
      ],
      comments: [
        { id: 'dfc-c03', bySlug: 'manon-girard', persona: 'productivite', content: 'The quiet discipline of keeping documents current is underrated. Respect.' },
        { id: 'dfc-c04', bySlug: 'camille-laurent', persona: 'popularite', content: 'Sharp paperwork, sharp portfolio — the order of operations checks out.' },
        { id: 'dfc-c05', bySlug: 'hugo-petit', persona: 'securite', content: 'Just make sure the version history does not keep old addresses in it.' },
      ],
    },
  },
  {
    authorSlug: 'lea-bernard',
    ageMinutes: 95,
    post: {
      persona: 'popularite',
      content: 'Paris moved from the moodboard to the itinerary folder today. The line between planning and committing is officially crossed.',
      sentiment: 'positive',
      attachedAsset: assetFor('street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif'),
      inferenceChain: [
        { step: 'data', value: 'A Paris street photo was moved from a references folder into a folder named after upcoming dates.', source: 'File system activity' },
        { step: 'classify', value: 'Travel intent', confidence: 'high' },
        { step: 'infer', value: 'The user is converting aspirational content into an actual plan.', confidence: 'high' },
        { step: 'generate', value: 'Paris moved from the moodboard to the itinerary folder today. The line between planning and committing is officially crossed.' },
      ],
      ingredients: [
        { label: 'Folder movement', weight: 90, dataPoints: ['references → itinerary'] },
        { label: 'Visual evidence', weight: 63, dataPoints: ['Eiffel Tower street photo'] },
        { label: 'Persona alignment', weight: 47, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A travel reference image reorganized into a dated planning folder.' },
        { label: 'THE LEAP', detail: 'Moving a file between folders is small; what it says about intent is not.' },
        { label: 'WHY THIS POST', detail: 'Announcing a plan publicly turns file management into social momentum.' },
      ],
      comments: [
        { id: 'dfc-c06', bySlug: 'camille-laurent', persona: 'popularite', content: 'The itinerary folder is where dreams either happen or quietly expire. Rooting for this one.' },
      ],
    },
  },
  {
    authorSlug: 'hugo-petit',
    ageMinutes: 130,
    post: {
      persona: 'securite',
      content: 'Documented the system state before touching a single setting. A timestamped screenshot has settled more arguments than any memory ever will.',
      sentiment: 'negative',
      attachedAsset: assetFor('Screenshot 2026-06-29 at 11.24.24.png'),
      inferenceChain: [
        { step: 'data', value: 'A dated system screenshot was captured minutes before configuration files changed.', source: 'Screenshots folder' },
        { step: 'classify', value: 'Audit behavior', confidence: 'high' },
        { step: 'infer', value: 'The user keeps evidence trails before making system changes.', confidence: 'high' },
        { step: 'generate', value: 'Documented the system state before touching a single setting. A timestamped screenshot has settled more arguments than any memory ever will.' },
      ],
      ingredients: [
        { label: 'Screenshot evidence', weight: 86, dataPoints: ['Screenshot 2026-06-29 at 11.24.24.png'] },
        { label: 'Change correlation', weight: 66, dataPoints: ['Config edits within 10 minutes'] },
        { label: 'Persona alignment', weight: 52, dataPoints: ['Security-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A screenshot taken immediately before system configuration changes.' },
        { label: 'THE LEAP', detail: 'Preemptive documentation is the signature of someone who expects to be questioned.' },
        { label: 'WHY THIS POST', detail: 'Caution is a reputation. This post files it publicly.' },
      ],
      comments: [
        { id: 'dfc-c07', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Screenshot-before-change should be mandatory practice. The audit trail thanks you.' },
        { id: 'dfc-c08', bySlug: 'theo-moreau', persona: 'productivite', content: 'Adopting this immediately. Cheaper than the argument it prevents.' },
      ],
    },
  },
  {
    authorSlug: 'manon-girard',
    ageMinutes: 160,
    post: {
      persona: 'productivite',
      content: 'Invoices numbered, filed, and archived before noon. Small ritual, but the books have never looked this calm.',
      sentiment: 'positive',
      attachedAsset: assetFor('invoice-number.jpeg'),
      inferenceChain: [
        { step: 'data', value: 'An invoice scan was renamed to a sequential numbering scheme and moved into an archive folder.', source: 'Recent files' },
        { step: 'classify', value: 'Financial admin', confidence: 'high' },
        { step: 'infer', value: 'The user maintains a disciplined invoicing routine.', confidence: 'high' },
        { step: 'generate', value: 'Invoices numbered, filed, and archived before noon. Small ritual, but the books have never looked this calm.' },
      ],
      ingredients: [
        { label: 'Document evidence', weight: 85, dataPoints: ['invoice-number.jpeg'] },
        { label: 'Naming discipline', weight: 64, dataPoints: ['Sequential rename pattern'] },
        { label: 'Persona alignment', weight: 49, dataPoints: ['Productivity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'An invoice scan renamed and archived using a consistent numbering scheme.' },
        { label: 'THE LEAP', detail: 'Tidy financial files imply a tidy operation behind them.' },
        { label: 'WHY THIS POST', detail: 'Order is a flex when it is verifiable.' },
      ],
      comments: [
        { id: 'dfc-c09', bySlug: 'theo-moreau', persona: 'productivite', content: 'Archived before noon is the part that hurts. Well played.' },
        { id: 'dfc-c10', bySlug: 'hugo-petit', persona: 'securite', content: 'Consider keeping the archive encrypted — invoice scans carry more personal data than people think.' },
      ],
    },
  },
  {
    authorSlug: 'lucas-rousseau',
    ageMinutes: 200,
    post: {
      persona: 'securite',
      content: 'Weekly backup verified, checksums matched, one redundant copy off-site. Boring is exactly how recovery day should feel.',
      sentiment: 'positive',
      inferenceChain: [
        { step: 'data', value: 'A scheduled backup job completed and a verification pass ran against the archive.', source: 'System diagnostics' },
        { step: 'classify', value: 'Backup hygiene', confidence: 'high' },
        { step: 'infer', value: 'The user treats data protection as routine rather than emergency response.', confidence: 'high' },
        { step: 'generate', value: 'Weekly backup verified, checksums matched, one redundant copy off-site. Boring is exactly how recovery day should feel.' },
      ],
      ingredients: [
        { label: 'System diagnostics', weight: 89, dataPoints: ['Backup job log', 'Checksum pass'] },
        { label: 'Recurrence', weight: 71, dataPoints: ['Weekly schedule kept 6 weeks running'] },
        { label: 'Persona alignment', weight: 55, dataPoints: ['Security-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A completed backup job followed by an integrity verification pass.' },
        { label: 'THE LEAP', detail: 'Consistency in invisible chores is the strongest security signal available.' },
        { label: 'WHY THIS POST', detail: 'Publishing the routine makes reliability part of the public record.' },
      ],
      comments: [
        { id: 'dfc-c11', bySlug: 'hugo-petit', persona: 'securite', content: 'Checksum verification is the step everyone skips. Not skipping it is the whole job.' },
      ],
    },
  },
  {
    authorSlug: 'chloe-lefevre',
    ageMinutes: 240,
    post: {
      persona: 'popularite',
      content: 'The studio’s most reliable colleague reported for duty again. Productivity impact debatable, morale impact undeniable.',
      sentiment: 'positive',
      attachedAsset: assetFor('cat.jpg'),
      inferenceChain: [
        { step: 'data', value: 'A pet photo was saved to the creator assets folder alongside campaign files.', source: 'Recent images' },
        { step: 'classify', value: 'Engagement asset', confidence: 'high' },
        { step: 'infer', value: 'The user blends personal warmth into a public content strategy.', confidence: 'medium', isBiased: true, biasNote: 'Assumes a pet photo in a work folder is strategic rather than accidental.' },
        { step: 'generate', value: 'The studio’s most reliable colleague reported for duty again. Productivity impact debatable, morale impact undeniable.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 82, dataPoints: ['cat.jpg', 'Creator assets folder'] },
        { label: 'Folder context', weight: 58, dataPoints: ['Stored beside campaign files'] },
        { label: 'Persona alignment', weight: 51, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A pet photo filed with professional creator assets.' },
        { label: 'THE LEAP', detail: 'When personal warmth is stored next to campaign files, it is part of the brand.' },
        { label: 'WHY THIS POST', detail: 'Reliable engagement content keeps the popularity score compounding.' },
      ],
      comments: [
        { id: 'dfc-c12', bySlug: 'camille-laurent', persona: 'popularite', content: 'The most consistent performer on this entire feed, and it is not close.' },
        { id: 'dfc-c13', bySlug: 'manon-girard', persona: 'productivite', content: 'Filing this under sustainable content strategy. The colleague deserves a raise.' },
      ],
    },
  },
  {
    authorSlug: 'camille-laurent',
    ageMinutes: 280,
    post: {
      persona: 'productivite',
      content: 'Final revision of the trip document is done. Three drafts, one decision, zero loose ends before the weekend.',
      sentiment: 'positive',
      attachedAsset: assetFor('35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf'),
      inferenceChain: [
        { step: 'data', value: 'A PDF was saved three times in one evening, with the final version renamed to include "final".', source: 'Recent documents' },
        { step: 'classify', value: 'Deadline completion', confidence: 'high' },
        { step: 'infer', value: 'The user closes work items decisively rather than letting drafts accumulate.', confidence: 'medium' },
        { step: 'generate', value: 'Final revision of the trip document is done. Three drafts, one decision, zero loose ends before the weekend.' },
      ],
      ingredients: [
        { label: 'Document evidence', weight: 83, dataPoints: ['35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf'] },
        { label: 'Revision cadence', weight: 62, dataPoints: ['3 saves in one evening'] },
        { label: 'Persona alignment', weight: 40, dataPoints: ['Cross-persona: productivity signal on a popularity profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'Three rapid revisions of one document ending in a decisive final save.' },
        { label: 'THE LEAP', detail: 'Fast iteration with a clean ending reads as competence, not chaos.' },
        { label: 'WHY THIS POST', detail: 'A completed task is worth more publicly than three pending ones.' },
      ],
      comments: [
        { id: 'dfc-c14', bySlug: 'lea-bernard', persona: 'popularite', content: 'Zero loose ends before a weekend should be a protected category of achievement.' },
      ],
    },
  },
  {
    authorSlug: 'theo-moreau',
    ageMinutes: 320,
    post: {
      persona: 'popularite',
      content: 'Lunch documentation reached presentation quality today. At this rate the camera roll qualifies as a menu.',
      sentiment: 'positive',
      attachedAsset: assetFor('2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg'),
      inferenceChain: [
        { step: 'data', value: 'A high-resolution food photo was saved to downloads and edited within the hour.', source: 'Recent images' },
        { step: 'classify', value: 'Lifestyle content', confidence: 'high' },
        { step: 'infer', value: 'The user invests editing effort into casual moments, suggesting an audience in mind.', confidence: 'medium', isBiased: true, biasNote: 'Editing a photo does not necessarily mean it was made to be shared.' },
        { step: 'generate', value: 'Lunch documentation reached presentation quality today. At this rate the camera roll qualifies as a menu.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 80, dataPoints: ['Tomato dish photo'] },
        { label: 'Edit effort', weight: 60, dataPoints: ['Edited within 1 hour of saving'] },
        { label: 'Persona alignment', weight: 38, dataPoints: ['Cross-persona: popularity signal on a productivity profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A food photo downloaded and promptly edited to a polished standard.' },
        { label: 'THE LEAP', detail: 'Nobody color-corrects lunch for themselves alone.' },
        { label: 'WHY THIS POST', detail: 'A light lifestyle post rounds out an otherwise all-work profile.' },
      ],
      comments: [
        { id: 'dfc-c15', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'The composition on this is genuinely strong. The menu pivot is available whenever you want it.' },
        { id: 'dfc-c16', bySlug: 'camille-laurent', persona: 'popularite', content: 'Presentation-quality lunch is a lifestyle statement and I support it entirely.' },
      ],
    },
  },
  {
    authorSlug: 'lea-bernard',
    ageMinutes: 360,
    post: {
      persona: 'popularite',
      content: 'New addition to the visual archive, no caption required. The folder is starting to tell its own story.',
      sentiment: 'positive',
      attachedAsset: assetFor('a49d7df20838811b3eee69a977e57c05.webp'),
      inferenceChain: [
        { step: 'data', value: 'An image with a hashed filename was saved into a curated references folder.', source: 'Recent images' },
        { step: 'classify', value: 'Curation habit', confidence: 'medium' },
        { step: 'infer', value: 'The user builds visual collections with deliberate consistency.', confidence: 'medium' },
        { step: 'generate', value: 'New addition to the visual archive, no caption required. The folder is starting to tell its own story.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 78, dataPoints: ['References folder image'] },
        { label: 'Collection growth', weight: 65, dataPoints: ['12 additions this month'] },
        { label: 'Persona alignment', weight: 50, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'Steady growth of a curated image collection.' },
        { label: 'THE LEAP', detail: 'A maintained archive is taste made visible.' },
        { label: 'WHY THIS POST', detail: 'Signaling curation keeps the profile’s aesthetic credibility current.' },
      ],
      comments: [
        { id: 'dfc-c17', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'A folder that tells its own story is the highest form of moodboard. Impeccable.' },
      ],
    },
  },
  {
    authorSlug: 'hugo-petit',
    ageMinutes: 400,
    post: {
      persona: 'productivite',
      content: 'Cleared forty-one files out of downloads this morning. What remains has a name, a place, and a reason to exist.',
      sentiment: 'positive',
      inferenceChain: [
        { step: 'data', value: 'The downloads folder shrank from 47 items to 6 in a single session.', source: 'File system activity' },
        { step: 'classify', value: 'Digital hygiene', confidence: 'high' },
        { step: 'infer', value: 'The user performs periodic, decisive cleanup rather than continuous accumulation.', confidence: 'high' },
        { step: 'generate', value: 'Cleared forty-one files out of downloads this morning. What remains has a name, a place, and a reason to exist.' },
      ],
      ingredients: [
        { label: 'File system activity', weight: 87, dataPoints: ['47 → 6 items in downloads'] },
        { label: 'Session focus', weight: 59, dataPoints: ['Single 25-minute cleanup session'] },
        { label: 'Persona alignment', weight: 42, dataPoints: ['Cross-persona: productivity signal on a security profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A downloads folder reduced to essentials in one focused session.' },
        { label: 'THE LEAP', detail: 'Ruthless file triage implies the same standard applies elsewhere.' },
        { label: 'WHY THIS POST', detail: 'Order earns trust, and trust is a score.' },
      ],
      comments: [
        { id: 'dfc-c18', bySlug: 'manon-girard', persona: 'productivite', content: '"A name, a place, and a reason to exist" is now my filing standard. Thank you.' },
        { id: 'dfc-c19', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Fewer stray files, smaller attack surface. Cleanup is security work in disguise.' },
      ],
    },
  },
  {
    authorSlug: 'manon-girard',
    ageMinutes: 440,
    post: {
      persona: 'popularite',
      content: 'Found the cover frame for the next client deck. Sometimes the right stock image does half the storytelling before slide two.',
      sentiment: 'positive',
      attachedAsset: assetFor('gettyimages-586890581.avif'),
      inferenceChain: [
        { step: 'data', value: 'A licensed stock image was downloaded into an active client project folder.', source: 'Recent images' },
        { step: 'classify', value: 'Presentation asset', confidence: 'high' },
        { step: 'infer', value: 'The user invests in visual polish for client-facing work.', confidence: 'high' },
        { step: 'generate', value: 'Found the cover frame for the next client deck. Sometimes the right stock image does half the storytelling before slide two.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 81, dataPoints: ['Stock photo in project folder'] },
        { label: 'Project context', weight: 67, dataPoints: ['Active client deck folder'] },
        { label: 'Persona alignment', weight: 39, dataPoints: ['Cross-persona: popularity signal on a productivity profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A stock image acquisition tied to an active client deliverable.' },
        { label: 'THE LEAP', detail: 'Buying the right frame early means the narrative is already decided.' },
        { label: 'WHY THIS POST', detail: 'Visible craft in client work reads well far beyond the client.' },
      ],
      comments: [
        { id: 'dfc-c20', bySlug: 'theo-moreau', persona: 'productivite', content: 'Cover slide locked before the content exists — that is real confidence in the outline.' },
      ],
    },
  },
  {
    authorSlug: 'lucas-rousseau',
    ageMinutes: 470,
    post: {
      persona: 'securite',
      content: 'Found a file in downloads I could not account for. It sits in quarantine until its story checks out — no exceptions.',
      sentiment: 'negative',
      attachedAsset: assetFor('47f85bb0022f16eadee6761b7c7d9b06.webp'),
      inferenceChain: [
        { step: 'data', value: 'An image with a hashed filename and no browser download record appeared in downloads.', source: 'Downloads folder' },
        { step: 'classify', value: 'Provenance anomaly', confidence: 'medium' },
        { step: 'infer', value: 'The user audits unexplained files instead of ignoring them.', confidence: 'high' },
        { step: 'generate', value: 'Found a file in downloads I could not account for. It sits in quarantine until its story checks out — no exceptions.' },
      ],
      ingredients: [
        { label: 'Provenance gap', weight: 88, dataPoints: ['No matching browser history entry'] },
        { label: 'Filename pattern', weight: 62, dataPoints: ['Hashed filename, no extension context'] },
        { label: 'Persona alignment', weight: 56, dataPoints: ['Security-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'An unexplained file with no download trail.' },
        { label: 'THE LEAP', detail: 'Files without provenance are guilty until proven boring.' },
        { label: 'WHY THIS POST', detail: 'Public vigilance is the security persona’s best currency.' },
      ],
      comments: [
        { id: 'dfc-c21', bySlug: 'hugo-petit', persona: 'securite', content: 'Quarantine-first is the correct posture. Most people just rename these and move on.' },
        { id: 'dfc-c22', bySlug: 'lea-bernard', persona: 'popularite', content: 'The suspense of a mystery file is honestly better than most series right now.' },
      ],
    },
  },
  {
    authorSlug: 'chloe-lefevre',
    ageMinutes: 500,
    post: {
      persona: 'popularite',
      content: 'Closing the week with the strangest file in the archive. Taste is a portfolio too, and this one keeps earning its place.',
      sentiment: 'positive',
      attachedAsset: assetFor('637627ca9eebde45ae5f394c_Underwater-Nun.jpeg'),
      inferenceChain: [
        { step: 'data', value: 'An unconventional art image was kept through two folder cleanups over three months.', source: 'File system history' },
        { step: 'classify', value: 'Taste signal', confidence: 'medium' },
        { step: 'infer', value: 'The user curates for distinctiveness, not just polish.', confidence: 'medium', isBiased: true, biasNote: 'Keeping one unusual file is treated as a curatorial statement.' },
        { step: 'generate', value: 'Closing the week with the strangest file in the archive. Taste is a portfolio too, and this one keeps earning its place.' },
      ],
      ingredients: [
        { label: 'Retention across cleanups', weight: 79, dataPoints: ['Survived 2 folder purges'] },
        { label: 'Visual distinctiveness', weight: 68, dataPoints: ['Unconventional subject matter'] },
        { label: 'Persona alignment', weight: 53, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'One unusual image deliberately kept while ordinary files were purged.' },
        { label: 'THE LEAP', detail: 'What survives a cleanup says more than what gets added.' },
        { label: 'WHY THIS POST', detail: 'Distinctive taste differentiates a profile in a feed of polish.' },
      ],
      comments: [
        { id: 'dfc-c23', bySlug: 'lea-bernard', persona: 'popularite', content: 'Surviving two purges makes it a permanent collection piece. The museum is real.' },
        { id: 'dfc-c24', bySlug: 'camille-laurent', persona: 'popularite', content: 'This image has more lore than most accounts. Correct decision to keep it.' },
      ],
    },
  },
];

/**
 * Comments injected onto Brikeld's newest posts (index-aligned: set 0 → his
 * newest post, set 1 → second newest, …).
 */
export const BRIKELD_POST_COMMENTS = [
  [
    { id: 'dfc-b01', bySlug: 'theo-moreau', persona: 'productivite', content: 'The tab count is a lifestyle, not a problem. The output speaks for itself.' },
    { id: 'dfc-b02', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Worth a browser session backup at that tab volume — one crash and the whole workspace is archaeology.' },
  ],
  [
    { id: 'dfc-b03', bySlug: 'camille-laurent', persona: 'popularite', content: 'This is the most relatable thing on the feed this week.' },
  ],
  [
    { id: 'dfc-b04', bySlug: 'manon-girard', persona: 'productivite', content: 'The pace here is genuinely impressive. Save some throughput for the rest of us.' },
    { id: 'dfc-b05', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Documenting the grind counts as content. Keep going.' },
  ],
];