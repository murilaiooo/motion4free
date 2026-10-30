import { REVIEW_AXES, readBlindPackage, reviewerOrder, readBlindReview } from '../../src/quality/blind-review.ts';
import { AppError, describeError } from '../../src/core/errors.ts';
import { $, readJson, download, element } from './common.mjs';
let pack, order = [], index = 0, activeUrl = null, identity = null; const ratings = new Map(), preferences = new Map();
function error(err) { $('status').textContent = describeError(err instanceof AppError ? err : new AppError('QUALIDADE_NOTAS')); }
function field(parent, label, tag, id, attributes = {}) { const wrap = element('label', label + ' '), input = element(tag); input.id = id; Object.assign(input, attributes); wrap.append(input); parent.append(wrap); return input; }
function show() {
  if (activeUrl) URL.revokeObjectURL(activeUrl); activeUrl = null; $('video').removeAttribute('src'); $('video').load();
  const variant = pack.variants.find(v => v.id === order[index]), group = pack.cases.find(c => c.id === variant.caseId);
  $('case').replaceChildren(element('h2', `${index + 1}/${order.length} · ${variant.id}`), element('p', variant.brief));
  const file = [...$('files').files].find(file => file.name === variant.file);
  if (file) { activeUrl = URL.createObjectURL(file); $('video').src = activeUrl; $('video').hidden = false; } else { $('video').hidden = true; $('case').append(element('p', `Arquivo cego ausente: ${variant.file}. Marque abstenção ou selecione o arquivo correto.`)); }
  const form = $('form'); form.replaceChildren(); form.hidden = false;
  field(form, 'Não consigo avaliar esta versão', 'input', 'abstain', {type:'checkbox', checked: !file});
  field(form, 'Motivo da abstenção', 'textarea', 'abstain-reason', {maxLength:500});
  for (const [axis, title] of Object.entries(REVIEW_AXES)) {
    const row = element('fieldset'); row.append(element('legend', title)); const score = field(row, 'Nota 0–5 (sem valor padrão)', 'select', `score-${axis}`);
    const empty = element('option', 'Escolha'); empty.value = ''; score.append(empty);
    for (let n = 0; n <= 5; n++) { const option = element('option', String(n)); option.value = String(n); score.append(option); }
    field(row, 'Tempo do exemplo (s)', 'input', `time-${axis}`, {type:'number', min:0, max:14400, step:.01}); field(row, 'Evidência / justificativa', 'textarea', `note-${axis}`, {maxLength:500}); form.append(row);
  }
  field(form, 'Erro severo (um por versão neste formulário; detalhes adicionais na nota)', 'select', 'severe');
  for (const kind of ['', 'factual-inversion','invented-claim','clipped-word','disconnected-motion','unreadable','technical-failure']) { const option = element('option', kind || 'Nenhum registrado'); option.value = kind; $('severe').append(option); }
  field(form, 'Tempo do erro severo', 'input', 'severe-time', {type:'number', min:0, max:14400, step:.01}); field(form, 'Descrição do erro severo', 'textarea', 'severe-note', {maxLength:500});
  const preference = field(form, 'Preferência provisória entre versões deste conteúdo (pode revisar nas próximas)', 'select', 'preference');
  for (const id of ['', 'abstain', ...group.variantIds]) { const option = element('option', id || 'Escolha após comparar'); option.value = id; preference.append(option); }
  if (preferences.has(group.id)) preference.value = preferences.get(group.id).variantId ?? 'abstain';
  field(form, 'Justificativa da preferência / abstenção', 'textarea', 'preference-reason', {maxLength:500, value:preferences.get(group.id)?.reason ?? ''});
  const saved = ratings.get(variant.id);
  if (saved?.status === 'abstain') { $('abstain').checked = true; $('abstain-reason').value = saved.reason; }
  if (saved?.status === 'rated') {
    $('abstain').checked = false;
    for (const [axis, entry] of Object.entries(saved.scores)) { $('score-'+axis).value = entry.score; $('time-'+axis).value = entry.second; $('note-'+axis).value = entry.note; }
    if (saved.severe[0]) { $('severe').value = saved.severe[0].kind; $('severe-time').value = saved.severe[0].second; $('severe-note').value = saved.severe[0].note; }
  }
  $('previous').disabled = index === 0;
  $('save').disabled = false; $('save').textContent = index + 1 === order.length ? 'Guardar última resposta' : 'Guardar resposta e avançar';
}
$('start').addEventListener('click', async () => { try { const candidate = readBlindPackage(await readJson($('package').files[0])); const nextOrder = reviewerOrder(candidate, $('reviewer').value); identity = {reviewerId:$('reviewer').value, expertise:$('expertise').value}; pack = candidate; order = nextOrder; index = 0; ratings.clear(); preferences.clear(); $('export').disabled = true; show(); $('status').textContent = 'Rodada iniciada. Notas e preferências ficam só nesta aba até baixar JSON.'; } catch(err) { error(err); } });
$('save').addEventListener('click', () => { try {
  const variant = pack.variants.find(v => v.id === order[index]); let rating;
  if ($('abstain').checked) { const reason = $('abstain-reason').value.trim(); if (!reason) throw new AppError('QUALIDADE_NOTAS'); rating = {status:'abstain',variantId:variant.id,reason}; }
  else {
    if (!$('video').src || $('video').readyState < 1) throw new AppError('QUALIDADE_NOTAS');
    const scores = {}; for (const axis of Object.keys(REVIEW_AXES)) { const score = $('score-'+axis).value, time = $('time-'+axis).value, note = $('note-'+axis).value.trim(); if (score === '' || time === '' || !note || Number(time) > $('video').duration) throw new AppError('QUALIDADE_NOTAS'); scores[axis] = {score:Number(score),second:Number(time),note}; }
    const severe = []; if ($('severe').value) { if ($('severe-time').value === '' || !$('severe-note').value.trim() || Number($('severe-time').value) > $('video').duration) throw new AppError('QUALIDADE_NOTAS'); severe.push({kind:$('severe').value,second:Number($('severe-time').value),note:$('severe-note').value}); }
    rating = {status:'rated',variantId:variant.id,scores,severe};
  }
  ratings.set(variant.id, rating);
  const preference = $('preference').value, reason = $('preference-reason').value.trim();
  if (preference && reason) preferences.set(variant.caseId, {caseId:variant.caseId,variantId:preference === 'abstain' ? null : preference,reason});
  if (index + 1 < order.length) { index++; show(); } else { $('save').disabled = true; $('export').disabled = false; $('status').textContent = 'Respostas guardadas na aba. Baixar exige todos os eixos ou abstenção, e preferência justificada para cada conteúdo.'; }
} catch(err) { error(err); } });
$('previous').addEventListener('click', () => { if (index > 0) { index--; show(); } });
$('export').addEventListener('click', () => { try { const review = readBlindReview({version:1,...identity,ratings:[...ratings.values()],preferences:[...preferences.values()]},pack); download(`review-${identity.reviewerId}.json`,review); } catch(err) { error(err); } });
window.addEventListener('pagehide', () => { $('video').removeAttribute('src'); $('video').load(); if (activeUrl) URL.revokeObjectURL(activeUrl); ratings.clear(); preferences.clear(); });
