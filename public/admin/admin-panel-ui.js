document.addEventListener('click', function(e) {
    const urlInput = e.target.closest('[id^="edit-game-image"]');
    if (urlInput) {
        const previewId = urlInput.id === 'edit-game-image'   ? 'prev-img-1' :
                          urlInput.id === 'edit-game-image-2' ? 'prev-img-2' : 'prev-img-3';
        const preview = document.getElementById(previewId);
        if (preview && urlInput.value) {
            preview.src = urlInput.value;
            preview.style.display = 'block';
        }
    }
});

document.addEventListener('change', async function(e) {
    const input = e.target;
    if (!input.classList.contains('r2-file-input')) return;

    const file = input.files[0];
    if (!file) return;

    const targetId  = input.dataset.target;
    const previewId = input.dataset.preview;
    const urlField  = document.getElementById(targetId);
    const preview   = document.getElementById(previewId);
    const label     = input.closest('.img-upload-btn');

    label.classList.add('uploading');
    label.textContent = '⏳';

    try {
        const fd = new FormData();
        fd.append('file', file);

        const res  = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
        const data = await res.json();

        if (!res.ok || data.error) throw new Error(data.error || '上傳失敗');

        if (urlField)  urlField.value = data.url;
        if (preview) { preview.src = data.url; preview.style.display = 'block'; }

    } catch (err) {
        alert('上傳失敗：' + err.message);
    } finally {
        label.classList.remove('uploading');
        label.innerHTML = '📁<input type="file" accept="image/*" data-target="' + targetId + '" data-preview="' + previewId + '" style="display:none" class="r2-file-input">';
        input.value = '';
    }
});

document.addEventListener('input', function(e) {
    const input = e.target;
    if (!input.id || !input.id.startsWith('edit-game-image')) return;
    const previewId = input.id === 'edit-game-image'   ? 'prev-img-1' :
                      input.id === 'edit-game-image-2' ? 'prev-img-2' : 'prev-img-3';
    const preview = document.getElementById(previewId);
    if (!preview) return;
    if (input.value) { preview.src = input.value; preview.style.display = 'block'; }
    else { preview.style.display = 'none'; }
});
