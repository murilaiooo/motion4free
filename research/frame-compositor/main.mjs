import { compositionFor } from './compositions.mjs';
import { commonGraph, parseGraph } from './graph.mjs';
import { createCanvas } from './canvas.mjs';
import { createThree } from './three.mjs';
import { describeError, AppError } from '../../src/core/errors.ts';
const $ = id => document.getElementById(id);
const cpu = createCanvas($('canvas')); let gpu = null, graph = commonGraph();
let sourceUrl = null, sourceReady = false, revision = 0;
const videos = [$('source-canvas'), $('source-three')];
const status = message => { $('status').textContent = message; };
function render() { revision++; const t = Number($('time').value); if (sourceReady) for (const video of videos) if (Math.abs(video.currentTime - t) > .001) video.currentTime = Math.min(t, video.duration - .001); cpu.renderAt(t); gpu?.renderAt(t); $('clock').textContent = `${t.toFixed(3)} s`; }
function apply(next) { const parsed = parseGraph(next); cpu.setGraph(parsed); gpu?.setGraph(parsed); graph = parsed; $('time').max = graph.duration; $('time').value = Math.min(Number($('time').value), graph.duration); $('graph').value = JSON.stringify(graph, null, 2); render(); }
function failure(error) { status(describeError(error instanceof AppError ? error : new AppError('CRIATIVO_GRAFO'))); }
$('time').addEventListener('input', render);
$('apply').addEventListener('click', () => { try { apply(JSON.parse($('graph').value)); status('Grafo aplicado. Nenhuma avaliação de qualidade foi realizada.'); } catch (error) { failure(error); } });
$('reset').addEventListener('click', () => { try { apply(commonGraph()); } catch (error) { failure(error); } });
$('gpu').addEventListener('click', async () => { $('gpu').disabled = true; try { gpu = await createThree($('three')); gpu.setGraph(graph); render(); $('png-three').disabled = false; status('Adaptador Three carregado; comparações e medições cabem ao QA.'); } catch (error) { gpu?.dispose(); gpu = null; $('gpu').disabled = false; failure(error); } });
for (const kind of ['minimal', 'tech', 'documentary']) $(kind).addEventListener('click', () => {
  try { apply(compositionFor(kind, [0, 1, 2].map(i => $('phrase-' + i).value), Number($('first-boundary').value), Number($('second-boundary').value)));
    status(kind === 'tech' ? 'Diagrama preparado. A geometria 3D exige Three; Canvas mostra projeção plana, sem promessa de equivalência.' : 'Composição preparada; anote as frases e confira os tempos antes da comparação.');
  } catch (error) { failure(error); }
});
$('rights').addEventListener('change', () => { revision++; $('source').disabled = !$('rights').checked; if (!$('rights').checked) { sourceReady = false; videos.forEach(v => { v.removeAttribute('src'); v.load(); }); if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = null; } });
$('source').addEventListener('change', () => { revision++;
  if (!$('rights').checked) return;
  const file = $('source').files?.[0]; if (!file) return;
  sourceReady = false; if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = URL.createObjectURL(file);
  for (const video of videos) { video.onloadedmetadata = () => { if (videos.every(v => v.readyState >= 1 && Number.isFinite(v.duration) && v.duration >= 12)) { sourceReady = true; render(); status('Gravação local vinculada. Nenhum arquivo é enviado ou alterado.'); } else if (video.duration < 12) failure(new AppError('CRIATIVO_MIDIA')); }; video.onerror = () => { sourceReady = false; failure(new AppError('CRIATIVO_MIDIA')); }; video.src = sourceUrl; }
});
function settled(video) {
  if (!video.seeking && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => { clearTimeout(timer); video.removeEventListener('seeked', check); video.removeEventListener('loadeddata', check); video.removeEventListener('error', fail); error ? reject(error) : resolve(); };
    const check = () => { if (!video.seeking && video.readyState >= 2) finish(); };
    const fail = () => finish(new AppError('CRIATIVO_MIDIA'));
    const timer = setTimeout(fail, 5000); video.addEventListener('seeked', check); video.addEventListener('loadeddata', check); video.addEventListener('error', fail); check();
  });
}
for (const key of ['canvas', 'three']) $('png-' + key).addEventListener('click', async () => {
  try {
    render(); const requested = revision, capturedTime = Number($('time').value);
    if (sourceUrl && !sourceReady) throw new AppError('CRIATIVO_MIDIA');
    if (sourceReady) await Promise.all(videos.map(settled));
    if (revision !== requested) throw new AppError('CRIATIVO_MIDIA');
    const output = document.createElement('canvas'); output.width = graph.width; output.height = graph.height;
    const ctx = output.getContext('2d');
    if (sourceReady) { const video = videos[0], scale = Math.max(output.width / video.videoWidth, output.height / video.videoHeight); const w = video.videoWidth * scale, h = video.videoHeight * scale; ctx.drawImage(video, (output.width - w) / 2, (output.height - h) / 2, w, h); }
    ctx.drawImage($(key), 0, 0);
    output.toBlob(blob => { if (!blob) return failure(new AppError('CRIATIVO_GRAFO')); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `${key}-${capturedTime.toFixed(3)}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'image/png');
  } catch (error) { failure(error); }
});
window.addEventListener('pagehide', () => { cpu.dispose(); gpu?.dispose(); videos.forEach(v => { v.removeAttribute('src'); v.load(); }); if (sourceUrl) URL.revokeObjectURL(sourceUrl); });
try { apply(graph); } catch (error) { failure(error); }
