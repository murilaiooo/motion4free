import { parseGraph, stateAt, textCanvas } from './graph.mjs';
import { AppError } from '../../src/core/errors.ts';
/** Fixed research-only dependency, fetched only by the explicit load button. */
const MODULE = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
export async function createThree(canvas) {
  let T;
  try { T = await import(/* @vite-ignore */ MODULE); } catch { throw new AppError('CRIATIVO_GPU'); }
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true }); }
  catch { throw new AppError('CRIATIVO_GPU'); }
  renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-270, 270, 480, -480, .1, 3000);
  camera.position.z = 2000;
  scene.add(new T.AmbientLight(0xffffff, 1.5)); const keyLight = new T.DirectionalLight(0xffffff, 3); keyLight.position.set(-250, 400, 800); scene.add(keyLight);
  let graph, meshes = [];
  function clear() { for (const { mesh } of meshes) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); } meshes = []; }
  return {
    setGraph(input) {
      const next = parseGraph(input); clear(); graph = next; renderer.setSize(graph.width, graph.height, false); renderer.setClearColor(graph.background, graph.transparent ? 0 : 1);
      for (const [index, node] of graph.nodes.entries()) {
        let geometry, material;
        if (node.kind === 'text') {
          const texture = new T.CanvasTexture(textCanvas(node)); texture.colorSpace = T.SRGBColorSpace;
          geometry = new T.PlaneGeometry(node.width, node.height); material = new T.MeshBasicMaterial({map: texture, transparent: true, depthTest: false, depthWrite: false});
        } else {
          geometry = node.kind === 'box3d' ? new T.BoxGeometry(node.width, node.height, node.depth ?? 80) : node.kind === 'circle' ? new T.CircleGeometry(1, 64) : new T.PlaneGeometry(node.width, node.height);
          material = node.kind === 'box3d' ? new T.MeshStandardMaterial({color: node.color, transparent: true, roughness: .45, metalness: .15}) : new T.MeshBasicMaterial({ color: node.color, transparent: true, depthTest: false, depthWrite: false });
        }
        const mesh = new T.Mesh(geometry, material); mesh.renderOrder = index; scene.add(mesh); meshes.push({node, mesh, index});
      }
    },
    renderAt(time) {
      const t = Number.isFinite(time) ? Math.max(0, Math.min(graph.duration, time)) : 0;
      for (const { node, mesh, index } of meshes) {
        const s = stateAt(node, t); mesh.visible = s.visible; mesh.material.opacity = s.opacity;
        mesh.position.set(s.x - graph.width / 2, graph.height / 2 - s.y, index * 2);
        mesh.scale.set(s.scale * (node.kind === 'circle' ? node.width / 2 : 1), s.scale * (node.kind === 'circle' ? node.height / 2 : 1), s.scale);
        mesh.rotation.set(node.kind === 'box3d' ? .35 : 0, node.kind === 'box3d' ? s.angle : 0, 0);
      }
      renderer.render(scene, camera);
    },
    dispose() { clear(); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
