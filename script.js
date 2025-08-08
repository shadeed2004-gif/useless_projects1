// script.js - improved heuristics and overlay
const video = document.getElementById('video');
const procCanvas = document.getElementById('procCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const startCamBtn = document.getElementById('startCam');
const captureBtn = document.getElementById('capture');
const fileInput = document.getElementById('fileInput');
const timeOutput = document.getElementById('timeOutput');
const debugMsg = document.getElementById('debugMsg');

let stream = null;

// camera start
startCamBtn.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
  } catch (e) {
    alert('Camera access denied or not available.');
    console.error(e);
  }
};

// capture from camera
captureBtn.onclick = () => {
  if (!video.videoWidth) { alert('Camera not ready'); return; }
  drawImageToCanvases(video);
  procDetect();
};

// file upload
fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      drawImageToCanvases(img);
      procDetect();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};

// helper: draw image to processing + preview canvases, keep reasonable size
function drawImageToCanvases(imgElem) {
  // target max dimension (better performance)
  const MAX_DIM = 800;
  let iw = imgElem.videoWidth || imgElem.naturalWidth;
  let ih = imgElem.videoHeight || imgElem.naturalHeight;
  let scale = Math.min(1, MAX_DIM / Math.max(iw, ih));
  const w = Math.round(iw * scale);
  const h = Math.round(ih * scale);

  procCanvas.width = w; procCanvas.height = h;
  previewCanvas.width = w; previewCanvas.height = h;
  overlayCanvas.width = w; overlayCanvas.height = h;

  const ctx = procCanvas.getContext('2d');
  ctx.drawImage(imgElem, 0, 0, w, h);

  // copy to preview (so user sees same image)
  const pctx = previewCanvas.getContext('2d');
  pctx.clearRect(0,0,w,h);
  pctx.drawImage(procCanvas, 0, 0);
  // clear overlay
  const octx = overlayCanvas.getContext('2d');
  octx.clearRect(0,0,w,h);
}

// wait for OpenCV runtime
function whenCvReady(fn) {
  if (typeof cv !== 'undefined' && cv && cv.Mat) {
    fn();
  } else {
    console.log('Waiting for OpenCV.js...');
    let check = setInterval(() => {
      if (typeof cv !== 'undefined' && cv && cv.Mat) {
        clearInterval(check);
        fn();
      }
    }, 100);
  }
}

whenCvReady(() => {
  console.log('OpenCV ready');
});

