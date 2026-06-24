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
            } else if (tool === 'counter') {
                counterOpen();
            } else if (tool === 'roles') {
                rolesOpen();
            } else if (tool === 'wheel') {
                wheelOpen();
            }
        });
    });
}

// ================================================================
// ================================================================

const FP_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
    '#00bcd4', '#8bc34a'
];
const FP_TEAM_COLORS  = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#e91e63'];
const FP_TEAM_NAMES   = ['A 隊', 'B 隊', 'C 隊', 'D 隊', 'E 隊', 'F 隊', 'G 隊', 'H 隊'];
const FP_TEAM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

let fpTouches      = {};
let fpPhase        = 'waiting';  // 'waiting' | 'countdown' | 'result'
let fpColorSeq     = 0;
let fpStabTimer    = null;
let fpCountTimer   = null;
let fpCountVal     = 3;
let fpMode         = 'pick';     // 'pick' | 'team'
let fpPickCount    = 1;
let fpTeamCount    = 2;

function fpOpen() {
    fpMode      = 'pick';
    fpPickCount = 1;
    fpTeamCount = 2;

    document.getElementById('fp-setup').style.display          = 'flex';
    document.getElementById('fp-status-text').style.display    = 'none';
    document.getElementById('fp-countdown-display').style.display = 'none';
    document.getElementById('fp-again-btn').style.display      = 'none';
    document.getElementById('fp-result-panel').style.display   = 'none';

    document.querySelectorAll('[data-fp-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fpMode === 'pick');
        btn.onclick = (e) => {
            e.stopPropagation();
            fpMode = btn.dataset.fpMode;
            document.querySelectorAll('[data-fp-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('fp-pick-options').style.display = fpMode === 'pick' ? 'flex' : 'none';
            document.getElementById('fp-team-options').style.display = fpMode === 'team' ? 'flex' : 'none';
        };
    });

    const pickInput = document.getElementById('fp-pick-input');
    pickInput.value = fpPickCount;
    document.querySelectorAll('[data-fp-pick]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.fpPick) === fpPickCount);
        btn.onclick = (e) => {
            e.stopPropagation();
            fpPickCount = parseInt(btn.dataset.fpPick);
            pickInput.value = fpPickCount;
            document.querySelectorAll('[data-fp-pick]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    pickInput.oninput = () => {
        const v = parseInt(pickInput.value);
        if (!isNaN(v) && v >= 1) {
            fpPickCount = v;
            document.querySelectorAll('[data-fp-pick]').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.fpPick) === v);
            });
        }
    };

    const teamInput = document.getElementById('fp-team-input');
    teamInput.value = fpTeamCount;
    document.querySelectorAll('[data-fp-teams]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.fpTeams) === fpTeamCount);
        btn.onclick = (e) => {
            e.stopPropagation();
            fpTeamCount = parseInt(btn.dataset.fpTeams);
            teamInput.value = fpTeamCount;
            document.querySelectorAll('[data-fp-teams]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    teamInput.oninput = () => {
        const v = parseInt(teamInput.value);
        if (!isNaN(v) && v >= 2) {
            fpTeamCount = v;
            document.querySelectorAll('[data-fp-teams]').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.fpTeams) === v);
            });
        }
    };

    document.getElementById('fp-start-btn').onclick = (e) => {
        e.stopPropagation();
        fpStartTouchPhase();
    };

    const closeBtn = document.getElementById('fp-close-btn');
    closeBtn.onclick = fpClose;
    closeBtn.addEventListener('touchend', (e) => { e.stopPropagation(); fpClose(); }, { passive: false });
}

function fpStartTouchPhase() {
    document.getElementById('fp-setup').style.display             = 'none';
    document.getElementById('fp-status-text').style.display       = 'block';
    document.getElementById('fp-countdown-display').style.display = 'block';
    document.getElementById('fp-again-btn').style.display         = 'none';
    document.getElementById('fp-result-panel').style.display      = 'none';

    fpResetState();

    const overlay = document.getElementById('first-player-overlay');
    overlay.removeEventListener('touchstart',  fpOnTouchStart);
    overlay.removeEventListener('touchend',    fpOnTouchEnd);
    overlay.removeEventListener('touchcancel', fpOnTouchEnd);
    overlay.addEventListener('touchstart',  fpOnTouchStart,  { passive: false });
    overlay.addEventListener('touchend',    fpOnTouchEnd,    { passive: false });
    overlay.addEventListener('touchcancel', fpOnTouchEnd,    { passive: false });
}

