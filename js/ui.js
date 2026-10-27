const vinyl = new VinylEngine();
let current = null;

const grooves = document.getElementById('grooves');
let g = '';
for (let r = 70; r <= 225; r += 2.5)
  g += `<circle r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width=".6"/>`;
grooves.innerHTML = g;

const P = { x: 640, y: 160 };
const ARM_LEN = 350;
const A_REST = 15, A_OUT = 155, A_IN = 138;

function armAt(angleDeg) {
  const a = angleDeg * Math.PI / 180;
  const tx = P.x + ARM_LEN * Math.cos(a);
  const ty = P.y + ARM_LEN * Math.sin(a);
  document.getElementById('armLine').setAttribute('x2', tx);
  document.getElementById('armLine').setAttribute('y2', ty);
  document.getElementById('armHead').innerHTML =
    `<rect x="${tx - 10}" y="${ty - 6}" width="20" height="12" rx="2" transform="rotate(${angleDeg + 90} ${tx} ${ty})" fill="#1a1a1a" stroke="#c8a030" stroke-width="1"/>
     <circle cx="${tx}" cy="${ty}" r="2.5" fill="#c8c8c8"/>`;
  document.getElementById('armWeight').setAttribute('x2', P.x + 40 * Math.cos(a + Math.PI));
  document.getElementById('armWeight').setAttribute('y2', P.y + 40 * Math.sin(a + Math.PI));
}
armAt(A_REST);