// main processing
function procDetect() {
  timeOutput.textContent = 'Processing...';
  debugMsg.textContent = '';

  try {
    // read from procCanvas
    let src = cv.imread(procCanvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // equalize contrast a bit
    cv.GaussianBlur(gray, gray, new cv.Size(5,5), 0);

    // try to find circle (clock face)
    let circles = new cv.Mat();
    // parameters tuned for typical clock photos
    cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1.0, gray.rows/8, 120, 30, Math.round(Math.min(gray.rows,gray.cols)*0.2), Math.round(Math.min(gray.rows,gray.cols)*0.9));
    if (circles.rows === 0) {
      cleanup([src,gray,circles]);
      timeOutput.textContent = 'No clock face detected';
      return;
    }

    // pick largest circle
    let cdata = circles.data32F;
    // circles are in triplets (x,y,r)
    let best = {x: cdata[0], y: cdata[1], r: cdata[2]};
    // find max radius in case multiple
    for (let i=1;i<circles.cols;i++){
      const x = cdata[i*3], y = cdata[i*3+1], r = cdata[i*3+2];
      if (r > best.r) best = {x,y,r};
    }
    const cx = Math.round(best.x), cy = Math.round(best.y), r = Math.round(best.r);

    // mask inner circle slightly smaller than r to reduce rim lines
    let mask = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
    cv.circle(mask, new cv.Point(cx,cy), Math.round(r*0.95), new cv.Scalar(255), -1);

    // edges only inside mask
    let masked = new cv.Mat();
    cv.bitwise_and(gray, mask, masked);

    let edges = new cv.Mat();
    cv.Canny(masked, edges, 50, 150);

    // Hough lines - allow shorter lines too
    let lines = new cv.Mat();
    cv.HoughLinesP(edges, lines, 1, Math.PI/180, 50, Math.round(r*0.12), 10); // smaller min length

    if (lines.rows === 0) {
      cleanup([src,gray,mask,masked,edges,lines]);
      timeOutput.textContent = 'No clock hands detected';
      return;
    }

    // filter candidate lines: base endpoint very close to center and tip reasonably inside circle (not exactly at rim)
    const innerBaseMax = r * 0.22;   // base must be close to center
    const minTipDist = r * 0.28;     // tip must be away from center enough
    const maxTipDist = r * 0.92;     // tip must be inside circle (avoid rim)
    let cand = [];
    for (let i=0;i<lines.rows;i++){
      let x1 = lines.data32S[i*4], y1 = lines.data32S[i*4+1], x2 = lines.data32S[i*4+2], y2 = lines.data32S[i*4+3];
      let d1 = Math.hypot(x1-cx,y1-cy);
      let d2 = Math.hypot(x2-cx,y2-cy);
      let baseIs1 = d1 < d2;
      let baseDist = baseIs1 ? d1 : d2;
      let tipDist = baseIs1 ? d2 : d1;
      // require base near center and tip inside valid radius band
      if (baseDist <= innerBaseMax && tipDist >= minTipDist && tipDist <= maxTipDist) {
        let tipx = baseIs1 ? x2 : x1;
        let tipy = baseIs1 ? y2 : y1;
        let len = Math.hypot(x2-x1, y2-y1);
        let angleRad = Math.atan2(tipy - cy, tipx - cx);
        let angleDeg = angleRad * 180 / Math.PI;
        let angleFrom12 = ((90 - angleDeg) + 360) % 360;
        cand.push({x1,y1,x2,y2,len,tipDist,angle: angleFrom12});
      }
    }

    if (cand.length === 0) {
      // fallback: allow base a bit farther (some clocks have small hubs)
      for (let i=0;i<lines.rows;i++){
        let x1 = lines.data32S[i*4], y1 = lines.data32S[i*4+1], x2 = lines.data32S[i*4+2], y2 = lines.data32S[i*4+3];
        let d1 = Math.hypot(x1-cx,y1-cy);
        let d2 = Math.hypot(x2-cx,y2-cy);
        let baseIs1 = d1 < d2;
        let baseDist = baseIs1 ? d1 : d2;
        let tipDist = baseIs1 ? d2 : d1;
        if (baseDist <= r*0.36 && tipDist >= r*0.22 && tipDist <= r*0.95) {
          let tipx = baseIs1 ? x2 : x1;
          let tipy = baseIs1 ? y2 : y1;
          let len = Math.hypot(x2-x1, y2-y1);
          let angleRad = Math.atan2(tipy - cy, tipx - cx);
          let angleDeg = angleRad * 180 / Math.PI;
          let angleFrom12 = ((90 - angleDeg) + 360) % 360;
          cand.push({x1,y1,x2,y2,len,tipDist,angle: angleFrom12});
        }
      }
    }

    if (cand.length === 0) {
      cleanup([src,gray,mask,masked,edges,lines]);
      timeOutput.textContent = 'No valid hand-like lines found';
      return;
    }

    // sometimes multiple near-duplicate lines detected -> cluster by angle (within 8 degrees)
    cand.sort((a,b) => b.len - a.len);
    const clusters = [];
    for (const c of cand) {
      let found = false;
      for (const cl of clusters) {
        if (Math.abs(((c.angle - cl.angle)+540)%360 - 180) <= 8) { // circular diff ~8deg
          // merge: keep max length
          if (c.len > cl.len) Object.assign(cl, c);
          found = true; break;
        }
      }
      if (!found) clusters.push(Object.assign({},c));
    }

    // pick minute = longest cluster; hour = next longest (but also with shorter tipDist)
    clusters.sort((a,b) => b.len - a.len);
    let minute = null, hour = null;
    minute = clusters[0];
    if (clusters.length > 1) {
      // pick candidate that's not almost colinear with minute and is shorter
      for (let i=1;i<clusters.length;i++){
        const candH = clusters[i];
        const angDiff = Math.abs(((candH.angle - minute.angle)+540)%360 - 180);
        if (angDiff > 10 || candH.len < minute.len*0.9) {
          hour = candH; break;
        }
      }
      // fallback: take second longest
      if (!hour) hour = clusters[1];
    }

    // compute minute value
    const minuteAngle = minute.angle;
    const minuteVal = Math.round(minuteAngle / 6) % 60;

    // compute hour using hour hand angle (if found); otherwise estimate from minute
    let hourVal;
    if (hour) {
      const hourFloat = hour.angle / 30.0; // 0..12
      // hourFloat already contains fraction due to minute position (approx)
      hourVal = Math.floor(hourFloat) % 12;
      // If hour hand angle looks like e.g. 0.9 (near 12) and minute pushes next hour, use floor.
      // But better correct with minute fraction from minuteVal
      const hourDisplay = (Math.floor(hourFloat) % 12) || 12;
      hourVal = hourDisplay;
    } else {
      // estimate: minute // 5 gives hour tick (0..11)
      const approxHourTick = Math.floor(minuteVal / 5) % 12;
      hourVal = approxHourTick === 0 ? 12 : approxHourTick;
    }

    // final formatting: if hourVal==0 show 12
    if (hourVal === 0) hourVal = 12;
    const timeStr = `${String(hourVal).padStart(2,'0')}:${String(minuteVal).padStart(2,'0')}`;
    timeOutput.textContent = timeStr;

    // draw overlay to visualize selected hands and circle
    drawOverlay(cx, cy, r, minute, hour);

    cleanup([src, gray, mask, masked, edges, lines, circles]);
  } catch (err) {
    console.error(err);
    debugMsg.textContent = 'Processing error: ' + err.message;
    timeOutput.textContent = '—';
  }
}

