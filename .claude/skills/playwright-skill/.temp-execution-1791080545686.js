const C=require('C:/Users/raiha/AppData/Local/Temp/claude/d--mybusiness-Auren-web-app-auren-ecommerce/f3af0b5d-ed91-4a02-a91b-4816478c3773/scratchpad/common.js');
(async()=>{
 const b=await C.chromium.launch({headless:true});
 for(const [w,h] of C.VPS){
  const ctx=await b.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();
  await page.goto(C.BASE+'/collections/winter-layers',{waitUntil:'networkidle'});
  await page.screenshot({path:C.SP+'coll-'+w+'-fold.png'});
  console.log(w,'ovf',JSON.stringify(await C.overflow(page)),'axe',JSON.stringify(await C.axe(page)),'h1',await page.locator('h1').innerText(),'cards',await page.locator('a[href^="/products/"]').count());
  if(w===375)console.log((await page.locator('main').innerText()).slice(0,400).replace(/\n+/g,' | '));
  await ctx.close();}
 // nav collections links
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage();
 await page.goto(C.BASE+'/shop',{waitUntil:'networkidle'});
 await page.locator('header button:has-text("Collections"), header a:has-text("Collections")').first().hover();await page.waitForTimeout(600);
 await page.screenshot({path:C.SP+'d-megamenu.png'});
 console.log(await page.$$eval('header a[href^="/collections"]',a=>a.map(x=>x.getAttribute('href')+' '+x.textContent.trim())));
 // hover card
 await page.mouse.move(700,300);
 await page.evaluate(()=>window.scrollTo(0,430));await page.waitForTimeout(400);
 await page.mouse.move(210,640);await page.waitForTimeout(800);
 await page.screenshot({path:C.SP+'hover-card.png'});
 await b.close();
})();
