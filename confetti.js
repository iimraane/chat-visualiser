// Confetti Animation Library for Chat Visualizer
// Provides heart and broken heart confetti effects

class ConfettiHeart {
    constructor(canvas, x, y, type = 'heart') {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = Math.random() * 20 + 15;
        this.speedY = Math.random() * 3 + 2;
        this.speedX = (Math.random() - 0.5) * 4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.opacity = 1;
        this.gravity = 0.1;
        this.colors = type === 'heart'
            ? ['#ff6b6b', '#ee5a5a', '#ff8787', '#fa5252', '#e03131']
            : ['#868e96', '#495057', '#343a40', '#6c757d', '#adb5bd'];
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        this.ctx.rotate(this.rotation);
        this.ctx.globalAlpha = this.opacity;
        this.ctx.fillStyle = this.color;

        if (this.type === 'heart') {
            this.drawHeart();
        } else {
            this.drawBrokenHeart();
        }

        this.ctx.restore();
    }

    drawHeart() {
        const s = this.size / 30;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -5 * s);
        this.ctx.bezierCurveTo(-10 * s, -15 * s, -20 * s, 0, 0, 15 * s);
        this.ctx.bezierCurveTo(20 * s, 0, 10 * s, -15 * s, 0, -5 * s);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawBrokenHeart() {
        const s = this.size / 30;
        // Left half
        this.ctx.beginPath();
        this.ctx.moveTo(-2 * s, -5 * s);
        this.ctx.bezierCurveTo(-10 * s, -15 * s, -20 * s, 0, -2 * s, 12 * s);
        this.ctx.lineTo(-1 * s, 5 * s);
        this.ctx.lineTo(-3 * s, 0);
        this.ctx.lineTo(-1 * s, -3 * s);
        this.ctx.closePath();
        this.ctx.fill();

        // Right half (offset)
        this.ctx.save();
        this.ctx.translate(4 * s, 3 * s);
        this.ctx.beginPath();
        this.ctx.moveTo(2 * s, -8 * s);
        this.ctx.bezierCurveTo(10 * s, -18 * s, 20 * s, -3 * s, 2 * s, 9 * s);
        this.ctx.lineTo(1 * s, 2 * s);
        this.ctx.lineTo(3 * s, -3 * s);
        this.ctx.lineTo(1 * s, -6 * s);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();

        // Crack line
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -6 * s);
        this.ctx.lineTo(-2 * s, 0);
        this.ctx.lineTo(2 * s, 5 * s);
        this.ctx.lineTo(0, 12 * s);
        this.ctx.stroke();
    }

    update() {
        this.speedY += this.gravity;
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
        this.opacity -= 0.008;

        return this.opacity > 0 && this.y < this.canvas.height + 50;
    }
}

class ConfettiManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
    }

    init() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-canvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10000;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    launchHearts(count = 80) {
        this.init();

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const x = Math.random() * this.canvas.width;
                const y = -20;
                this.particles.push(new ConfettiHeart(this.canvas, x, y, 'heart'));
            }, i * 30);
        }

        // Also burst from center
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const x = this.canvas.width / 2 + Math.cos(angle) * 50;
            const y = this.canvas.height / 2 + Math.sin(angle) * 50;
            const heart = new ConfettiHeart(this.canvas, x, y, 'heart');
            heart.speedX = Math.cos(angle) * (Math.random() * 5 + 3);
            heart.speedY = Math.sin(angle) * (Math.random() * 5 + 3) - 5;
            this.particles.push(heart);
        }

        if (!this.animationId) this.animate();
    }

    launchBrokenHearts(count = 50) {
        this.init();

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const x = Math.random() * this.canvas.width;
                const y = -20;
                this.particles.push(new ConfettiHeart(this.canvas, x, y, 'broken'));
            }, i * 40);
        }

        if (!this.animationId) this.animate();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles = this.particles.filter(p => {
            p.draw();
            return p.update();
        });

        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.animationId = null;
        }
    }
}

// Global instance
const confettiManager = new ConfettiManager();

function launchHeartConfetti() {
    confettiManager.launchHearts();
}

function launchBrokenHeartConfetti() {
    confettiManager.launchBrokenHearts();
}
