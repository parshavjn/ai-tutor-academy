import('@google/genai').then(m => {
  console.log('Keys:', Object.keys(m).join(', '));
  console.log('Default keys:', m.default ? Object.keys(m.default).filter(k => k.startsWith('G') || k === 'Type').join(', ') : 'no default');
}).catch(e => console.error('Error:', e.message));
