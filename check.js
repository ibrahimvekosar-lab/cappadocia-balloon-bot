const fs = require('fs');

function convertUtcRangeToTr(raw) {
  const m = raw.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  if (!m) return { validRange: raw, date: '' };
  const startTr = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) + 3 * 3600000);
  const endTr = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[6], +m[7]) + 3 * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  const dStr = `${pad(startTr.getUTCDate())}.${pad(startTr.getUTCMonth() + 1)}.${startTr.getUTCFullYear()}`;
  return {
    validRange: `${dStr} • ${pad(startTr.getUTCHours())}:${pad(startTr.getUTCMinutes())} - ${pad(endTr.getUTCHours())}:${pad(endTr.getUTCMinutes())} (Local)`,
    date: dStr
  };
}

async function run() {
  const prev = JSON.parse(fs.readFileSync('status.json', 'utf8'));
  const res = await fetch('https://kapadokya.edu.tr');
  const html = await res.text();
  const clean = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const match = clean.match(/SEKTÖR A\s+(UÇULUR|UÇULMAZ|BEKLEME|YEŞİL|SARI|KIRMIZI)[\s\S]{0,600}?GÜNCELLEME TARİHİ ve SAATİ\s*:\s*(\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}:\d{2})[\s\S]{0,200}?GEÇERLİ TARİH ve SAATLER\s*:\s*(\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/i);
  if (!match) { console.log('Sector A pattern not matched yet'); return; }

  const rawStatus = match[1].toUpperCase();
  const updatedAt = match[2];
  const { validRange, date } = convertUtcRangeToTr(match[3]);

  let flag = 'GREEN';
  if (rawStatus.includes('BEKLEME') || rawStatus.includes('SARI')) flag = 'YELLOW';
  else if (rawStatus.includes('UÇULMAZ') || rawStatus.includes('KIRMIZI')) flag = 'RED';

  let shouldNotify = false;
  let title = '';
  let body = '';

  if (prev.validRange !== validRange || prev.flag !== flag) {
    if (flag === 'GREEN') {
      shouldNotify = true;
      title = '🟢 Balloon Flights CONFIRMED (Green Flag)';
      body = `Sector A is cleared to fly for ${validRange}. Terrace opens at 05:00 AM!`;
    } else if (flag === 'YELLOW') {
      shouldNotify = true;
      title = '🟡 Balloon Flights ON HOLD (Yellow Flag)';
      body = `Sector A is on standby for ${validRange}. Please wait for the next SHM update.`;
    } else if (flag === 'RED') {
      const sameDayGreenToRed = prev.lastDate === date && prev.flag === 'GREEN';
      if (!sameDayGreenToRed) {
        shouldNotify = true;
        title = '🔴 Balloon Flights CANCELLED (Red Flag)';
        body = `Sector A is declared NO-FLY for ${validRange}.`;
      }
    }
  }

  fs.writeFileSync('status.json', JSON.stringify({ flag, validRange, updatedAt, lastDate: date, shouldNotify, title, body }, null, 2));
  console.log('Updated:', { flag, validRange, shouldNotify });
}

run();
