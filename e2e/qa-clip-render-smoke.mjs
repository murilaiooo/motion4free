import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let report={status:'started',errors};
try{
 await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=1&exporttest=1');
 await page.getByTestId('clip-card').waitFor();
 const times=await page.locator('.clip-time').first().innerText();
 report.times=times;
 if (!times.includes('0:01') || !times.includes('0:06')) throw Error('Test fixture must represent valid real 1–6 second media; observed '+times);
 const dlPromise=page.waitForEvent('download',{timeout:120000});
 await page.getByTestId('clip-render').click();
 const dl=await dlPromise;
 const dir=path.join(process.cwd(),'e2e/fixtures/qa-generated-local');
 fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'short-render-verification.mp4');
 await dl.saveAs(file);
 const ff=spawnSync('ffprobe',['-v','error','-show_entries','format=duration,size','-show_entries','stream=codec_name,codec_type,width,height','-of','json',file],{encoding:'utf8'});
 const meta=JSON.parse(ff.stdout);
 report={status:'rendered',times,name:dl.suggestedFilename(),metadata:meta,errors};
 if (!meta.streams.some(s=>s.codec_type==='video') || Number(meta.format.duration)<4 || Number(meta.format.duration)>7) throw Error('Unexpected actual output duration/codec');
} catch(e) {report.status='failed';report.error=String(e).slice(0,1000);report.body=(await page.locator('body').innerText().catch(()=>'')).slice(0,900);}
await browser.close();
console.log('RENDER_SMOKE',JSON.stringify(report));
if(report.status!=='rendered'||report.errors.length)process.exitCode=1;
