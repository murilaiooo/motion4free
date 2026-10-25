import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'});
const page=await browser.newPage();
const report={ok:false};
try{
 await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=1');
 await page.getByTestId('clip-card').waitFor();
 await page.getByTestId('clip-preview').click();
 await page.waitForFunction(()=>!document.querySelector('[data-testid="clips-video"]').paused,{timeout:10000});
 await page.getByTestId('clip-preview').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="clips-video"]').paused,{timeout:10000});
 await page.getByTestId('clips-preview-context').getByText('Prévia pausada').waitFor({timeout:3000});
 report.status=(await page.getByTestId('clips-preview-context').innerText()).slice(0,95);
 report.ok=report.status.toLocaleLowerCase('pt-BR').includes('prévia pausada')&&!report.status.toLocaleLowerCase('pt-BR').includes('reproduzindo da fonte');
}catch(err){report.error=String(err).slice(0,450)}
await browser.close();
console.log('PREVIEW_PAUSE '+JSON.stringify(report));
if(!report.ok)process.exitCode=1;
