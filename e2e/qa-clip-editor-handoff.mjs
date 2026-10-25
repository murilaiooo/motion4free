import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const result={ok:false,errors};
try{
 await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=1&exporttest=1');
 await page.getByTestId('clip-card').first().waitFor({timeout:15000});
 const proposed='O vídeo tem um começo e fim';
 await page.getByTestId('clip-title').first().fill(proposed);
 await page.getByTestId('clip-details').first().click();
 await page.getByTestId('clip-details').first().click();
 result.title=await page.getByTestId('clip-title').first().inputValue();
 await page.getByTestId('clip-edit').first().click();
 await page.waitForFunction(()=>window.__openedInEditor===true,{timeout:30000});
 result.handoff=await page.evaluate(()=>window.__openedInEditor===true);
 result.ok=result.handoff&&result.title===proposed&&errors.length===0;
}catch(err){result.error=String(err).slice(0,1000);result.body=(await page.locator('body').innerText().catch(()=>'' )).slice(0,500)}
await browser.close();
console.log('EDITOR_HANDOFF',JSON.stringify(result));
if(!result.ok)process.exitCode=1;
