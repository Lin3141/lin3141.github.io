(() => {
    'use strict';

    const root = document.documentElement;
    const EMAIL = 'lingxinchen223@gmail.com';
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    const desktop = matchMedia('(min-width: 1024px)');

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    /* ---------------------------------------------------------
       Fig. 1 — neighborhood graph with message passing
       --------------------------------------------------------- */
    const graph = (() => {
        const canvas = $('#graph');
        const host = $('#intro');
        if (!canvas || !canvas.getContext) return { refreshColors() {} };

        const ctx = canvas.getContext('2d');
        const LINK = 46, LINK2 = LINK * LINK;
        const REACH = 118;
        const HOP_MS = 85, MAX_HOPS = 12, MIN_GAP = 24;

        let W = 0, H = 0, nodes = [], pointer = null, wave = 0;
        let ink = '27,26,23', accent = '194,65,12', dim = 1;
        let running = false, onScreen = true, lastPulse = 0, resizeFrame = 0;

        function refreshColors() {
            const cs = getComputedStyle(root);
            ink = cs.getPropertyValue('--graph-ink').trim() || ink;
            accent = cs.getPropertyValue('--graph-accent').trim() || accent;
            dim = parseFloat(cs.getPropertyValue('--graph-dim')) || 1;
            if (!running) draw();
        }

        function seed() {
            const cs = getComputedStyle(canvas);
            const num = (prop, fallback) => {
                const v = parseFloat(cs.getPropertyValue(prop));
                return Number.isFinite(v) ? v : fallback;
            };
            const cx = num('--graph-cx', 0.7) * W;
            const cy = num('--graph-cy', 0.5) * H;
            const rx = num('--graph-rx', 0.3) * W;
            const ry = num('--graph-ry', 0.2) * H;

            nodes = [];
            for (let tries = 0; tries < 5000 && nodes.length < 130; tries++) {
                const angle = Math.random() * Math.PI * 2;
                const u = Math.sqrt(Math.random());
                // thin the population out toward the rim so it fades, rather than stopping
                if (Math.random() < u * u * 0.65) continue;

                const x = cx + Math.cos(angle) * u * rx;
                const y = cy + Math.sin(angle) * u * ry;
                if (x < 6 || y < 6 || x > W - 6 || y > H - 6) continue;
                if (nodes.some(n => (n.x - x) ** 2 + (n.y - y) ** 2 < MIN_GAP * MIN_GAP)) continue;

                nodes.push({
                    x, y, hx: x, hy: y, vx: 0, vy: 0,
                    r: 1.4 + Math.random() * 1.1,
                    act: 0, wave: 0, hop: 0, due: Infinity,
                });
            }
        }

        function resize() {
            W = canvas.clientWidth;
            H = canvas.clientHeight;
            if (!W || !H) return;
            const dpr = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
            draw();
        }

        function pointAt(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function nearest(x, y) {
            let best = null, bestDist = Infinity;
            for (const n of nodes) {
                const d = (n.x - x) ** 2 + (n.y - y) ** 2;
                if (d < bestDist) { bestDist = d; best = n; }
            }
            return { node: best, dist: Math.sqrt(bestDist) };
        }

        function pulse(x, y, maxDist = 70) {
            const { node, dist } = nearest(x, y);
            if (!node || dist > maxDist) return false;
            wave += 1;
            node.wave = wave;
            node.hop = 0;
            node.due = performance.now();
            lastPulse = performance.now();
            return true;
        }

        function update(now) {
            for (const n of nodes) {
                n.vx += (Math.random() - 0.5) * 0.03 + (n.hx - n.x) * 0.0009;
                n.vy += (Math.random() - 0.5) * 0.03 + (n.hy - n.y) * 0.0009;

                if (pointer) {
                    const dx = n.x - pointer.x, dy = n.y - pointer.y;
                    const d = Math.hypot(dx, dy);
                    if (d < REACH && d > 0.5) {
                        const force = (1 - d / REACH) * 0.07;
                        n.vx += (dx / d) * force;
                        n.vy += (dy / d) * force;
                    }
                }

                n.vx *= 0.94;
                n.vy *= 0.94;
                n.x += n.vx;
                n.y += n.vy;

                if (n.due <= now) {
                    n.due = Infinity;
                    n.act = 1;
                    if (n.hop < MAX_HOPS) {
                        for (const m of nodes) {
                            if (m.wave === n.wave) continue;
                            if ((m.x - n.x) ** 2 + (m.y - n.y) ** 2 > LINK2) continue;
                            m.wave = n.wave;
                            m.hop = n.hop + 1;
                            m.due = now + HOP_MS * (0.75 + Math.random() * 0.5);
                        }
                    }
                }
                n.act *= 0.972;
            }

            if (!pointer && now - lastPulse > 7000 && nodes.length) {
                const n = nodes[(Math.random() * nodes.length) | 0];
                pulse(n.x, n.y);
            }
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.lineCap = 'round';

            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
                    if (d2 > LINK2) continue;
                    const t = 1 - Math.sqrt(d2) / LINK;
                    const heat = Math.min(a.act, b.act);
                    if (heat > 0.04) {
                        ctx.strokeStyle = `rgba(${accent},${(0.25 + 0.65 * heat) * t})`;
                        ctx.lineWidth = 1.2;
                    } else {
                        ctx.strokeStyle = `rgba(${ink},${Math.min(0.42 * t * dim, 1)})`;
                        ctx.lineWidth = 0.8;
                    }
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }

            if (pointer) {
                ctx.lineWidth = 0.8;
                for (const n of nodes) {
                    const d = Math.hypot(n.x - pointer.x, n.y - pointer.y);
                    if (d > REACH) continue;
                    ctx.strokeStyle = `rgba(${accent},${0.32 * (1 - d / REACH)})`;
                    ctx.beginPath();
                    ctx.moveTo(pointer.x, pointer.y);
                    ctx.lineTo(n.x, n.y);
                    ctx.stroke();
                }
            }

            for (const n of nodes) {
                const near = pointer ? clamp(1 - Math.hypot(n.x - pointer.x, n.y - pointer.y) / REACH, 0, 1) : 0;
                const glow = Math.max(n.act, near * 0.7);
                ctx.fillStyle = glow > 0.04
                    ? `rgba(${accent},${0.55 + 0.45 * glow})`
                    : `rgba(${ink},${Math.min(0.62 * dim, 1)})`;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + glow * 1.7, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function frame(now) {
            if (!running) return;
            update(now);
            draw();
            requestAnimationFrame(frame);
        }

        function start() {
            if (running || reduceMotion.matches || !onScreen) return;
            running = true;
            requestAnimationFrame(frame);
        }

        function stop() { running = false; }

        new ResizeObserver(() => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(resize);
        }).observe(canvas);

        new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            onScreen ? start() : stop();
        }).observe(host);

        host.addEventListener('pointermove', e => {
            if (e.pointerType !== 'mouse' || reduceMotion.matches) return;
            pointer = pointAt(e);
            host.style.cursor = nearest(pointer.x, pointer.y).dist < 60 ? 'crosshair' : '';
        });

        host.addEventListener('pointerleave', () => {
            pointer = null;
            host.style.cursor = '';
        });

        host.addEventListener('click', e => {
            if (reduceMotion.matches) return;
            if (e.target.closest('a, button, input, img')) return;
            if (String(getSelection())) return;
            const p = pointAt(e);
            pulse(p.x, p.y);
        });

        reduceMotion.addEventListener('change', () => (reduceMotion.matches ? (stop(), draw()) : start()));

        refreshColors();
        start();
        return { refreshColors };
    })();

    /* ---------------------------------------------------------
       Theme
       --------------------------------------------------------- */
    const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches);

    function setTheme(theme) {
        root.dataset.theme = theme;
        try { localStorage.setItem('theme', theme); } catch (e) {}
        graph.refreshColors();
    }

    function toggleTheme(originX, originY) {
        const next = isDark() ? 'light' : 'dark';
        if (!document.startViewTransition || reduceMotion.matches) { setTheme(next); return; }

        const x = originX ?? innerWidth / 2;
        const y = originY ?? innerHeight / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

        document.startViewTransition(() => setTheme(next)).ready.then(() => {
            root.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' }
            );
        });
    }

    $('#theme-toggle').addEventListener('click', e => {
        const r = e.currentTarget.getBoundingClientRect();
        toggleTheme(r.left + r.width / 2, r.top + r.height / 2);
    });

    darkQuery.addEventListener('change', () => { if (!root.dataset.theme) graph.refreshColors(); });

    /* ---------------------------------------------------------
       Table of contents: active section + reading progress
       --------------------------------------------------------- */
    (() => {
        const links = $$('.toc a');
        const sections = links.map(a => document.getElementById(a.dataset.section));
        if (!links.length) return;
        let queued = false;

        function update() {
            queued = false;
            const anchor = innerHeight * 0.3;
            const atBottom = innerHeight + scrollY >= document.body.scrollHeight - 2;
            let active = 0;
            sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= anchor) active = i; });
            if (atBottom) active = sections.length - 1;

            links.forEach((a, i) => {
                let progress = i < active ? 1 : 0;
                if (i === active) {
                    const rect = sections[i].getBoundingClientRect();
                    progress = atBottom ? 1 : clamp((anchor - rect.top) / Math.max(rect.height, 1), 0, 1);
                }
                a.style.setProperty('--p', progress.toFixed(3));
                a.classList.toggle('active', i === active);
                if (i === active) a.setAttribute('aria-current', 'true');
                else a.removeAttribute('aria-current');
            });
        }

        addEventListener('scroll', () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(update);
        }, { passive: true });
        addEventListener('resize', update);
        update();
    })();

    /* ---------------------------------------------------------
       Experience accordion
       --------------------------------------------------------- */
    (() => {
        const jobs = $$('.job');
        const expandAll = $('#expand-all');

        function setOpen(job, open) {
            job.toggleAttribute('data-open', open);
            $('.job-head', job).setAttribute('aria-expanded', String(open));
        }

        function syncLabel() {
            if (!expandAll) return;
            expandAll.textContent = jobs.every(j => j.hasAttribute('data-open')) ? 'Collapse all' : 'Expand all';
        }

        jobs.forEach(job => {
            $('.job-head', job).addEventListener('click', () => {
                setOpen(job, !job.hasAttribute('data-open'));
                syncLabel();
            });
        });

        expandAll?.addEventListener('click', () => {
            const open = jobs.some(j => !j.hasAttribute('data-open'));
            jobs.forEach(j => setOpen(j, open));
            syncLabel();
        });

        syncLabel();
    })();

    /* ---------------------------------------------------------
       Cursor label on project rows
       --------------------------------------------------------- */
    (() => {
        const pill = $('#cursor-pill');
        const targets = $$('[data-cursor]');
        if (!pill || !targets.length || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        let tx = 0, ty = 0, x = 0, y = 0, frame = 0;

        function follow() {
            x += (tx - x) * 0.2;
            y += (ty - y) * 0.2;
            pill.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
            frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(follow) : 0;
        }

        addEventListener('pointermove', e => {
            tx = e.clientX;
            ty = e.clientY;
            if (!frame) frame = requestAnimationFrame(follow);
        }, { passive: true });

        targets.forEach(el => {
            el.addEventListener('pointerenter', () => {
                $('span', pill).textContent = el.dataset.cursor;
                pill.classList.add('show');
            });
            el.addEventListener('pointerleave', () => pill.classList.remove('show'));
        });
    })();

    /* ---------------------------------------------------------
       Toast + copy email
       --------------------------------------------------------- */
    const toastEl = $('#toast');
    let toastTimer;

    function toast(message) {
        toastEl.textContent = message;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
    }

    async function copyEmail() {
        try {
            await navigator.clipboard.writeText(EMAIL);
            return true;
        } catch (e) {
            return false;
        }
    }

    (() => {
        const link = $('#email');
        const hint = $('#email-hint');
        let hintTimer;
        hint.textContent = 'Click to copy';

        link.addEventListener('click', async e => {
            e.preventDefault();
            if (await copyEmail()) {
                hint.textContent = 'Copied to clipboard';
                hint.classList.add('ok');
                clearTimeout(hintTimer);
                hintTimer = setTimeout(() => {
                    hint.textContent = 'Click to copy';
                    hint.classList.remove('ok');
                }, 2400);
            } else {
                location.href = `mailto:${EMAIL}`;
            }
        });
    })();

    /* ---------------------------------------------------------
       Command palette
       --------------------------------------------------------- */
    (() => {
        const el = $('#palette');
        const input = $('#palette-input');
        const list = $('#palette-list');

        const jump = id => () => document.getElementById(id)?.scrollIntoView({
            behavior: reduceMotion.matches ? 'auto' : 'smooth',
            block: 'start',
        });
        const openUrl = url => () => window.open(url, '_blank', 'noopener');

        const commands = [
            { group: 'Jump to', label: 'About', hint: '01', run: jump('about') },
            { group: 'Jump to', label: 'Experience', hint: '02', run: jump('experience') },
            { group: 'Jump to', label: 'Projects', hint: '03', run: jump('projects') },
            { group: 'Jump to', label: 'Awards', hint: '04', run: jump('awards') },
            { group: 'Jump to', label: 'Education', hint: '05', run: jump('education') },
            { group: 'Jump to', label: 'Skills', hint: '06', run: jump('skills') },
            { group: 'Jump to', label: 'Contact', hint: '07', run: jump('contact') },
            { group: 'Actions', label: 'Copy email address', hint: EMAIL, keywords: 'mail contact reach', run: async () => toast(await copyEmail() ? 'Email copied' : EMAIL) },
            { group: 'Actions', label: 'Toggle dark mode', keywords: 'theme light appearance', run: () => toggleTheme() },
            { group: 'Actions', label: 'Open résumé', hint: 'PDF', keywords: 'resume cv download', run: openUrl('Lingxin_Chen_Resume.pdf') },
            { group: 'Links', label: 'GitHub', hint: 'Lin3141', run: openUrl('https://github.com/Lin3141') },
            { group: 'Links', label: 'LinkedIn', hint: 'lingxin-chen', run: openUrl('https://www.linkedin.com/in/lingxin-chen-b65912184/') },
        ];

        let filtered = commands;
        let active = 0;
        let lastFocus = null;

        function highlight() {
            $$('.palette-item', list).forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
            const current = $(`#cmd-${active}`, list);
            if (current) {
                input.setAttribute('aria-activedescendant', current.id);
                current.scrollIntoView({ block: 'nearest' });
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        }

        function render() {
            const query = input.value.trim().toLowerCase();
            filtered = commands.filter(c => !query ||
                `${c.label} ${c.group} ${c.keywords || ''}`.toLowerCase().includes(query));
            active = clamp(active, 0, Math.max(filtered.length - 1, 0));
            list.textContent = '';

            if (!filtered.length) {
                const empty = document.createElement('li');
                empty.className = 'palette-empty';
                empty.textContent = 'Nothing matches that';
                list.append(empty);
                input.removeAttribute('aria-activedescendant');
                return;
            }

            let group = '';
            filtered.forEach((command, i) => {
                if (command.group !== group) {
                    group = command.group;
                    const heading = document.createElement('li');
                    heading.className = 'palette-group';
                    heading.setAttribute('role', 'presentation');
                    heading.textContent = group;
                    list.append(heading);
                }

                const item = document.createElement('li');
                item.className = 'palette-item';
                item.id = `cmd-${i}`;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', String(i === active));

                const label = document.createElement('span');
                label.textContent = command.label;
                item.append(label);

                if (command.hint) {
                    const hint = document.createElement('span');
                    hint.className = 'pi-hint';
                    hint.textContent = command.hint;
                    item.append(hint);
                }

                item.addEventListener('pointermove', () => {
                    if (active === i) return;
                    active = i;
                    highlight();
                });
                item.addEventListener('click', () => run(i));
                list.append(item);
            });

            highlight();
        }

        function run(index = active) {
            const command = filtered[index];
            if (!command) return;
            close();
            command.run();
        }

        function open() {
            if (!el.hidden) return;
            lastFocus = document.activeElement;
            el.hidden = false;
            input.value = '';
            active = 0;
            render();
            input.focus();
            document.body.style.overflow = 'hidden';
        }

        function close() {
            if (el.hidden) return;
            el.hidden = true;
            document.body.style.overflow = '';
            lastFocus?.focus?.({ preventScroll: true });
        }

        input.addEventListener('input', () => { active = 0; render(); });

        el.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key === 'Tab') { e.preventDefault(); return; }
            if (!filtered.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                active = (active + 1) % filtered.length;
                highlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                active = (active - 1 + filtered.length) % filtered.length;
                highlight();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                run();
            }
        });

        $$('[data-close-palette]').forEach(b => b.addEventListener('click', close));
        $$('[data-open-palette]').forEach(b => b.addEventListener('click', open));

        addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                el.hidden ? open() : close();
            } else if (e.key === '/' && el.hidden && !e.target.closest('input, textarea, [contenteditable]')) {
                e.preventDefault();
                open();
            }
        });
    })();

    /* ---------------------------------------------------------
       Odds and ends
       --------------------------------------------------------- */
    (() => {
        const bar = $('#mobile-bar');
        const name = $('.name');
        new IntersectionObserver(([entry]) => {
            const show = !entry.isIntersecting && !desktop.matches;
            bar.classList.toggle('show', show);
            bar.inert = !show;
        }, { rootMargin: '-56px 0px 0px 0px' }).observe(name);
    })();

    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
        $$('.kbd-mod').forEach(k => (k.textContent = 'Ctrl'));
    }

    $('#year').textContent = new Date().getFullYear();
})();
