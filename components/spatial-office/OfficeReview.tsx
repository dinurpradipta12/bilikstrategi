'use client';

import { useState } from 'react';
import { Radio, Shapes } from 'lucide-react';
import OfficeDashboard from './OfficeDashboard';

export default function OfficeReview() {
  const [game, setGame] = useState(true);
  const [mode, setMode] = useState<'live' | 'demo'>('demo');
  return <div className={game ? 'office-review-game' : ''}>
    <div className="office-review-modes" role="group" aria-label="Sumber data kantor">
      <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}><Radio size={16} /><span>Data tim langsung<small>Mengikuti check-in / checkout asli</small></span></button>
      <button type="button" aria-pressed={mode === 'demo'} onClick={() => setMode('demo')}><Shapes size={16} /><span>Simulasi desain<small>Nama contoh untuk review tata ruang</small></span></button>
      <button type="button" aria-pressed={game} onClick={() => setGame(value => !value)}>{game ? 'Tampilan review' : 'Tampilan game'}</button>
    </div>
    <OfficeDashboard key={mode} demo={mode === 'demo'} immersive={game} />
  </div>;
}
