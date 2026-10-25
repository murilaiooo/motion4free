import path from 'node:path';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',args:['--no-sandbox']});
const result=[];
for(const [width,height] of [[1440,900],[390,844]]) {
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5182/e2e/clip-review-lab.html?clips=6',{waitUntil:'domcontentloaded'});
 await page.getByTestId('clip-card').first().waitFor({timeout:20000});
 const geometry=await page.evaluate(()=>{
  const card=document.querySelector('[data-testid="clip-card"]');
  const actions=card.querySelector('.clip-actions').getBoundingClientRect();
  const title=card.querySelector('input[aria-label^="Título do clipe"]').getBoundingClientRect();
  const body=card.getBoundingClientRect();
  return {screen:innerWidth,scrollWidth:document.documentElement.scrollWidth,cardWidth:body.width,actionWidth:actions.width,titleWidth:title.width,overlap:title.right>actions.left,titleRight:title.right,actionsLeft:actions.left};
 });
 await page.screenshot({path:path.join(process.cwd(),'docs/reviews/evidence/issue147','before-'+width+'x'+height+'.png'),fullPage:true});
 result.push({width,height,geometry,errors});
 console.log('ISSUE147_BEFORE '+JSON.stringify(result.at(-1)));
 await page.close();
}
await browser.close();
