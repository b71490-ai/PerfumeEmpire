const { chromium } = require('playwright');

(async () => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3001';
  const url = `${base}/admin`;
  console.log('Opening', url);
  const browser = await chromium.launch();
  const mobile = process.env.MOBILE === '1';
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1' } : {});
  const page = await context.newPage();

  // capture console and page errors
  page.on('console', msg => console.log('PAGE LOG>', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR>', err.message));

  await page.goto(url, { waitUntil: 'networkidle' }).catch(e => console.log('Goto error', e.message));

  // find candidate clickable elements (buttons and links)
  const candidates = await page.$$eval('a,button,[role="button"]', els => els.slice(0,50).map(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const text = el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('href') || el.className || el.tagName;
    return {
      tag: el.tagName,
      text: text.trim().slice(0,80),
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      pointerEvents: style.pointerEvents,
      visibility: style.visibility,
      display: style.display,
      zIndex: style.zIndex,
      ariaHidden: el.getAttribute('aria-hidden')
    }
  }));

  console.log('Found', candidates.length, 'clickable candidates (sample):');
  candidates.forEach((c, i) => console.log(i, c));

  // For each candidate, check which element is at its center (could be overlay)
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.width === 0 || c.height === 0) continue;
    const cx = Math.round(c.left + c.width/2);
    const cy = Math.round(c.top + c.height/2);
    const topEl = await page.evaluate(({x,y}) => {
      const el = document.elementFromPoint(x,y);
      if (!el) return null;
      return { tag: el.tagName, class: el.className, id: el.id, text: el.innerText ? el.innerText.slice(0,60) : '' };
    }, { x: cx, y: cy });
    console.log(`At center of candidate[${i}] (${c.text}) -> top element:`, topEl);
  }

  // detect large fixed/absolute overlays that may block clicks
  const overlays = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const els = Array.from(document.querySelectorAll('*'));
    return els.map(el => {
      const s = window.getComputedStyle(el);
      if (['fixed','absolute','sticky'].includes(s.position)) {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, class: el.className, id: el.id, left: r.left, top: r.top, width: r.width, height: r.height, z: s.zIndex, pointerEvents: s.pointerEvents, opacity: s.opacity };
      }
      return null;
    }).filter(Boolean).filter(o => (o.width*o.height) > (vw*vh*0.02)).slice(0,20);
  });
  console.log('Potential overlay-like elements (position fixed/abs) ->', overlays);
  // inspect admin-sidebar contents if present
  const sidebarInfo = await page.evaluate(() => {
    const aside = document.querySelector('.admin-sidebar');
    if (!aside) return null;
    const items = Array.from(aside.querySelectorAll('*')).slice(0,200).map(el => {
      return { tag: el.tagName, class: el.className, text: el.innerText ? el.innerText.trim().slice(0,80) : '', href: el.getAttribute ? el.getAttribute('href') : null };
    });
    return { tag: aside.tagName, class: aside.className, itemsCount: items.length, sample: items.slice(0,40) };
  });
  console.log('Sidebar inspect:', sidebarInfo);

  // Try clicking the first visible candidate and observe navigation or errors
  const visibleCandidates = await page.$$(`a,button,[role="button"]`);
  for (let i = 0; i < Math.min(6, visibleCandidates.length); i++) {
    try {
      const el = visibleCandidates[i];
      const visible = await el.isVisible();
      if (!visible) continue;
      const box = await el.boundingBox();
      if (!box || box.width === 0 || box.height === 0) continue;
      console.log('Attempting click on candidate', i);
      await Promise.all([
        page.waitForTimeout(500),
        el.click({ timeout: 2000 }).catch(e => console.log('click error', e.message))
      ]);
    } catch (e) {
      console.log('Click attempt exception', e.message);
    }
  }

  await browser.close();
})();
