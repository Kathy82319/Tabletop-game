import { ui } from '../ui.js';

let allSessions = [];

// ── 渲染列表 ──────────────────────────────────────────────────
function renderList(list) {
    const tbody = document.getElementById('sb-admin-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">沒有記分板紀錄</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(s => {
        const d       = new Date(s.created_at);
        const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        const owner   = s.owner_name || s.owner_line_id;
        return `
        <tr>
            <td>${s.game_name}</td>
            <td class="compound-cell" style="text-align:left;">
                <div class="main-info">${owner}</div>
                <div class="sub-info">${s.owner_line_id}</div>
            </td>
            <td>${dateStr}</td>
            <td>${s.player_count}</td>
            <td>
                <button class="action-btn btn-view" data-id="${s.session_id}" data-name="${s.game_name}" style="margin-right:6px; background:var(--warning-color); color:#000;">查看</button>
                <button class="action-btn btn-delete" data-id="${s.session_id}" data-name="${s.game_name}" style="background:var(--danger-color); color:#fff;">刪除</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-view').forEach(btn => {
        btn.onclick = () => openDetail(btn.dataset.id, btn.dataset.name);
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deleteSession(btn.dataset.id, btn.dataset.name);
    });
}

// ── 篩選 ──────────────────────────────────────────────────────
function applyFilter() {
    const term = (document.getElementById('sb-admin-search')?.value || '').toLowerCase().trim();
    const filtered = term
        ? allSessions.filter(s =>
            s.game_name.toLowerCase().includes(term) ||
            (s.owner_name || '').toLowerCase().includes(term) ||
            s.owner_line_id.toLowerCase().includes(term))
        : allSessions;
    renderList(filtered);
}

// ── 查看詳細 Modal ────────────────────────────────────────────
async function openDetail(sessionId, gameName) {
    const modal = document.getElementById('sb-admin-modal');
    document.getElementById('sb-admin-modal-title').textContent = gameName;
    document.getElementById('sb-admin-modal-players').innerHTML = '<tr><td colspan="3" style="text-align:center;">讀取中...</td></tr>';
    document.getElementById('sb-admin-modal-events').innerHTML  = '';
    modal.style.display = 'flex';

    document.getElementById('sb-admin-modal-close').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    try {
        const res  = await fetch(`/api/admin/scoreboards?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();

        // 玩家
        const playersEl = document.getElementById('sb-admin-modal-players');
        const players   = data.players || [];
        playersEl.innerHTML = players.length === 0
            ? '<tr><td colspan="3" style="text-align:center; color:#888;">無玩家資料</td></tr>'
            : players.map(p => {
                const jd = new Date(p.joined_at);
                const jt = `${jd.getMonth()+1}/${jd.getDate()} ${jd.getHours().toString().padStart(2,'0')}:${jd.getMinutes().toString().padStart(2,'0')}`;
                return `<tr><td>${p.nickname}</td><td>${p.score} 分</td><td>${jt}</td></tr>`;
            }).join('');

        // 事件
        const eventsEl = document.getElementById('sb-admin-modal-events');
        const events   = data.events || [];
        if (events.length === 0) {
            eventsEl.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">尚無紀錄</td></tr>';
        } else {
            eventsEl.innerHTML = events.map(ev => {
                const d  = new Date(ev.created_at);
                const ts = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
                if (ev.event_type === 'score') {
                    const sign = ev.delta >= 0 ? '+' : '';
                    const color = ev.delta >= 0 ? '#2a7a4a' : '#c0392b';
                    return `<tr>
                        <td>${ts}</td>
                        <td>${ev.nickname}</td>
                        <td style="color:${color}; font-weight:bold;">${sign}${ev.delta}</td>
                        <td>${ev.new_score} 分</td>
                    </tr>`;
                } else {
                    const label = ev.event_type === 'join' ? '加入' : '離開';
                    return `<tr>
                        <td>${ts}</td>
                        <td>${ev.nickname}</td>
                        <td colspan="2" style="color:#888;">${label}</td>
                    </tr>`;
                }
            }).join('');
        }
    } catch (e) {
        document.getElementById('sb-admin-modal-players').innerHTML =
            '<tr><td colspan="3" style="color:red; text-align:center;">載入失敗</td></tr>';
    }
}

// ── 刪除 ──────────────────────────────────────────────────────
async function deleteSession(sessionId, gameName) {
    if (!confirm(`確定要刪除「${gameName}」的記分板紀錄嗎？\n此操作無法復原，包含所有玩家與遊戲紀錄都會一併刪除。`)) return;

    try {
        const res  = await fetch('/api/admin/scoreboards', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '刪除失敗');

        ui.toast.success(`已刪除「${gameName}」`);
        allSessions = allSessions.filter(s => s.session_id !== sessionId);
        applyFilter();
    } catch (e) {
        ui.toast.error(e.message);
    }
}

// ── 初始化 ────────────────────────────────────────────────────
export async function init() {
    const tbody = document.getElementById('sb-admin-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">讀取中...</td></tr>';

    try {
        const res = await fetch('/api/admin/scoreboards');
        allSessions = await res.json();
        applyFilter();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">載入失敗</td></tr>';
        return;
    }

    document.getElementById('sb-admin-search')?.addEventListener('input', applyFilter);
    document.getElementById('sb-admin-clear-btn')?.addEventListener('click', () => {
        const input = document.getElementById('sb-admin-search');
        if (input) input.value = '';
        applyFilter();
    });
}
