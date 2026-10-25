import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const checks=[];
for(const [width,height] of [[390,600],[390,844],[768,900],[1440,900]]){
 const page=await browser.newPage({viewport:{width,height}});
 try{
  await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=10');
  await page.getByTestId('clip-card').first().waitFor();
  for(const name of ['clip-title','clip-preview','clip-details','clip-edit','clip-render']){
   const target=page.getByTestId('clip-card').last().getByTestId(name);
   await target.focus(); await page.waitForTimeout(50);
   const result=await target.evaluate(el=>{
    const r=el.getBoundingClientRect(), footer=document.querySelector('.clips-bar').getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,footerTop:footer.top,viewport:innerHeight,hiddenUnderFooter:r.bottom>footer.top-3,hiddenAbove:r.top<0};
   });
   checks.push({width,height,name,ok:!result.hiddenUnderFooter&&!result.hiddenAbove,...result});
  }
 }catch(err){checks.push({width,height,ok:false,error:String(err).slice(0,300)})}
 await page.close();
}
await browser.close();
const file=path.join(process.cwd(),'docs/reviews/evidence/issue147/edge/footer-focus.json');
fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(checks,null,2));
console.log('FOOTER_FOCUS',JSON.stringify({count:checks.length,failed:checks.filter(x=>!x.ok)}));
if(checks.some(x=>!x.ok))process.exitCode=1;
