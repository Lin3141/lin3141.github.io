// ============================================
// Theme toggle (persisted, defaults to dark)
// ============================================
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme');

if (savedTheme === 'light') root.setAttribute('data-theme', 'light');

themeToggle.addEventListener('click', () => {
    const isLight = root.getAttribute('data-theme') === 'light';
    if (isLight) {
        root.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
});

// ============================================
// Mobile nav toggle
// ============================================
const mobileMenu = document.getElementById('mobile-menu');
const navMenu = document.getElementById('nav-menu');

mobileMenu.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    navMenu.classList.toggle('active');
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// ============================================
// Smooth scroll for in-page anchors
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        const target = document.querySelector(targetId);
        if (!target) return;
        e.preventDefault();
        const offset = target.getBoundingClientRect().top + window.pageYOffset - 76;
        window.scrollTo({ top: offset, behavior: 'smooth' });
    });
});

// ============================================
// Navbar scroll state + active-link scrollspy
// ============================================
const navbar = document.getElementById('navbar');
const sections = document.querySelectorAll('section[id], footer[id]');
const navLinks = document.querySelectorAll('.nav-link');
const scrollTopBtn = document.getElementById('scroll-top-btn');
const timelineProgress = document.getElementById('timeline-progress');
const timelineEl = document.getElementById('timeline');

function onScroll() {
    const y = window.pageYOffset;

    navbar.classList.toggle('scrolled', y > 20);
    scrollTopBtn.classList.toggle('visible', y > 400);

    let current = '';
    sections.forEach(section => {
        const top = section.getBoundingClientRect().top;
        if (top <= 120 && top + section.offsetHeight > 120) current = section.id;
    });
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });

    if (timelineEl && timelineProgress) {
        const rect = timelineEl.getBoundingClientRect();
        const viewportAnchor = window.innerHeight * 0.65;
        const progress = (viewportAnchor - rect.top) / rect.height;
        timelineProgress.style.height = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    }
}

function throttle(fn, limit) {
    let waiting = false;
    return (...args) => {
        if (waiting) return;
        fn(...args);
        waiting = true;
        setTimeout(() => (waiting = false), limit);
    };
}

window.addEventListener('scroll', throttle(onScroll, 50));
window.addEventListener('resize', throttle(onScroll, 100));
onScroll();

scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ============================================
// Reveal-on-scroll (staggered)
// ============================================
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 6, 5) * 60}ms`;
    revealObserver.observe(el);
});

// Safety net: a very fast/large scroll jump can skip the single frame where
// an element crosses the intersection threshold, leaving it stuck invisible.
// Sweep periodically and reveal anything already past the viewport.
function sweepMissedReveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top < window.innerHeight) {
            el.classList.add('visible');
            revealObserver.unobserve(el);
        }
    });
}
window.addEventListener('scroll', throttle(sweepMissedReveals, 200));

// ============================================
// Animated stat counters
// ============================================
const statEls = document.querySelectorAll('.stat-number');

function animateCount(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCount(entry.target);
            statObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

statEls.forEach(el => statObserver.observe(el));

// ============================================
// Hero role-cycling type effect
// ============================================
const roles = [
    'LLM Engineer',
    'Cloud Engineer',
    'Full-Stack Software Engineer',
    'MSCS Student @ Vanderbilt'
];
const roleEl = document.getElementById('role-cycle');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
    roleEl.textContent = roles[0];
} else {
    let roleIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function typeLoop() {
        const currentRole = roles[roleIndex];
        if (!deleting) {
            charIndex++;
            roleEl.textContent = currentRole.slice(0, charIndex);
            if (charIndex === currentRole.length) {
                deleting = true;
                setTimeout(typeLoop, 1800);
                return;
            }
        } else {
            charIndex--;
            roleEl.textContent = currentRole.slice(0, charIndex);
            if (charIndex === 0) {
                deleting = false;
                roleIndex = (roleIndex + 1) % roles.length;
            }
        }
        setTimeout(typeLoop, deleting ? 35 : 65);
    }
    typeLoop();
}

// ============================================
// Spotlight cursor-follow effect on cards
// ============================================
document.querySelectorAll('.spotlight-card').forEach(card => {
    card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
});

// ============================================
// Copy email to clipboard
// ============================================
const copyEmailBtn = document.getElementById('copy-email');
const copyEmailLabel = document.getElementById('copy-email-label');
const EMAIL = 'lingxinchen223@gmail.com';

copyEmailBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(EMAIL);
    } catch {
        window.location.href = `mailto:${EMAIL}`;
        return;
    }
    const original = copyEmailLabel.textContent;
    copyEmailBtn.querySelector('i').className = 'fas fa-check';
    copyEmailLabel.textContent = 'Copied!';
    setTimeout(() => {
        copyEmailBtn.querySelector('i').className = 'fas fa-envelope';
        copyEmailLabel.textContent = original;
    }, 1800);
});

// ============================================
// Misc
// ============================================
document.getElementById('year').textContent = new Date().getFullYear();
