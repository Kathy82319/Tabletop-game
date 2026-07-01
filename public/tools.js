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
    fpMode      = 'order';
    fpPickCount = 1;
    fpTeamCount = 2;

    document.getElementById('fp-setup').style.display          = 'flex';
    document.getElementById('fp-status-text').style.display    = 'none';
    document.getElementById('fp-countdown-display').style.display = 'none';
    document.getElementById('fp-again-btn').style.display      = 'none';
    document.getElementById('fp-result-panel').style.display   = 'none';

    document.querySelectorAll('[data-fp-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fpMode === 'order');
        btn.onclick = (e) => {
            e.stopPropagation();
            fpMode = btn.dataset.fpMode;
            document.querySelectorAll('[data-fp-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('fp-pick-options').style.display = fpMode === 'pick'  ? 'flex' : 'none';
            document.getElementById('fp-team-options').style.display = fpMode === 'team'  ? 'flex' : 'none';
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

    if (fpMode === 'order') {
        fpShowOrderResult();
    } else if (fpMode === 'pick') {
        fpShowPickResult();
    } else {
        fpShowTeamResult();
    }
}

function fpShowOrderResult() {
    document.getElementById('fp-status-text').textContent = '🎉 數字越小越先手！';

    const ids = Object.keys(fpTouches).sort(() => Math.random() - 0.5);
    ids.forEach((id, index) => {
        const tp    = fpTouches[id];
        const rank  = index + 1;
        const color = FP_COLORS[tp.colorIdx];
        setTimeout(() => {
            tp.el.textContent = rank;
            tp.el.style.backgroundColor = color;
            tp.el.style.borderColor     = color;
            tp.el.classList.add('result');
            if (rank === 1) tp.el.classList.add('first');
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

// ── 記分板狀態 ────────────────────────────────────────────────
let sbSessionId   = null;
let sbOwnerLineId = null;
let sbPlayers     = [];
let sbEvents      = [];
let sbGameName    = '';
let sbPollTimer   = null;

const LIFF_ID = '2008076323-GN1e7naW';

function sbGetJoinUrl(sessionId) {
    return `https://liff.line.me/${LIFF_ID}?liff.state=${encodeURIComponent('#page-scoreboard-join@' + sessionId)}`;
}

// ── 開啟 / 關閉 ───────────────────────────────────────────────
function sbOpen() {
    document.getElementById('scoreboard-overlay').style.display = 'flex';
    document.getElementById('sb-close-btn').onclick = sbClose;
    sbShowSetup();
}

function sbClose() {
    sbStopPolling();
    document.getElementById('scoreboard-overlay').style.display = 'none';
}

// ── 設定畫面 ──────────────────────────────────────────────────
function sbShowSetup() {
    sbStopPolling();
    document.getElementById('sb-setup').style.display    = 'flex';
    document.getElementById('sb-qr-panel').style.display = 'none';
    document.getElementById('sb-playing').style.display  = 'none';
    document.getElementById('sb-score-popup').style.display = 'none';

    document.getElementById('sb-game-name-input').value = '';
    document.getElementById('sb-create-btn').onclick = sbCreate;

    sbLoadRecentSessions();
}

async function sbLoadRecentSessions() {
    const lineId = window.userProfile?.userId;
    if (!lineId) return;

    const section = document.getElementById('sb-history-section');
    const list    = document.getElementById('sb-history-list');

    try {
        const res  = await fetch(`/api/scoreboard/my-history?line_user_id=${encodeURIComponent(lineId)}`);
        const data = await res.json();
        const owned = (data.history || []).filter(h => h.is_owner);
        if (owned.length === 0) { section.style.display = 'none'; return; }

        section.style.display = 'block';
        list.innerHTML = '';
        owned.slice(0, 3).forEach(entry => {
            const d = new Date(entry.created_at);
            const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            const item = document.createElement('div');
            item.className = 'sb-history-item';
            item.innerHTML = `
                <div class="sb-history-meta">${entry.game_name} · ${dateStr} · ${entry.player_count} 人</div>
                <div class="sb-history-actions">
                    <button class="sb-history-continue-btn">繼續這場</button>
                </div>`;
            item.querySelector('.sb-history-continue-btn').onclick = () => {
                sbSessionId   = entry.session_id;
                sbOwnerLineId = lineId;
                sbGameName    = entry.game_name;
                sbShowPlaying();
            };
            list.appendChild(item);
        });
    } catch (e) {
        section.style.display = 'none';
    }
}

// ── 建立 Session ──────────────────────────────────────────────
async function sbCreate() {
    const lineId   = window.userProfile?.userId;
    const gameName = document.getElementById('sb-game-name-input').value.trim();
    if (!gameName) {
        document.getElementById('sb-game-name-input').focus();
        return;
    }
    if (!lineId) return;

    const btn = document.getElementById('sb-create-btn');
    btn.disabled = true;
    btn.textContent = '建立中...';

    try {
        const res  = await fetch('/api/scoreboard/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_name: gameName, owner_line_id: lineId })
        });
        const data = await res.json();
        sbSessionId   = data.session_id;
        sbOwnerLineId = lineId;
        sbGameName    = gameName;

        // 自動把創建者加入為玩家
        await fetch(`/api/scoreboard/${sbSessionId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nickname:     window.userProfile?.displayName || '主持人',
                line_user_id: lineId
            })
        });

        sbShowPlaying();
        sbOpenQrModal();
    } finally {
        btn.disabled = false;
        btn.textContent = '建立並產生 QR code';
    }
}

// ── QR code 浮層（蓋在計分板上）─────────────────────────────
function sbOpenQrModal() {
    const panel = document.getElementById('sb-qr-panel');
    panel.style.display = 'flex';

    document.getElementById('sb-qr-game-name').textContent = sbGameName;
    document.getElementById('sb-qr-close-btn').onclick = sbCloseQrModal;

    const qrDiv = document.getElementById('sb-qrcode');
    qrDiv.innerHTML = '';
    new QRCode(qrDiv, {
        text:   sbGetJoinUrl(sbSessionId),
        width:  180,
        height: 180
    });

    sbStartPolling('sb-waiting-players', false);
}

function sbCloseQrModal() {
    sbStopPolling();
    document.getElementById('sb-qr-panel').style.display = 'none';
    sbStartPolling('sb-rankings', true);
}

// ── 計分進行畫面 ──────────────────────────────────────────────
function sbShowPlaying() {
    sbStopPolling();
    document.getElementById('sb-setup').style.display    = 'none';
    document.getElementById('sb-qr-panel').style.display = 'none';
    document.getElementById('sb-playing').style.display  = 'flex';

    const isOwner = sbOwnerLineId === window.userProfile?.userId;

    document.getElementById('sb-game-title').textContent        = sbGameName;
    document.getElementById('sb-reset-btn').onclick             = sbShowSetup;
    document.getElementById('sb-show-qr-btn').onclick           = sbOpenQrModal;
    document.getElementById('sb-log-btn').onclick               = sbOpenLog;
    document.getElementById('sb-add-player-btn').style.display  = isOwner ? 'block' : 'none';
    document.getElementById('sb-add-player-btn').onclick        = sbOpenAddPlayerPopup;

    sbStartPolling('sb-rankings', true);
}

// ── Polling ───────────────────────────────────────────────────
function sbStartPolling(containerId, isPlaying) {
    sbStopPolling();
    sbFetchAndRender(containerId, isPlaying);
    sbPollTimer = setInterval(() => sbFetchAndRender(containerId, isPlaying), 5000);
}

function sbStopPolling() {
    if (sbPollTimer) { clearInterval(sbPollTimer); sbPollTimer = null; }
}

async function sbFetchAndRender(containerId, isPlaying) {
    if (!sbSessionId) return;
    try {
        const res  = await fetch(`/api/scoreboard/${sbSessionId}`);
        const data = await res.json();
        sbPlayers = data.players || [];
        sbEvents  = data.events  || [];
        if (isPlaying) {
            sbRenderRankings(containerId);
            sbRenderLogIfOpen();
        } else {
            sbRenderWaiting(containerId);
        }
    } catch (e) { /* 網路暫時失敗，等下一輪 */ }
}

function sbRenderWaiting(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (sbPlayers.length === 0) {
        el.innerHTML = '<p class="sb-waiting-empty">等待玩家掃碼加入...</p>';
        return;
    }
    el.innerHTML = sbPlayers.map(p =>
        `<div class="sb-waiting-player">${p.nickname}</div>`
    ).join('');
}

function sbRenderRankings(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const isOwner = sbOwnerLineId === window.userProfile?.userId;

    container.innerHTML = '';
    sbPlayers.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'sb-player-card';
        if (isOwner) card.style.cursor = 'pointer';

        const removeBtn = isOwner
            ? `<button class="sb-remove-btn" title="移除玩家">×</button>`
            : '';

        card.innerHTML = `
            <div class="sb-card-top">
                <span class="sb-name">${p.nickname}</span>
                <span class="sb-score">${p.score}<span class="sb-score-unit"> 分</span></span>
                ${removeBtn}
            </div>`;

        if (isOwner) {
            card.onclick = () => sbOpenScorePopup(p);
            const btn = card.querySelector('.sb-remove-btn');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    sbRemovePlayer(p);
                };
            }
        }
        container.appendChild(card);
    });
}

// ── 紀錄抽屜 ──────────────────────────────────────────────────
function sbOpenLog() {
    const drawer = document.getElementById('sb-log-drawer');
    drawer.style.display = 'flex';
    document.getElementById('sb-log-close-btn').onclick = () => {
        drawer.style.display = 'none';
    };
    sbRenderLog();
}

function sbRenderLogIfOpen() {
    const drawer = document.getElementById('sb-log-drawer');
    if (drawer && drawer.style.display !== 'none') sbRenderLog();
}

function sbRenderLog() {
    const list  = document.getElementById('sb-log-list');
    const empty = document.getElementById('sb-log-empty');
    if (!list) return;

    if (sbEvents.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    list.innerHTML = '';

    sbEvents.forEach(ev => {
        const d  = new Date(ev.created_at);
        const ts = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        const el = document.createElement('div');
        el.className = 'sb-log-entry';

        if (ev.event_type === 'score') {
            const pos = ev.delta >= 0;
            el.innerHTML =
                `<span class="sb-log-time">${ts}</span>` +
                `<span class="sb-log-name">${ev.nickname}</span>` +
                `<span class="sb-log-delta ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${ev.delta}</span>` +
                `<span class="sb-log-after">→ ${ev.new_score} 分</span>`;
        } else if (ev.event_type === 'join') {
            el.innerHTML =
                `<span class="sb-log-time">${ts}</span>` +
                `<span class="sb-log-name">${ev.nickname}</span>` +
                `<span class="sb-log-delta" style="color:rgba(255,255,255,0.4);">加入</span>`;
        } else if (ev.event_type === 'leave') {
            el.innerHTML =
                `<span class="sb-log-time">${ts}</span>` +
                `<span class="sb-log-name">${ev.nickname}</span>` +
                `<span class="sb-log-delta" style="color:rgba(255,255,255,0.3);">離開</span>`;
        }
        list.appendChild(el);
    });
}

// ── 移除玩家 ──────────────────────────────────────────────────
async function sbRemovePlayer(player) {
    if (sbPlayers.length <= 1) {
        alert('至少需要保留 1 位玩家');
        return;
    }
    if (!confirm(`確定要移除「${player.nickname}」嗎？`)) return;

    try {
        const res = await fetch(`/api/scoreboard/${sbSessionId}/remove-player`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: player.player_id, owner_line_id: sbOwnerLineId })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        await sbFetchAndRender('sb-rankings', true);
    } catch (e) {
        alert('移除失敗，請重試');
    }
}

// ── 手動新增玩家 ──────────────────────────────────────────────
function sbOpenAddPlayerPopup() {
    document.getElementById('sb-add-player-input').value = '';
    document.getElementById('sb-add-player-popup').style.display = 'flex';
    setTimeout(() => document.getElementById('sb-add-player-input').focus(), 50);

    document.getElementById('sb-add-player-confirm').onclick = sbConfirmAddPlayer;
    document.getElementById('sb-add-player-cancel').onclick  = sbCloseAddPlayerPopup;
    document.getElementById('sb-add-player-input').onkeydown = (e) => {
        if (e.key === 'Enter') sbConfirmAddPlayer();
    };
}

function sbCloseAddPlayerPopup() {
    document.getElementById('sb-add-player-popup').style.display = 'none';
}

async function sbConfirmAddPlayer() {
    const nickname = document.getElementById('sb-add-player-input').value.trim();
    if (!nickname) {
        document.getElementById('sb-add-player-input').focus();
        return;
    }
    sbCloseAddPlayerPopup();

    try {
        await fetch(`/api/scoreboard/${sbSessionId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, line_user_id: null })
        });
        await sbFetchAndRender('sb-rankings', true);
    } catch (e) { /* 下次 polling 會同步 */ }
}

// ── 分數彈窗 ──────────────────────────────────────────────────
function sbOpenScorePopup(player) {
    document.getElementById('sb-popup-player-name').textContent    = player.nickname;
    document.getElementById('sb-popup-current-score').textContent  = `目前：${player.score} 分`;
    document.getElementById('sb-popup-input').value = '';
    document.getElementById('sb-score-popup').style.display = 'flex';

    setTimeout(() => document.getElementById('sb-popup-input').focus(), 50);

    document.getElementById('sb-popup-plus').onclick  = () => sbApplyScore(player.player_id, 1);
    document.getElementById('sb-popup-minus').onclick = () => sbApplyScore(player.player_id, -1);
    document.getElementById('sb-popup-cancel').onclick = sbCloseScorePopup;
}

function sbCloseScorePopup() {
    document.getElementById('sb-score-popup').style.display = 'none';
}

async function sbApplyScore(playerId, sign) {
    const val = parseInt(document.getElementById('sb-popup-input').value);
    if (isNaN(val) || val <= 0) {
        document.getElementById('sb-popup-input').focus();
        return;
    }
    const delta = sign * val;
    sbCloseScorePopup();

    try {
        await fetch(`/api/scoreboard/${sbSessionId}/score`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId, delta, owner_line_id: sbOwnerLineId })
        });
        await sbFetchAndRender('sb-rankings', true);
    } catch (e) { /* 下一次 polling 會自動同步 */ }
}

// ── 玩家加入頁（掃 QR code 後）────────────────────────────────
let sjSessionId  = null;
let sjPlayerId   = null;
let sjPollTimer  = null;

async function initializeScoreboardJoinPage(sessionId) {
    sjSessionId = sessionId;
    sjPlayerId  = null;
    if (sjPollTimer) { clearInterval(sjPollTimer); sjPollTimer = null; }

    document.getElementById('sj-nickname-panel').style.display = 'block';
    document.getElementById('sj-view-panel').style.display     = 'none';

    // 先拉 session 資料顯示遊戲名稱
    try {
        const res  = await fetch(`/api/scoreboard/${sessionId}`);
        const data = await res.json();
        if (data.error) { document.getElementById('sj-game-name').textContent = '找不到此記分板'; return; }
        document.getElementById('sj-game-name').textContent = data.session.game_name;
    } catch (e) {
        document.getElementById('sj-game-name').textContent = '載入失敗，請重試';
        return;
    }

    document.getElementById('sj-join-btn').onclick = sjJoin;
    document.getElementById('sj-nickname-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') sjJoin();
    });
}

async function sjJoin() {
    const nickname = document.getElementById('sj-nickname-input').value.trim();
    const errorEl  = document.getElementById('sj-join-error');
    errorEl.style.display = 'none';

    if (!nickname) {
        errorEl.textContent = '請輸入暱稱';
        errorEl.style.display = 'block';
        return;
    }

    const lineId = window.userProfile?.userId || null;
    const btn    = document.getElementById('sj-join-btn');
    btn.disabled = true;

    try {
        const res  = await fetch(`/api/scoreboard/${sjSessionId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, line_user_id: lineId })
        });
        const data = await res.json();
        if (data.error) {
            errorEl.textContent = data.error;
            errorEl.style.display = 'block';
            return;
        }
        sjPlayerId = data.player_id;
        sjShowView();
    } catch (e) {
        errorEl.textContent = '加入失敗，請重試';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
    }
}

function sjShowView() {
    document.getElementById('sj-nickname-panel').style.display = 'none';
    document.getElementById('sj-view-panel').style.display     = 'block';

    sjFetchAndRender();
    sjPollTimer = setInterval(sjFetchAndRender, 5000);
}

async function sjFetchAndRender() {
    try {
        const res  = await fetch(`/api/scoreboard/${sjSessionId}`);
        const data = await res.json();
        document.getElementById('sj-view-game-name').textContent = data.session?.game_name || '';
        const players = data.players || [];
        const container = document.getElementById('sj-rankings');
        container.innerHTML = '';
        players.forEach((p, rank) => {
            const card = document.createElement('div');
            card.className = 'sb-player-card' + (rank === 0 ? ' sb-first' : '');
            card.innerHTML = `
                <div class="sb-card-top">
                    <span class="sb-rank">${rank === 0 ? '👑' : rank + 1}</span>
                    <span class="sb-name">${p.nickname}</span>
                    <span class="sb-score">${p.score}<span class="sb-score-unit"> 分</span></span>
                </div>`;
            container.appendChild(card);
        });
    } catch (e) { /* 等下次 */ }
}

// ── 冒險者過往遊戲紀錄頁 ──────────────────────────────────────
async function initializeGameHistoryPage() {
    const lineId    = window.userProfile?.userId;
    const container = document.getElementById('game-history-container');
    if (!lineId) { container.innerHTML = '<p style="text-align:center; padding:20px;">請先登入</p>'; return; }

    try {
        const res  = await fetch(`/api/scoreboard/my-history?line_user_id=${encodeURIComponent(lineId)}`);
        const data = await res.json();
        const list = data.history || [];

        if (list.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--color-text-secondary);">還沒有遊戲紀錄</p>';
            return;
        }

        container.innerHTML = '';
        list.forEach(entry => {
            const d = new Date(entry.created_at);
            const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            const badge   = entry.is_owner ? '<span class="game-history-owner-badge">建立者</span>' : '';
            const item    = document.createElement('div');
            item.className = 'game-history-card';
            item.innerHTML = `
                <div class="game-history-name">${entry.game_name}${badge}</div>
                <div class="game-history-detail">暱稱：${entry.nickname}　分數：${entry.score} 分　共 ${entry.player_count} 位玩家</div>
                <div class="game-history-date">${dateStr}</div>`;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#e74c3c;">載入失敗</p>';
    }
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

