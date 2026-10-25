import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
const root=process.cwd(), evidence=path.join(root,'docs/reviews/evidence/issue147');
fs.mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',args:['--no-sandbox']});
const resolutions=[[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768],[768,900],[390,844]];
const output=[];let allPassed=true;
for(const [width,height] of resolutions){
 const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=6',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByTestId('clip-card').first().waitFor({timeout:25000});
  const cards=await page.getByTestId('clip-card').count();
  const geometry=await page.evaluate(()=>{
   const doc=document.documentElement, all=[...document.querySelectorAll('[data-testid="clip-card"]')];
   let intersections=0, overflow=0, minTitle=1e5;
   for(const card of all){
    const box=card.getBoundingClientRect();
    if(box.right>innerWidth+2)overflow++;
    const title=card.querySelector('[data-testid="clip-title"]')?.getBoundingClientRect();
    if(title)minTitle=Math.min(minTitle,title.width);
    for(const button of card.querySelectorAll('.clip-card-actions button,.clip-card-actions a')){
      const b=button.getBoundingClientRect();
      if(b.left<box.left-1||b.right>box.right+1||b.top<box.top-1||b.bottom>box.bottom+1)intersections++;
    }
   }
   const bar=document.querySelector('.clips-bar')?.getBoundingClientRect();
   const last=all.at(-1)?.getBoundingClientRect();
   return {screenWidth:innerWidth,documentWidth:doc.scrollWidth,intersections,overflow,minTitle,bar:bar?.height,lastY:last?.bottom,pageHeight:doc.scrollHeight};
  });
  const selectedBefore=await page.getByTestId('clips-selection-count').textContent();
  await page.getByTestId('clips-select-none').click();
  const none=await page.getByTestId('clips-selection-count').textContent();
  await page.getByTestId('clips-select-all').click();
  const all=await page.getByTestId('clips-selection-count').textContent();
  await page.getByTestId('clips-select-none').click();
  await page.getByTestId('clip-check').first().check();
  const one=await page.getByTestId('clips-selection-count').textContent();
  await page.getByTestId('clip-title').nth(1).fill('Título com 100 caracteres de confirmação visual e revisão do texto');
  await page.getByTestId('clip-details').first().click();
  const inspector=await page.getByTestId('clip-inspector').count();
  await page.getByTestId('clip-preview').first().click();
  const preview=await page.getByTestId('clips-preview-context').textContent();
  await page.getByTestId('clip-details').first().click();
  await page.getByTestId('clips-select-all').click();
  await page.screenshot({path:path.join(evidence,'after-'+width+'x'+height+'.png'),fullPage:true,animations:'disabled'});
  const ok=cards===6 && geometry.documentWidth<=width+1 && geometry.intersections===0 && geometry.overflow===0 && geometry.minTitle>Math.min(145,width*.35) && inspector===1 && none?.startsWith('0 de 6') && all?.startsWith('6 de 6') && one?.startsWith('1 de 6') && errors.length===0;
  allPassed&&=ok;
  const result={width,height,ok,cards,geometry,selectedBefore,none,all,one,inspector,preview:preview?.slice(0,180),errors};
  output.push(result);console.log('ISSUE147_LAYOUT '+JSON.stringify(result));
 }catch(e){
  allPassed=false;output.push({width,height,error:String(e),errors});console.log('ISSUE147_FAIL '+JSON.stringify({width,height,error:String(e),errors}));
 }finally{await page.close();}
}
await browser.close();
fs.writeFileSync(path.join(root,'docs/reviews/evidence/issue147/metrics.json'),JSON.stringify(output,null,2));
console.log('ISSUE147_QA '+(allPassed?'PASS':'FAIL'));
if(!allPassed)process.exitCode=1;
