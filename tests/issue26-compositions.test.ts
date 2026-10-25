// @ts-nocheck -- Módulo exploratório JS isolado sem declarações TypeScript.
import { describe, expect, it } from 'vitest';
import {compositionFor} from '../research/frame-compositor/compositions.mjs';
import {parseGraph,stateAt} from '../research/frame-compositor/graph.mjs';

const phrases=['Primeira frase da mesma origem','Desenvolvimento sem números inventados','Conclusão gravada na mesma origem'];
const graphs = Object.fromEntries(['minimal','tech','documentary'].map(name=>[name,compositionFor(name,phrases,4,8)]));

describe('issue #26 — mesmo conteúdo, três linguagens de composição',()=>{
 it('usa as mesmas três frases e tempos, mas têm estruturas distintas 5/9/13 nodes',()=>{
   const minimal=graphs.minimal,tech=graphs.tech,documentary=graphs.documentary;
   expect([minimal.nodes.length,tech.nodes.length,documentary.nodes.length]).toEqual([5,9,13]);
   for(const graph of [minimal,tech,documentary]){
     expect(graph.duration).toBe(12);
     expect(graph.transparent).toBe(true);
     for(const text of phrases)expect(graph.nodes.some(n=>n.text===text)).toBe(true);
     expect(graph.nodes.every(n=>typeof n.start==='number'&&n.start>=0&&n.end<=12)).toBe(true);
   }
   expect(minimal.nodes.every(n=>n.kind!=='box3d')).toBe(true);
   expect(tech.nodes.filter(n=>n.kind==='box3d')).toHaveLength(3);
   expect(tech.nodes.filter(n=>n.kind==='box3d').every(n=>n.spin>0)).toBe(true);
   expect(documentary.nodes.some(n=>n.enter==='rise')).toBe(true);
   expect(new Set([minimal,tech,documentary].map(g=>JSON.stringify(g.nodes.map(n=>[n.kind,n.x,n.y,n.start,n.end])))).size).toBe(3);
 });
 it('retiming numérico e reapresentação não alteram a fonte das frases',()=>{
   const t=compositionFor('tech',phrases,3.5,9);
   expect(t.nodes.find(n=>n.id==='volume-1')?.start).toBe(3.5);
   expect(t.nodes.find(n=>n.id==='volume-2')?.start).toBe(9);
   expect(t.nodes.filter(n=>n.kind==='text').map(n=>n.text)).toEqual(phrases);
   const before=JSON.stringify(t);
   const a=t.nodes.map(n=>stateAt(n,5));
   t.nodes.forEach(n=>stateAt(n,11));
   const b=t.nodes.map(n=>stateAt(n,5));
   expect(b).toEqual(a);
   expect(JSON.stringify(t)).toBe(before);
 });
 it('bloqueia payloads com URLs, script, nós inválidos e entrada sem consentimento',()=>{
   expect(()=>compositionFor('untrusted',phrases,4,8)).toThrow();
   expect(()=>compositionFor('minimal',phrases,11,3)).toThrow();
   expect(()=>compositionFor('minimal',phrases,4,12.2)).toThrow();
   const graph=structuredClone(graphs.minimal);
   graph.nodes[0].imageUrl='https://attacker.example/picture.png';
   expect(()=>parseGraph(graph)).toThrow();
   const hostile=structuredClone(graphs.tech);
   hostile.nodes[0].id='../../unsafe';
   expect(()=>parseGraph(hostile)).toThrow();
   expect(()=>parseGraph({...graphs.documentary,nodes:graphs.documentary.nodes.concat(new Array(80).fill(graphs.documentary.nodes[0]))})).toThrow();
 });
});
