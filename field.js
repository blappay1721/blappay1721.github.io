// Voronoi field: each low-res cell takes the color of its nearest seed; near-ties draw the edges.
(() => {
    const canvas = document.getElementById('field');
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    let CELL = 8;
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
        const n = pts.length, dist = new Float64Array(n);
        const gaps = pts.map(p => pts.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));
        // ponytail: brute-force per cell, O(cells × seeds); fine at 8px cells and 17 seeds
        for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
            let d1 = Infinity, k = 0;
            for (let j = 0; j < n; j++) {
                const dx = pts[j][0] - x, dy = pts[j][1] - y;
                dist[j] = dx * dx + dy * dy;
                if (dist[j] < d1) { d1 = dist[j]; k = j; }
            }
            // Edge = within half a cell of the region's nearest boundary. The boundary with seed j lies
            // (dj - d1) / (2 × gap) away, which keeps lines one cell wide even where two seeds sit close
            // together. Checking every j, not just the second-nearest seed, matters: near a border the
            // neighbor across it is often not the second-nearest seed, and testing only that one left gaps.
            let e = Infinity;
            for (let j = 0; j < n; j++) if (j !== k) e = Math.min(e, (dist[j] - d1) / (2 * gaps[k][j]));
            const t = pts[k][2];
            const c = e < .5 ? edge
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
    // On window, not the hero: the fixed nav sits over the hero and would swallow the events.
    // The cursor's screen position is kept so scrolling (which moves the hero under a still cursor)
    // re-places the probe too; otherwise the highlight drifts away until the mouse moves again.
    let cursor = null;
    function placeProbe() {
        if (!cursor) return;
        const r = hero.getBoundingClientRect();
        const x = (cursor[0] - r.left) / r.width, y = (cursor[1] - r.top) / r.height;
        probe = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? [x, y] : null;
        if (still.matches && visible) draw();
    }
    addEventListener('pointermove', e => { cursor = [e.clientX, e.clientY]; placeProbe(); });
    addEventListener('scroll', placeProbe, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { cursor = probe = null; draw(); });
    new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(hero);
    dark.addEventListener('change', () => { readColors(); draw(); });
    addEventListener('resize', resize);
    // Printouts are white paper: just the cell outlines, in a light tint of the theme's cobalt, on a
    // finer grid so the lines come out thin. Drawn once into a print-only canvas, because browsers
    // can fire afterprint (and redraw the screen field) before they capture the page.
    const paper = Object.assign(document.createElement('canvas'), { id: 'field-print' });
    paper.setAttribute('aria-hidden', 'true');
    canvas.after(paper);
    addEventListener('beforeprint', () => {
        const keep = colors;
        CELL = 3; colors = ['#ffffff', '#ffffff', '#b9c5f2', '#ffffff'].map(hex); probe = null; resize();
        paper.width = w; paper.height = h;
        paper.getContext('2d').drawImage(canvas, 0, 0);
        CELL = 8; colors = keep; resize();
    });

    readColors(); resize(); tick();
})();
