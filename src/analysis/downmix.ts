/**
 * Áudio de vídeo longo (v0.22, ADR-0023). Guardar 1 hora em estéreo na taxa original ocupa ≈ 1,4 GB;
 * aqui cada pedaço decodificado já entra direto num único canal de 16 kHz (o que o Whisper e a análise
 * de silêncio usam), e o original nunca fica inteiro na memória. 1 hora fica em ≈ 230 MB.
 *
 * Redução por média (filtro caixa): cada amostra de saída é a média das amostras de origem que caem
 * nela. Contas com inteiros, para a mesma amostra de origem sempre cair na mesma saída.
 */
export class Mono16kWriter {
  readonly out: Float32Array;

  constructor(
    readonly sampleRate: number,
    durationSec: number,
    readonly rate = 16000,
  ) {
    this.out = new Float32Array(Math.max(0, Math.ceil(durationSec * rate)));
  }

  /** `channels`: dados de cada canal do pedaço (mesmo tamanho); `startSample`: posição da 1ª amostra no original. */
  write(channels: readonly Float32Array[], startSample: number): void {
    const nc = channels.length;
    if (nc === 0) return;
    const n = channels[0]!.length;
    const out = this.out;
    for (let k = 0; k < n; k++) {
      const s = startSample + k;
      if (s < 0) continue;
      const i = Math.floor((s * this.rate) / this.sampleRate);
      if (i >= out.length) break;
      let v = 0;
      for (let c = 0; c < nc; c++) v += channels[c]![k]!;
      out[i]! += v / nc;
    }
  }

  /** Divide cada soma pelo número de amostras que caíram nela e devolve o sinal pronto. */
  finish(): Float32Array {
    const out = this.out;
    for (let i = 0; i < out.length; i++) {
      const count = Math.ceil(((i + 1) * this.sampleRate) / this.rate) - Math.ceil((i * this.sampleRate) / this.rate);
      if (count > 1) out[i]! /= count;
      // origem com taxa menor que 16 kHz: saída sem amostra repete a anterior
      else if (count === 0 && i > 0) out[i] = out[i - 1]!;
    }
    return out;
  }
}
