// Dick-tionary JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add hover effects to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Add random dick fact
    const dickFacts = [
        "The Horse Cock has the highest intimidation factor!",
        "Fire Hose Frank can shoot over 4 meters!",
        "Drinking 10+ beers gives you a +50% volume bonus!",
        "The Cop Showed Up condition causes both players to lose!",
        "Morning spots have different effects than night spots!",
        "Pierced Python is one of the legendary dick types!",
        "Weather can completely change the outcome of a contest!",
        "Some dicks have special counter abilities!",
        "The Zone condition makes you immune to all debuffs!",
        "Laser Dick has perfect aim but terrible other stats!"
    ];

    // Display random fact if element exists
    const factElement = document.getElementById('random-fact');
    if (factElement) {
        const randomFact = dickFacts[Math.floor(Math.random() * dickFacts.length)];
        factElement.textContent = `💡 Did you know? ${randomFact}`;
    }

    // Add search functionality for characteristics
    const searchInput = document.getElementById('dick-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const dickItems = document.querySelectorAll('.dick-category li');
            
            dickItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    item.style.display = 'block';
                    item.style.background = 'rgba(255, 205, 0, 0.1)';
                } else {
                    item.style.display = 'none';
                }
            });

            // Show/hide categories if empty
            document.querySelectorAll('.dick-category').forEach(category => {
                const visibleItems = category.querySelectorAll('li[style*="display: block"]');
                if (visibleItems.length === 0 && searchTerm !== '') {
                    category.style.display = 'none';
                } else {
                    category.style.display = 'block';
                }
            });
        });
    }

    // Add filter buttons for conditions
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.dataset.filter;
            const conditions = document.querySelectorAll('.condition-type');
            
            if (filter === 'all') {
                conditions.forEach(condition => {
                    condition.style.display = 'block';
                });
            } else {
                conditions.forEach(condition => {
                    if (condition.classList.contains(filter)) {
                        condition.style.display = 'block';
                    } else {
                        condition.style.display = 'none';
                    }
                });
            }
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Add time-based location highlighting
    const highlightCurrentLocations = () => {
        const now = new Date();
        const hour = now.getHours();
        let timeCategory = '';

        if (hour >= 6 && hour < 12) {
            timeCategory = 'morning';
        } else if (hour >= 12 && hour < 18) {
            timeCategory = 'arvo';
        } else if (hour >= 18 && hour < 24) {
            timeCategory = 'night';
        } else {
            timeCategory = 'late-night';
        }

        // Highlight current time locations
        document.querySelectorAll('.location-category').forEach(category => {
            if (category.dataset.time === timeCategory) {
                category.style.border = '2px solid var(--aussie-gold)';
                category.style.boxShadow = '0 0 20px rgba(255, 205, 0, 0.5)';
            }
        });
    };

    // Run on page load
    if (document.querySelector('.location-category')) {
        highlightCurrentLocations();
    }

    // Add copy command functionality
    document.querySelectorAll('.command-box code').forEach(codeBlock => {
        codeBlock.style.cursor = 'pointer';
        codeBlock.title = 'Click to copy';
        
        codeBlock.addEventListener('click', function() {
            const text = this.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.textContent;
                this.textContent = '✅ Copied!';
                setTimeout(() => {
                    this.textContent = originalText;
                }, 2000);
            });
        });
    });

    // Add page transition effects
    const links = document.querySelectorAll('.nav-link:not(.back-link)');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.href.includes('#')) return; // Skip anchor links
            
            e.preventDefault();
            const href = this.href;
            
            document.body.style.opacity = '0';
            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    });

    // Fade in on page load
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.3s ease';
        document.body.style.opacity = '1';
    }, 100);

    // Console easter egg
    console.log('%c🍆💦 Welcome to the Dick-tionary! 💦🍆', 
        'color: #FFCD00; font-size: 20px; font-weight: bold; background: #00843D; padding: 10px;');
    console.log('%cMay the best dick win, ya legend!', 
        'color: #FFCD00; font-size: 14px;');
});