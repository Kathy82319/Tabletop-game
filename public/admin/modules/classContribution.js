// public/admin/modules/classContribution.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let items = [];
let chartInstance = null;

const colors = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
    '#59a14f', '#edc948', '#b07aa1', '#ff9da7'
];

function currentValues() {
    return items.map(item => {
        const input = document.querySelector(`.class-contribution-value[data-id="${item.id}"]`);
        return Number(input?.value) || 0;
    });
}

function renderChart() {
    const canvas = document.getElementById('class-contribution-chart');
    const emptyMsg = document.getElementById('class-contribution-chart-empty');
    if (!canvas) return;

    if (items.length === 0) {
        canvas.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyMsg) emptyMsg.style.display = 'none';

    const labels = items.map(item => item.name);
    const values = currentValues();

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = values;
        chartInstance.data.datasets[0].backgroundColor = labels.map((_, i) => colors[i % colors.length]);
        chartInstance.update();
        return;
    }

    chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '職業公會排行',
                data: values,
                backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.parsed.y}`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 }, grace: '15%' },
                x: { ticks: { font: { size: 13 } } }
            }
        }
    });
}

function renderTable() {
    const tbody = document.getElementById('class-contribution-tbody');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">尚無職業資料。</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const iconHtml = item.icon_url
            ? `<img src="${item.icon_url}" style="max-height: 1.2em; vertical-align: middle; border-radius: 4px; margin-right: 4px;">`
            : '';
        const checked = item.is_visible ? 'checked' : '';
        return `
            <tr>
                <td style="text-align:left;">${iconHtml}${item.name}</td>
                <td><input type="number" class="class-contribution-value" data-id="${item.id}" value="${item.value}" style="width:80px; box-sizing:border-box;"></td>
                <td><input type="checkbox" class="class-contribution-visible" data-id="${item.id}" ${checked} style="width:auto;"></td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('.class-contribution-value').forEach(input => {
        input.addEventListener('input', renderChart);
    });
}

async function handleSave() {
    const saveBtn = document.getElementById('btn-save-class-contribution');
    const toggle = document.getElementById('class-contribution-toggle');

    const payload = {
        showOnProfile: toggle.checked,
        items: items.map(item => {
            const input = document.querySelector(`.class-contribution-value[data-id="${item.id}"]`);
            const visibleInput = document.querySelector(`.class-contribution-visible[data-id="${item.id}"]`);
            return { id: item.id, value: Number(input?.value) || 0, isVisible: !!visibleInput?.checked };
        })
    };

    try {
        saveBtn.disabled = true;
        await api.saveClassContribution(payload);
        ui.toast.success('儲存成功');
    } catch (error) {
        ui.toast.error(error.message);
    } finally {
        saveBtn.disabled = false;
    }
}

export const init = async () => {
    const page = document.getElementById('page-class-contribution');
    if (!page) return;

    try {
        const data = await api.getClassContribution();
        items = data.items || [];

        document.getElementById('class-contribution-toggle').checked = !!data.showOnProfile;

        renderTable();
        renderChart();

        const saveBtn = document.getElementById('btn-save-class-contribution');
        if (saveBtn && !saveBtn.dataset.listenerAttached) {
            saveBtn.addEventListener('click', handleSave);
            saveBtn.dataset.listenerAttached = 'true';
        }
    } catch (error) {
        console.error(error);
        ui.toast.error('載入職業公會排行資料失敗');
    }
};
