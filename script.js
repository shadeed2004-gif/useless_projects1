const video = document.getElementById("video");
const snapBtn = document.getElementById("snapBtn");
const cameraBtn = document.getElementById("cameraBtn");
const uploadInput = document.getElementById("uploadInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadBtn = document.getElementById("downloadBtn");

let image = new Image();

// Start camera
cameraBtn.addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.style.display = "block";
        snapBtn.style.display = "inline-block";
    } catch (err) {
        alert("Camera access denied!");
    }
});

// Take snapshot
snapBtn.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    processImage();
});

// Upload image
uploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            processImage();
        };
        image.src = reader.result;
    };
    reader.readAsDataURL(file);
});

function processImage() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const colorMap = {};

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const rgb = `rgb(${r},${g},${b})`;
        colorMap[rgb] = colorMap[rgb] || { count: 0, coords: [] };
        if (colorMap[rgb].coords.length < 3) {
            let x = (i / 4) % canvas.width;
            let y = Math.floor(i / 4 / canvas.width);
            colorMap[rgb].coords.push({ x, y });
        }
        colorMap[rgb].count++;
    }

    // Draw labels
    Object.keys(colorMap).forEach((color) => {
        colorMap[color].coords.forEach(({ x, y }) => {
            drawLabel(x, y, color);
        });
    });

    downloadBtn.disabled = false;
}

// Draw label with background and arrow
function drawLabel(x, y, color) {
    const textColor = getContrastYIQ(color);
    ctx.font = "12px Arial";
    ctx.fillStyle = color;
    const textWidth = ctx.measureText(color).width + 12;

    ctx.beginPath();
    ctx.rect(x, y - 20, textWidth, 16);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.fillText(color, x + 6, y - 8);

    // Draw arrow line
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + textWidth / 2, y - 4);
    ctx.lineTo(x, y);
    ctx.stroke();
}

// Contrast-aware text color
function getContrastYIQ(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    const yiq = (r*299 + g*587 + b*114) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

// Download labeled image
downloadBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "labeled_image.png";
    link.href = canvas.toDataURL();
    link.click();
});
