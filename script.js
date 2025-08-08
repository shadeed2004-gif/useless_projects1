const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const startCameraBtn = document.getElementById('startCamera');
const uploadImage = document.getElementById('uploadImage');
const captureBtn = document.getElementById('captureBtn');
const retakeBtn = document.getElementById('retakeBtn');
const downloadBtn = document.getElementById('downloadBtn');

let stream;

// Start camera
startCameraBtn.onclick = async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.style.display = 'block';
        captureBtn.style.display = 'inline-block';
    } catch (err) {
        alert('Camera access denied or unavailable.');
    }
};

// Capture image from camera
captureBtn.onclick = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    stopCamera();
    labelColors();
};

// Upload image from device
uploadImage.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        labelColors();
    };
    img.src = URL.createObjectURL(file);
    canvas.style.display = 'block';
};

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    video.style.display = 'none';
    canvas.style.display = 'block';
    captureBtn.style.display = 'none';
}

// Retake / Upload again
retakeBtn.onclick = () => {
    canvas.style.display = 'none';
    video.style.display = 'none';
    captureBtn.style.display = 'none';
};

// Download labeled image
downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'labeled_image.png';
    link.href = canvas.toDataURL();
    link.click();
};

// Label colors in image
function labelColors() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let colors = {};
    for (let i = 0; i < imageData.length; i += 4 * 50) { // skip some pixels for speed
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const name = getColorName(r, g, b);
        colors[name] = { r, g, b };
    }

    Object.entries(colors).forEach(([name]) => {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, ctx.measureText(name).width + 6, 16);
        ctx.fillStyle = 'black';
        ctx.fillText(name, x + 3, y + 12);
    });
}

// Basic color name function
function getColorName(r, g, b) {
    const colorNames = {
        'Red': [255, 0, 0],
        'Green': [0, 128, 0],
        'Blue': [0, 0, 255],
        'Yellow': [255, 255, 0],
        'Orange': [255, 165, 0],
        'Purple': [128, 0, 128],
        'Pink': [255, 192, 203],
        'Black': [0, 0, 0],
        'White': [255, 255, 255],
        'Gray': [128, 128, 128],
        'Brown': [165, 42, 42]
    };
    let closest = 'Unknown';
    let minDist = Infinity;
    for (let [name, rgb] of Object.entries(colorNames)) {
        const dist = Math.sqrt((r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2);
        if (dist < minDist) {
            minDist = dist;
            closest = name;
        }
    }
    return closest;
}
