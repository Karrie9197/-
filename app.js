(function () {
  const state = {
    sets: [],
    index: 0,
    foundCount: 0,
    foundHotspots: new Set()
  };

  const els = {
    leftImg: document.getElementById('left-img'),
    rightImg: document.getElementById('right-img'),
    leftCanvas: document.getElementById('left-canvas'),
    rightCanvas: document.getElementById('right-canvas'),
    level: document.getElementById('level'),
    total: document.getElementById('total'),
    found: document.getElementById('found'),
    need: document.getElementById('need'),
    prevBtn: document.getElementById('prev'),
    nextBtn: document.getElementById('next'),
    restartBtn: document.getElementById('restart'),
    message: document.getElementById('message'),
    qrContainer: document.getElementById('qr-container')
  };

  function showMessage(txt, timeout = 2000) {
    els.message.textContent = txt;
    if (timeout) setTimeout(()=> { if (els.message.textContent === txt) els.message.textContent = ''; }, timeout);
  }

  function loadSets() {
    return fetch('sets.json').then(r => {
      if (!r.ok) throw new Error('无法加载 sets.json，HTTP ' + r.status);
      return r.json();
    });
  }

  function setupQR() {
    // 二维码指向当前页面 URL（可改为部署 URL）
    try {
      new QRCode(els.qrContainer, {
        text: window.location.href,
        width: 128,
        height: 128
      });
    } catch (e) {
      console.warn('二维码库加载失败', e);
    }
  }

  function setCanvasSize(img, canvas) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = img.width + 'px';
    canvas.style.height = img.height + 'px';
  }

  function renderHotspots() {
    const set = state.sets[state.index];
    const leftCtx = els.leftCanvas.getContext('2d');
    const rightCtx = els.rightCanvas.getContext('2d');
    leftCtx.clearRect(0,0,els.leftCanvas.width, els.leftCanvas.height);
    rightCtx.clearRect(0,0,els.rightCanvas.width, els.rightCanvas.height);

    // draw found marks
    set.hotspots.forEach((h, i) => {
      const found = state.foundHotspots.has(i);
      drawCircle(leftCtx, h, found ? 'rgba(0,200,0,0.5)' : 'rgba(255,0,0,0.2)');
      drawCircle(rightCtx, h, found ? 'rgba(0,200,0,0.5)' : 'rgba(255,0,0,0.0)');
    });
  }

  function drawCircle(ctx, h, style) {
    const x = h.x * ctx.canvas.width;
    const y = h.y * ctx.canvas.height;
    const r = (h.r || 0.05) * Math.max(ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = style;
    ctx.fillStyle = style;
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.stroke();
  }

  function loadLevel(idx) {
    const set = state.sets[idx];
    if (!set) return;
    state.index = idx;
    state.foundCount = 0;
    state.foundHotspots = new Set();

    els.level.textContent = idx + 1;
    els.total.textContent = state.sets.length;
    els.found.textContent = 0;
    els.need.textContent = set.hotspots.length;

    els.leftImg.src = set.left;
    els.rightImg.src = set.right;

    // after images loaded, size canvases and render
    let loaded = 0;
    function onImgLoad() {
      loaded++;
      if (loaded < 2) return;
      setCanvasSize(els.leftImg, els.leftCanvas);
      setCanvasSize(els.rightImg, els.rightCanvas);
      renderHotspots();
    }

    els.leftImg.onload = onImgLoad;
    els.rightImg.onload = onImgLoad;
  }

  function checkClick(e) {
    const set = state.sets[state.index];
    if (!set) return;
    // compute click position relative to image
    const rect = els.rightImg.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    // translate into natural pixels if necessary, but hotspots are normalized so compare normalized coords
    for (let i = 0; i < set.hotspots.length; i++) {
      if (state.foundHotspots.has(i)) continue;
      const h = set.hotspots[i];
      const dx = cx - h.x;
      const dy = cy - h.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const r = h.r || 0.05;
      if (dist <= r) {
        state.foundHotspots.add(i);
        state.foundCount++;
        els.found.textContent = state.foundCount;
        showMessage('找到一个！');
        renderMarkOnCanvases(i);
        if (state.foundCount >= set.hotspots.length) {
          showMessage('本关完成！自动跳到下一关', 3000);
          setTimeout(()=> {
            const next = (state.index + 1) % state.sets.length;
            loadLevel(next);
          }, 1200);
        }
        return;
      }
    }
    // 点击未命中
    showMessage('没有，继续找~', 800);
  }

  function renderMarkOnCanvases(hitIndex) {
    const set = state.sets[state.index];
    const h = set.hotspots[hitIndex];
    const leftCtx = els.leftCanvas.getContext('2d');
    const rightCtx = els.rightCanvas.getContext('2d');
    drawCircle(leftCtx, h, 'rgba(0,200,0,0.5)');
    drawCircle(rightCtx, h, 'rgba(0,200,0,0.5)');
  }

  function attachEvents() {
    els.rightImg.addEventListener('click', checkClick);
    els.prevBtn.addEventListener('click', ()=> {
      const idx = (state.index - 1 + state.sets.length) % state.sets.length;
      loadLevel(idx);
    });
    els.nextBtn.addEventListener('click', ()=> {
      const idx = (state.index + 1) % state.sets.length;
      loadLevel(idx);
    });
    els.restartBtn.addEventListener('click', ()=> {
      loadLevel(state.index);
    });
    window.addEventListener('resize', ()=> {
      // adjust canvas CSS size to match image display size
      if (els.leftImg.naturalWidth) setCanvasSize(els.leftImg, els.leftCanvas);
      if (els.rightImg.naturalWidth) setCanvasSize(els.rightImg, els.rightCanvas);
      renderHotspots();
    });
  }

  // 初始化
  function init() {
    loadSets().then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        showMessage('sets.json 为空或格式不正确', 4000);
        return;
      }
      state.sets = data;
      attachEvents();
      setupQR();
      loadLevel(0);
    }).catch(err => {
      console.error(err);
      showMessage('无法加载 sets.json：' + err.message, 5000);
    });
  }

  init();
})();
