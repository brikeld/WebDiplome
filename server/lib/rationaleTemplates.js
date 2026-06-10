/**
 * Per-board fallback rationales used when the LM Studio rationales call fails
 * or returns malformed JSON. selfPhrase is used for the user; clonePhrases[] is
 * cycled by clone index. Clone signals are filled in at runtime ("score N").
 *
 * Pure data — safe to import from client bundles (no Node fs/path).
 */
export const RATIONALE_TEMPLATES = {
  most_productive: {
    selfPhrase: 'shipping more than you sleep',
    clonePhrases: [
      'quietly outproducing the room',
      'mostly creative tools today',
      'late-night work bursts',
      'one big push, then silence',
    ],
  },
  closest_to_burnout: {
    selfPhrase: 'editing files past midnight again',
    clonePhrases: [
      'no social apps in days',
      'work app open all weekend',
      'back-to-back since dawn',
      'inbox at 1am energy',
    ],
  },
  most_likely_change_jobs: {
    selfPhrase: 'tab open on a job board',
    clonePhrases: [
      'glassdoor-curious this week',
      'low file output, high comms',
      'recruiter dm season',
      'updating the resume quietly',
    ],
  },
  ignoring_health: {
    selfPhrase: 'no health app installed and it shows',
    clonePhrases: [
      'café wifi, late-night files',
      'screen time off the chart',
      'fitness app last opened: never',
      'snack runs as cardio',
    ],
  },
  most_secure: {
    selfPhrase: 'vpn on, torrents off',
    clonePhrases: [
      'fewest networks joined',
      'paranoid in a good way',
      'firewall hobbyist energy',
      'never on public wifi',
    ],
  },
  most_socially_isolated: {
    selfPhrase: 'one wifi network, zero pings',
    clonePhrases: [
      'social apps untouched today',
      'lone wolf signal',
      'one chat tab, all week',
      'group chats on mute',
    ],
  },
  most_likely_ghost: {
    selfPhrase: 'reads but doesn\u2019t reply',
    clonePhrases: [
      'comms app open, no sends',
      'last seen yesterday',
      'half-typed messages everywhere',
      'inbox at 0, replies at 0',
    ],
  },
  most_likely_miss_deadline: {
    selfPhrase: 'one more episode before the draft',
    clonePhrases: [
      'tabs open, nothing shipped',
      'deadline tomorrow, vibes today',
      'scrolling through the brief again',
      'almost started, technically',
    ],
  },
  replaced_by_ai_90_days: {
    selfPhrase: 'delegating the thinking to the bots',
    clonePhrases: [
      'copilot does the first pass',
      'prompt engineer by accident',
      'human in the loop, barely',
      'automating themselves out slowly',
    ],
  },
  least_with_expensive_setup: {
    selfPhrase: 'max spec, min output',
    clonePhrases: [
      'studio rig, hobby pace',
      'M-chip, S-tier procrastination',
      'gear envy bait',
      'render farm for one png',
    ],
  },
  procrastinate_right_now: {
    selfPhrase: 'just checking one thing first',
    clonePhrases: [
      'afternoon scroll spiral',
      'inbox zero cosplay',
      'organizing folders instead',
      'one more coffee break',
    ],
  },
  quit_to_countryside: {
    selfPhrase: 'saved a farmhouse listing at 2am',
    clonePhrases: [
      'homestead tab hoarder',
      'job board then cottage pinterest',
      'off-grid curious lately',
      'vanlife research phase',
    ],
  },
  get_hacked_this_month: {
    selfPhrase: 'public wifi and no vpn',
    clonePhrases: [
      'torrent client still installed',
      'password reuse energy',
      'updates snoozed since spring',
      'guest network regular',
    ],
  },
  tracked_by_third_parties: {
    selfPhrase: 'every domain knows their name',
    clonePhrases: [
      'ad pixels everywhere',
      'social logins on everything',
      'browser history is the product',
      'no vpn, full footprint',
    ],
  },
  ignoring_system_warnings: {
    selfPhrase: 'dismissed the dialog three weeks ago',
    clonePhrases: [
      'disk almost full, still downloading',
      'battery service recommended, ignored',
      'filevault off, vibes on',
      'red badge collector',
    ],
  },
  leak_confidential_accident: {
    selfPhrase: 'wrong slack thread, right attachment',
    clonePhrases: [
      'sync folder chaos',
      'screenshot with metadata',
      'reply-all energy',
      'cloud link, no password',
    ],
  },
  messiest_digital_life: {
    selfPhrase: 'downloads folder as filing system',
    clonePhrases: [
      '200 saved wifi networks',
      'installs everything, uses nothing',
      'storage bar permanently red',
      'desktop as inbox',
    ],
  },
  havent_left_house: {
    selfPhrase: 'same home wifi for days',
    clonePhrases: [
      'delivery apps only social life',
      'outside network: not found',
      'couch orbit stable',
      'fresh air last seen: unclear',
    ],
  },
  talking_to_ais_not_people: {
    selfPhrase: 'long chat with claude, zero texts sent',
    clonePhrases: [
      'ai therapist hours',
      'group chat mute, llm unmute',
      'prompts not people',
      'social battery routed to bots',
    ],
  },
  least_sleep: {
    selfPhrase: 'files saved after midnight again',
    clonePhrases: [
      'no sleep app, many late tabs',
      '3am creative burst routine',
      'alarm is a suggestion',
      'circadian rhythm optional',
    ],
  },
};