function hash(s){ let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function cover(name) {
  const h = hash(name);
  return `radial-gradient(circle at 40% 30%, hsl(${h % 360},65%,55%), hsl(${(h + 60) % 360},55%,18%) 70%)`;
}

const rack = document.getElementById('rack');
async function renderRack() {
  const list = await Library.all();
  rack.innerHTML = list.map(t => `
    <div class="card ${current?.id === t.id ? 'playing' : ''}" data-id="${t.id}">
      <div class="cov" style="background:${cover(t.name)}"></div>
      <div><div class="name">${t.name}</div><div class="meta">${(t.size / 1024 / 1024).toFixed(1)} MB</div></div>
      <div class="act">
        <button class="play">播放</button>
        <button class="del">✕</button>
      </div>
    </div>`).join('') || '<div class="drop">唱片架空空如也 —— 点上方「导入音乐」或拖拽文件到这里</div>';
}

rack.addEventListener('click', async e => {
  vinyl.ensureContext();
  const card = e.target.closest('.card'); if (!card) return;
  const id = card.dataset.id;
  if (e.target.classList.contains('del')) {
    await Library.remove(id);
    if (current?.id === id) { vinyl.stop(); current = null; resetUI(); }
    renderRack();
  } else if (e.target.classList.contains('play')) {
    const rec = await Library.get(id);
    if (rec) loadAndPlay(rec);
  }
});

function resetUI() {
  document.getElementById('playBtn').textContent = '▶ 落针播放';
  document.getElementById('led').classList.remove('on');
  document.getElementById('disc').style.animationPlayState = 'paused';
  armAt(A_REST);
}

function setSpin(on) {
  document.getElementById('disc').style.animationPlayState = on ? 'running' : 'paused';
  document.getElementById('disc').style.setProperty('--spin', (60 / vinyl.rpm) + 's');
}

async function loadAndPlay(track) {
  try {
    vinyl.ensureContext();
    if (vinyl.track) vinyl.stop();
    current = track;
    document.getElementById('labelTitle').textContent = track.name.slice(0, 16);
    document.getElementById('labelSide').textContent = `${vinyl.rpm}`;
    await vinyl.play(track);
    setSpin(true);
    document.getElementById('playBtn').textContent = '⏸ 暂停';
    document.getElementById('led').classList.add('on');
    renderRack();
  } catch (err) {
    alert('播放失败: ' + err.message + '\n\n请确认文件是有效的音频格式（MP3/WAV/OGG/FLAC）');
    console.error(err);
  }
}

document.getElementById('playBtn').addEventListener('click', async () => {
  vinyl.ensureContext();
  if (!current) {
    document.getElementById('fileInput').click();
    return;
  }
  const p = document.getElementById('player');
  if (p.paused) {
    await vinyl.resume();
    setSpin(true);
    document.getElementById('playBtn').textContent = '⏸ 暂停';
    document.getElementById('led').classList.add('on');
  } else {
    vinyl.pause();
    setSpin(false);
    document.getElementById('playBtn').textContent = '▶ 继续播放';
    document.getElementById('led').classList.remove('on');
  }
});

const svg = document.getElementById('surface');
let armDragging = false;

function getSvgPoint(clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function angleFromPointer(clientX, clientY) {
  const pt = getSvgPoint(clientX, clientY);
  const dx = pt.x - P.x;
  const dy = pt.y - P.y;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

document.getElementById('armLine').style.pointerEvents = 'stroke';
document.getElementById('armLine').style.cursor = 'grab';

svg.addEventListener('mousedown', (e) => {
  const target = e.target;
  if (target.id === 'armLine' || target.closest('#armHead') || target.id === 'pivot') {
    armDragging = true;
    e.preventDefault();
  }
});

document.addEventListener('mousemove', (e) => {
  if (!armDragging) return;
  let angle = angleFromPointer(e.clientX, e.clientY);
  angle = Math.max(0, Math.min(175, angle));
  armAt(angle);
});

document.addEventListener('mouseup', (e) => {
  if (!armDragging) return;
  armDragging = false;
  let angle = angleFromPointer(e.clientX, e.clientY);
  const p = document.getElementById('player');

  if (angle >= A_OUT - 5 && angle <= A_IN + 5) {
    angle = Math.max(A_IN, Math.min(A_OUT, angle));
    armAt(angle);
    if (current && p.duration) {
      const progress = (A_OUT - angle) / (A_OUT - A_IN);
      p.currentTime = progress * p.duration;
      if (p.paused) {
        vinyl.resume();
        setSpin(true);
        document.getElementById('playBtn').textContent = '⏸ 暂停';
        document.getElementById('led').classList.add('on');
      }
    }
  } else {
    armAt(A_REST);
  }
});

document.getElementById('player').addEventListener('timeupdate', () => {
  if (armDragging) return;
  const p = document.getElementById('player');
  const dur = p.duration || 0;
  if (!dur || p.paused) return;
  const prog = p.currentTime / dur;
  armAt(A_OUT - (A_OUT - A_IN) * prog);
  document.getElementById('labelSide').textContent =
    `${Math.floor(p.currentTime)}s / ${Math.floor(dur)}s`;
});

document.getElementById('player').addEventListener('ended', () => {
  vinyl.pause();
  setSpin(false);
  document.getElementById('playBtn').textContent = '▶ 落针播放';
  document.getElementById('led').classList.remove('on');
  armAt(A_REST);
});

document.getElementById('player').addEventListener('error', (e) => {
  console.error('audio error:', e, document.getElementById('player').error);
});

const fileInput = document.getElementById('fileInput');
const drop = document.getElementById('drop');

async function importFiles(files) {
  vinyl.ensureContext();
  const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name));
  if (!audioFiles.length) {
    alert('请选择音频文件（MP3 / WAV / OGG / FLAC / M4A）');
    return;
  }
  for (const f of audioFiles) {
    await Library.add(f.name, f);
  }
  renderRack();
  const all = await Library.all();
  if (all.length && !current) loadAndPlay(all[all.length - 1]);
}

document.getElementById('importBtn').onclick = (e) => { vinyl.ensureContext(); fileInput.click(); };
fileInput.onchange = e => { importFiles(e.target.files); fileInput.value = ''; };
drop.onclick = () => { vinyl.ensureContext(); fileInput.click(); };
['dragover','dragleave','drop'].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.toggle('over', ev === 'dragover');
    if (ev === 'drop') importFiles(e.dataTransfer.files);
  }));

document.getElementById('vol').oninput = e => vinyl.setVolume(+e.target.value);
document.getElementById('crackle').oninput = e => vinyl.setCrackle(+e.target.value);
document.getElementById('warm').oninput = e => vinyl.setWarm(+e.target.value);
document.getElementById('wow').oninput = e => vinyl.startWow(+e.target.value);

vinyl.setVolume(80);
vinyl.startWow(20);

document.querySelectorAll('.rpm button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.rpm button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  vinyl.setRpm(+b.dataset.rpm);
  setSpin(!document.getElementById('player').paused);
});

const scope = document.getElementById('scope'), ctx2 = scope.getContext('2d');
function draw() {
  const lvl = vinyl.getLevel();
  ctx2.fillStyle = '#10151b'; ctx2.fillRect(0, 0, scope.width, scope.height);
  ctx2.strokeStyle = '#ff7a45'; ctx2.lineWidth = 2; ctx2.beginPath();
  for (let i = 0; i < scope.width; i++) {
    const y = scope.height / 2 - (Math.sin(i * 0.18) * lvl * 20 + (Math.random() - .5) * lvl * 8);
    i ? ctx2.lineTo(i, y) : ctx2.moveTo(i, y);
  }
  ctx2.stroke();
  requestAnimationFrame(draw);
}
draw();

document.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); document.getElementById('playBtn').click(); }
});

Library.open().then(renderRack);
