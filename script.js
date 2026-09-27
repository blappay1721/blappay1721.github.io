// Voronoi field: each low-res cell takes the color of its nearest seed; near-ties draw the edges.
(() => {
    const canvas = document.getElementById('field');
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    const CELL = 8;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const dark = matchMedia('(prefers-color-scheme: dark)');
    let w, h, img, colors, probe = null, visible = true;
    const seeds = Array.from({ length: 16 }, () => ({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - .5) * .0004, vy: (Math.random() - .5) * .0004,
        t: Math.random()
    }));

    const hex = s => { const n = parseInt(s.trim().slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
    function readColors() {
        const cs = getComputedStyle(document.documentElement);
        colors = ['--cell-a', '--cell-b', '--edge', '--probe'].map(v => hex(cs.getPropertyValue(v)));
    }
    function resize() {
        w = Math.ceil(hero.clientWidth / CELL); h = Math.ceil(hero.clientHeight / CELL);
        canvas.width = w; canvas.height = h;
        img = ctx.createImageData(w, h);
        draw();
    }
    function draw() {
        const [a, b, edge, pc] = colors, d = img.data;
        const pts = seeds.map(s => [s.x * w, s.y * h, s.t]);
        if (probe) pts.push([probe[0] * w, probe[1] * h, -1]);
        // ponytail: brute-force nearest seed per cell, O(cells × seeds); fine at 8px cells and 17 seeds
        for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
            let d1 = Infinity, d2 = Infinity, k = 0;
            for (let j = 0; j < pts.length; j++) {
                const dx = pts[j][0] - x, dy = pts[j][1] - y, dd = dx * dx + dy * dy;
                if (dd < d1) { d2 = d1; d1 = dd; k = j; } else if (dd < d2) d2 = dd;
            }
            const t = pts[k][2];
            const c = Math.sqrt(d2) - Math.sqrt(d1) < 1 ? edge
                : t < 0 ? pc
                : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }
    function tick() {
        if (visible && !still.matches) {
            for (const s of seeds) {
                s.x += s.vx; s.y += s.vy;
                if (s.x < 0 || s.x > 1) s.vx *= -1;
                if (s.y < 0 || s.y > 1) s.vy *= -1;
            }
            draw();
        }
        requestAnimationFrame(tick);
    }

    hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        probe = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
        if (still.matches) draw();
    });
    hero.addEventListener('pointerleave', () => { probe = null; draw(); });
    new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(hero);
    dark.addEventListener('change', () => { readColors(); draw(); });
    addEventListener('resize', resize);

    readColors(); resize(); tick();
})();

// Count a figure up from zero, keeping its prefix, suffix, commas and decimals ("−86%", "16,384", "95.4%").
const still = matchMedia('(prefers-reduced-motion: reduce)');
function countUp(el) {
    const text = el.dataset.final ??= el.textContent;
    const m = text.match(/\d[\d,]*(\.\d+)?/);
    if (!m || still.matches) return;
    const target = parseFloat(m[0].replaceAll(',', '')), places = m[1] ? m[1].length - 1 : 0;
    const fmt = v => text.replace(m[0], v.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }));
    const start = performance.now(), dur = 900;
    const step = now => {
        const t = Math.min((now - start) / dur, 1);
        el.textContent = fmt(target * (1 - (1 - t) ** 3));
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
// Page figures count up each time they scroll (or open) into view
const counter = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && countUp(e.target)), { threshold: 0.6 });
document.querySelectorAll('.result b').forEach(b => counter.observe(b));

// Project category cards: each cycles through its projects' headline results and toggles its list.
(() => {
    const cats = [...document.querySelectorAll('.cat')];
    const panelOf = b => document.getElementById(b.getAttribute('aria-controls'));
    const pause = document.querySelector('.pause');
    pause.addEventListener('click', () => {
        const on = pause.getAttribute('aria-pressed') !== 'true';
        pause.setAttribute('aria-pressed', on);
        pause.textContent = on ? 'Resume rotation' : 'Pause rotation';
        cats[0].parentElement.classList.toggle('paused', on);
    });
    cats.forEach((btn, n) => {
        const panel = panelOf(btn), tick = btn.querySelector('.tick'), pie = btn.querySelector('.pie');
        const items = [...panel.querySelectorAll('summary')].map(s => ({
            num: s.querySelector('.result b')?.textContent ?? '',
            unit: s.querySelector('.result small')?.textContent ?? '',
            title: s.querySelector('h3').textContent
        }));
        let i = 0;
        const show = () => {
            const it = items[i];
            tick.replaceChildren(...[['span', it.title], ['b', it.num], ['small', it.unit]]
                .filter(([, t]) => t).map(([tag, t]) => Object.assign(document.createElement(tag), { textContent: t })));
            const num = tick.querySelector('b');
            if (num) countUp(num);
        };
        btn.querySelector('.cat-count').textContent = items.length + ' projects';
        panel.hidden = true;
        show();
        // Cards flip in order, 2s apart; hovering pauses the pie, and with it the card
        pie.style.animationDelay = -(cats.length - 1 - n) * 2 + 's';
        pie.addEventListener('animationiteration', async () => {
            const move = still.matches ? 0 : 12;
            const out = tick.animate([{}, { opacity: 0, transform: `translateY(${-move}px)` }],
                { duration: 220, easing: 'ease-in', fill: 'forwards' });
            await out.finished;
            i = (i + 1) % items.length;
            show();
            out.cancel();
            // New lines rise in one after another
            [...tick.children].forEach((el, k) => el.animate(
                [{ opacity: 0, transform: `translateY(${move}px)` }, {}],
                { duration: 420, delay: k * 70, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
        });
        btn.addEventListener('click', () => {
            const opening = btn.getAttribute('aria-expanded') !== 'true';
            cats.forEach(b => { b.setAttribute('aria-expanded', 'false'); panelOf(b).hidden = true; });
            btn.setAttribute('aria-expanded', opening);
            panel.hidden = !opening;
        });
    });
})();
