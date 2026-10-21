import { build } from 'vite';

process.env.VITE_FAKE_ASR = '1';
await build();
