// ============================================
// PARTICLE SYSTEM
// ============================================

let particlesEnabled = true;
let particles = [];
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

// Mouse tracking object
let mouse = {
    x: null,
    y: null,
    radius: 100 // This is the 'repel' distance
};

window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});

// Clear mouse position when it leaves the window so particles don't stay pushed
window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

function initParticles() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = [];
    // Adjust particle count based on screen size for performance
    const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000));
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speedX: Math.random() * 0.5 - 0.25,
            speedY: Math.random() * 0.5 - 0.25,
            opacity: Math.random() * 0.5 + 0.2
        });
    }
}

function animateParticles() {
    if (!particlesEnabled) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

    // Draw connecting lines first (behind particles)
    const maxDistance = 150;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < maxDistance) {
                // Calculate opacity based on distance (closer = more opaque)
                const opacity = (1 - distance / maxDistance) * 0.3;
                ctx.strokeStyle = accentColor;
                ctx.globalAlpha = opacity;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }

    // Draw particles
    ctx.fillStyle = accentColor;
    particles.forEach(p => {
        // Repel Logic
        if (mouse.x != null && mouse.y != null) {
            let dx = p.x - mouse.x;
            let dy = p.y - mouse.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouse.radius) {
                // Calculate the force (stronger when closer)
                let forceDirectionX = dx / distance;
                let forceDirectionY = dy / distance;
                let force = (mouse.radius - distance) / mouse.radius;

                // Move the particle away
                p.x += forceDirectionX * force * 1;
                p.y += forceDirectionY * force * 1;
            }
        }

        // Normal movement
        p.x += p.speedX;
        p.y += p.speedY;

        // Screen wrap/bounce
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(animateParticles);
}

function toggleParticles() {
    particlesEnabled = document.getElementById('set-particles').checked;
    if (particlesEnabled) animateParticles();
}

window.addEventListener('resize', initParticles);

// Start the system
initParticles();
animateParticles();

// Export functions to window
window.toggleParticles = toggleParticles;
window.initParticles = initParticles;
window.animateParticles = animateParticles;
