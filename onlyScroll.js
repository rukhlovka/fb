(async () => {
  // === Налаштування ===
  const STEP_PX = 1200;            // крок вниз
  const STEPS_PER_BATCH = 8;       // кроків підряд
  const STEP_DELAY_MS = 220;       // пауза між кроками
  const REST_AFTER_BATCH_MS = 1800;// відпочинок після пачки
  const HARD_STOP_MS = 15 * 60_000;// хард-стоп (15 хв)
  const SMOOTH = false;            // true = smooth scroll (повільніше)

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log('%cAutoScroll:', 'color:#22c55e', ...a);

  // === Стан ===
  let running = true;
  let paused = false;
  let startTime = performance.now();

  // === Визначаємо скролер (якщо є модалка/контейнер) ===
  // 1) якщо курсор наведений на скрол-контейнер — беремо його
  // 2) інакше — window/document
  const findScrollableParent = (el) => {
    let p = el;
    while (p && p !== document.body) {
      const st = getComputedStyle(p);
      const canScroll = (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 10);
      if (canScroll) return p;
      p = p.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  const hovered = document.querySelector(':hover');
  const SCROLLER = findScrollableParent(hovered || document.body);

  const isWindowScroller = SCROLLER === (document.scrollingElement || document.documentElement);
  const getTop = () => (isWindowScroller ? window.scrollY : SCROLLER.scrollTop);
  const getHeight = () => (isWindowScroller ? window.innerHeight : SCROLLER.clientHeight);
  const getScrollHeight = () => (isWindowScroller ? document.documentElement.scrollHeight : SCROLLER.scrollHeight);

  const setTop = (y) => {
    if (isWindowScroller) {
      window.scrollTo({ top: y, behavior: SMOOTH ? 'smooth' : 'auto' });
    } else {
      if (SMOOTH && 'scrollTo' in SCROLLER) SCROLLER.scrollTo({ top: y, behavior: 'smooth' });
      else SCROLLER.scrollTop = y;
    }
  };

  log('🎯 Scroller:', isWindowScroller ? 'window' : SCROLLER.tagName);
  try { SCROLLER.style.outline = '2px solid #22c55e'; } catch {}

  // === UI: кнопки ===
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 999999,
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    padding: '10px',
    background: 'rgba(0,0,0,0.55)',
    borderRadius: '12px',
    backdropFilter: 'blur(6px)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  });

  const mkBtn = (text, bg) => {
    const b = document.createElement('button');
    b.textContent = text;
    Object.assign(b.style, {
      padding: '10px 14px',
      background: bg,
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '14px',
      boxShadow: '0 0 10px rgba(0,0,0,0.25)',
      userSelect: 'none'
    });
    return b;
  };

  const status = document.createElement('div');
  status.textContent = '▶️ Running';
  Object.assign(status.style, { color: 'white', fontSize: '13px', opacity: 0.95, marginLeft: '6px' });

  const pauseBtn = mkBtn('⏸ Пауза', '#f59e0b');
  const stopBtn  = mkBtn('⏹ Стоп', '#ef4444');

  pauseBtn.onclick = () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶️ Продовжити' : '⏸ Пауза';
    status.textContent = paused ? '⏸ Paused' : '▶️ Running';
  };

  stopBtn.onclick = () => {
    running = false;
    paused = false;
    status.textContent = '⏹ Stopped';
    stopBtn.style.background = '#555';
    pauseBtn.disabled = true;
    pauseBtn.style.opacity = 0.6;
  };

  wrap.appendChild(pauseBtn);
  wrap.appendChild(stopBtn);
  wrap.appendChild(status);
  document.body.appendChild(wrap);

  // === Основний цикл скролу вниз до кінця ===
  while (running && performance.now() - startTime < HARD_STOP_MS) {
    if (paused) {
      await sleep(200);
      continue;
    }

    const before = getTop();
    const bottomReached = Math.ceil(before + getHeight()) >= getScrollHeight() - 2;

    if (bottomReached) break;

    // робимо пачку кроків
    for (let i = 0; i < STEPS_PER_BATCH && running && !paused; i++) {
      const cur = getTop();
      setTop(cur + STEP_PX);

      // легкий "пінг", інколи допомагає сайтам підвантажувати контент
      window.dispatchEvent(new Event('scroll'));
      await sleep(STEP_DELAY_MS);

      const now = getTop();
      const stuck = Math.abs(now - cur) < 2; // не рухається
      if (stuck) break;
    }

    await sleep(REST_AFTER_BATCH_MS);
  }

  // === Фініш ===
  if (running) {
    status.textContent = '✅ Done';
    stopBtn.textContent = '✅ Готово';
    stopBtn.style.background = '#22c55e';
    pauseBtn.disabled = true;
    pauseBtn.style.opacity = 0.6;
  }

  log('✅ Finished');
})();
