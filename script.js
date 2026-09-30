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
    if (!m) return;
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

// Entrance for content the visitor just revealed (opened a project or card): fade in from dx, dy
function rise(el, delay = 0, dx = 0, dy = 14) {
    if (still.matches) dx = dy = 0;  // reduced motion: fade only
    el.animate([{ opacity: 0, transform: `translate(${dx}px, ${dy}px)` }, {}],
        { duration: 500, delay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
}
// Scrolled content is never hidden. Headings draw their accent bar and bullet dots pop in
// once they're on screen; CSS does the animating off the .seen class.
document.documentElement.classList.add('js');
const seer = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('seen'); seer.unobserve(e.target); }
}), { threshold: 0.3 });
document.querySelectorAll('h2, ul').forEach(el => {
    [...el.children].forEach((li, k) => li.style.setProperty('--i', k));
    seer.observe(el);
});
// Bullets slide in from the left when a project opens
document.querySelectorAll('.projects details').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) d.querySelectorAll('.body li, .body .stack').forEach((el, k) => rise(el, 60 + k * 70, -16, 0));
}));

// Gentle eased scroll to wherever target() says, re-measured every frame so layout shifts mid-glide
// (the cards' rotating text, fonts landing) don't make it miss. Hand-rolled because Chrome on
// Windows drops behavior:'smooth' entirely when system animations are off; it's user-triggered.
function glide(target) {
    const from = scrollY, max = () => document.documentElement.scrollHeight - innerHeight;
    const to = () => Math.max(0, Math.min(target(), max()));
    const dist = Math.abs(to() - from);
    if (dist < 8) return;  // already there; don't fidget
    const dur = Math.min(1000, 350 + dist / 3), start = performance.now();
    const step = now => {
        const t = Math.min((now - start) / dur, 1);
        scrollTo({ top: from + (to() - from) * (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2), behavior: 'instant' });
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
// Space the fixed nav bar covers, plus breathing room that grows with the window (no fixed sizes)
const nav = document.querySelector('.nav');
const margins = () => {
    const room = Math.min(96, Math.max(24, innerHeight * .1));
    return [nav.offsetHeight + room, room];
};
// Where to scroll so [top, bottom] sits comfortably on screen: the least movement that gets it
// inside the margins, or, if it's too tall for that, its top just below the nav.
function comfy(top, bottom) {
    const [above, below] = margins(), vh = innerHeight;
    if (bottom - top > vh - above - below) return scrollY + top - above;
    return scrollY + (top < above ? top - above : bottom > vh - below ? bottom - vh + below : 0);
}
// A just-opened project list: fit the cards and the list together if they fit comfortably,
// otherwise give the list the screen.
function reveal(head, list) {
    const [above, below] = margins();
    const both = list.getBoundingClientRect().bottom - head.getBoundingClientRect().top <= innerHeight - above - below;
    glide(() => {
        const h = head.getBoundingClientRect(), l = list.getBoundingClientRect();
        return both ? comfy(h.top, l.bottom) : comfy(l.top, l.bottom);
    });
}

// Nav: section links glide there; the bar turns solid once past the top; the current section is marked
const links = [...nav.querySelectorAll('a')];
links.forEach(a => a.addEventListener('click', e => {
    const el = document.querySelector(a.hash), heading = el.querySelector('h2, footer > p') ?? el;
    e.preventDefault();
    history.replaceState(null, '', a.hash === '#top' ? location.pathname : a.hash);
    // Bring the section into focus: centered in the space below the bar if it fits comfortably,
    // otherwise its heading just below the bar with the same breathing room as the cards
    glide(() => {
        if (a.hash === '#top') return 0;
        const [above, below] = margins(), top = heading.getBoundingClientRect().top, h = el.getBoundingClientRect().bottom - top;
        const space = innerHeight - above - below;
        return scrollY + top - above - (h <= space ? (space - h) / 2 : 0);
    });
    pinned = a.hash === '#top' ? null : el;
    markCurrent();
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });  // keyboard and screen readers continue from the section
}));
const solid = () => nav.classList.toggle('solid', scrollY > 8);
addEventListener('scroll', solid, { passive: true });
solid();
// Current section: the last one whose heading has passed the middle of the screen (the last one
// once the page bottoms out). A clicked link stays current until the visitor scrolls by hand,
// since a short section near the end can't reach the middle.
const sections = [...document.querySelectorAll('main section, footer')];
let pinned = null, queued = false;
function markCurrent() {
    queued = false;
    let cur = pinned;
    if (!cur) {
        const mid = (nav.offsetHeight + innerHeight) / 2;
        if (scrollY >= document.documentElement.scrollHeight - innerHeight - 2) cur = sections.at(-1);
        else for (const s of sections) if ((s.querySelector('h2, footer > p') ?? s).getBoundingClientRect().top <= mid) cur = s;
    }
    links.forEach(a => cur && a.hash === '#' + cur.id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
}
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(markCurrent); } };
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);
const unpin = () => { if (pinned) { pinned = null; queue(); } };
addEventListener('wheel', unpin, { passive: true });
addEventListener('touchstart', unpin, { passive: true });
addEventListener('keydown', e => /^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key) && unpin());
markCurrent();

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
        // Size the ticker for its tallest project so rotating never shifts the page below
        let lastW = 0;
        const fit = () => {
            if (innerWidth === lastW) return;  // mobile toolbars fire height-only resizes
            lastW = innerWidth;
            const keep = i;
            let tallest = 0;
            tick.style.minHeight = '';
            for (i = 0; i < items.length; i++) { show(); tallest = Math.max(tallest, tick.offsetHeight); }
            i = keep;
            show();
            tick.style.minHeight = tallest + 'px';
        };
        fit();
        document.fonts.ready.then(() => { lastW = 0; fit(); });
        addEventListener('resize', fit);
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
            if (!opening) return;
            reveal(cats[0].parentElement, panel);
            [...panel.children].forEach((el, k) => rise(el, k * 60));
        });
    });
})();

// Email: clicking copies the address; the label briefly reads "Copied ✓"
document.querySelectorAll('.email').forEach(btn => {
    const label = btn.querySelector('span'), email = btn.dataset.email;
    btn.addEventListener('click', async () => {
        btn.style.minWidth = btn.offsetWidth + 'px';  // keep the pill from shrinking
        try {
            await navigator.clipboard.writeText(email);
            label.textContent = 'Copied ✓';
        } catch {
            label.textContent = email;
            getSelection().selectAllChildren(label);  // clipboard blocked: select it for Ctrl+C
            return;
        }
        clearTimeout(btn.reset);
        btn.reset = setTimeout(() => { label.textContent = email; btn.style.minWidth = ''; }, 2000);
    });
});
