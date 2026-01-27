(async () => {
  // === Налаштування ===
  const STEP_PX = 1600;
  const STEPS_PER_BATCH = 6;
  const STEP_DELAY_MS = 250;
  const REST_AFTER_BATCH_MS = 2200;
  const WAIT_NEW_TIMEOUT_MS = 3000;
  const BOUNCE_BACK_PX = 3200;
  const HARD_STOP_MS = 15 * 60_000;

  const LABELS = ['Запросити', 'Invite', 'Пригласить', 'Запросить', 'Запрошення надіслано'];
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const log = (...a)=>console.log('%cFB Scroll:', 'color:#3b82f6', ...a);

  let running = true;
  let paused = false;

  // === Хелпер очікування паузи ===
  const waitWhilePaused = async () => {
    while (paused && running) {
      await sleep(200);
    }
  };

  // === STOP кнопка ===
  const stopBtn = document.createElement('button');
  stopBtn.textContent = '⏹ STOP';
  Object.assign(stopBtn.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 999999,
    padding: '10px 16px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 0 8px rgba(0,0,0,0.2)'
  });
  stopBtn.onclick = () => {
    running = false;
    paused = false;
    stopBtn.textContent = '⏹ Зупинено';
    stopBtn.style.background = '#555';
    pauseBtn.style.display = 'none';
  };
  document.body.appendChild(stopBtn);

  // === PAUSE / RESUME кнопка ===
  const pauseBtn = document.createElement('button');
  pauseBtn.textContent = '⏸ Пауза';
  Object.assign(pauseBtn.style, {
    position: 'fixed',
    top: '70px',
    right: '20px',
    zIndex: 999999,
    padding: '10px 16px',
    background: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 0 8px rgba(0,0,0,0.2)'
  });
  pauseBtn.onclick = () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶️ Продовжити' : '⏸ Пауза';
    pauseBtn.style.background = paused ? '#22c55e' : '#f59e0b';
    log(paused ? '⏸ Пауза' : '▶️ Продовжено');
  };
  document.body.appendChild(pauseBtn);

  // === Hotkey: SPACE ===
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      pauseBtn.click();
    }
  });

  // === Utils ===
  const isVisible = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.opacity!=='0';
  };

  const findInviteButtons = () => {
    const btns = [...document.querySelectorAll('[role="button"]')];
    return btns.filter(b=>{
      const t = (b.getAttribute('aria-label') || b.innerText || '').trim();
      return isVisible(b) && LABELS.some(l => t === l || t.includes(l));
    });
  };

  const firstBtns = findInviteButtons();
  if (!firstBtns.length) {
    log('⚠️ Не бачу кнопок. Зроби ручний скрол і перезапусти.');
    return;
  }

  const findScrollerFrom = (el) => {
    let p = el;
    while (p && p !== document.body) {
      const st = getComputedStyle(p);
      if (/(auto|scroll)/.test(st.overflowY) || p.scrollHeight > p.clientHeight+50) return p;
      p = p.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  const SCROLLER = findScrollerFrom(firstBtns[0]);
  log('🎯 Скролер знайдено:', SCROLLER === document.scrollingElement ? 'window' : SCROLLER.tagName);
  SCROLLER.style.outline = '2px solid #3b82f6';

  const waitForNewNodes = (timeoutMs) => new Promise(resolve=>{
    let done = false;
    const timer = setTimeout(()=>{ if(!done){done=true; obs.disconnect(); resolve(false);} }, timeoutMs);
    const obs = new MutationObserver(()=>{
      if (!done) { done=true; clearTimeout(timer); obs.disconnect(); resolve(true); }
    });
    obs.observe(SCROLLER, {childList:true, subtree:true});
  });

  // === Основний цикл ===
  const startTime = performance.now();

  while (running && performance.now() - startTime < HARD_STOP_MS) {
    await waitWhilePaused();

    for (let i=0;i<STEPS_PER_BATCH && running;i++) {
      await waitWhilePaused();

      const before = SCROLLER.scrollTop;
      const atBottom = Math.ceil(before + SCROLLER.clientHeight) >= SCROLLER.scrollHeight;

      SCROLLER.scrollTop = atBottom
        ? Math.max(0, before - BOUNCE_BACK_PX)
        : before + STEP_PX;

      window.scrollBy(0,1); window.scrollBy(0,-1);
      await sleep(STEP_DELAY_MS);
    }

    await sleep(REST_AFTER_BATCH_MS);
    await waitForNewNodes(WAIT_NEW_TIMEOUT_MS);
  }

  log('✅ Скрол завершено');
  stopBtn.textContent = '✅ Готово';
  stopBtn.style.background = '#22c55e';
  pauseBtn.style.display = 'none';
})();
