const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const captureBtn = document.getElementById("captureBtn");
const upload = document.getElementById("upload");
const colorThief = new ColorThief();

// Start camera
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        alert("Camera access denied: " + err.message);
    });

// Capture from camera
captureBtn.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    processImage();
});

// Upload from device
upload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        processImage();
    };
    img.src = URL.createObjectURL(file);
});

// Process image and label colors
function processImage() {
    const img = new Image();
    img.src = canvas.toDataURL();

    img.onload = () => {
        const colors = colorThief.getPalette(img, 8); // Get 8 main colors

        colors.forEach(color => {
            const name = namer(`rgb(${color[0]}, ${color[1]}, ${color[2]})`).basic[0].name;

            // Random position for labels
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;

            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x - 10, y - 10, 20, 20);

            ctx.fillStyle = "black";
            ctx.font = "14px Arial";
            ctx.fillText(name, x + 15, y);
        });
    };
}