function fpClose() {
    clearTimeout(fpStabTimer);
    clearInterval(fpCountTimer);

    const overlay = document.getElementById('first-player-overlay');
    overlay.removeEventListener('touchstart',  fpOnTouchStart);
    overlay.removeEventListener('touchend',    fpOnTouchEnd);
    overlay.removeEventListener('touchcancel', fpOnTouchEnd);
    overlay.style.display = 'none';

    Object.values(fpTouches).forEach(tp => tp.el && tp.el.remove());
    fpTouches = {};
}

function fpResetState() {
    clearTimeout(fpStabTimer);
    clearInterval(fpCountTimer);

    Object.values(fpTouches).forEach(tp => tp.el && tp.el.remove());
    document.querySelectorAll('.fp-circle').forEach(el => el.remove());

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

    if (fpMode === 'pick') {
        fpShowPickResult();
    } else {
        fpShowTeamResult();
    }
}

function fpShowPickResult() {
    const pick = Math.min(fpPickCount, Object.keys(fpTouches).length);
    document.getElementById('fp-status-text').textContent =
        pick === 1 ? '🎉 先手玩家！' : `🎉 選出 ${pick} 位玩家！`;

    const ids = Object.keys(fpTouches).sort(() => Math.random() - 0.5);
    const selectedSet = new Set(ids.slice(0, pick));

    ids.forEach((id, index) => {
        const tp = fpTouches[id];
        const isSelected = selectedSet.has(id);
        setTimeout(() => {
            tp.el.classList.add('result');
            if (isSelected) {
                tp.el.textContent = '★';
                tp.el.style.backgroundColor = FP_COLORS[tp.colorIdx];
                tp.el.style.borderColor     = FP_COLORS[tp.colorIdx];
                tp.el.classList.add('fp-selected');
            } else {
                tp.el.classList.add('fp-dimmed');
            }
        }, index * 120);
    });

    const agBtn = document.getElementById('fp-again-btn');
    setTimeout(() => {
        agBtn.style.display = 'block';
        agBtn.onclick = (e) => {
            e.stopPropagation();
            agBtn.style.display = 'none';
            fpResetState();
        };
    }, ids.length * 120 + 400);
}

function fpShowTeamResult() {
    document.getElementById('fp-status-text').textContent = '分組完成！';

    const ids = Object.keys(fpTouches).sort(() => Math.random() - 0.5);
    const teamColorIdxMap = {};
    for (let k = 0; k < fpTeamCount; k++) teamColorIdxMap[k] = [];

    ids.forEach((id, i) => {
        const teamIdx = i % fpTeamCount;
        const tp = fpTouches[id];
        teamColorIdxMap[teamIdx].push(tp.colorIdx);

        setTimeout(() => {
            tp.el.classList.add('result');
            tp.el.textContent           = FP_TEAM_LETTERS[teamIdx];
            tp.el.style.backgroundColor = FP_TEAM_COLORS[teamIdx];
            tp.el.style.borderColor     = FP_TEAM_COLORS[teamIdx];
            tp.el.style.color           = 'white';
        }, i * 120);
    });

    setTimeout(() => {
        const cardsDiv = document.getElementById('fp-result-cards');
        cardsDiv.innerHTML = '';

        for (let k = 0; k < fpTeamCount; k++) {
            const card = document.createElement('div');
            card.className = 'fp-team-card';
            card.style.borderColor = FP_TEAM_COLORS[k];

            const dots = teamColorIdxMap[k].map(ci =>
                `<span class="fp-team-dot" style="background:${FP_COLORS[ci]}"></span>`
            ).join('');

            card.innerHTML = `<div class="fp-team-name" style="color:${FP_TEAM_COLORS[k]}">${FP_TEAM_NAMES[k]}</div>
                              <div class="fp-team-dots">${dots}</div>`;
            cardsDiv.appendChild(card);
        }

        document.getElementById('fp-result-again-btn').onclick = () => {
            fpStartTouchPhase();
        };

        document.getElementById('fp-result-panel').style.display = 'flex';
    }, ids.length * 120 + 800);
}

// ================================================================
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
// ================================================================

let counterResDefs     = [];
let counterPlayers     = [];
let counterLog         = [];
let counterIsActive    = false;
let counterCustomTarget = { pi: -1, ri: -1 };

const COUNTER_STORAGE_KEY = 'counter_history';
const COUNTER_MAX_HISTORY = 5;