// draw overlay on overlayCanvas
function drawOverlay(cx, cy, r, minute, hour) {
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0,0,overlayCanvas.width, overlayCanvas.height);

  // circle
  ctx.lineWidth = Math.max(2, Math.round(r*0.02));
  ctx.strokeStyle = 'rgba(0,180,0,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.stroke();

  // minute (red)
  if (minute) {
    const angleM = (90 - minute.angle) * Math.PI/180;
    const tipMx = Math.round(cx + Math.cos(angleM) * minute.tipDist);
    const tipMy = Math.round(cy - Math.sin(angleM) * minute.tipDist);
    ctx.strokeStyle = 'rgba(220,20,60,0.95)';
    ctx.lineWidth = Math.max(3, Math.round(r*0.025));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipMx, tipMy);
    ctx.stroke();
  }

  // hour (blue)
  if (hour) {
    const angleH = (90 - hour.angle) * Math.PI/180;
    const tipHx = Math.round(cx + Math.cos(angleH) * hour.tipDist);
    const tipHy = Math.round(cy - Math.sin(angleH) * hour.tipDist);
    ctx.strokeStyle = 'rgba(20,100,220,0.95)';
    ctx.lineWidth = Math.max(3, Math.round(r*0.018));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipHx, tipHy);
    ctx.stroke();
  }

  // center dot
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, Math.round(r*0.02)), 0, Math.PI*2);
  ctx.fill();
}

// cleanup mats convenience
function cleanup(mats) {
  for (const m of mats) {
    try { if (m && typeof m.delete === 'function') m.delete(); } catch(e){}
  }
}
