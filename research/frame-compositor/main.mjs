import { commonGraph, parseGraph } from './graph.mjs';
import { createCanvas } from './canvas.mjs';
import { createThree } from './three.mjs';
import { describeError, AppError } from '../../src/core/errors.ts';
const $ = id => document.getElementById(id);
const cpu = createCanvas($('canvas')); let gpu = null, graph = commonGraph();
const status = message => { $('status').textContent = message; };
function render() { const t = Number($('time').value); cpu.renderAt(t); gpu?.renderAt(t); $('clock').textContent = `${t.toFixed(3)} s`; }
function apply(next) { const parsed = parseGraph(next); cpu.setGraph(parsed); gpu?.setGraph(parsed); graph = parsed; $('time').max = graph.duration; $('time').value = Math.min(Number($('time').value), graph.duration); $('graph').value = JSON.stringify(graph, null, 2); render(); }
function failure(error) { status(describeError(error instanceof AppError ? error : new AppError('CRIATIVO_GRAFO'))); }
$('time').addEventListener('input', render);
$('apply').addEventListener('click', () => { try { apply(JSON.parse($('graph').value)); status('Grafo aplicado. Nenhuma avaliação de qualidade foi realizada.'); } catch (error) { failure(error); } });
$('reset').addEventListener('click', () => { try { apply(commonGraph()); } catch (error) { failure(error); } });
$('gpu').addEventListener('click', async () => { $('gpu').disabled = true; try { gpu = await createThree($('three')); gpu.setGraph(graph); render(); $('png-three').disabled = false; status('Adaptador Three carregado; comparações e medições cabem ao QA.'); } catch (error) { gpu?.dispose(); gpu = null; $('gpu').disabled = false; failure(error); } });
for (const key of ['canvas', 'three']) $('png-' + key).addEventListener('click', () => {
  try { render(); $(key).toBlob(blob => { if (!blob) return failure(new AppError('CRIATIVO_GRAFO')); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `${key}-${Number($('time').value).toFixed(3)}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'image/png'); } catch (error) { failure(error); }
});
window.addEventListener('pagehide', () => { cpu.dispose(); gpu?.dispose(); });
try { apply(graph); } catch (error) { failure(error); }
