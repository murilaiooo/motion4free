export type ToFaceWorker = { type: 'detect'; image: ImageBitmap };
export type FaceBox = { x: number; y: number; size: number; score: number };
export type FromFaceWorker = { type: 'faces'; faces: FaceBox[] } | { type: 'error' };
