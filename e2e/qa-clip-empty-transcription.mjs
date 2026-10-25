import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const page=await browser.newPage({viewport:{width:390,height:844}});
const report={scenario:'empty fake-ASR words in full app',ok:false,errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto((process.env.M4F_QA_BASE_URL || 'http://127.0.0.1:5185')+'/?asr=vazio#clipes');
 await page.getByTestId('long-file-input').setInputFiles('e2e/fixtures/long-tts-repeat-122s-local.mp4');
 await page.getByTestId('error-M4F-1102').waitFor({timeout:30000});
 report.message=(await page.getByTestId('error-M4F-1102').innerText()).slice(0,280);
 report.clipsOpen=await page.getByTestId('clip-maker').count();
 report.ok=report.clipsOpen===0&&report.errors.length===0;
}catch(e){report.error=String(e).slice(0,500)}
await browser.close();
console.log('EMPTY_ASR '+JSON.stringify(report));
if(!report.ok)process.exitCode=1;
