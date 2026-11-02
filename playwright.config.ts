import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Referências versionadas: comparar também no Brave/Windows, com as mesmas
  // tolerâncias de fontes declaradas nos testes, sem gerar baseline novo por SO.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-linux{ext}',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173',
    // os testes leem os textos em português; sem isto o app abriria em inglês (idioma do navegador de teste)
    locale: 'pt-BR',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run build:e2e && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
