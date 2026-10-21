import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import { tab } from './ui';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';
const PEDIDO = 'gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos';

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Pedido');
}

type Plan = { style: { captions: { colors: { text: string | null; highlight: string | null } }; emoji: { mode: string; everySec: number } }; scenes: { kind: string; emoji?: string }[]; brief: { hookStyle: string | null; unsupported: string[] } };
const plan = (page: Page) => page.evaluate(() => (window as unknown as { __m4f: { plan: unknown } }).__m4f.plan) as Promise<Plan>;

/** Pixels do quadro atual parecidos com uma cor (tolerância por canal). */
const countColor = (page: Page, rgb: [number, number, number], tol = 40) =>
  page.getByTestId('player-canvas').evaluate(
    (c: HTMLCanvasElement, [r, g, b, t]) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i]! - r!) < t! && Math.abs(d[i + 1]! - g!) < t! && Math.abs(d[i + 2]! - b!) < t!) n++;
      return n;
    },
    [...rgb, tol],
  );

test('pedido do responsável sem IA: legenda verde e amarela, emojis a cada 3 s, gancho criativo, "Ainda não sei fazer"', async ({ page }) => {
  await openVideo(page);
  await expect(page.getByTestId('brief-input')).toBeVisible();
  // para num instante com legenda na tela (≈ 1 s) e mede o verde antes do pedido
  await page.getByTestId('play').click();
  await expect.poll(async () => Number((await page.getByTestId('player-time').textContent())!.split(' s')[0]!.replace(',', '.')), { timeout: 10_000 }).toBeGreaterThan(0.8);
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Assistir');
  const greenBefore = await countColor(page, [0x22, 0xc5, 0x5e], 14);

  await page.getByTestId('brief-input').fill(PEDIDO);
  await page.getByTestId('brief-apply').click();

  const summary = page.getByTestId('brief-summary');
  await expect(summary).toContainText('Apliquei');
  await expect(page.getByTestId('brief-applied')).toContainText('#22C55E');
  await expect(page.getByTestId('brief-applied')).toContainText('#FFD400');
  await expect(page.getByTestId('brief-applied')).toContainText('Emojis a cada 3 s');
  await expect(page.getByTestId('brief-applied')).toContainText('criativo');
  // a área "Ainda não sei fazer" aparece (aqui: entendeu tudo)
  await expect(page.getByTestId('brief-unsupported')).toContainText('Ainda não sei fazer');
  await expect(page.getByTestId('brief-unsupported')).toContainText('entendi tudo');
  await expect(page.getByText('Palavras que não usei')).toHaveCount(0);

  const p = await plan(page);
  expect(p.style.captions.colors.text).toBe('#22C55E');
  expect(p.style.captions.colors.highlight).toBe('#FFD400');
  expect(p.style.emoji).toMatchObject({ mode: 'interval', everySec: 3 });
  expect(p.brief.hookStyle).toBe('criativo');
  expect(p.scenes.filter((s) => s.kind === 'emoji').length).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('scene-summary')).toContainText('emoji');

  // a legenda verde aparece de fato no quadro desenhado
  await expect.poll(() => countColor(page, [0x22, 0xc5, 0x5e], 14), { timeout: 10_000 }).toBeGreaterThan(greenBefore + 300);
  // e nenhum aviso de fonte de emoji
  await expect(page.getByTestId('warning-M4F-805')).toHaveCount(0);
});

test('o que o app ainda não faz aparece em "Ainda não sei fazer" sem impedir o resto', async ({ page }) => {
  await openVideo(page);
  await page.getByTestId('brief-input').fill('legenda verde e musica de fundo');
  await page.getByTestId('brief-apply').click();
  await expect(page.getByTestId('brief-applied')).toContainText('#22C55E');
  await expect(page.getByTestId('brief-unsupported')).toContainText('música');

  // só coisas que o app não faz: aviso M4F-1003 e a lista
  await page.getByTestId('brief-input').fill('efeito 3d e filtro preto e branco');
  await page.getByTestId('brief-apply').click();
  await expect(page.getByTestId('warning-M4F-1003')).toBeVisible();
  await expect(page.getByTestId('warning-M4F-1003')).toContainText('3D');
  // o pedido anterior continua aplicado
  expect((await plan(page)).style.captions.colors.text).toBe('#22C55E');
});

test('escolha do modelo de IA mostra os três tamanhos com download e memória', async ({ page }) => {
  await openVideo(page);
  // v0.27: a aba IA mostra só "IA: … · Alterar"; as opções ficam em Configurações › IA e provedores
  await expect(page.getByTestId('ai-status')).toContainText('só regras');
  await page.getByTestId('ai-change').click();
  await expect(page.getByTestId('settings-section-ia')).toBeVisible();
  await expect(page.getByTestId('ai-rules')).toBeChecked();
  const local = page.getByTestId('ai-local');
  // sem WebGPU no navegador de teste a opção fica desabilitada e explica o porquê
  if (await local.isDisabled()) {
    await expect(page.getByText('Indisponível aqui: este navegador não tem WebGPU')).toBeVisible();
    return;
  }
  await local.check();
  await expect(page.getByTestId('ai-model-padrao')).toBeChecked();
  await expect(page.getByTestId('ai-models')).toContainText('Leve');
  await expect(page.getByTestId('ai-models')).toContainText('Forte');
});

test('com emojis e legenda colorida, o vídeo final é um MP4 real e a fonte dos emojis carrega no Worker', async ({ page }, info) => {
  await openVideo(page);
  await page.getByTestId('brief-input').fill(PEDIDO);
  await page.getByTestId('brief-apply').click();
  await expect(page.getByTestId('brief-applied')).toContainText('#22C55E');
  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  await expect(download).toHaveAttribute('data-export-where', 'worker');
  await expect(page.getByTestId('warning-M4F-805')).toHaveCount(0);
  await expect(page.getByTestId('warning-M4F-801')).toHaveCount(0);
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const path = info.outputPath('pedido-ia.mp4');
  await file.saveAs(path);
  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect((await input.getPrimaryAudioTrack())?.codec).toBe('aac');
  expect(await input.computeDuration()).toBeGreaterThan(2.5);
});
