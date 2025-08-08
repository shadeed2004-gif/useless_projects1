const canvas = document.getElementById("analogClock");
const ctx = canvas.getContext("2d");
const generateBtn = document.getElementById("generateBtn");

function drawClock(hours, minutes) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let radius = canvas.width / 2;
    ctx.translate(radius, radius);
    radius = radius * 0.90;

    drawFace(ctx, radius);
    drawNumbers(ctx, radius);
    drawTime(ctx, hours, minutes, radius);

    ctx.translate(-canvas.width / 2, -canvas.height / 2);
}

function drawFace(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();

    ctx.strokeStyle = "#333";
    ctx.lineWidth = radius * 0.05;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.05, 0, 2 * Math.PI);
    ctx.fillStyle = "#333";
    ctx.fill();
}

function drawNumbers(ctx, radius) {
    ctx.font = radius * 0.15 + "px Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let num = 1; num <= 12; num++) {
        let ang = num * Math.PI / 6;
        ctx.rotate(ang);
        ctx.translate(0, -radius * 0.85);
        ctx.rotate(-ang);
        ctx.fillText(num.toString(), 0, 0);
        ctx.rotate(ang);
        ctx.translate(0, radius * 0.85);
        ctx.rotate(-ang);
    }
}

function drawTime(ctx, hour, minute, radius) {
    let hourPos = (hour % 12) * Math.PI / 6 +
                  (minute * Math.PI / (6 * 60));
    drawHand(ctx, hourPos, radius * 0.5, radius * 0.07);

    let minutePos = (minute * Math.PI / 30);
    drawHand(ctx, minutePos, radius * 0.8, radius * 0.07);
}

function drawHand(ctx, pos, length, width) {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.moveTo(0, 0);
    ctx.rotate(pos);
    ctx.lineTo(0, -length);
    ctx.stroke();
    ctx.rotate(-pos);
}

// When user clicks "Generate"
generateBtn.addEventListener("click", () => {
    const timeValue = document.getElementById("timeInput").value;
    if (!timeValue) {
        alert("Please enter a time!");
        return;
    }
    const [hour, minute] = timeValue.split(":").map(Number);
    drawClock(hour, minute);
});
