const vinyl = new VinylEngine();
let current = null;
let spinning = false;

/* ---------- 唱片纹路 ---------- */
const grooves = document.getElementById('grooves');
let g = '';
for (let r = 64; r <= 200; r += 3.1)
  g += `<circle r="${r}" fill="none" stroke="rgba(255,255,255,.055)" stroke-width=".7"/>`;
grooves.innerHTML = g;

/* ---------- 唱臂几何 ---------- */
const P = { x: 560, y: 48 };        // 转轴
const C = { x: 250, y: 235 };       // 唱片中心
const ARM_LEN = 310;
const A_REST = 100, A_OUT = 115, A_IN = 143;   // 角度(度)

function armAt(angleDeg, lifted = false) {
  const a = angleDeg * Math.PI / 180;
  const L = ARM_LEN - (lifted ? 26 : 0);
  const tx = P.x + L * Math.cos(a);
  const ty = P.y + L * Math.sin(a);
  document.getElementById('armLine').setAttribute('x2', tx);
  document.getElementById('armLine').setAttribute('y2', ty);
  document.getElementById('armHead').innerHTML =
    `<rect x="${tx - 12}" y="${ty - 8}" width="24" height="16" rx="4" transform="rotate(${angleDeg} ${tx} ${ty})" fill="#20262e"/>
     <circle cx="${tx}" cy="${ty}" r="3" fill="#d7dbe0"/>`;
  document.getElementById('armWeight').setAttribute('x2', P.x + 40 * Math.cos(a + Math.PI));
  document.getElementById('armWeight').setAttribute('y2', P.y + 40 * Math.sin(a + Math.PI));
}
armAt(A_REST);

/* ---------- 封面（文件名哈希生成） ---------- */
function hash(s){ let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function cover(name) {
  const h = hash(name);
  return `radial-gradient(circle at 40% 30%, hsl(${h % 360},65%,55%), hsl(${(h + 60) % 360},55%,18%) 70%)`;
}

/* ---------- 唱片架渲染 ---------- */
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
    </div>`).join('') || '<div class="drop">唱片架空空如也 —— 导入音乐开始</div>';
}

rack.addEventListener('click', async e => {
  const card = e.target.closest('.card'); if (!card) return;
  const id = card.dataset.id;
  if (e.target.classList.contains('del')) {
    await Library.remove(id);
    if (current?.id === id) { vinyl.stop(); current = null; }
    renderRack();
  } else if (e.target.classList.contains('play')) {
    const rec = await Library.get(id);
    if (rec) loadAndPlay(rec);
  }
});

/* ---------- 播放 / 落针 ---------- */
async function loadAndPlay(track) {
  if (vinyl.track) vinyl.stop();
  current = track;
  document.getElementById('labelTitle').textContent = track.name.slice(0, 18);
  document.getElementById('labelSide').textContent = `${vinyl.rpm} RPM`;
  await vinyl.play(track);
  setSpin(true);
  document.getElementById('playBtn').textContent = '⏏ 抬针停止';
  document.getElementById('led').classList.add('on');
  renderRack();
}

function setSpin(on) {
  document.getElementById('disc').style.animationPlayState = on ? 'running' : 'paused';
  document.getElementById('disc').style.setProperty('--spin', (60 / vinyl.rpm) + 's');
}

document.getElementById('playBtn').addEventListener('click', async () => {
  if (!current) {
    document.getElementById('fileInput').click();
    return;
  }
  if (document.getElementById('player').paused) {
    await vinyl.play(current);
    setSpin(true);
    document.getElementById('playBtn').textContent = '⏏ 抬针停止';
    document.getElementById('led').classList.add('on');
  } else {
    vinyl.stop();
    setSpin(false);
    document.getElementById('playBtn').textContent = '▶ 落针播放';
    document.getElementById('led').classList.remove('on');
    armAt(A_REST);
  }
});

/* ---------- 唱臂随进度移动 + 进度 ---------- */
document.getElementById('player').addEventListener('timeupdate', () => {
  const p = document.getElementById('player');
  const dur = p.duration || 0;
  if (!dur || p.paused) return;
  const prog = p.currentTime / dur;
  armAt(A_OUT + (A_IN - A_OUT) * prog);
  document.getElementById('labelSide').textContent =
    `${Math.floor(p.currentTime)}s / ${Math.floor(dur)}s`;
});

/* ---------- 导入 ---------- */
const fileInput = document.getElementById('fileInput');
const drop = document.getElementById('drop');
async function importFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('audio/')) continue;
    await Library.add(f.name, f);
  }
  renderRack();
  const first = await Library.all();
  if (first.length && !current) loadAndPlay(first[0]);
}
document.getElementById('importBtn').onclick = () => fileInput.click();
fileInput.onchange = e => importFiles(e.target.files);
drop.onclick = () => fileInput.click();
['dragover','dragleave','drop'].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.toggle('over', ev === 'dragover');
    if (ev === 'drop') importFiles(e.dataTransfer.files);
  }));

/* ---------- 旋钮 ---------- */
document.getElementById('vol').oninput = e => vinyl.setVolume(+e.target.value);
document.getElementById('crackle').oninput = e => vinyl.setCrackle(+e.target.value);
document.getElementById('warm').oninput = e => vinyl.setWarm(+e.target.value);
document.getElementById('wow').oninput = e => vinyl.startWow(+e.target.value);
vinyl.startWow(20);

document.querySelectorAll('.rpm button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.rpm button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  vinyl.setRpm(+b.dataset.rpm);
  setSpin(!document.getElementById('player').paused);
});

/* ---------- 示波器 ---------- */
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

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); document.getElementById('playBtn').click(); }
});

/* init */
Library.open().then(renderRack);
