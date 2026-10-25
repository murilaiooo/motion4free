/**
 * Issue #26, local-only reproducible POC; assumes Vite research server on port 5179.
 * Outputs three distinct same-source 12s MP4 files to test-results (never git).
 * Uses screenshot of the POC's displayed source+overlay stage, preserving audio.
 * Do not confuse Canvas flat box with actual Three 3D geometry.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';

const root=process.cwd();
const source=path.join(root,'test-results','issue26-source.webm');
if(!fs.existsSync(source))throw new Error('Execute npm run fixture + ffmpeg source generator');
const modes=['minimal','tech','documentary'];
const sourceSha=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1300},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const observations={source:source.replace(root,''),sourceSha256:sourceSha,duration:12,frequency:10,framesPerMode:120,modes:{},errors};
try {
 await page.goto('http://127.0.0.1:5179/research/frame-compositor/index.html',{waitUntil:'domcontentloaded',timeout:45000});
 await page.addStyleTag({content:'.stage{width:540px!important;height:960px!important}.stage video,.stage canvas{width:540px!important;height:960px!important}body{max-width:1500px!important}.stage canvas{border:0!important}'});
 const names=['Introdução da gravação','Desenvolvimento do mesmo conteúdo','Conclusão da gravação'];
 for(let i=0;i<3;i++)await page.locator('#phrase-'+i).fill(names[i]);
 await page.locator('#rights').check();
 await page.locator('#source').setInputFiles(source);
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Gravação local vinculada'),null,{timeout:25000});
 const gpuStart=Date.now();
 await page.locator('#gpu').click();
 // A importação CDN de Three é assíncrona. Não interpretar o botão inicialmente
 // desabilitado como indisponibilidade GPU sem aguardar a resolução real.
 await page.waitForFunction(() => !document.querySelector('#png-three').disabled || /M4F-807/.test(document.querySelector('#status')?.textContent || ''), null, {timeout:20000});
 const gpu=await page.locator('#png-three').isEnabled();
 observations.gpu={available:gpu,loadMs:Date.now()-gpuStart,status:await page.locator('#status').textContent(),renderer:'Brave SwiftShader/WebGL (if available, not representative of GPU hardware)'};
 observations.browser=await page.evaluate(()=>({userAgent:navigator.userAgent,deviceMemoryGiB:navigator.deviceMemory??null,cpuLogicalThreads:navigator.hardwareConcurrency??null,webgl2:!!document.createElement('canvas').getContext('webgl2')}));
 for(const mode of modes) {
  await page.locator('#'+mode).click();
  const graph=JSON.parse(await page.locator('#graph').inputValue());
  const hashes=[];
  const folder=path.join(root,'test-results','issue26-'+mode);
  fs.mkdirSync(folder,{recursive:true});
  const sampleTimes=[1,5,9];
  const metrics=[];
  const capture=mode==='tech'&&gpu? page.locator('.stage').nth(1):page.locator('.stage').nth(0);
  for(let frame=0;frame<120;frame++){
   const t=frame/10;
   const start=Date.now();
   await page.locator('#time').evaluate((el,value)=>{
     el.value=String(value);
     el.dispatchEvent(new Event('input',{bubbles:true}));
   },t);
   await page.waitForFunction(()=>{
     const video=document.querySelector('#source-canvas');
     const target=Number(document.querySelector('#time').value);
     return video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime-target)<0.045;
   },null,{timeout:9000});
   const filename=path.join(folder,String(frame).padStart(3,'0')+'.png');
   await capture.screenshot({path:filename,animations:'disabled',timeout:9000});
   metrics.push(Date.now()-start);
   if(sampleTimes.some(sec=>Math.abs(t-sec)<1e-6))
     hashes.push({t,sha256:crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')});
  }
  const out=path.join(root,'test-results','issue26-'+mode+'.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','10','-i',path.join(folder,'%03d.png'),'-i',source,'-map','0:v','-map','1:a:0','-c:v','libx264','-vf','scale=540:960:flags=lanczos','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-t','12','-movflags','+faststart',out],{stdio:'pipe',timeout:120000});
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height','-of','json',out],{encoding:'utf8'}));
  const pixels=execFileSync('ffmpeg',['-v','error','-ss','5','-i',out,'-frames:v','1','-vf','scale=32:32','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
  if(pixels.length!==3072)throw new Error(mode+': video frame unreadable');
  const uniqueKinds=[...new Set(graph.nodes.map(n=>n.kind))];
  observations.modes[mode]={renderer:mode==='tech'&&gpu?'Three.js/WebGL':'Canvas2D',nodeCount:graph.nodes.length,kinds:uniqueKinds,samples:hashes,frameMs:{median:metrics.slice().sort((a,b)=>a-b)[60],max:Math.max(...metrics)},probe,decodedFrameBytes:pixels.length,mp4:out.replace(root,'')};
  console.log('ISSUE26_MODE',JSON.stringify({mode,...observations.modes[mode]}));
 }
 if(new Set(modes.map(m=>JSON.stringify(observations.modes[m].samples.map(s=>s.sha256)))).size!==3)
  throw new Error('As três composições geraram frames idênticos');
 if(errors.length)throw new Error('JavaScript errors: '+JSON.stringify(errors));
 const afterSha=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
 if(afterSha!==sourceSha)throw new Error('A gravação original foi alterada!');
 observations.sourceUnmodified=true;
 console.log('ISSUE26_SUCCESS '+JSON.stringify(observations));
}finally{await browser.close();}
