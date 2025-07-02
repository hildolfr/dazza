// ===== DAZZA'S WORLD MAP SCRIPT =====

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Welcome to Dazza\'s World, cunt!');
    
    // Add subtle parallax effect on mouse move
    const mapViewport = document.querySelector('.map-viewport');
    const australiaMap = document.querySelector('.australia-map');
    
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    
    // Smooth animation loop
    function animate() {
        // Lerp towards target position
        targetX += (mouseX - targetX) * 0.05;
        targetY += (mouseY - targetY) * 0.05;
        
        // Apply subtle rotation based on mouse position
        const rotateX = 15 + targetY * 5; // Base 15deg + mouse influence
        const rotateY = targetX * 5;
        
        australiaMap.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Add click sound effect ready for future features
    const landmass = document.querySelector('.landmass');
    landmass.style.cursor = 'pointer';
    
    landmass.addEventListener('click', (e) => {
        // Calculate click position relative to landmass
        const rect = landmass.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        console.log(`Clicked at: ${x.toFixed(1)}%, ${y.toFixed(1)}%`);
        
        // Create a temporary click indicator
        const indicator = document.createElement('div');
        indicator.style.position = 'absolute';
        indicator.style.left = `${x}%`;
        indicator.style.top = `${y}%`;
        indicator.style.width = '20px';
        indicator.style.height = '20px';
        indicator.style.background = 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)';
        indicator.style.borderRadius = '50%';
        indicator.style.transform = 'translate(-50%, -50%)';
        indicator.style.pointerEvents = 'none';
        indicator.style.animation = 'click-pulse 0.5s ease-out forwards';
        
        landmass.appendChild(indicator);
        
        setTimeout(() => {
            indicator.remove();
        }, 500);
    });
    
    // Add some random ambient animations
    setInterval(() => {
        // Randomly trigger a dust particle
        if (Math.random() < 0.3) {
            createDustParticle();
        }
    }, 5000);
    
    function createDustParticle() {
        const particle = document.createElement('div');
        particle.className = 'dust-particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${50 + Math.random() * 30}%`;
        particle.style.animation = `dust-float ${8 + Math.random() * 4}s ease-in-out`;
        
        document.querySelector('.animation-layer').appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 12000);
    }
});

// Add click pulse animation
const style = document.createElement('style');
style.textContent = `
    @keyframes click-pulse {
        0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);