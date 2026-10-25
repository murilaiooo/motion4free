import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
const downloads=[];const errors=[];
page.on('download',d=>downloads.push(d));
page.on('pageerror',e=>errors.push(e.message));
const report={};
try{
 await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=2&exporttest=1');
 await page.getByTestId('clip-card').first().waitFor();
 const intervals=await page.locator('.clip-time').allTextContents();
 report.intervals=intervals;
 if(intervals.length!==2 || !intervals[0].includes('0:01–0:06') || !intervals[1].includes('0:06–0:11'))throw Error('fixture must have two independent 5-second cuts');
 await page.getByTestId('clips-select-all').click();
 report.selection=await page.getByTestId('clips-selection-count').innerText();
 await page.getByTestId('clip-preview').last().click();
 report.preview=(await page.getByTestId('clips-preview-context').innerText()).slice(0,100);
 const position=await page.getByTestId('clips-video').evaluate(v=>v.currentTime);
 report.seek=position;
 if(Math.abs(position-6)>0.15)throw Error('Second candidate preview seek mismatch: '+position);
 await page.getByTestId('clips-render-all').click();
 await page.getByTestId('clips-stop').waitFor({state:'visible',timeout:30000});
 await page.getByTestId('clips-stop').waitFor({state:'hidden',timeout:90000});
 report.jobs=await page.locator('.clip-card-feedback').allTextContents();
 report.count=downloads.length;
 const dir=path.join(process.cwd(),'e2e/fixtures/qa-generated-local');
 fs.mkdirSync(dir,{recursive:true});
 report.files=[];
 for(const [i,d] of downloads.entries()){
  const file=path.join(dir,'batch-'+(i+1)+'.mp4');
  await d.saveAs(file);
  const result=spawnSync('ffprobe',['-v','error','-show_entries','format=duration,size','-show_entries','stream=codec_name,codec_type,width,height','-of','json',file],{encoding:'utf8'});
  const info=JSON.parse(result.stdout);
  report.files.push({name:d.suggestedFilename(),duration:Number(info.format.duration),streams:info.streams});
 }
 report.ok=downloads.length===2&&report.files.every(f=>f.duration>=4.9&&f.duration<=5.2&&f.streams.some(x=>x.codec_name==='h264')&&f.streams.some(x=>x.codec_name==='aac'))&&errors.length===0;
}catch(err){report.ok=false;report.error=String(err).slice(0,900);report.body=(await page.locator('body').innerText().catch(()=>'' )).slice(0,900)}
await browser.close();
report.errors=errors;
console.log('BATCH_QA',JSON.stringify(report));
if(!report.ok)process.exitCode=1;
