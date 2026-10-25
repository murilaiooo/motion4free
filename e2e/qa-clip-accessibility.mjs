import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const tests=[];
for (const width of [390, 1440]) {
 const page=await browser.newPage({viewport:{width,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=3');
  await page.getByTestId('clip-card').first().waitFor();
  const first=page.getByTestId('clip-details').first();
  await first.focus();
  const focusBefore=await first.evaluate(e=>document.activeElement===e);
  await page.keyboard.press('Shift+Tab');
  const backwardFocus=await page.getByTestId('clip-preview').first().evaluate(e=>document.activeElement===e);
  await page.keyboard.press('Tab');
  const forwardFocus=await first.evaluate(e=>document.activeElement===e);
  await page.keyboard.press('Enter');
  const opened=await page.getByTestId('clip-inspector').count()===1;
  const expanded=await first.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  const closed=await page.getByTestId('clip-inspector').count()===0;
  const inspectorInputs=await page.locator('[data-testid="clip-title"]').count();
  const controls=await page.evaluate(()=>{
    return [...document.querySelectorAll('[data-testid="clip-card"] button, [data-testid="clip-card"] input')].map(e=>({tag:e.tagName,kind:e.getAttribute('type'),name:e.getAttribute('aria-label')||e.textContent?.trim()||e.getAttribute('title')||'',width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)})).filter(c=>!c.name);
  });
  const ok=focusBefore&&backwardFocus&&forwardFocus&&opened&&expanded==='true'&&closed&&inspectorInputs===3&&controls.length===0&&errors.length===0;
  tests.push({width,ok,focusBefore,backwardFocus,forwardFocus,opened,expanded,closed,unlabeled:controls,errors});
 }catch(err){tests.push({width,ok:false,error:String(err)});}
 await page.close();
}
await browser.close();
const file=path.join(process.cwd(),'docs/reviews/evidence/issue147/edge/accessibility.json');
fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(tests,null,2));
console.log('ACCESSIBILITY',JSON.stringify(tests));
if(tests.some(t=>!t.ok))process.exitCode=1;
