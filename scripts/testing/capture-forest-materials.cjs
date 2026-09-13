const {chromium} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// An isolated browser context with no user storage; only ordinary keyboard input.
(async () => {
  const dir=path.resolve('.codex-tmp/forest-materials');
  fs.mkdirSync(dir,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:0});
    await page.goto('http://127.0.0.1:5187/chapter-one.html');
    await page.getByRole('button',{name:'旅途笔记（J）'}).waitFor();
    // The renderer is dynamically imported. Wait for actual module loading.
    await page.waitForFunction(()=>document.querySelector('.forest-opening__candidate')?.textContent.includes('v0.6'));
    await page.clock.pauseAt(60000);
    const canvas=page.locator('canvas[data-surface="game"]');
    await canvas.focus();
    const capture=async name=>{
      const url=await canvas.evaluate(c=>c.toDataURL('image/png'));
      fs.writeFileSync(path.join(dir,name+'-native.png'),Buffer.from(url.split(',')[1],'base64'));
      await page.screenshot({path:path.join(dir,name+'.png')});
    };
    await capture('arrival');
    await page.keyboard.down('d');
    let arrived=false;
    const key='tokipona.forest-opening.vertical-slice.v0.1';
    for(let i=0;i<500;i++) {
      await page.clock.fastForward(100);
      const x=await page.evaluate(k=>{
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem(k)).spatial.spatial.player.x;
      },key);
      if(x>=1750) {arrived=true;break;}
    }
    await page.keyboard.up('d');
    if(!arrived)throw Error('Ordinary movement did not reach material benchmark');
    for(let i=0;i<20;i++)await page.clock.fastForward(100);
    await capture('creek');
    console.log(JSON.stringify({errors,dir,canvas:await canvas.evaluate(c=>[c.width,c.height])}));
    if(errors.length)throw Error(errors.join('\n'));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
