/// <reference lib="webworker" />
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FromFaceWorker, ToFaceWorker } from './face-protocol';

// Fixed, versioned public model/runtime. Only downloads; no frame, audio, transcript or key leaves the worker.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
let detector: Promise<FaceDetector> | null = null;
const post = (message: FromFaceWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
self.onmessage = async (event: MessageEvent<ToFaceWorker>) => {
  const image = event.data.image;
  try {
    detector ??= FilesetResolver.forVisionTasks(WASM, true).then((files) => FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE', minDetectionConfidence: 0.65,
    }));
    const result = (await detector).detect(image);
    post({ type: 'faces', faces: result.detections.flatMap((detection) => {
      const box = detection.boundingBox;
      const score = detection.categories[0]?.score ?? 0;
      if (!box || score < 0.65) return [];
      return [{ x: (box.originX + box.width / 2) / image.width, y: (box.originY + box.height / 2) / image.height, size: box.width / image.width, score }];
    }) });
  } catch { post({ type: 'error' }); }
  finally { image.close(); }
};
