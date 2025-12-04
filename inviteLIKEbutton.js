(async () => {
  // === Налаштування ===
  const LABELS = ['Запросити','Invite','Пригласить','Запросить'];
  const CLICK_DELAY_MS = 1400;

  // скрол-параметри
  const STEP_PX = 1600;               // крок в середині пакету
  const STEPS_PER_BATCH = 6;          // к-сть кроків у пакеті
  const STEP_DELAY_MS = 250;          // пауза між кроками
  const REST_AFTER_BATCH_MS = 2200;   // пауза після пакету (дає час підвантажити)
  const WAIT_NEW_TIMEOUT_MS = 3000;   // скільки чекаємо появу нових кнопок
  const BOUNCE_BACK_PX = 3200;        // відскок вгору, якщо вже дно
  const HARD_STOP_MS = 15 * 60_000;

  const log = (...a)=>console.log('%cFB Inviter:', 'color:#22c55e', ...a);
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const isVisible = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.opacity!=='0';
  };

  // шукаємо всі кнопки "Запросити" по всьому document
  const findInviteButtons = () => {
    const btns = [...document.querySelectorAll('[role="button"]:not([aria-disabled="true"])')];
    return btns.filter(b=>{
      const t = (b.getAttribute('aria-label') || b.innerText || '').trim();
      return isVisible(b) && LABELS.some(l => t===l || t.includes(l));
    });
  };

  // знаходимо СПРАВЖНІЙ скролер: піднімаємось від першої кнопки вгору
  const findScrollerFrom = (el) => {
    let p = el;
    while (p && p !== document.body) {
      const st = getComputedStyle(p);
      const can = (/(auto|scroll)/.test(st.overflowY) || p.scrollHeight > p.clientHeight+50);
      if (can) return p;
      p = p.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  // чекаємо на появу нових кнопок (або таймаут)
  const waitForNewButtonsOrTimeout = (timeoutMs) => new Promise(resolve=>{
    const startCount = findInviteButtons().length;
    let done = false;
    const timer = setTimeout(()=>{ if(!done){ done=true; obs.disconnect(); resolve(false); } }, timeoutMs);
    const obs = new MutationObserver(()=>{
      const now = findInviteButtons().length;
      if (now > startCount && !done) {
        done = true; clearTimeout(timer); obs.disconnect(); resolve(true);
      }
    });
    obs.observe(document.body, {childList:true, subtree:true});
  });

  // ---- ПІДГОТОВКА ----
  let invited = 0;
  const clicked = new WeakSet();
  let firstBtns = findInviteButtons();
  if (!firstBtns.length) { log('не бачу кнопок — зроби 1 ручний скрол у модалці і перезапусти'); return; }
  const SCROLLER = findScrollerFrom(firstBtns[0]);
  log('скролер:', SCROLLER === document.scrollingElement ? 'window' : SCROLLER.tagName, '— готово');

  // черга + спостерігач (щоб ловити нові кнопки миттєво)
  const queue = [];
  const seen = new WeakSet();
  const pushNewButtons = () => {
    const btns = findInviteButtons();
    for (const b of btns) if (!seen.has(b)) { seen.add(b); queue.push(b); b.style.outline='2px solid #22c55e'; }
  };
  pushNewButtons();

  const mo = new MutationObserver(pushNewButtons);
  mo.observe(document.body, {childList:true, subtree:true});

  // ---- КЛІКЕР (паралельно) ----
  const clicker = setInterval(async () => {
    const b = queue.shift();
    if (!b) return;
    try { b.click(); invited++; log(`Invited #${invited}`); } catch {}
    await sleep(CLICK_DELAY_MS);
  }, 300);

  // ---- РОЗУМНИЙ СКРОЛ (пакетами + паузи + bounce) ----
  const startTime = performance.now();
  while (performance.now() - startTime < HARD_STOP_MS) {
    // пакет дрібних кроків
    for (let i=0;i<STEPS_PER_BATCH;i++){
      const before = SCROLLER.scrollTop;
      const atBottom = Math.ceil(before + SCROLLER.clientHeight) >= SCROLLER.scrollHeight;
      if (atBottom) SCROLLER.scrollTop = Math.max(0, before - BOUNCE_BACK_PX);
      else          SCROLLER.scrollTop = before + STEP_PX;

      // легке ворушіння вікна — інколи тригерить підвантаження
      window.scrollBy(0,1); window.scrollBy(0,-1);

      await sleep(STEP_DELAY_MS);
    }
    // довша пауза після пакету + чекаємо появу нових елементів
    await sleep(REST_AFTER_BATCH_MS);
    await waitForNewButtonsOrTimeout(WAIT_NEW_TIMEOUT_MS);

    // якщо в черзі нічого, підкидаємо ще
    if (!queue.length) pushNewButtons();

    // якщо кнопок взагалі не стало — зробимо ще один bounce
    if (!queue.length && !findInviteButtons().length) {
      SCROLLER.scrollTop = Math.max(0, SCROLLER.scrollTop - BOUNCE_BACK_PX);
      await sleep(REST_AFTER_BATCH_MS);
    }
  }

  clearInterval(clicker);
  mo.disconnect();
  log('ГОТОВО', `Запрошено: ${invited}`);
})();
