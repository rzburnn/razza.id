(() => {
  'use strict';

  // ==========================================
  // 1. AMBIL ELEMEN DOM
  // ==========================================
  const gameShell = document.querySelector('#game-shell');
  const canvas = document.querySelector('#game');
  const ctx = canvas ? canvas.getContext('2d') : null;

  const overlay = document.querySelector('#overlay');
  const startButton = document.querySelector('#start-button');
  const announcement = document.querySelector('#announcement');
  const hitFlash = document.querySelector('#hit-flash');
  const endingLayer = document.querySelector('#ending-layer');
  const endingTitle = document.querySelector('#ending-title');
  const scoreEl = document.querySelector('#score');
  const moneyEl = document.querySelector('#money');
  const comboEl = document.querySelector('#combo');
  const phaseLabel = document.querySelector('#phase-label');
  const pauseBtn = document.querySelector('#pause-btn');
  const fullscreenBtn = document.querySelector('#fullscreen-btn');

  const dialogueBox = document.querySelector('#dialogue-box');
  const dialogueText = document.querySelector('#dialogue-text');
  const dialogueSpeaker = document.querySelector('#dialogue-speaker');

  if (!canvas || !ctx) return;

  const W = 800;
  const H = 400;
  canvas.width = W;
  canvas.height = H;
  const GROUND_Y = H - 55;

  // ==========================================
  // 2. SOUND SYNTH & LAGU PAUSE RETRO (TANPA FILE EKSTERNAL)
  // ==========================================
  let audioCtx = null;
  let masterGain = null;
  let pauseMusicTimer = null;
  let pauseStep = 0;

  const pauseMelody = [
    523.25, 659.25, 783.99, 659.25,
    587.33, 698.46, 880.00, 698.46,
    523.25, 659.25, 783.99, 1046.50,
    783.99, 659.25, 587.33, 493.88
  ];
  const pauseBass = [
    130.81, 130.81, 196.00, 196.00,
    146.83, 146.83, 220.00, 220.00,
    130.81, 130.81, 196.00, 196.00,
    174.61, 174.61, 123.47, 123.47
  ];

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const compressor = audioCtx.createDynamicsCompressor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.75;
      masterGain.connect(compressor);
      compressor.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSfx(freq, duration, type = 'sine', vol = 0.3, slideTo = null) {
    try {
      const ctxAudio = ensureAudioCtx();
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctxAudio.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, ctxAudio.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol, ctxAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctxAudio.currentTime + duration);
      osc.connect(gain);
      gain.connect(masterGain || ctxAudio.destination);
      osc.start();
      osc.stop(ctxAudio.currentTime + duration);
    } catch (_) {}
  }

  function playPauseBeat() {
    try {
      const ctxAudio = ensureAudioCtx();
      const now = ctxAudio.currentTime;
      const idx = pauseStep % pauseMelody.length;

      const leadOsc = ctxAudio.createOscillator();
      const leadGain = ctxAudio.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(pauseMelody[idx], now);
      leadGain.gain.setValueAtTime(0.11, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      leadOsc.connect(leadGain);
      leadGain.connect(masterGain || ctxAudio.destination);
      leadOsc.start(now);
      leadOsc.stop(now + 0.2);

      if (idx % 2 === 0) {
        const bassOsc = ctxAudio.createOscillator();
        const bassGain = ctxAudio.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(pauseBass[idx], now);
        bassGain.gain.setValueAtTime(0.24, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        bassOsc.connect(bassGain);
        bassGain.connect(masterGain || ctxAudio.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.4);
      }

      pauseStep++;
    } catch (_) {}
  }

  function startPauseMusic() {
    stopPauseMusic();
    pauseStep = 0;
    playPauseBeat();
    pauseMusicTimer = setInterval(playPauseBeat, 230);
  }

  function stopPauseMusic() {
    if (pauseMusicTimer !== null) {
      clearInterval(pauseMusicTimer);
      pauseMusicTimer = null;
    }
  }

  // ==========================================
  // 3. MUAT ASET GAMBAR (JALAN 10, LARI 5, LOMPAT 5)
  // ==========================================
  function loadImage(src, fallbackSrc = null) {
    const img = new Image();
    img.src = src;
    if (fallbackSrc) {
      img.onerror = () => {
        if (!img.dataset.triedFallback) {
          img.dataset.triedFallback = '1';
          img.src = fallbackSrc;
        }
      };
    }
    return img;
  }

  const backgrounds = [
    loadImage('myasset/myframe/bgkalcer.jpg', 'myasset/myframe/bgkalcer.png'),
    loadImage('myasset/myframe/bgchaos.png', 'myasset/myframe/bgchaos.jpg')
  ];

  // 1. Jalan: 10 frame (walk1.png .. walk10.png)
  const walkFrames = [];
  for (let i = 1; i <= 10; i++) {
    walkFrames.push(loadImage(`myasset/Runn/walk${i}.png`, `myasset/Runn/walk${i}.PNG`));
  }

  // 2. Lari: 5 frame (Run11.png .. Run15.png)
  const playerFrames = [];
  for (let i = 11; i <= 15; i++) {
    playerFrames.push(loadImage(`myasset/Runn/Run${i}.png`, `myasset/Runn/Run${i}.PNG`));
  }

  // 3. Lompat: 5 frame (Jump16.png .. Jump20.png)
  const jumpFrames = [];
  for (let i = 16; i <= 20; i++) {
    const runFallback = playerFrames[0]?.src || null;
    jumpFrames.push(loadImage(`myasset/Runn/Jump${i}.png`, runFallback));
  }

  const coinImg = loadImage('myasset/cointengkorak.png', 'asset/cointengkorak.png');

  const obstacleTypes = [
    { name: 'Dunlop Ban', img: loadImage('myasset/ban.png'), width: 96, height: 96 },
    { name: 'Bhappp', img: loadImage('myasset/bhap.png'), width: 104, height: 98 },
    { name: 'Listrik', img: loadImage('myasset/listrik.png'), width: 94, height: 108 }
  ];

  // ==========================================
  // 4. STATE GAME (DELTA TIME & SMOOTH JUMP)
  // ==========================================
  const state = {
    mode: 'ready', // ready | running | paused | dialogue | over
    score: 0,
    money: 0,
    combo: 1,
    comboTimer: 0,
    speed: 410,
    elapsed: 0,
    lastFrame: 0,
    lastScoreTick: 0,
    nextObstacleTime: 0.9,
    nextCoinTime: 0.6,
    bgBlend: 0,
    bgScrollX: 0,
    shakeTimer: 0,
    firstCoinCollected: false,
    phase2Announced: false,
    walkAnimTime: 0,
    runAnimTime: 0,
    jumpAnimTime: 0
  };

  const player = {
    x: 88,
    y: GROUND_Y - 82,
    width: 68,
    height: 82,
    jumpStartAt: null,
    jumpDuration: 0.56,
    jumpPeak: 124,
    baseOffsetY: 0,
    jumpsUsed: 0,
    maxJumps: 2,
    grounded: true,
    walkIndex: 0,
    animIndex: 0,
    jumpIndex: 0,
    ghostTrail: []
  };

  let obstacles = [];
  let coins = [];
  let particles = [];
  let floatingTexts = [];
  let embers = [];

  // ==========================================
  // 5. EFEK PARTIKEL, BARA API & POP-UP
  // ==========================================
  function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 1) * 260,
        size: 3 + Math.random() * 4,
        color,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6
      });
    }
  }

  function spawnFloatingText(text, x, y, color = '#facc15') {
    floatingTexts.push({
      text,
      x,
      y,
      vy: -72,
      color,
      life: 0.75,
      maxLife: 0.75
    });
  }

  function spawnEmber() {
    embers.push({
      x: Math.random() * W,
      y: H + 10,
      vx: -40 - Math.random() * 80,
      vy: -45 - Math.random() * 75,
      size: 2 + Math.random() * 2.5,
      alpha: 0.5 + Math.random() * 0.5
    });
  }

  // ==========================================
  // 6. UI, DIALOG, PAUSE & FULLSCREEN
  // ==========================================
  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(Math.floor(state.score));
    if (moneyEl) moneyEl.textContent = String(state.money);
    if (comboEl) comboEl.textContent = `x${state.combo}`;
    if (phaseLabel) {
      phaseLabel.textContent = state.bgBlend >= 0.5
        ? 'FASE 2: KOTA MEMBARA'
        : 'FASE 1: KOTA KALCER';
    }
  }

  function showAnnouncement(text) {
    if (!announcement) return;
    announcement.textContent = text;
    announcement.classList.add('show');
    setTimeout(() => {
      announcement.classList.remove('show');
    }, 2400);
  }

  function startFirstCoinDialogue() {
    if (!dialogueBox) return;
    state.mode = 'dialogue';
    dialogueBox.style.display = 'block';
    dialogueBox.setAttribute('aria-hidden', 'false');
    if (dialogueSpeaker) dialogueSpeaker.textContent = 'KALCER RUN';
    if (dialogueText) {
      dialogueText.textContent = 'Koin tengkorak didapat! Ambil koin beruntun untuk Combo x5, dan tekan SPASI 2x untuk Double Jump!';
    }
  }

  function closeDialogue() {
    if (!dialogueBox) return;
    dialogueBox.style.display = 'none';
    dialogueBox.setAttribute('aria-hidden', 'true');
    state.mode = 'running';
    state.lastFrame = performance.now();
    state.lastScoreTick = performance.now();
  }

  function togglePause() {
    if (state.mode === 'running') {
      state.mode = 'paused';
      if (pauseBtn) pauseBtn.textContent = 'RESUME';
      startPauseMusic();
    } else if (state.mode === 'paused') {
      stopPauseMusic();
      state.mode = 'running';
      state.lastFrame = performance.now();
      state.lastScoreTick = performance.now();
      if (pauseBtn) pauseBtn.textContent = 'PAUSE';
    }
  }

  let pseudoFullscreen = false;

  function isFullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement || pseudoFullscreen);
  }

  async function toggleFullscreen() {
    try {
      const target = gameShell || document.documentElement;
      const nativeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);

      if (!nativeFs && !pseudoFullscreen) {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
          target.webkitRequestFullscreen();
        } else {
          pseudoFullscreen = true;
          if (gameShell) gameShell.classList.add('is-fullscreen');
        }
      } else if (nativeFs) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        pseudoFullscreen = false;
        if (gameShell) gameShell.classList.remove('is-fullscreen');
      } else {
        pseudoFullscreen = false;
        if (gameShell) gameShell.classList.remove('is-fullscreen');
      }
    } catch (_) {
      pseudoFullscreen = !pseudoFullscreen;
      if (gameShell) {
        gameShell.classList.toggle('is-fullscreen', pseudoFullscreen);
      }
    } finally {
      syncFullscreenLabel();
    }
  }

  function syncFullscreenLabel() {
    const nativeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!nativeFs && gameShell && !gameShell.classList.contains('is-fullscreen')) {
      pseudoFullscreen = false;
    }
    if (fullscreenBtn) {
      fullscreenBtn.textContent = isFullscreenActive() ? 'EXIT FS' : 'FULLSCREEN';
    }
  }

  // ==========================================
  // 7. KONTROL ALUR GAME & LOMPAT SMOOTH
  // ==========================================
  function getCurrentJumpHeight(now) {
    if (player.jumpStartAt === null) return player.baseOffsetY;

    const elapsedJump = (now - player.jumpStartAt) / 1000;
    if (elapsedJump >= player.jumpDuration) {
      player.jumpStartAt = null;
      player.baseOffsetY = 0;
      return 0;
    }

    const t = elapsedJump / player.jumpDuration;
    const arc = Math.sin(Math.PI * t) * player.jumpPeak;
    const carried = player.baseOffsetY * (1 - t);
    return arc + carried;
  }

  function startGame() {
    stopPauseMusic();
    const now = performance.now();
    state.mode = 'running';
    state.score = 0;
    state.money = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.speed = 410;
    state.elapsed = 0;
    state.lastFrame = now;
    state.lastScoreTick = now;
    state.nextObstacleTime = 0.9;
    state.nextCoinTime = 0.6;
    state.bgBlend = 0;
    state.bgScrollX = 0;
    state.shakeTimer = 0;
    state.phase2Announced = false;
    state.walkAnimTime = 0;
    state.runAnimTime = 0;
    state.jumpAnimTime = 0;

    player.y = GROUND_Y - player.height;
    player.jumpStartAt = null;
    player.baseOffsetY = 0;
    player.jumpsUsed = 0;
    player.grounded = true;
    player.walkIndex = 0;
    player.animIndex = 0;
    player.jumpIndex = 0;
    player.ghostTrail = [];

    obstacles = [];
    coins = [];
    particles = [];
    floatingTexts = [];
    embers = [];

    document.body.classList.remove('phase-chaos');
    if (pauseBtn) pauseBtn.textContent = 'PAUSE';
    if (dialogueBox) dialogueBox.style.display = 'none';
    if (endingLayer) endingLayer.style.display = 'none';

    if (overlay) {
      overlay.classList.remove('is-gameover');
      overlay.style.display = 'none';
    }

    updateHUD();
    playSfx(440, 0.12, 'triangle', 0.28, 660);
  }

  function endGame() {
    const now = performance.now();
    const jumpOffset = getCurrentJumpHeight(now);
    player.y = (GROUND_Y - player.height) - jumpOffset;
    player.jumpStartAt = null;
    player.baseOffsetY = 0;

    stopPauseMusic();
    state.mode = 'over';
    state.shakeTimer = 0;
    spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#ef4444', 24);
    playSfx(180, 0.32, 'sawtooth', 0.4, 75);

    if (hitFlash) {
      hitFlash.classList.remove('active');
      void hitFlash.offsetWidth;
      hitFlash.classList.add('active');
    }

    if (endingLayer && endingTitle) {
      endingTitle.textContent = `SKOR AKHIR: ${Math.floor(state.score)} · KOIN: ${state.money}`;
      endingLayer.style.display = 'block';
    }

    if (overlay) {
      overlay.classList.add('is-gameover');
      overlay.style.display = 'flex';
      const title = overlay.querySelector('.title-mark');
      const copy = overlay.querySelector('.intro-copy');
      const btn = overlay.querySelector('#start-button');
      if (title) title.innerHTML = 'LARI <span>TERHENTI</span>';
      if (copy) copy.textContent = 'Rintangan mengenai kamu! Siap pecahkan rekor berikutnya?';
      if (btn) btn.textContent = 'MAIN LAGI (SPASI / KLIK)';
    }
  }

  function handleAction() {
    if (state.mode === 'paused') {
      togglePause();
      return;
    }
    if (state.mode === 'dialogue') {
      closeDialogue();
      return;
    }
    if (state.mode === 'ready' || state.mode === 'over') {
      startGame();
      return;
    }

    if (state.mode === 'running' && player.jumpsUsed < player.maxJumps) {
      const now = performance.now();
      const isDouble = player.jumpsUsed === 1;

      if (isDouble) {
        player.baseOffsetY = Math.max(0, (GROUND_Y - player.height) - player.y);
        player.jumpPeak = 94;
        player.jumpDuration = 0.46;
        playSfx(580, 0.13, 'sine', 0.3, 880);
      } else {
        player.baseOffsetY = 0;
        player.jumpPeak = 124;
        player.jumpDuration = 0.56;
        playSfx(360, 0.12, 'triangle', 0.26, 540);
      }

      player.jumpStartAt = now;
      player.jumpsUsed++;
      player.grounded = false;
      player.jumpIndex = 0;
      state.jumpAnimTime = 0;

      spawnParticles(
        player.x + player.width / 2,
        player.y + player.height,
        isDouble ? '#38bdf8' : '#cbd5e1',
        isDouble ? 12 : 7
      );
      if (isDouble) {
        spawnFloatingText('DOUBLE JUMP!', player.x, player.y - 8, '#38bdf8');
      }
    }
  }

  function isColliding(a, b) {
    const padX = 12;
    const padY = 10;
    return (
      a.x + padX < b.x + b.width - padX &&
      a.x + a.width - padX > b.x + padX &&
      a.y + padY < b.y + b.height - padY &&
      a.y + a.height - padY > b.y + padY
    );
  }

  // ==========================================
  // 8. SPAWN HALANGAN & KOIN
  // ==========================================
  function spawnObstaclePattern() {
    const baseType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const roll = Math.random();

    if (state.score > 140 && roll < 0.3) {
      const secondType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      obstacles.push({
        x: W + 20,
        y: GROUND_Y - baseType.height,
        width: baseType.width,
        height: baseType.height,
        img: baseType.img,
        typeIndex: obstacleTypes.indexOf(baseType)
      });
      obstacles.push({
        x: W + 20 + baseType.width + 16,
        y: GROUND_Y - secondType.height,
        width: secondType.width,
        height: secondType.height,
        img: secondType.img,
        typeIndex: obstacleTypes.indexOf(secondType)
      });
      state.nextObstacleTime = state.elapsed + 1.35 + Math.random() * 0.35;
      return;
    }

    obstacles.push({
      x: W + 20,
      y: GROUND_Y - baseType.height,
      width: baseType.width,
      height: baseType.height,
      img: baseType.img,
      typeIndex: obstacleTypes.indexOf(baseType)
    });

    const minGapSec = Math.max(0.78, 1.18 - Math.floor(state.score / 100) * 0.06);
    state.nextObstacleTime = state.elapsed + minGapSec + Math.random() * 0.32;
  }

  function spawnCoinFormation() {
    const pattern = Math.floor(Math.random() * 3);
    const startX = W + 30;

    if (pattern === 0) {
      coins.push({ x: startX, y: GROUND_Y - 95, width: 30, height: 30, bobOffset: 0 });
    } else if (pattern === 1) {
      const offsets = [0, -35, 0];
      for (let i = 0; i < 3; i++) {
        coins.push({
          x: startX + i * 38,
          y: GROUND_Y - 105 + offsets[i],
          width: 30,
          height: 30,
          bobOffset: i * 0.8
        });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        coins.push({
          x: startX + i * 36,
          y: GROUND_Y - 172,
          width: 30,
          height: 30,
          bobOffset: i * 0.6
        });
      }
    }

    state.nextCoinTime = state.elapsed + 1.0 + Math.random() * 0.4;
  }

  // ==========================================
  // 9. UPDATE LOGIKA (TIAP FRAME)
  // ==========================================
  function isWalkingPace() {
    return player.grounded && state.score < 50 && state.speed < 430;
  }

  function update(now, dt) {
    if (state.mode !== 'running') return;

    if (state.shakeTimer > 0) {
      state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    }

    state.elapsed += dt;
    state.speed = 410 + Math.min(440, Math.floor(state.score / 180) * 65);

    const scoreTicks = Math.floor((now - state.lastScoreTick) / 100);
    if (scoreTicks > 0) {
      state.score += scoreTicks * 3;
      state.lastScoreTick += scoreTicks * 100;
    }

    if (state.combo > 1) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }

    if (state.score >= 400 && state.bgBlend < 1) {
      state.bgBlend = Math.min(1, state.bgBlend + dt * 0.85);
      if (!state.phase2Announced) {
        state.phase2Announced = true;
        state.shakeTimer = 0.22;
        document.body.classList.add('phase-chaos');
        showAnnouncement('FASE 2: KOTA MEMBARA!');
        playSfx(220, 0.45, 'sawtooth', 0.36, 110);
      }
    }

    if (state.bgBlend > 0.2 && Math.random() < dt * 16) {
      spawnEmber();
    }

    state.bgScrollX -= state.speed * 0.55 * dt;
    if (state.bgScrollX <= -W) {
      state.bgScrollX += W;
    }

    const jumpOffset = getCurrentJumpHeight(now);
    const prevGrounded = player.grounded;

    if (player.jumpStartAt !== null || jumpOffset > 0) {
      player.grounded = false;
      player.y = (GROUND_Y - player.height) - jumpOffset;
      state.jumpAnimTime += dt * 1000;
      const stepJumpMs = Math.max(45, (player.jumpDuration * 1000) / jumpFrames.length);
      player.jumpIndex = Math.min(
        jumpFrames.length - 1,
        Math.floor(state.jumpAnimTime / stepJumpMs)
      );

      if (player.jumpsUsed === 2) {
        player.ghostTrail.push({ x: player.x, y: player.y, alpha: 0.45 });
        if (player.ghostTrail.length > 6) player.ghostTrail.shift();
      }
    } else {
      player.y = GROUND_Y - player.height;
      player.grounded = true;
      player.jumpsUsed = 0;
      player.jumpIndex = 0;
      state.jumpAnimTime = 0;
      if (!prevGrounded) {
        player.walkIndex = 0;
        player.animIndex = 0;
        spawnParticles(player.x + player.width / 2, GROUND_Y, '#94a3b8', 5);
      }
    }

    for (const g of player.ghostTrail) g.alpha *= 0.84;
    player.ghostTrail = player.ghostTrail.filter((g) => g.alpha > 0.04);

    if (player.grounded) {
      if (isWalkingPace()) {
        state.walkAnimTime += dt * 1000;
        player.walkIndex = Math.floor(state.walkAnimTime / 65) % walkFrames.length;
      } else {
        state.runAnimTime += dt * 1000;
        const stepMs = state.speed > 560 ? 52 : 70;
        player.animIndex = Math.floor(state.runAnimTime / stepMs) % playerFrames.length;
      }
    }

    if (state.elapsed >= state.nextObstacleTime) spawnObstaclePattern();
    if (state.elapsed >= state.nextCoinTime) spawnCoinFormation();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= state.speed * dt;
      if (isColliding(player, obs)) {
        endGame();
        return;
      }
      if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.x -= state.speed * dt;

      if (isColliding(player, coin)) {
        const gain = 10 * state.combo;
        state.money += gain;
        state.score += 25 * state.combo;
        state.combo = Math.min(5, state.combo + 1);
        state.comboTimer = 3.8;

        spawnParticles(coin.x + 15, coin.y + 15, '#facc15', 10);
        spawnFloatingText(`+${gain} KOIN (x${state.combo})`, coin.x, coin.y - 6, '#facc15');
        playSfx(660 + state.combo * 70, 0.11, 'triangle', 0.32);
        coins.splice(i, 1);

        if (!state.firstCoinCollected) {
          state.firstCoinCollected = true;
          startFirstCoinDialogue();
        }
        continue;
      }

      if (coin.x + coin.width < 0) coins.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    for (let i = embers.length - 1; i >= 0; i--) {
      const em = embers[i];
      em.x += em.vx * dt;
      em.y += em.vy * dt;
      em.alpha -= dt * 0.22;
      if (em.y < -10 || em.alpha <= 0) embers.splice(i, 1);
    }

    updateHUD();
  }

  // ==========================================
  // 10. RENDER KE KANVAS
  // ==========================================
  function getActivePlayerSprite() {
    if (!player.grounded) {
      const jImg = jumpFrames[player.jumpIndex];
      if (jImg && jImg.complete && jImg.naturalWidth > 0) return jImg;
    }

    if (isWalkingPace() || state.mode === 'ready') {
      const wImg = walkFrames[player.walkIndex];
      if (wImg && wImg.complete && wImg.naturalWidth > 0) return wImg;
    }

    const rImg = playerFrames[player.animIndex];
    if (rImg && rImg.complete && rImg.naturalWidth > 0) return rImg;
    return null;
  }

  function drawBgTile(img, x) {
    const srcW = img.naturalWidth;
    const srcH = Math.floor(img.naturalHeight * 0.84);
    ctx.drawImage(img, 0, 0, srcW, srcH, x, 0, W + 2, H);
  }

  function draw(now) {
    ctx.save();

    if (state.mode === 'running' && state.shakeTimer > 0) {
      ctx.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    }

    const bgKalcer = backgrounds[0];
    const bgChaos = backgrounds[1];
    const scrollX = Math.floor(state.bgScrollX);

    if (bgKalcer && bgKalcer.complete && bgKalcer.naturalWidth > 0) {
      drawBgTile(bgKalcer, scrollX - 1);
      drawBgTile(bgKalcer, scrollX + W - 1);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
    }

    if (state.bgBlend > 0 && bgChaos && bgChaos.complete && bgChaos.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = state.bgBlend;
      drawBgTile(bgChaos, scrollX - 1);
      drawBgTile(bgChaos, scrollX + W - 1);
      ctx.restore();
    }

    for (const em of embers) {
      ctx.globalAlpha = Math.max(0, em.alpha * state.bgBlend);
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(em.x, em.y, em.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const shadowScale = Math.max(0.35, 1 - (GROUND_Y - (player.y + player.height)) / 180);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(
      player.x + player.width / 2,
      GROUND_Y + 4,
      (player.width * 0.42) * shadowScale,
      6 * shadowScale,
      0, 0, Math.PI * 2
    );
    ctx.fill();

    const activeSprite = getActivePlayerSprite();
    if (activeSprite) {
      for (const g of player.ghostTrail) {
        ctx.save();
        ctx.globalAlpha = g.alpha;
        ctx.drawImage(activeSprite, g.x, g.y, player.width, player.height);
        ctx.restore();
      }
      ctx.drawImage(activeSprite, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    const fallbackColors = ['#ef4444', '#f97316', '#a855f7'];
    const obstacleDropY = 22;

    for (const obs of obstacles) {
      if (obs.img && obs.img.complete && obs.img.naturalWidth > 0 && obs.img.naturalHeight > 0) {
        const ratio = obs.img.naturalWidth / obs.img.naturalHeight;
        let drawW = obs.width;
        let drawH = obs.height;
        if (ratio < 1) {
          drawW = obs.height * ratio;
        } else {
          drawH = obs.width / ratio;
        }
        const drawX = obs.x + (obs.width - drawW) / 2;
        const drawY = (GROUND_Y + obstacleDropY) - drawH;

        ctx.drawImage(obs.img, drawX, drawY, drawW, drawH);

        obs.y = drawY;
        obs.height = drawH;
      } else {
        ctx.fillStyle = fallbackColors[obs.typeIndex % fallbackColors.length];
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      }
    }

    for (const coin of coins) {
      const bobY = Math.sin(now / 220 + coin.bobOffset) * 4;
      if (coinImg && coinImg.complete && coinImg.naturalWidth > 0) {
        ctx.drawImage(coinImg, coin.x, coin.y + bobY, coin.width, coin.height);
      } else {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(coin.x + 15, coin.y + 15 + bobY, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const ft of floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (state.mode === 'paused') {
      ctx.fillStyle = 'rgba(4, 7, 18, 0.74)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#facc15';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME DIJEDA', W / 2, H / 2 - 8);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Tekan P / ESC / SPASI atau klik untuk lanjut', W / 2, H / 2 + 22);
      ctx.textAlign = 'start';
    }
  }

  function loop(now) {
    if (!state.lastFrame) state.lastFrame = now;
    const dt = Math.min((now - state.lastFrame) / 1000, 0.05);
    state.lastFrame = now;

    update(now, dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  // ==========================================
  // 11. EVENT LISTENER
  // ==========================================
  if (startButton) {
    startButton.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      if (state.mode === 'ready' || state.mode === 'over') startGame();
    });
  }

  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleAction();
    });
  }

  if (dialogueBox) {
    dialogueBox.addEventListener('click', () => {
      if (state.mode === 'dialogue') closeDialogue();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause();
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  document.addEventListener('fullscreenchange', syncFullscreenLabel);
  document.addEventListener('webkitfullscreenchange', syncFullscreenLabel);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) handleAction();
    }
  });

  updateHUD();
  draw(performance.now());
  requestAnimationFrame(loop);
})();