const video = document.getElementById('video');
const captureBtn = document.getElementById('capture');
const uploadInput = document.getElementById('upload');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorThief = new ColorThief();

// Start camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => { video.srcObject = stream; })
  .catch(err => alert("Camera access denied!"));

// Capture from camera
captureBtn.addEventListener('click', () => {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  processImage();
});

// Upload image
uploadInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    processImage();
  };
  img.src = URL.createObjectURL(file);
});

// Process image for top colors
function processImage() {
  const imgData = canvas.toDataURL();
  const img = new Image();
  img.onload = () => {
    const palette = colorThief.getPalette(img, 6); // top 6 colors

    // Redraw original image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Add labels
    palette.forEach((color, i) => {
      const y = 40 + i * 40;
      const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

      // Color swatch
      ctx.fillStyle = rgb;
      ctx.fillRect(canvas.width - 60, y - 15, 30, 30);

      // Line to swatch
      ctx.strokeStyle = rgb;
      ctx.beginPath();
      ctx.moveTo(canvas.width - 60, y);
      ctx.lineTo(canvas.width - 100, y);
      ctx.stroke();

      // Label text
      ctx.fillStyle = "#000";
      ctx.font = "14px Arial";
      ctx.fillText(rgb, canvas.width - 200, y + 5);
    });
  };
  img.src = imgData;
}
