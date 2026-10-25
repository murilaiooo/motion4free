import { useEffect, useState } from 'react';
import type { ClipItem } from './ClipMaker';
import type { OutputFormatId } from '../core/formats';

/** Lightweight, on-device source frames. One decoder; no remote request and no saved project data. */
export function useClipStills(videoUrl: string, items: readonly ClipItem[], format: OutputFormatId): Record<string, string> {
  const [stills, setStills] = useState<Record<string, string>>({});
  const anchors = items.map(it => [it.uid, (it.m.start + it.m.end) / 2] as const);
  const key = JSON.stringify(anchors);
  useEffect(() => {
    setStills({});
    // An empty result list has no frames to extract: avoid starting a decoder.
    if (anchors.length === 0) return;
    let cancelled = false;
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.src = videoUrl;
    const cover = document.createElement('canvas');
    // These small JPEGs remain in React state only; canvas is not uploaded or persisted.
    const size = format === 'vertical' ? [114, 202] : format === 'quadrado' ? [160, 160] : [202, 114];
    cover.width = size[0]!;
    cover.height = size[1]!;
    const ctx = cover.getContext('2d');
    const once = (name: string, timeout: number) => new Promise<boolean>(resolve => {
      if (cancelled) { resolve(false); return; }
      let completed = false;
      const finish = (ok: boolean) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        el.removeEventListener(name, done);
        el.removeEventListener('error', failed);
        resolve(ok);
      };
      const done = () => finish(true);
      const failed = () => finish(false);
      const timer = setTimeout(() => finish(false), timeout);
      el.addEventListener(name, done, { once: true });
      el.addEventListener('error', failed, { once: true });
    });
    void (async () => {
      if (!ctx) return;
      if (el.readyState < 1 && !await once('loadedmetadata', 9000)) return;
      for (const [uid, time] of anchors.slice(0, 20)) {
        if (cancelled) break;
        const safe = Math.max(0, Math.min(time, Math.max(0, el.duration - .1)));
        if (Math.abs(el.currentTime - safe) > .06 || el.readyState < 2) {
          const ready = once('seeked', 6000);
          el.currentTime = safe;
          if (!await ready) continue;
        }
        if (cancelled || !el.videoWidth || !el.videoHeight) break;
        const factor = Math.max(cover.width / el.videoWidth, cover.height / el.videoHeight);
        const w = el.videoWidth * factor;
        const h = el.videoHeight * factor;
        ctx.clearRect(0, 0, cover.width, cover.height);
        ctx.drawImage(el, (cover.width - w) / 2, (cover.height - h) / 2, w, h);
        const data = cover.toDataURL('image/jpeg', .72);
        if (!cancelled) setStills(prev => ({ ...prev, [uid]: data }));
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      el.pause();
      el.removeAttribute('src');
      // Avoid continuing decoding abandoned footage in the background.
      el.load();
    };
    // anchors serialized for determinism; videoUrl owns the original File's blob URL.
  }, [videoUrl, format, key]);
  return stills;
}
