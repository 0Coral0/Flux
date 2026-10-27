(() => {
    const dialog = document.getElementById('profile-crop-dialog');
    const canvas = document.getElementById('profile-crop-canvas');
    const ctx = canvas.getContext('2d');
    const zoom = document.getElementById('crop-zoom');
    const x = document.getElementById('crop-x');
    const y = document.getElementById('crop-y');
    let image = null;
    let loadId = 0;
    let target = 'avatar';
    window.setProfileImageInput = (input, value) => {
        input.dataset.upload = value.startsWith('data:image/') ? value : '';
        input.value = input.dataset.upload ? '' : value;
        input.placeholder = input.dataset.upload ? 'Uploaded image' : 'https://...';
    };
    window.getProfileImageInput = input => input.dataset.upload || input.value.trim();

    function draw() {
        if (!image) return;
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * Number(zoom.value);
        const width = image.width * scale, height = image.height * scale;
        const left = -(width - canvas.width) * Number(x.value) / 100;
        const top = -(height - canvas.height) * Number(y.value) / 100;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, left, top, width, height);
    }
    [zoom, x, y].forEach(input => input.addEventListener('input', draw));
    window.uploadProfileImage = (input, nextTarget = 'avatar') => {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 15000000) return alert('Please choose an image smaller than 15 MB.');
        const id = ++loadId;
        const reader = new FileReader();
        reader.onload = () => {
            const nextImage = new Image();
            nextImage.onload = () => {
                if (id !== loadId) return;
                if (nextImage.naturalWidth * nextImage.naturalHeight > 40000000) return alert('Please resize that image before uploading.');
                image = nextImage;
                target = nextTarget === 'banner' ? 'banner' : 'avatar';
                canvas.width = target === 'banner' ? 900 : 400;
                canvas.height = target === 'banner' ? 300 : 400;
                document.getElementById('profile-crop-title').textContent = target === 'banner' ? 'Adjust your profile banner' : 'Adjust your profile picture';
                zoom.value = 1; x.value = 50; y.value = 50;
                draw();
                if (!dialog.open) dialog.showModal();
            };
            nextImage.onerror = () => alert('That image could not be opened. Please try another.');
            nextImage.src = reader.result;
        };
        reader.onerror = () => alert('That image could not be opened. Please try another.');
        reader.readAsDataURL(file);
    };
    window.closeProfileCrop = () => { ++loadId; dialog.close(); image = null; };
    window.applyProfileCrop = () => {
        if (!image) return;
        let result = canvas.toDataURL('image/webp', 0.76);
        let width = canvas.width, height = canvas.height, quality = 0.76;
        for (let attempt = 0; result.length > 28000 && attempt < 5; attempt++) {
            width = Math.max(160, Math.round(width * 0.78));
            height = Math.max(80, Math.round(height * 0.78));
            quality = Math.max(0.42, quality - 0.08);
            const compact = document.createElement('canvas'); compact.width = width; compact.height = height;
            compact.getContext('2d').drawImage(canvas, 0, 0, width, height);
            result = compact.toDataURL('image/webp', quality);
        }
        setProfileImageInput(document.getElementById(target === 'banner' ? 'profile-banner-input' : 'profile-avatar-input'), result);
        saveProfileData();
        closeProfileCrop();
    };
})();
