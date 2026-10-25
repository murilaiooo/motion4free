import { build } from 'vite';
import { generateOfflineShell } from './generate-offline-shell.mjs';

process.env.VITE_FAKE_ASR = '1';
await build();
generateOfflineShell();
