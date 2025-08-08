const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const previewImg = document.getElementById('previewImg');
const startCamBtn = document.getElementById('startCam');
const captureBtn = document.getElementById('capture');
const fileInput = document.getElementById('fileInput');
const timeOutput = document.getElementById('timeOutput');
const debugMsg = document.getElementById('debugMsg');

let stream;

// Start camera
startCamBtn.onclick = async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
    } catch (e) {
        alert('Camera access denied or not available.');
        console.error(e);
    }
};

// Capture from camera
captureBtn.onclick = () => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    previewImg.src = dataUrl;
    detectTime(dataUrl);
};

// Upload file
fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        previewImg.src = reader.result;
        detectTime(reader.result);
    };
    reader.readAsDataURL(file);
};

// Wait until OpenCV.js is ready
function onOpenCvReady() {
    console.log('OpenCV.js loaded');
}

// Main detection
function detectTime(dataUrl) {
    timeOutput.textContent = 'Processing...';
    debugMsg.textContent = '';

    let img = new Image();
    img.onload = function () {
        let mat = cv.imread(img);
        let gray = new cv.Mat();
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

        // Detect clock circle
        let circles = new cv.Mat();
        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, gray.rows/8, 100, 30, gray.rows/8, gray.rows/2);
        if (circles.rows === 0) {
            timeOutput.textContent = 'No clock face detected';
            mat.delete(); gray.delete(); circles.delete();
            return;
        }

        let circle = circles.data32F;
        let cx = circle[0], cy = circle[1], r = circle[2];

        // Detect hands (edges + lines)
        let edges = new cv.Mat();
        cv.Canny(gray, edges, 50, 150);
        let lines = new cv.Mat();
        cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 60, r * 0.4, 10);

        if (lines.rows === 0) {
            timeOutput.textContent = 'No clock hands detected';
            mat.delete(); gray.delete(); circles.delete(); edges.delete(); lines.delete();
            return;
        }

        let hands = [];
        for (let i = 0; i < lines.rows; i++) {
            let [x1, y1, x2, y2] = lines.intPtr(i);
            let d1 = Math.hypot(x1 - cx, y1 - cy);
            let d2 = Math.hypot(x2 - cx, y2 - cy);
            if (d1 < r*0.7 || d2 < r*0.7) {
                let len = Math.hypot(x2 - x1, y2 - y1);
                let tipx = d1 > d2 ? x1 : x2;
                let tipy = d1 > d2 ? y1 : y2;
                let angle = Math.atan2(tipy - cy, tipx - cx) * (180 / Math.PI);
                let angFrom12 = (90 - angle + 360) % 360;
                hands.push({ angle: angFrom12, length: len });
            }
        }

        if (hands.length < 1) {
            timeOutput.textContent = 'No valid hands found';
            mat.delete(); gray.delete(); circles.delete(); edges.delete(); lines.delete();
            return;
        }

        hands.sort((a, b) => b.length - a.length);
        let minuteAngle = hands[0].angle;
        let minute = Math.round(minuteAngle / 6) % 60;

        let hourAngle = hands.length > 1 ? hands[1].angle : minuteAngle;
        let hour = Math.floor(hourAngle / 30) % 12;
        let hh = hour === 0 ? 12 : hour;

        timeOutput.textContent = `${String(hh).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

        mat.delete(); gray.delete(); circles.delete(); edges.delete(); lines.delete();
    };
    img.src = dataUrl;
}
