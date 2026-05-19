// src/features/liveScoring/useLiveScoring.js
import { useContext } from 'react';
import { LiveScoringContext } from './LiveScoringContext.jsx';

export function useLiveScoring() {
  const ctx = useContext(LiveScoringContext);
  if (!ctx) throw new Error('useLiveScoring must be used inside LiveScoringProvider');
  return ctx;
}
