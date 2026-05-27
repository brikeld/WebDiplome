import { shufflePhrases } from './generatingPhrases.js';

/** Evocative lines shown while the desktop collector runs — illustrative, not literal. */
export const HARVEST_PHRASES = [
  'Reading wallpaper pixels',
  'Scanning recent downloads',
  'Indexing open applications',
  'Mapping filesystem traces',
  'Capturing screen habits',
  'Profiling keyboard tempo',
  'Harvesting browser tabs',
  'Measuring idle gaps',
  'Cataloguing dock apps',
  'Sampling Wi‑Fi names',
  'Reading system locale',
  'Tracing file access times',
  'Snapshotting desktop clutter',
  'Auditing login items',
  'Sweeping screenshot folder',
  'Parsing calendar density',
  'Counting notification badges',
  'Interrogating the clipboard',
  'Listening to Bluetooth peripherals',
  'Weighing your font choices',
  'Timing app switch rhythm',
  'Scanning Documents folder',
  'Reading machine sleep patterns',
  'Profiling display brightness',
  'Collecting recent images',
  'Tracing Spotlight queries',
  'Measuring dock icon order',
  'Sampling audio output devices',
  'Reading timezone drift',
  'Harvesting menu bar traces',
];

export function shuffledHarvestPhrases() {
  return shufflePhrases(HARVEST_PHRASES);
}
