import { prepareBlindPackage, readBlindPackage, summarizeBlindReviews } from '../../src/quality/blind-review.ts';
import { AppError, describeError } from '../../src/core/errors.ts';
import { $, readJson, download } from './common.mjs';
$('prepare').addEventListener('click', async () => { $('prepare').disabled = true; try {
  const result = prepareBlindPackage(await readJson($('dataset').files[0]), await readJson($('outputs').files[0]), $('seed').value, crypto.randomUUID());
  download('reviewer-package.json', result.pack); download('PRIVATE-curator-key.json', result.privateKey);
  $('status').textContent = 'Pacotes preparados. Nenhuma avaliação foi realizada; os vídeos não foram renomeados ou enviados.';
} catch (error) { $('status').textContent = describeError(error instanceof AppError ? error : new AppError('QUALIDADE_PACOTE')); }
finally { $('prepare').disabled = false; } });

$('summarize').addEventListener('click', async () => { $('summarize').disabled = true; try {
  const files = [...$('reviews').files]; if (!files.length || files.length > 50) throw new AppError('QUALIDADE_NOTAS');
  const pack = readBlindPackage(await readJson($('report-package').files[0]));
  const reviews = []; for (const file of files) reviews.push(await readJson(file));
  download('PRIVATE-human-review-summary.json', summarizeBlindReviews(pack, reviews));
  $('status').textContent = 'Relatório descritivo preparado. Notas humanas não certificam equivalência profissional; revise falhas e divergências separadamente.';
} catch (error) { $('status').textContent = describeError(error instanceof AppError ? error : new AppError('QUALIDADE_NOTAS')); }
finally { $('summarize').disabled = false; } });
