import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/core/errors';

const { canEncodeAudio, canEncodeVideo } = vi.hoisted(() => ({
  canEncodeAudio: vi.fn(),
  canEncodeVideo: vi.fn(),
}));
vi.mock('mediabunny', () => ({ canEncodeAudio, canEncodeVideo }));
import { chooseCodecs } from '../src/media/codecs';

beforeEach(() => {
  vi.clearAllMocks();
  canEncodeAudio.mockResolvedValue(true);
  canEncodeVideo.mockImplementation(async (codec: string) => codec === 'avc');
});

describe('issue #2: do not distribute unverified FFmpeg AAC binary', () => {
  it('uses native AAC when output has audio, not the WASM fallback', async () => {
    expect(await chooseCodecs(720, 1280, true)).toEqual({ video: 'avc', degraded: false });
    expect(canEncodeAudio).toHaveBeenCalledWith('aac');
  });
  it('fails explicitly if native AAC is missing and media has audio', async () => {
    canEncodeAudio.mockResolvedValue(false);
    await expect(chooseCodecs(720, 1280, true)).rejects.toMatchObject({
      key: 'SEM_AAC', code: 'M4F-407',
    } satisfies Partial<AppError>);
  });
  it('permits silent MP4 export without an AAC encoder', async () => {
    canEncodeAudio.mockResolvedValue(false);
    expect(await chooseCodecs(720, 1280, false)).toEqual({ video: 'avc', degraded: false });
    expect(canEncodeAudio).not.toHaveBeenCalled();
  });
  it('rejects missing native video codecs with actionable error', async () => {
    canEncodeVideo.mockResolvedValue(false);
    await expect(chooseCodecs(720, 1280, false)).rejects.toMatchObject({ key: 'SEM_ENCODER' });
  });
});