// ── localStorage ──────────────────────────────────────────────
function counterSaveHistory() {
    if (!counterIsActive || counterPlayers.length === 0) return;
    const history = JSON.parse(localStorage.getItem(COUNTER_STORAGE_KEY) || '[]');
    history.unshift({
        ts:       Date.now(),
        resDefs:  counterResDefs.map(r => ({ ...r })),
        players:  counterPlayers.map(p => ({
            name:      p.name,
            resources: p.resources.map(r => ({ ...r }))
        }))
    });
    localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(history.slice(0, COUNTER_MAX_HISTORY)));
}

function counterRenderHistory() {
    const history = JSON.parse(localStorage.getItem(COUNTER_STORAGE_KEY) || '[]');
    const section = document.getElementById('counter-history-section');
    const list    = document.getElementById('counter-history-list');

    if (history.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = '';

    history.forEach(entry => {
        const d       = new Date(entry.ts);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ` +
            `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        const resNames = entry.resDefs.map(r => r.name).join('、');

        const summary = entry.players.map(p => {
            const parts = p.resources.map((r, i) => {
                const def = entry.resDefs[i];
                return r.maxVal !== null ? `${def.name} ${r.value}/${r.maxVal}` : `${def.name} ${r.value}`;
            }).join(' · ');
            return `${p.name}：${parts}`;
        }).join('\n');

        const item = document.createElement('div');
        item.className = 'sb-history-item';
        item.innerHTML = `
            <div class="sb-history-meta">${dateStr} · ${entry.players.length} 位玩家 · ${resNames}</div>
            <div class="sb-history-summary" style="white-space:pre-line">${summary}</div>
            <div class="sb-history-actions">
                <button class="sb-history-continue-btn">繼續這場</button>
                <button class="sb-history-new-btn">同樣設定重開</button>
            </div>`;

        item.querySelector('.sb-history-continue-btn').onclick = () => {
            counterResDefs  = entry.resDefs.map(r => ({ ...r }));
            counterPlayers  = entry.players.map(p => ({
                name:      p.name,
                resources: p.resources.map(r => ({ ...r }))
            }));
            counterLog      = [];
            counterIsActive = true;
            counterGoPlaying();
        };

        item.querySelector('.sb-history-new-btn').onclick = () => {
            const playerList = document.getElementById('counter-player-list');
            playerList.innerHTML = '';
            entry.players.forEach(p => counterAddPlayerRow(p.name, playerList));
            const resDefs = document.getElementById('counter-res-defs');
            resDefs.innerHTML = '';
            entry.resDefs.forEach(r => counterAddResDef(r, resDefs));
        };

        list.appendChild(item);
    });
}

// ── In-game log ───────────────────────────────────────────────
function counterAddLog(pi, ri, delta) {
    const r = counterPlayers[pi].resources[ri];
    counterLog.unshift({
        playerName: counterPlayers[pi].name,
        resName:    counterResDefs[ri].name,
        delta,
        newValue:   r.value,
        maxVal:     r.maxVal,
        ts:         Date.now()
    });
}

function counterOpenLog() {
    const drawer = document.getElementById('counter-log-drawer');
    drawer.style.display = 'flex';
    document.getElementById('counter-log-close-btn').onclick = () => {
        drawer.style.display = 'none';
    };
    const list  = document.getElementById('counter-log-list');
    const empty = document.getElementById('counter-log-empty');
    list.innerHTML = '';

    if (counterLog.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    counterLog.forEach(entry => {
        const d  = new Date(entry.ts);
        const ts = `${d.getHours().toString().padStart(2,'0')}:` +
                   `${d.getMinutes().toString().padStart(2,'0')}:` +
                   `${d.getSeconds().toString().padStart(2,'0')}`;
        const pos   = entry.delta > 0;
        const after = entry.maxVal !== null
            ? `${entry.newValue}/${entry.maxVal}` : `${entry.newValue}`;
        const el = document.createElement('div');
        el.className = 'sb-log-entry';
        el.innerHTML =
            `<span class="sb-log-time">${ts}</span>` +
            `<span class="sb-log-name">${entry.playerName} · ${entry.resName}</span>` +
            `<span class="sb-log-delta ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${entry.delta}</span>` +
            `<span class="sb-log-after">→ ${after}</span>`;
        list.appendChild(el);
    });
}

// ── 開啟 / 關閉 ───────────────────────────────────────────────
function counterOpen() {
    document.getElementById('counter-overlay').style.display = 'flex';
    document.getElementById('counter-close-btn').onclick = counterClose;
    counterShowSetup();
}

function counterClose() {
    counterSaveHistory();
    counterIsActive = false;
    document.getElementById('counter-overlay').style.display = 'none';
    document.getElementById('counter-log-drawer').style.display = 'none';
    document.getElementById('counter-custom-popup').style.display = 'none';
}

function counterOpenCustomPopup(pi, ri) {
    counterCustomTarget = { pi, ri };
    const player = counterPlayers[pi];
    const def    = counterResDefs[ri];
    document.getElementById('counter-popup-label').textContent =
        `為「${player.name}」的 ${def.name} 加減`;
    document.getElementById('counter-popup-input').value = '';
    const popup = document.getElementById('counter-custom-popup');
    popup.style.display = 'flex';
    setTimeout(() => document.getElementById('counter-popup-input').focus(), 50);

    document.getElementById('counter-popup-plus').onclick  = () => counterApplyCustom(1);
    document.getElementById('counter-popup-minus').onclick = () => counterApplyCustom(-1);
    document.getElementById('counter-popup-cancel').onclick = () => {
        popup.style.display = 'none';
    };
}

function counterApplyCustom(sign) {
    const val = parseInt(document.getElementById('counter-popup-input').value);
    const { pi, ri } = counterCustomTarget;
    if (!isNaN(val) && val > 0 && pi >= 0) {
        const delta = sign * val;
        counterPlayers[pi].resources[ri].value += delta;
        counterAddLog(pi, ri, delta);
    }
    document.getElementById('counter-custom-popup').style.display = 'none';
    counterRender();
}

function counterGoPlaying() {
    document.getElementById('counter-setup').style.display   = 'none';
    document.getElementById('counter-playing').style.display = 'flex';
    document.getElementById('counter-log-drawer').style.display = 'none';
    document.getElementById('counter-reset-btn').onclick    = counterShowSetup;
    document.getElementById('counter-log-open-btn').onclick = counterOpenLog;
    counterRender();
}

function counterShowSetup() {
    counterSaveHistory();
    counterIsActive = false;

    document.getElementById('counter-setup').style.display   = 'flex';
    document.getElementById('counter-playing').style.display = 'none';
    document.getElementById('counter-log-drawer').style.display = 'none';

    const playerList = document.getElementById('counter-player-list');
    playerList.innerHTML = '';
    ['玩家 1', '玩家 2'].forEach(n => counterAddPlayerRow(n, playerList));
    document.getElementById('counter-add-player-btn').onclick = () => counterAddPlayerRow('', playerList);

    const resDefs = document.getElementById('counter-res-defs');
    resDefs.innerHTML = '';
    counterAddResDef({ name: 'HP', startVal: 20, maxVal: 20 }, resDefs);

    document.getElementById('counter-add-res-btn').onclick = () => {
        if (resDefs.querySelectorAll('.counter-res-def').length < 4) {
            counterAddResDef({ name: '', startVal: 0, maxVal: null }, resDefs);
        }
    };

    document.getElementById('counter-start-btn').onclick = counterStart;
    counterRenderHistory();
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
    const playerInputs = document.querySelectorAll('#counter-player-list .player-name-input');
    const playerNames  = Array.from(playerInputs).map((inp, i) => inp.value.trim() || `玩家 ${i + 1}`);

    counterResDefs = Array.from(document.querySelectorAll('.counter-res-def')).map(def => ({
        name:     def.querySelector('.counter-res-name-input').value.trim() || '資源',
        startVal: parseInt(def.querySelector('.res-start').value) || 0,
        maxVal:   def.querySelector('.res-max').value !== ''
                  ? parseInt(def.querySelector('.res-max').value)
                  : null
    }));

    counterPlayers = playerNames.map(name => ({
        name,
        resources: counterResDefs.map(r => ({ value: r.startVal, maxVal: r.maxVal }))
    }));

    counterLog      = [];
    counterIsActive = true;
    counterGoPlaying();
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
            const res    = player.resources[ri];
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
                        <span class="counter-res-value-display">${valDisplay}</span>
                    </div>
                    <div class="counter-res-row-btns">
                        <button class="sb-btn" data-pi="${pi}" data-ri="${ri}" data-d="-5">-5</button>
                        <button class="sb-btn" data-pi="${pi}" data-ri="${ri}" data-d="-1">-1</button>
                        <button class="sb-btn" data-pi="${pi}" data-ri="${ri}" data-d="1">+1</button>
                        <button class="sb-btn" data-pi="${pi}" data-ri="${ri}" data-d="5">+5</button>
                        <button class="sb-btn sb-custom-btn" data-pi="${pi}" data-ri="${ri}" data-d="custom">自訂</button>
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

    container.querySelectorAll('.counter-res-row-btns .sb-btn').forEach(btn => {
        btn.onclick = () => {
            const pi = parseInt(btn.dataset.pi);
            const ri = parseInt(btn.dataset.ri);
            if (btn.dataset.d === 'custom') {
                counterOpenCustomPopup(pi, ri);
            } else {
                const delta = parseInt(btn.dataset.d);
                counterPlayers[pi].resources[ri].value += delta;
                counterAddLog(pi, ri, delta);
                counterRender();
            }
        };
    });
}

// ================================================================
// ================================================================

var roleAssignments  = [];
var rolePassword     = '';
var roleCurrentIdx   = 0;
var rolePhase        = 'setup';

function rolesOpen() {
    document.getElementById('roles-overlay').style.display = 'flex';
    document.getElementById('roles-close-btn').onclick = rolesClose;

    if (rolePhase === 'playing') {
        rolesShowPhase('roles-playing');
    } else if (rolePhase === 'final') {
        rolesShowPhase('roles-final');
    } else {
        rolePhase = 'setup';
        rolesShowSetup();
    }
}

function rolesClose() {
    document.getElementById('roles-overlay').style.display = 'none';
}

function rolesShowPhase(activeId) {
    ['roles-setup','roles-distributing','roles-playing','roles-final'].forEach(function(id) {
        document.getElementById(id).style.display = (id === activeId) ? 'flex' : 'none';
    });
}

function rolesShowSetup() {
    rolePhase = 'setup';
    rolesShowPhase('roles-setup');

    var playerList = document.getElementById('roles-player-list');
    playerList.innerHTML = '';
    var defaults = ['玩家 1','玩家 2','玩家 3','玩家 4','玩家 5','玩家 6'];
    defaults.forEach(function(n) { rolesAddPlayerRow(n, playerList); });

    var defList = document.getElementById('roles-def-list');
    defList.innerHTML = '';
    rolesAddRoleRow({ emoji:'🐺', name:'狼人',   desc:'夜晚可睜眼互認',     count:2 }, defList);
    rolesAddRoleRow({ emoji:'🔮', name:'預言家',  desc:'每晚查驗一位玩家身份', count:1 }, defList);
    rolesAddRoleRow({ emoji:'👥', name:'村民',    desc:'',                   count:3 }, defList);

    document.getElementById('roles-add-player-btn').onclick = function() {
        rolesAddPlayerRow('', playerList);
    };
    document.getElementById('roles-add-role-btn').onclick = function() {
        rolesAddRoleRow({ emoji:'', name:'', desc:'', count:1 }, defList);
    };
    document.getElementById('roles-start-btn').onclick = rolesStart;
    document.getElementById('roles-password').value = '';

    var setup = document.getElementById('roles-setup');
    setup.removeEventListener('input', rolesUpdateCountStatus);
    setup.addEventListener('input', rolesUpdateCountStatus);
    rolesUpdateCountStatus();
}

function rolesAddPlayerRow(defaultName, list) {
    var idx = list.querySelectorAll('.player-input-row').length + 1;
    var row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML =
        '<input type="text" class="player-name-input" placeholder="玩家 ' + idx + '" value="' + defaultName + '">' +
        '<button class="remove-player-btn">×</button>';
    row.querySelector('.remove-player-btn').onclick = function() {
        if (list.querySelectorAll('.player-input-row').length > 2) { row.remove(); }
        rolesUpdateCountStatus();
    };
    list.appendChild(row);
}

var ROLE_EMOJIS = ['🎭','🐺','🔮','👥','🏹','🧙','🛡️','💀','👑','🗡️','🦊','❓','🌙','🔥','🃏'];

function rolesEmojiOptions(selected) {
    return ROLE_EMOJIS.map(function(e) {
        return '<option value="' + e + '"' + (e === selected ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
}

function rolesAddRoleRow(opts, container) {
    var emoji = opts.emoji || '🎭';
    var row = document.createElement('div');
    row.className = 'role-def-row-wrap';
    row.innerHTML =
        '<div class="role-def-row">' +
            '<select class="role-emoji-select">' + rolesEmojiOptions(emoji) + '</select>' +
            '<input type="text" class="role-name-field" value="' + (opts.name || '') + '" placeholder="角色名稱">' +
            '<input type="number" class="role-count-input" value="' + (opts.count || 1) + '" min="1" max="20" inputmode="numeric">' +
            '<button class="remove-player-btn">×</button>' +
        '</div>' +
        '<input type="text" class="role-desc-input" value="' + (opts.desc || '') + '" placeholder="簡短說明（選填）">';
    row.querySelector('.remove-player-btn').onclick = function() {
        if (container.querySelectorAll('.role-def-row-wrap').length > 1) {
            row.remove();
            rolesUpdateCountStatus();
        }
    };
    container.appendChild(row);
}

function rolesUpdateCountStatus() {
    var playerCount = document.querySelectorAll('#roles-player-list .player-input-row').length;
    var roleTotal = 0;
    document.querySelectorAll('.role-count-input').forEach(function(el) {
        roleTotal += (parseInt(el.value) || 0);
    });
    var status   = document.getElementById('roles-count-status');
    var startBtn = document.getElementById('roles-start-btn');

    if (playerCount === roleTotal && roleTotal > 0) {
        status.textContent = '✓ ' + playerCount + ' 位玩家，' + roleTotal + ' 個角色，數量符合';
        status.style.color = '#2ecc71';
        startBtn.disabled  = false;
        startBtn.style.opacity = '1';
    } else {
        status.textContent = '✗ ' + playerCount + ' 位玩家 vs ' + roleTotal + ' 個角色，請確保數量相符';
        status.style.color = '#e74c3c';
        startBtn.disabled  = true;
        startBtn.style.opacity = '0.45';
    }
}

function rolesStart() {
    var players = [];
    document.querySelectorAll('#roles-player-list .player-name-input').forEach(function(el, i) {
        players.push(el.value.trim() || ('玩家 ' + (i + 1)));
    });

    var pool = [];
    document.querySelectorAll('.role-def-row-wrap').forEach(function(wrap) {
        var emoji = wrap.querySelector('.role-emoji-select').value || '🎭';
        var name  = wrap.querySelector('.role-name-field').value.trim()   || '未命名';
        var desc  = wrap.querySelector('.role-desc-input').value.trim();
        var count = parseInt(wrap.querySelector('.role-count-input').value) || 1;
        for (var i = 0; i < count; i++) {
            pool.push({ emoji: emoji, name: name, desc: desc });
        }
    });

    for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }

    roleAssignments = players.map(function(playerName, i) {
        return { playerName: playerName, role: pool[i] };
    });
    rolePassword   = document.getElementById('roles-password').value;
    roleCurrentIdx = 0;

    rolesShowPhase('roles-distributing');
    rolesShowHandoff();
}

function rolesShowHandoff() {
    rolePhase = 'distributing';
    var player = roleAssignments[roleCurrentIdx];

    document.getElementById('roles-handoff').style.display     = 'flex';
    document.getElementById('roles-reveal-card').style.display = 'none';

    document.getElementById('roles-handoff-name').textContent = player.playerName;

    var btn = document.getElementById('roles-ready-btn');
    btn.textContent = '我是 ' + player.playerName + '，準備好了';
    btn.onclick = rolesShowRoleCard;
}

function rolesShowRoleCard() {
    var role = roleAssignments[roleCurrentIdx].role;
    document.getElementById('roles-handoff').style.display = 'none';

    var card = document.getElementById('roles-reveal-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    card.style.display = 'flex';

    document.getElementById('roles-card-emoji').textContent = role.emoji;
    document.getElementById('roles-card-name').textContent  = role.name;
    document.getElementById('roles-card-desc').textContent  = role.desc;

    document.getElementById('roles-confirm-btn').onclick = rolesConfirmRole;
}

function rolesConfirmRole() {
    roleCurrentIdx++;
    if (roleCurrentIdx < roleAssignments.length) {
        rolesShowHandoff();
    } else {
        rolesShowPlaying();
    }
}

function rolesShowPlaying() {
    rolePhase = 'playing';
    rolesShowPhase('roles-playing');
    document.getElementById('roles-end-btn').onclick = rolesShowFinal;
}

function rolesShowFinal() {
    rolePhase = 'final';
    rolesShowPhase('roles-final');

    document.getElementById('roles-unlock-panel').style.display = 'flex';
    document.getElementById('roles-full-reveal').style.display  = 'none';
    document.getElementById('roles-unlock-input').value         = '';
    document.getElementById('roles-unlock-error').style.display = 'none';

    if (!rolePassword) {
        rolesShowFullReveal();
        return;
    }

    document.getElementById('roles-unlock-btn').onclick = function() {
        var input = document.getElementById('roles-unlock-input').value;
        if (input === rolePassword) {
            rolesShowFullReveal();
        } else {
            document.getElementById('roles-unlock-error').style.display = 'block';
            document.getElementById('roles-unlock-input').value = '';
        }
    };
}

function rolesShowFullReveal() {
    document.getElementById('roles-unlock-panel').style.display = 'none';
    document.getElementById('roles-full-reveal').style.display  = 'block';

    var list = document.getElementById('roles-reveal-list');
    list.innerHTML = '';

    roleAssignments.forEach(function(entry, i) {
        var item = document.createElement('div');
        item.className = 'roles-reveal-item';
        item.style.animationDelay = (i * 160) + 'ms';
        item.innerHTML =
            '<span class="roles-reveal-player">' + entry.playerName + '</span>' +
            '<span class="roles-reveal-emoji">'  + entry.role.emoji  + '</span>'  +
            '<span class="roles-reveal-role">'   + entry.role.name   + '</span>';
        list.appendChild(item);
    });

    document.getElementById('roles-restart-btn').onclick = function() {
        rolePhase = 'setup';
        roleAssignments = [];
        rolesShowSetup();
    };
}


// ================================================================
// ================================================================

var wheelOptions  = [];
var wheelRotation = 0;
var wheelWinner   = -1;
var wheelSpinning = false;
var wheelPhase    = 'setup';

var WHEEL_COLORS = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#e91e8c', '#1abc9c'
];

// ── 開啟 / 關閉 ───────────────────────────────────────────────
function wheelOpen() {
    document.getElementById('wheel-overlay').style.display = 'flex';
    document.getElementById('wheel-close-btn').onclick = wheelClose;

    if (wheelPhase === 'playing' && wheelOptions.length >= 2) {
        document.getElementById('wheel-setup').style.display   = 'none';
        document.getElementById('wheel-playing').style.display = 'flex';
        document.getElementById('wheel-result-popup').style.display = 'none';
        document.getElementById('wheel-spin-btn').disabled = false;
        document.getElementById('wheel-edit-btn').disabled = false;
    } else {
        wheelPhase = 'setup';
        wheelShowSetup();
    }
}

function wheelClose() {
    document.getElementById('wheel-overlay').style.display = 'none';
}

// ── Phase 1: 設定 ─────────────────────────────────────────────
function wheelShowSetup() {
    wheelPhase = 'setup';
    document.getElementById('wheel-setup').style.display        = 'flex';
    document.getElementById('wheel-playing').style.display      = 'none';
    document.getElementById('wheel-result-popup').style.display = 'none';

    var list = document.getElementById('wheel-option-list');
    list.innerHTML = '';
    var defaults = wheelOptions.length >= 2
        ? wheelOptions
        : ['選項 A', '選項 B', '選項 C', '選項 D'];
    defaults.forEach(function(opt) { wheelAddOptionRow(opt, list); });

    document.getElementById('wheel-add-btn').onclick = function() {
        if (list.querySelectorAll('.player-input-row').length < 10) {
            wheelAddOptionRow('', list);
        }
        wheelUpdateStartBtn();
    };
    document.getElementById('wheel-start-btn').onclick = wheelGoPlaying;

    list.removeEventListener('input', wheelUpdateStartBtn);
    list.addEventListener('input', wheelUpdateStartBtn);
    wheelUpdateStartBtn();
}

function wheelAddOptionRow(text, list) {
    var idx = list.querySelectorAll('.player-input-row').length + 1;
    var row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML =
        '<input type="text" class="player-name-input" placeholder="選項 ' + idx + '" value="' + (text || '') + '">' +
        '<button class="remove-player-btn">×</button>';
    row.querySelector('.remove-player-btn').onclick = function() {
        if (list.querySelectorAll('.player-input-row').length > 2) {
            row.remove();
            wheelUpdateStartBtn();
        }
    };
    list.appendChild(row);
}

function wheelUpdateStartBtn() {
    var filled = Array.from(document.querySelectorAll('#wheel-option-list .player-name-input'))
        .filter(function(el) { return el.value.trim() !== ''; }).length;
    var btn = document.getElementById('wheel-start-btn');
    btn.disabled      = filled < 2;
    btn.style.opacity = filled < 2 ? '0.45' : '1';
}

// ── Phase 2: 輪盤 ─────────────────────────────────────────────
function wheelGoPlaying() {
    wheelOptions = Array.from(document.querySelectorAll('#wheel-option-list .player-name-input'))
        .map(function(el, i) { return el.value.trim() || ('選項 ' + (i + 1)); })
        .filter(function(opt) { return opt !== ''; });

    if (wheelOptions.length < 2) return;

    wheelPhase    = 'playing';
    wheelRotation = 0;
    wheelWinner   = -1;
    wheelSpinning = false;

    document.getElementById('wheel-setup').style.display        = 'none';
    document.getElementById('wheel-playing').style.display      = 'flex';
    document.getElementById('wheel-result-popup').style.display = 'none';

    var spinBtn = document.getElementById('wheel-spin-btn');
    var editBtn = document.getElementById('wheel-edit-btn');
    spinBtn.disabled = false;
    editBtn.disabled = false;

    var size   = Math.min(300, window.innerWidth - 64);
    var canvas = document.getElementById('wheel-canvas');
    canvas.width  = size;
    canvas.height = size;

    var wrap = document.getElementById('wheel-canvas-wrap');
    wrap.style.width      = size + 'px';
    wrap.style.height     = size + 'px';
    wrap.style.transition = 'none';
    wrap.style.transform  = 'rotate(0deg)';

    wheelDraw();

    spinBtn.onclick = wheelSpin;
    editBtn.onclick = function() { wheelShowSetup(); };
}

function wheelDraw() {
    var canvas = document.getElementById('wheel-canvas');
    var ctx    = canvas.getContext('2d');
    var size   = canvas.width;
    var cx     = size / 2;
    var cy     = size / 2;
    var r      = cx - 6;
    var n      = wheelOptions.length;

    ctx.clearRect(0, 0, size, size);
    if (n === 0) return;

    var segRad = (2 * Math.PI) / n;

    for (var i = 0; i < n; i++) {
        var startA = -Math.PI / 2 + i * segRad;
        var endA   = startA + segRad;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startA, endA);
        ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth   = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(startA + segRad / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';

        var fontSize = n <= 3 ? 16 : n <= 5 ? 14 : 11;
        ctx.font = 'bold ' + fontSize + 'px "PingFang TC", "Noto Sans TC", sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur  = 5;

        var maxChars = n <= 3 ? 9 : n <= 5 ? 7 : 5;
        var label = wheelOptions[i];
        if (label.length > maxChars) label = label.substring(0, maxChars) + '…';

        ctx.fillText(label, r - 14, Math.round(fontSize / 3));
        ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.fillStyle   = '#1a1008';
    ctx.fill();
    ctx.strokeStyle = 'rgba(184,134,11,0.9)';
    ctx.lineWidth   = 3;
    ctx.stroke();
}

// ── 旋轉 ──────────────────────────────────────────────────────
function wheelSpin() {
    if (wheelSpinning || wheelOptions.length < 2) return;
    wheelSpinning = true;

    document.getElementById('wheel-result-popup').style.display = 'none';
    document.getElementById('wheel-spin-btn').disabled = true;
    document.getElementById('wheel-edit-btn').disabled = true;

    var n         = wheelOptions.length;
    var segDeg    = 360 / n;
    wheelWinner   = Math.floor(Math.random() * n);

    var winnerCenter = wheelWinner * segDeg + segDeg / 2;
    var currentMod   = ((wheelRotation % 360) + 360) % 360;
    var target       = ((-(winnerCenter)) % 360 + 360) % 360;
    var adjust       = (target - currentMod + 360) % 360;
    if (adjust < 30) adjust += 360;

    var newRotation = wheelRotation + 5 * 360 + adjust;
    wheelRotation   = newRotation;

    var wrap = document.getElementById('wheel-canvas-wrap');
    wrap.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
    wrap.style.transform  = 'rotate(' + newRotation + 'deg)';

    setTimeout(function() {
        wheelSpinning = false;
        document.getElementById('wheel-spin-btn').disabled = false;
        document.getElementById('wheel-edit-btn').disabled = false;
        wheelShowResult();
    }, 4200);
}

// ── 結果 ──────────────────────────────────────────────────────
function wheelShowResult() {
    var popup = document.getElementById('wheel-result-popup');
    document.getElementById('wheel-result-name').textContent = wheelOptions[wheelWinner];
    popup.style.animation = 'none';
    void popup.offsetWidth;
    popup.style.animation = '';
    popup.style.display   = 'flex';

    document.getElementById('wheel-again-btn').onclick = function() {
        popup.style.display = 'none';
    };

    document.getElementById('wheel-remove-btn').onclick = function() {
        wheelOptions.splice(wheelWinner, 1);
        popup.style.display = 'none';
        wheelWinner = -1;

        if (wheelOptions.length < 2) {
            wheelShowSetup();
            return;
        }

        wheelRotation = 0;
        var wrap = document.getElementById('wheel-canvas-wrap');
        wrap.style.transition = 'none';
        wrap.style.transform  = 'rotate(0deg)';
        wheelDraw();
    };
}

