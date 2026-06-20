// =================================================================
// 桌遊工具頁 (tools.js)
// 每個小工具獨立一個區塊，統一由 initializeToolsPage() 掛載
// =================================================================

function initializeToolsPage() {
    document.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
            const tool = card.dataset.tool;
            if (tool === 'first-player') {
                document.getElementById('first-player-overlay').style.display = 'flex';
                fpOpen();
            } else if (tool === 'timer') {
                timerOpen();
            } else if (tool === 'dice') {
                diceOpen();
            }
        });
    });
}

// ================================================================
// 工具一：起始玩家抽籤
// ================================================================

const FP_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
    '#00bcd4', '#8bc34a'
];

let fpTouches      = {};         // identifier -> { x, y, colorIdx, el }
let fpPhase        = 'waiting';  // 'waiting' | 'countdown' | 'result'
let fpColorSeq     = 0;
let fpStabTimer    = null;
let fpCountTimer   = null;
let fpCountVal     = 3;

function fpOpen() {
    fpResetState();

    const overlay = document.getElementById('first-player-overlay');
    overlay.addEventListener('touchstart',  fpOnTouchStart,  { passive: false });
    overlay.addEventListener('touchend',    fpOnTouchEnd,    { passive: false });
    overlay.addEventListener('touchcancel', fpOnTouchEnd,    { passive: false });

    // touchstart 呼叫 preventDefault 會阻止 click，改用 touchend + stopPropagation
    const closeBtn = document.getElementById('fp-close-btn');
    closeBtn.onclick = fpClose;
    closeBtn.addEventListener('touchend', (e) => { e.stopPropagation(); fpClose(); }, { passive: false });
}

function fpClose() {
    clearTimeout(fpStabTimer);
    clearInterval(fpCountTimer);

    const overlay = document.getElementById('first-player-overlay');
    overlay.removeEventListener('touchstart',  fpOnTouchStart);
    overlay.removeEventListener('touchend',    fpOnTouchEnd);
    overlay.removeEventListener('touchcancel', fpOnTouchEnd);
    overlay.style.display = 'none';
}

function fpResetState() {
    clearTimeout(fpStabTimer);
    clearInterval(fpCountTimer);

    Object.values(fpTouches).forEach(tp => tp.el.remove());

    fpTouches  = {};
    fpPhase    = 'waiting';
    fpColorSeq = 0;

    const display = document.getElementById('fp-countdown-display');
    display.textContent = '';
    display.style.opacity = '0';
    display.classList.remove('tick');

    document.getElementById('fp-status-text').textContent = '請所有玩家將手指放在螢幕上';
}

function fpOnTouchStart(e) {
    e.preventDefault();
    if (fpPhase === 'result') return;
    if (fpPhase === 'countdown') fpCancelCountdown();

    Array.from(e.changedTouches).forEach(touch => {
        if (fpTouches[touch.identifier]) return;

        const colorIdx = fpColorSeq % FP_COLORS.length;
        fpColorSeq++;

        const el = document.createElement('div');
        el.className = 'fp-circle';
        el.style.left = touch.clientX + 'px';
        el.style.top  = touch.clientY + 'px';
        el.style.borderColor = FP_COLORS[colorIdx];
        el.style.backgroundColor = FP_COLORS[colorIdx] + '33';

        document.getElementById('first-player-overlay').appendChild(el);

        fpTouches[touch.identifier] = { x: touch.clientX, y: touch.clientY, colorIdx, el };
    });

    fpUpdateStatus();
    fpScheduleCountdown();
}

function fpOnTouchEnd(e) {
    e.preventDefault();
    if (fpPhase === 'result') return;
    if (fpPhase === 'countdown') fpCancelCountdown();

    Array.from(e.changedTouches).forEach(touch => {
        const tp = fpTouches[touch.identifier];
        if (tp) { tp.el.remove(); delete fpTouches[touch.identifier]; }
    });

    fpUpdateStatus();
    fpScheduleCountdown();
}

function fpUpdateStatus() {
    const n = Object.keys(fpTouches).length;
    const el = document.getElementById('fp-status-text');
    if (n === 0)      el.textContent = '請所有玩家將手指放在螢幕上';
    else if (n === 1) el.textContent = '1 位玩家就緒，等待其他人...';
    else              el.textContent = `${n} 位玩家就緒，保持不動...`;
}

function fpScheduleCountdown() {
    clearTimeout(fpStabTimer);
    if (Object.keys(fpTouches).length >= 2 && fpPhase === 'waiting') {
        fpStabTimer = setTimeout(fpStartCountdown, 300);
    }
}

function fpStartCountdown() {
    fpPhase    = 'countdown';
    fpCountVal = 3;

    document.getElementById('fp-status-text').textContent = '放開手指可取消！';
    fpTickCountdown();

    fpCountTimer = setInterval(() => {
        fpCountVal--;
        if (fpCountVal > 0) {
            fpTickCountdown();
        } else {
            clearInterval(fpCountTimer);
            fpShowResult();
        }
    }, 1000);
}

function fpTickCountdown() {
    const display = document.getElementById('fp-countdown-display');
    display.style.opacity = '1';
    display.textContent = fpCountVal;
    display.classList.remove('tick');
    void display.offsetWidth;
    display.classList.add('tick');
}

