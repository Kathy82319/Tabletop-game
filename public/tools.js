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
            } else if (tool === 'scoreboard') {
                sbOpen();
            } else if (tool === 'teams') {
                teamsOpen();
            } else if (tool === 'counter') {
                counterOpen();
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

    document.getElementById('timer-custom-start').onclick = () => {
        const mins = parseInt(document.getElementById('timer-custom-min').value) || 0;
        const secs = parseInt(document.getElementById('timer-custom-sec').value) || 0;
        const total = mins * 60 + secs;
        if (total <= 0) return;
        timerTotal = total;
        timerLeft  = total;
        timerShowRunning();
    };
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

const D6_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

function diceValueToDisplay(value, sides) {
    return sides === 6 ? D6_FACES[value - 1] : value;
}

function diceRoll() {
    const resultArea = document.getElementById('dice-result-area');

    // 建立佔位元素，先顯示滾動狀態
    const row = document.createElement('div');
    row.className = 'dice-results-row';
    const isD6 = diceSelectedSides === 6;
    const cells = Array.from({ length: diceSelectedCount }, () => {
        const el = document.createElement('div');
        el.className = 'dice-single rolling' + (isD6 ? ' d6-face' : '');
        el.textContent = diceValueToDisplay(
            Math.floor(Math.random() * diceSelectedSides) + 1,
            diceSelectedSides
        );
        row.appendChild(el);
        return el;
    });
    resultArea.innerHTML = '';
    resultArea.appendChild(row);

    // 快速滾動數字（老虎機效果）
    let tick = 0;
    const rolling = setInterval(() => {
        cells.forEach(el => {
            const r = Math.floor(Math.random() * diceSelectedSides) + 1;
            el.textContent = diceValueToDisplay(r, diceSelectedSides);
        });
        tick++;
        if (tick >= 10) {
            clearInterval(rolling);
            diceShowFinalResult(cells);
        }
    }, 60);
}

function diceShowFinalResult(cells) {
    const results = cells.map(() =>
        Math.floor(Math.random() * diceSelectedSides) + 1
    );
    const total = results.reduce((a, b) => a + b, 0);

    cells.forEach((el, i) => {
        el.classList.remove('rolling');
        el.classList.add('landed');
        el.style.animationDelay = `${i * 100}ms`;
        el.textContent = diceValueToDisplay(results[i], diceSelectedSides);
    });

    const resultArea = document.getElementById('dice-result-area');
    const existing = resultArea.querySelector('.dice-total-line');
    if (existing) existing.remove();

    if (diceSelectedCount > 1) {
        const p = document.createElement('p');
        p.className = 'dice-total-line';
        p.innerHTML = `合計 <span>${total}</span>`;
        resultArea.appendChild(p);
    }
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

// ================================================================
// 工具四：記分板
// ================================================================

let sbPlayers      = [];   // [{ name, score }]
let sbLog          = [];   // [{ name, delta, newScore, ts }]
let sbCustomTarget = -1;
let sbIsPlaying    = false;

const SB_STORAGE_KEY = 'sb_history';
const SB_MAX_HISTORY = 5;

function sbSaveHistory() {
    if (!sbIsPlaying || sbPlayers.length === 0) return;
    const history = JSON.parse(localStorage.getItem(SB_STORAGE_KEY) || '[]');
    history.unshift({ ts: Date.now(), players: sbPlayers.map(p => ({ ...p })) });
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(history.slice(0, SB_MAX_HISTORY)));
}

function sbLoadHistory() {
    return JSON.parse(localStorage.getItem(SB_STORAGE_KEY) || '[]');
}

function sbRenderHistory() {
    const history = sbLoadHistory();
    const section = document.getElementById('sb-history-section');
    const list    = document.getElementById('sb-history-list');

    if (history.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = '';

    history.forEach((entry) => {
        const d = new Date(entry.ts);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ` +
            `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        const sorted  = [...entry.players].sort((a, b) => b.score - a.score);
        const summary = sorted.map((p, i) =>
            `${i === 0 ? '👑' : i + 1}. ${p.name} ${p.score} 分`
        ).join('\n');

        const item = document.createElement('div');
        item.className = 'sb-history-item';
        item.innerHTML = `
            <div class="sb-history-meta">${dateStr} · ${entry.players.length} 位玩家</div>
            <div class="sb-history-summary" style="white-space:pre-line">${summary}</div>
            <div class="sb-history-actions">
                <button class="sb-history-continue-btn">繼續這場</button>
                <button class="sb-history-new-btn">同樣玩家重開</button>
            </div>`;

        item.querySelector('.sb-history-continue-btn').onclick = () => {
            sbPlayers   = entry.players.map(p => ({ ...p }));
            sbLog       = [];
            sbIsPlaying = true;
            document.getElementById('sb-setup').style.display  = 'none';
            document.getElementById('sb-playing').style.display = 'flex';
            document.getElementById('sb-reset-btn').onclick = sbShowSetup;
            document.getElementById('sb-log-open-btn').onclick = sbOpenLog;
            sbRender();
        };

        item.querySelector('.sb-history-new-btn').onclick = () => {
            const list = document.getElementById('sb-player-list');
            list.innerHTML = '';
            entry.players.forEach(p => sbAddPlayerRow(p.name, list));
        };

        list.appendChild(item);
    });
}

function sbOpen() {
    document.getElementById('scoreboard-overlay').style.display = 'flex';
    document.getElementById('sb-close-btn').onclick = sbClose;
    sbShowSetup();
}

function sbClose() {
    sbSaveHistory();
    sbIsPlaying = false;
    document.getElementById('scoreboard-overlay').style.display = 'none';
    document.getElementById('sb-custom-popup').style.display = 'none';
}

function sbShowSetup() {
    sbSaveHistory();
    sbIsPlaying = false;

    document.getElementById('sb-setup').style.display = 'flex';
    document.getElementById('sb-playing').style.display = 'none';
    document.getElementById('sb-custom-popup').style.display = 'none';

    const list = document.getElementById('sb-player-list');
    list.innerHTML = '';
    ['玩家 1', '玩家 2', '玩家 3', '玩家 4'].forEach(name => sbAddPlayerRow(name, list));

    document.getElementById('sb-add-btn').onclick = () => sbAddPlayerRow('', list);
    document.getElementById('sb-start-btn').onclick = sbStart;
    sbRenderHistory();
}

function sbAddPlayerRow(defaultName, list) {
    list = list || document.getElementById('sb-player-list');
    const idx = list.querySelectorAll('.player-input-row').length + 1;
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `<input type="text" class="player-name-input" placeholder="玩家 ${idx}" value="${defaultName}">
                     <button class="remove-player-btn">×</button>`;
    row.querySelector('.remove-player-btn').onclick = () => {
        if (list.querySelectorAll('.player-input-row').length > 2) row.remove();
    };
    list.appendChild(row);
}

function sbStart() {
    const inputs = document.querySelectorAll('#sb-player-list .player-name-input');
    sbPlayers = Array.from(inputs).map((inp, i) => ({
        name: inp.value.trim() || `玩家 ${i + 1}`,
        score: 0
    }));
    sbLog = [];
    sbIsPlaying = true;
    document.getElementById('sb-setup').style.display = 'none';
    document.getElementById('sb-playing').style.display = 'flex';
    document.getElementById('sb-reset-btn').onclick = sbShowSetup;
    document.getElementById('sb-log-open-btn').onclick = sbOpenLog;
    sbRender();
}

function sbAddLog(playerIdx, delta) {
    sbLog.unshift({
        name:     sbPlayers[playerIdx].name,
        delta:    delta,
        newScore: sbPlayers[playerIdx].score,
        ts:       Date.now()
    });
}

function sbOpenLog() {
    const drawer = document.getElementById('sb-log-drawer');
    drawer.style.display = 'flex';
    document.getElementById('sb-log-close-btn').onclick = () => {
        drawer.style.display = 'none';
    };
    sbRenderLog();
}

function sbRenderLog() {
    const list  = document.getElementById('sb-log-list');
    const empty = document.getElementById('sb-log-empty');
    list.innerHTML = '';

    if (sbLog.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    sbLog.forEach(entry => {
        const d   = new Date(entry.ts);
        const ts  = `${d.getHours().toString().padStart(2, '0')}:` +
                    `${d.getMinutes().toString().padStart(2, '0')}:` +
                    `${d.getSeconds().toString().padStart(2, '0')}`;
        const pos = entry.delta > 0;
        const el  = document.createElement('div');
        el.className = 'sb-log-entry';
        el.innerHTML =
            `<span class="sb-log-time">${ts}</span>` +
            `<span class="sb-log-name">${entry.name}</span>` +
            `<span class="sb-log-delta ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${entry.delta}</span>` +
            `<span class="sb-log-after">→ ${entry.newScore} 分</span>`;
        list.appendChild(el);
    });
}

function sbRender() {
    const ranked = sbPlayers
        .map((p, i) => ({ ...p, idx: i }))
        .sort((a, b) => b.score - a.score);

    const container = document.getElementById('sb-rankings');
    container.innerHTML = '';

    ranked.forEach((p, rank) => {
        const card = document.createElement('div');
        card.className = 'sb-player-card' + (rank === 0 ? ' sb-first' : '');
        card.innerHTML = `
            <div class="sb-card-top">
                <span class="sb-rank">${rank === 0 ? '👑' : rank + 1}</span>
                <span class="sb-name">${p.name}</span>
                <span class="sb-score">${p.score}<span class="sb-score-unit"> 分</span></span>
            </div>
            <div class="sb-card-btns">
                <button class="sb-btn" data-idx="${p.idx}" data-d="-10">-10</button>
                <button class="sb-btn" data-idx="${p.idx}" data-d="-1">-1</button>
                <button class="sb-btn" data-idx="${p.idx}" data-d="1">+1</button>
                <button class="sb-btn" data-idx="${p.idx}" data-d="10">+10</button>
                <button class="sb-btn sb-custom-btn" data-idx="${p.idx}" data-d="custom">自訂</button>
            </div>`;
        container.appendChild(card);
    });

    container.querySelectorAll('.sb-btn').forEach(btn => {
        btn.onclick = () => {
            const i = parseInt(btn.dataset.idx);
            if (btn.dataset.d === 'custom') {
                sbOpenCustomPopup(i);
            } else {
                const delta = parseInt(btn.dataset.d);
                sbPlayers[i].score += delta;
                sbAddLog(i, delta);
                sbRender();
            }
        };
    });
}

function sbOpenCustomPopup(playerIdx) {
    sbCustomTarget = playerIdx;
    const popup = document.getElementById('sb-custom-popup');
    document.getElementById('sb-popup-label').textContent = `為「${sbPlayers[playerIdx].name}」加分或扣分`;
    document.getElementById('sb-popup-input').value = '';
    popup.style.display = 'flex';
    setTimeout(() => document.getElementById('sb-popup-input').focus(), 50);

    document.getElementById('sb-popup-plus').onclick = () => sbApplyCustom(1);
    document.getElementById('sb-popup-minus').onclick = () => sbApplyCustom(-1);
    document.getElementById('sb-popup-cancel').onclick = () => {
        popup.style.display = 'none';
    };
}

function sbApplyCustom(sign) {
    const val = parseInt(document.getElementById('sb-popup-input').value);
    if (!isNaN(val) && val > 0 && sbCustomTarget >= 0) {
        const delta = sign * val;
        sbPlayers[sbCustomTarget].score += delta;
        sbAddLog(sbCustomTarget, delta);
    }
    document.getElementById('sb-custom-popup').style.display = 'none';
    sbRender();
}

// ================================================================
// 工具五：隨機分組
// ================================================================

let teamsCount = 2;
let teamsLastPlayers = [];

const TEAM_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
const TEAM_NAMES  = ['A 隊', 'B 隊', 'C 隊', 'D 隊'];

function teamsOpen() {
    document.getElementById('teams-overlay').style.display = 'flex';
    document.getElementById('teams-close-btn').onclick = teamsClose;
    teamsShowSetup();
}

function teamsClose() {
    document.getElementById('teams-overlay').style.display = 'none';
}

function teamsShowSetup() {
    document.getElementById('teams-setup').style.display = 'flex';
    document.getElementById('teams-result').style.display = 'none';

    const list = document.getElementById('teams-player-list');
    list.innerHTML = '';

    const defaults = teamsLastPlayers.length >= 2
        ? teamsLastPlayers
        : ['玩家 1', '玩家 2', '玩家 3', '玩家 4'];
    defaults.forEach(name => teamsAddPlayerRow(name, list));

    document.getElementById('teams-add-btn').onclick = () => teamsAddPlayerRow('', list);
    document.getElementById('teams-go-btn').onclick   = teamsShuffle;

    document.querySelectorAll('.tools-option-btn[data-teams]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.teams) === teamsCount);
        btn.onclick = () => {
            document.querySelectorAll('.tools-option-btn[data-teams]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            teamsCount = parseInt(btn.dataset.teams);
        };
    });
}

function teamsAddPlayerRow(defaultName, list) {
    list = list || document.getElementById('teams-player-list');
    const idx = list.querySelectorAll('.player-input-row').length + 1;
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `<input type="text" class="player-name-input" placeholder="玩家 ${idx}" value="${defaultName}">
                     <button class="remove-player-btn">×</button>`;
    row.querySelector('.remove-player-btn').onclick = () => {
        if (list.querySelectorAll('.player-input-row').length > 2) row.remove();
    };
    list.appendChild(row);
}

function teamsShuffle() {
    const inputs = document.querySelectorAll('#teams-player-list .player-name-input');
    let players = Array.from(inputs).map((inp, i) => inp.value.trim() || `玩家 ${i + 1}`);
    if (players.length < teamsCount) return;

    teamsLastPlayers = players.slice();

    // Fisher-Yates shuffle
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    const teams = Array.from({ length: teamsCount }, () => []);
    players.forEach((p, i) => teams[i % teamsCount].push(p));

    document.getElementById('teams-setup').style.display = 'none';
    const resultDiv = document.getElementById('teams-result');
    resultDiv.style.display = 'flex';

    const cardsContainer = document.getElementById('teams-result-cards');
    cardsContainer.innerHTML = '';
    teams.forEach((team, i) => {
        const card = document.createElement('div');
        card.className = 'teams-result-card';
        card.style.borderColor = TEAM_COLORS[i];
        card.innerHTML = `<div class="teams-result-header" style="color:${TEAM_COLORS[i]}">${TEAM_NAMES[i]}</div>
                          <div class="teams-result-members">${team.map(p => `<span>${p}</span>`).join('')}</div>`;
        cardsContainer.appendChild(card);
    });

    document.getElementById('teams-reshuffle-btn').onclick = () => {
        // 用同一批名字重新洗牌
        teamsShuffle();
    };
}

// ================================================================
// 工具六：資源計數器
// ================================================================

// counterResDefs: [{ name, startVal, maxVal }]  (maxVal = null 代表無上限)
// counterPlayers: [{ name, resources: [{ value, maxVal }] }]
let counterResDefs = [];
let counterPlayers = [];

function counterOpen() {
    document.getElementById('counter-overlay').style.display = 'flex';
    document.getElementById('counter-close-btn').onclick = counterClose;
    counterShowSetup();
}

function counterClose() {
    document.getElementById('counter-overlay').style.display = 'none';
}

function counterShowSetup() {
    document.getElementById('counter-setup').style.display  = 'flex';
    document.getElementById('counter-playing').style.display = 'none';

    // 玩家清單
    const playerList = document.getElementById('counter-player-list');
    playerList.innerHTML = '';
    ['玩家 1', '玩家 2'].forEach(n => counterAddPlayerRow(n, playerList));
    document.getElementById('counter-add-player-btn').onclick = () => counterAddPlayerRow('', playerList);

    // 資源定義清單（預設一個 HP）
    const resDefs = document.getElementById('counter-res-defs');
    resDefs.innerHTML = '';
    counterAddResDef({ name: 'HP', startVal: 20, maxVal: 20 }, resDefs);

    document.getElementById('counter-add-res-btn').onclick = () => {
        if (resDefs.querySelectorAll('.counter-res-def').length < 4) {
            counterAddResDef({ name: '', startVal: 0, maxVal: null }, resDefs);
        }
    };

    document.getElementById('counter-start-btn').onclick = counterStart;
}

function counterAddPlayerRow(defaultName, list) {
    const idx = list.querySelectorAll('.player-input-row').length + 1;
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `<input type="text" class="player-name-input" placeholder="玩家 ${idx}" value="${defaultName}">
                     <button class="remove-player-btn">×</button>`;
    row.querySelector('.remove-player-btn').onclick = () => {
        if (list.querySelectorAll('.player-input-row').length > 1) row.remove();
    };
    list.appendChild(row);
}

function counterAddResDef({ name, startVal, maxVal }, container) {
    const def = document.createElement('div');
    def.className = 'counter-res-def';
    def.innerHTML = `
        <div class="counter-res-def-top">
            <input type="text" class="counter-res-name-input" placeholder="名稱（HP、金幣、VP…）" value="${name}">
            <button class="remove-player-btn">×</button>
        </div>
        <div class="counter-res-def-bottom">
            <div class="counter-res-field">
                <label>起始</label>
                <input type="number" class="counter-res-num-input res-start" value="${startVal}" inputmode="numeric">
            </div>
            <div class="counter-res-field">
                <label>上限</label>
                <input type="number" class="counter-res-num-input res-max" value="${maxVal ?? ''}" placeholder="無" inputmode="numeric">
            </div>
        </div>`;
    def.querySelector('.remove-player-btn').onclick = () => {
        if (container.querySelectorAll('.counter-res-def').length > 1) def.remove();
    };
    container.appendChild(def);
}

function counterStart() {
    // 讀玩家
    const playerInputs = document.querySelectorAll('#counter-player-list .player-name-input');
    const playerNames  = Array.from(playerInputs).map((inp, i) => inp.value.trim() || `玩家 ${i + 1}`);

    // 讀資源定義
    counterResDefs = Array.from(document.querySelectorAll('.counter-res-def')).map(def => ({
        name:     def.querySelector('.counter-res-name-input').value.trim() || '資源',
        startVal: parseInt(def.querySelector('.res-start').value) || 0,
        maxVal:   def.querySelector('.res-max').value !== ''
                  ? parseInt(def.querySelector('.res-max').value)
                  : null
    }));

    // 建立玩家資料
    counterPlayers = playerNames.map(name => ({
        name,
        resources: counterResDefs.map(r => ({ value: r.startVal, maxVal: r.maxVal }))
    }));

    document.getElementById('counter-setup').style.display  = 'none';
    document.getElementById('counter-playing').style.display = 'flex';
    document.getElementById('counter-reset-btn').onclick = counterShowSetup;
    counterRender();
}

function counterBarColor(ratio) {
    if (ratio > 0.6) return '#2ecc71';
    if (ratio > 0.3) return '#f1c40f';
    return '#e74c3c';
}

function counterIsEliminated(player) {
    return player.resources.some(r => r.maxVal !== null && r.value <= 0);
}

function counterRender() {
    const container = document.getElementById('counter-cards');
    container.innerHTML = '';

    counterPlayers.forEach((player, pi) => {
        const eliminated = counterIsEliminated(player);
        const card = document.createElement('div');
        card.className = 'counter-player-card' + (eliminated ? ' eliminated' : '');

        const resRows = counterResDefs.map((def, ri) => {
            const res   = player.resources[ri];
            const hasMax = res.maxVal !== null;
            const ratio  = hasMax ? Math.max(0, res.value) / res.maxVal : 1;
            const color  = hasMax ? counterBarColor(ratio) : 'rgba(255,255,255,0.5)';
            const valDisplay = hasMax
                ? `<span style="color:${color}">${res.value}</span><span class="counter-res-max-text"> / ${res.maxVal}</span>`
                : `<span>${res.value}</span>`;
            const bar = hasMax
                ? `<div class="counter-progress-track">
                     <div class="counter-progress-fill" style="width:${Math.max(0,ratio*100).toFixed(1)}%;background:${color}"></div>
                   </div>`
                : '';
            return `
                <div class="counter-res-row">
                    <div class="counter-res-row-top">
                        <span class="counter-res-label-text">${def.name}</span>
                        <button class="counter-res-ctrl-btn" data-pi="${pi}" data-ri="${ri}" data-d="-1">−</button>
                        <span class="counter-res-value-display">${valDisplay}</span>
                        <button class="counter-res-ctrl-btn" data-pi="${pi}" data-ri="${ri}" data-d="1">+</button>
                    </div>
                    ${bar}
                </div>`;
        }).join('');

        card.innerHTML = `
            <div class="counter-player-header">
                <span class="counter-player-name-label">${player.name}</span>
                ${eliminated ? '<span class="counter-eliminated-badge">陣亡</span>' : ''}
            </div>
            ${resRows}`;
        container.appendChild(card);
    });

    container.querySelectorAll('.counter-res-ctrl-btn').forEach(btn => {
        btn.onclick = () => {
            const pi = parseInt(btn.dataset.pi);
            const ri = parseInt(btn.dataset.ri);
            counterPlayers[pi].resources[ri].value += parseInt(btn.dataset.d);
            counterRender();
        };
    });
}
