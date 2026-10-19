(() => {
    const dialog = document.getElementById('profile-crop-dialog');
    const canvas = document.getElementById('profile-crop-canvas');
    const ctx = canvas.getContext('2d');
    const zoom = document.getElementById('crop-zoom');
    const x = document.getElementById('crop-x');
    const y = document.getElementById('crop-y');
    let image = null;
    let kind = 'avatar';
    let loadId = 0;
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
    window.uploadProfileImage = (input, imageKind) => {
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
                kind = imageKind;
                canvas.width = kind === 'banner' ? 900 : 400;
                canvas.height = kind === 'banner' ? 300 : 400;
                canvas.classList.toggle('is-banner', kind === 'banner');
                document.getElementById('profile-crop-title').textContent = kind === 'banner' ? 'Adjust your banner' : 'Adjust your profile picture';
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
        setProfileImageInput(document.getElementById(kind === 'banner' ? 'profile-banner-input' : 'profile-avatar-input'), canvas.toDataURL('image/webp', 0.88));
        saveProfileData();
        closeProfileCrop();
    };
})();
