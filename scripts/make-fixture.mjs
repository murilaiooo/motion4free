// Generate synthetic media on Windows, macOS and Linux without Bash or WSL.
// Requires ffmpeg in PATH. Fixtures are ignored by Git and contain no user media.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = join('e2e', 'fixtures');
mkdirSync(directory, { recursive: true });

function ffmpeg(name, args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-y', '-loglevel', 'error', ...args, join(directory, name)], {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error) {
    console.error('Cannot run ffmpeg. Install FFmpeg and add it to PATH before generating E2E fixtures.');
    throw result.error;
  }
  if (result.status !== 0) throw new Error(`FFmpeg failed to generate ${name} (exit ${result.status}).`);
}

// 6 s with two audible spans: 0–1.4 s and 3.0–4.3 s.
ffmpeg('fala-com-pausas.webm', [
  '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=6',
  '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=6',
  '-filter_complex', "[1:a]volume='if(between(t,0,1.4)+between(t,3.0,4.3),0.5,0)':eval=frame[a]",
  '-map', '0:v', '-map', '[a]', '-c:v', 'libvpx-vp9', '-b:v', '1M',
  '-deadline', 'realtime', '-c:a', 'libopus', '-shortest',
]);

ffmpeg('sem-audio.webm', [
  '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=2',
  '-c:v', 'libvpx-vp9', '-b:v', '500k', '-deadline', 'realtime',
]);

ffmpeg('curto.webm', [
  '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=1',
  '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=1',
  '-c:v', 'libvpx-vp9', '-b:v', '1M', '-deadline', 'realtime',
  '-c:a', 'libopus', '-shortest',
]);

// Distinct color and pitch prove that clip order and sound survive export.
for (const { name, color, size, frequency } of [
  { name: 'clip-red.webm', color: 'red', size: '180x320', frequency: 440 },
  { name: 'clip-blue.webm', color: 'blue', size: '320x180', frequency: 880 },
]) {
  ffmpeg(name, [
    '-f', 'lavfi', '-i', `color=c=${color}:size=${size}:rate=15:duration=1.4`,
    '-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=48000:duration=1.4`,
    '-c:v', 'libvpx-vp9', '-b:v', '220k', '-deadline', 'realtime',
    '-cpu-used', '8', '-c:a', 'libopus', '-shortest',
  ]);
}
console.log('Generated 5 synthetic E2E media fixtures in e2e/fixtures.');