function fpCancelCountdown() {
    clearInterval(fpCountTimer);
    clearTimeout(fpStabTimer);
    fpPhase = 'waiting';

    const display = document.getElementById('fp-countdown-display');
    display.style.opacity = '0';
    display.classList.remove('tick');

    fpUpdateStatus();
}

// ================================================================
// 工具二：沙漏計時器
// ================================================================

const TIMER_CIRCUMFERENCE = 553; // 2π × 88

let timerTotal    = 0;
let timerLeft     = 0;
let timerPaused   = false;
let timerInterval = null;

function timerOpen() {
    document.getElementById('timer-overlay').style.display = 'flex';
    timerShowSetup();

    const closeBtn = document.getElementById('timer-close-btn');
    closeBtn.onclick = timerClose;
}

function timerClose() {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('timer-overlay').style.display = 'none';
}

function timerShowSetup() {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('timer-setup').style.display = 'block';
    document.getElementById('timer-running').style.display = 'none';

    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
        btn.onclick = () => {
            timerTotal = parseInt(btn.dataset.seconds);
            timerLeft  = timerTotal;
            timerShowRunning();
        };
    });
}

function timerShowRunning() {
    document.getElementById('timer-setup').style.display = 'none';
    const running = document.getElementById('timer-running');
    running.style.display = 'flex';

    timerPaused = false;
    timerRender();

    document.getElementById('timer-pause-btn').textContent = '暫停';
    document.getElementById('timer-pause-btn').onclick = timerTogglePause;
    document.getElementById('timer-reset-btn').onclick  = timerShowSetup;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timerPaused) return;
        timerLeft--;
        timerRender();
        if (timerLeft <= 0) {
            clearInterval(timerInterval);
            timerDone();
        }
    }, 1000);
}

function timerTogglePause() {
    timerPaused = !timerPaused;
    document.getElementById('timer-pause-btn').textContent = timerPaused ? '繼續' : '暫停';
}

function timerRender() {
    const mins = Math.floor(timerLeft / 60);
    const secs = timerLeft % 60;
    const display = document.getElementById('timer-display');
    display.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    display.classList.toggle('done', timerLeft === 0);

    const ratio  = timerTotal > 0 ? timerLeft / timerTotal : 0;
    const offset = TIMER_CIRCUMFERENCE * (1 - ratio);
    const prog   = document.getElementById('timer-ring-prog');
    prog.style.strokeDashoffset = offset;
    prog.classList.toggle('done', timerLeft === 0);
}

function timerDone() {
    document.getElementById('timer-display').textContent = '時間到！';
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
}

// ================================================================
// 工具三：骰子
// ================================================================

let diceSelectedSides = 6;
let diceSelectedCount = 1;

function diceOpen() {
    document.getElementById('dice-overlay').style.display = 'flex';
    diceSelectedSides = 6;
    diceSelectedCount = 1;

    document.querySelectorAll('.dice-type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.sides === '6'));
    document.querySelectorAll('.dice-count-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.count === '1'));

    document.getElementById('dice-result-area').innerHTML =
        '<p class="dice-hint">選好後點擊下方擲骰</p>';

    document.querySelectorAll('.dice-type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.dice-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            diceSelectedSides = parseInt(btn.dataset.sides);
        };
    });

    document.querySelectorAll('.dice-count-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.dice-count-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            diceSelectedCount = parseInt(btn.dataset.count);
        };
    });

    document.getElementById('dice-roll-btn').onclick = diceRoll;

    const closeBtn = document.getElementById('dice-close-btn');
    closeBtn.onclick = () => {
        document.getElementById('dice-overlay').style.display = 'none';
    };
}

function diceRoll() {
    const results = Array.from({ length: diceSelectedCount },
        () => Math.floor(Math.random() * diceSelectedSides) + 1);
    const total = results.reduce((a, b) => a + b, 0);

    const diceHTML = results.map((r, i) =>
        `<div class="dice-single" style="animation-delay:${i * 80}ms">${r}</div>`
    ).join('');

    const totalHTML = diceSelectedCount > 1
        ? `<p class="dice-total-line">合計 <span>${total}</span></p>` : '';

    document.getElementById('dice-result-area').innerHTML =
        `<div class="dice-results-row">${diceHTML}</div>${totalHTML}`;
}

function fpShowResult() {
    fpPhase = 'result';

    document.getElementById('fp-countdown-display').style.opacity = '0';
    document.getElementById('fp-status-text').textContent = '🎉 數字越小越先手！';

    const ids = Object.keys(fpTouches).sort(() => Math.random() - 0.5);

    ids.forEach((id, index) => {
        const tp      = fpTouches[id];
        const rank    = index + 1;
        const color   = FP_COLORS[tp.colorIdx];
        const isFirst = rank === 1;

        setTimeout(() => {
            tp.el.textContent = rank;
            tp.el.style.backgroundColor = color;
            tp.el.style.borderColor = color;
            tp.el.classList.add('result');
            if (isFirst) tp.el.classList.add('first');
        }, index * 120);
    });
}
