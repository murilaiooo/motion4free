import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_VERY_HIGH } from 'mediabunny';
import { AppError, describeError } from '../core/errors';

/**
 * Recorta [start, end] do vídeo longo num MP4 pequeno, no próprio navegador (v0.22, ADR-0023).
 * Sempre recodifica (`copy: false`): o arquivo novo começa exatamente em `start`, então as palavras já
 * transcritas encaixam só subtraindo `start`. Qualidade "muito alta" porque o clipe ainda passa pela
 * exportação final. O arquivo longo é lido aos pedaços e nunca é copiado inteiro.
 */
export async function cutRange(file: Blob, start: number, end: number, onProgress: (fraction: number) => void): Promise<Blob> {
  const where = `${start.toFixed(1)}–${end.toFixed(1)} s`;
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      trim: { start, end },
      copy: false,
      video: { quality: QUALITY_VERY_HIGH },
      audio: { quality: QUALITY_HIGH },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(', ');
      throw new AppError('CORTE_FALHOU', `${where}: ${why || 'conversão inválida'}`);
    }
    if (!conversion.utilizedTracks.some((t) => t.type === 'video')) {
      const why = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(', ');
      throw new AppError('CORTE_FALHOU', `${where}: a imagem não pôde ser recodificada (${why || 'sem faixa de vídeo'})`);
    }
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) throw new AppError('CORTE_FALHOU', `${where}: arquivo vazio`);
    return new Blob([buffer], { type: 'video/mp4' });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('CORTE_FALHOU', `${where}: ${describeError(err)}`);
  } finally {
    input.dispose();
  }
}
