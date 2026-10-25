/**
 * Local-only deterministic layout test; not an app route or production artifact.
 * Uses the exact ClipMaker and a 12s synthetic video stretched to 145s solely
 * for screenshots. Labels/timestamps are synthetic and are not a real ASR result.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClipMaker, newClipWork, type ClipWork, type ClipItem } from '../src/app/ClipMaker';
import '../src/app/theme.css';
import '../src/app/app.css';
import '../src/app/landing.css';

const params = new URL(location.href).searchParams;
const exportTest = params.get('exporttest') === '1';
const sampleCount = Math.max(0, Math.min(10, Number(params.get('clips') || 6)));
const width = Number(params.get('sourcewidth') || 1920);
const height = Number(params.get('sourceheight') || 1080);
const speech = ['Esse é o começo de uma história que precisa de contexto.',
  'Agora vem a explicação completa, sem cortar a ideia ao meio.',
  'Aqui aparece o problema e a mudança que fizemos.',
  'Esse detalhe ajuda a compreender a informação.',
  'A consequência vale a pena ser demonstrada com clareza.',
  'Por isso a conclusão fecha o raciocínio sem adivinhar dados.'];
const words = Array.from({ length: 433 }, (_, i) => ({
  id: 'w' + i,
  text: speech[i % speech.length]!.split(' ')[i % 8] || 'contexto.',
  start: i * .32,
  end: i * .32 + .25,
}));
const moments: ClipItem[] = Array.from({ length: sampleCount }, (_, i) => {
  const start = exportTest ? (sampleCount === 1 ? 1 : i * 5 + 1) : 4 + i * 12.8;
  const end = exportTest ? (sampleCount === 1 ? 6 : start + 5) : start + 21;
  return {
    uid: 'fixture-' + i,
    checked: i < Math.min(6, sampleCount),
    job: {kind: 'idle'},
    m: {
      id: 'moment-' + i, rank: i + 1, start, end,
      title: i === 1 ? 'A decisão completa: o que mudou, por que isso importa e como aplicar na prática, mesmo começando do zero' :
        ['Como uma ideia se transforma em resultado', 'A melhor parte está na explicação', 'Comece pelo contexto certo', 'Por que o final não pode faltar'][i % 4]!,
      text: speech.slice(i % 3).join(' ').repeat(i === 1 ? 3 : 1),
      score: 90 - i * 3,
      reasons: ['Começa com uma ideia completa', 'Sequência clara de contexto e conclusão'],
      wordCount: 60,
      sourceEvidence: {firstWordId: words[Math.min(words.length-1, Math.round(start/.32))]!.id,
        lastWordId: words[Math.min(words.length-1, Math.round(end/.32))]!.id,
        review: i === 2 ? ['Confirme se o gancho depende do começo do vídeo.'] : [],
        source: i === 1 ? 'ai-context' : 'local-context'},
    },
  };
});
async function mount() {
  const file = await fetch('/e2e/fixtures/long-review.webm').then(r => r.blob())
    .then(blob => new File([blob], 'entrevista-portuguesa-exemplo-2min25.webm', { type: 'video/webm', lastModified: 100 }));
  const validWords = exportTest ? words.filter(word => word.end <= 12.207) : words;
  const analysis = {file, durationSec:exportTest ? 12.207 : 145, width, height, words:validWords, silences:[], energy:new Float32Array(0), energyStep:.02, warnings:[], asrModel:'Whisper base (teste)', reused:false};
  const starter:ClipWork = { ...newClipWork(analysis), length:'curto', count: Math.min(10,sampleCount || 3), items: moments };
  function Fixture() {
    const [work,setWork]=useState<ClipWork>(starter);
    return <ClipMaker work={work} onWork={update=>setWork(prev=>update(prev))}
      onOpenInEditor={()=> { (window as any).__openedInEditor=true; }}
      onBack={()=> { (window as any).__back=true; }}
      onStorage={()=>{}} />;
  }
  createRoot(document.getElementById('root')!).render(<Fixture />);
}
mount().catch(error => {document.body.textContent=String(error)});
