// Lilac Labs — motion and demos. Plain JS, no dependencies.
// Everything here is progressive: without JS the page shows every section in
// its finished state, and with reduced motion the demos render their end state.
(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var wait = function (ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    };

    // Run cb(true/false) as el enters/leaves the viewport.
    function watch(el, cb, options) {
        if (!("IntersectionObserver" in window)) { cb(true); return; }
        new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { cb(e.isIntersecting, e); });
        }, options || { threshold: 0.25 }).observe(el);
    }

    /* ---------------------------------------------------------------- Header */

    var header = document.querySelector("[data-header]");
    var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---------------------------------------------------------------- Reveal */

    var revealed = document.querySelectorAll("[data-reveal]");
    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add("is-in");
                io.unobserve(e.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
        revealed.forEach(function (el) { io.observe(el); });
    } else {
        revealed.forEach(function (el) { el.classList.add("is-in"); });
    }

    /* ---------------------------------------------------------------- Count up */

    document.querySelectorAll("[data-count]").forEach(function (el) {
        var target = Number(el.dataset.count);
        var suffix = el.dataset.suffix || "";
        if (reduceMotion) return;
        el.textContent = "0" + suffix;
        var done = false;
        watch(el, function (visible) {
            if (!visible || done) return;
            done = true;
            var start = performance.now();
            var dur = 1500;
            (function tick(now) {
                var t = Math.min(1, (now - start) / dur);
                var eased = 1 - Math.pow(1 - t, 3);
                el.textContent = Math.round(target * eased).toLocaleString("en-US") + suffix;
                if (t < 1) requestAnimationFrame(tick);
            })(start);
        }, { threshold: 0.6 });
    });

    /* ---------------------------------------------------------------- Marquee */

    document.querySelectorAll("[data-marquee]").forEach(function (track) {
        Array.prototype.slice.call(track.children).forEach(function (child) {
            var clone = child.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            track.appendChild(clone);
        });
    });

    /* ---------------------------------------------------------------- Hero */

    var stage = document.querySelector("[data-tilt]");
    if (stage && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
        var device = stage.querySelector(".device");
        stage.addEventListener("pointermove", function (e) {
            var r = stage.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5;
            var y = (e.clientY - r.top) / r.height - 0.5;
            device.style.transform = "rotate(-1.6deg) rotateY(" + (x * 7).toFixed(2) + "deg) rotateX(" + (-y * 6).toFixed(2) + "deg)";
        });
        stage.addEventListener("pointerleave", function () {
            device.style.transform = "";
        });
    }

    // Looping clips only play while on screen.
    document.querySelectorAll("video[data-autoplay]").forEach(function (video) {
        if (reduceMotion) {
            video.removeAttribute("autoplay");
            video.pause();
            video.setAttribute("controls", "");
            return;
        }
        watch(video, function (visible) {
            if (visible) video.play().catch(function () {});
            else video.pause();
        }, { threshold: 0.2 });
    });

    /* ---------------------------------------------------------------- Lesson reel */

    var reel = document.querySelector("[data-reel]");
    if (reel) {
        var tabs = Array.prototype.slice.call(reel.querySelectorAll(".reel-tab"));
        var video = reel.querySelector("[data-reel-video]");
        var title = reel.querySelector("[data-reel-title]");
        var list = reel.querySelector(".reel-list");
        var soundBtn = reel.querySelector("[data-sound]");
        var soundLabel = reel.querySelector("[data-sound-label]");
        var current = -1;
        var inView = false;
        var soundOn = false;

        if (reduceMotion) video.setAttribute("controls", "");

        // Clips start muted (browsers only autoplay silently). "Hear Sunny" turns
        // on her voice for every lesson in the player until it's turned off.
        var setSound = function (on) {
            soundOn = on;
            video.muted = !on;
            soundBtn.setAttribute("aria-pressed", String(on));
            soundBtn.setAttribute("aria-label", on ? "Turn off Sunny's voice" : "Turn on Sunny's voice");
            soundLabel.textContent = on ? "Sound on" : "Hear Sunny";
        };
        var playClip = function () {
            var p = video.play();
            if (p && p.catch) p.catch(function () {
                // A browser that wants a fresh tap for sound: keep playing, muted.
                if (!video.muted) {
                    setSound(false);
                    video.play().catch(function () {});
                }
            });
        };
        setSound(false);

        soundBtn.addEventListener("click", function () {
            soundBtn.classList.add("was-used");
            if (soundOn) {
                setSound(false);
                return;
            }
            // Start the lesson over so Sunny's voice begins at the first line.
            // Pause and rewind before unmuting, or the clip is heard for an
            // instant where it was. All of it runs inside the tap, which phones
            // need before they'll play sound.
            video.pause();
            try { video.currentTime = 0; } catch (e) { /* not loaded yet */ }
            setSound(true);
            playClip();
        });
        // Native controls (reduced motion) can unmute too; keep the button in step.
        video.addEventListener("volumechange", function () {
            if (video.muted === soundOn) setSound(!video.muted);
        });

        var select = function (i, userChose) {
            if (i === current) return;
            current = i;
            tabs.forEach(function (tab, j) {
                var on = j === i;
                tab.classList.toggle("is-active", on);
                tab.setAttribute("aria-selected", String(on));
                tab.querySelector(".reel-progress i").style.setProperty("--p", 0);
            });
            var tab = tabs[i];
            title.textContent = tab.querySelector("strong").textContent + " · " +
                tab.querySelector(".reel-grade").textContent.split(" · ")[0];
            // Stop the old clip now, so its voice doesn't run on under the fade.
            video.pause();
            video.classList.add("is-swapping");
            setTimeout(function () {
                video.poster = tab.dataset.poster;
                video.src = tab.dataset.src;
                video.muted = !soundOn;
                video.load();
                video.classList.remove("is-swapping");
                if (inView && (!reduceMotion || userChose || soundOn)) playClip();
            }, 260);
            // Keep the active chip visible in the sideways list on small screens.
            if (list.scrollWidth > list.clientWidth) {
                list.scrollTo({ left: tab.parentElement.offsetLeft - 16, behavior: reduceMotion ? "auto" : "smooth" });
            }
        };

        tabs.forEach(function (tab, i) {
            tab.addEventListener("click", function () { select(i, true); });
        });

        video.addEventListener("timeupdate", function () {
            if (!video.duration || current < 0) return;
            tabs[current].querySelector(".reel-progress i").style.setProperty("--p", (video.currentTime / video.duration).toFixed(4));
        });
        video.addEventListener("ended", function () {
            if (!reduceMotion) select((current + 1) % tabs.length);
        });

        select(0);
        watch(reel, function (visible) {
            inView = visible;
            if (!visible) video.pause();
            else if (!reduceMotion || soundOn) playClip();
        }, { threshold: 0.3 });
    }

    /* ---------------------------------------------------------------- Harness pipeline */

    var pipeline = document.querySelector("[data-pipeline]");
    if (pipeline) {
        var steps = pipeline.querySelectorAll(".pipe-step");
        var checks = pipeline.querySelectorAll(".check");
        var leak = pipeline.querySelector(".check-leak");
        var flags = ["is-drafted", "is-flagged", "is-returning", "is-rewritten", "is-delivered"];

        var setChecks = function (state) {
            checks.forEach(function (c) {
                c.classList.remove("is-pass", "is-fail");
                if (state === "fail") c.classList.add(c === leak ? "is-fail" : "is-pass");
                if (state === "pass") c.classList.add("is-pass");
            });
        };
        var light = function (on) {
            steps.forEach(function (s, i) {
                s.classList.toggle("is-on", i === on);
                s.classList.toggle("is-done", i < on);
            });
        };
        var flag = function (names) {
            flags.forEach(function (f) { pipeline.classList.toggle(f, names.indexOf(f) >= 0); });
        };

        // [phase, lit step, flags, checks, duration]
        var script = [
            [0, 0, [], null, 1500],
            [1, 1, [], null, 1700],
            [2, 2, ["is-drafted"], null, 1900],
            [3, 3, ["is-drafted", "is-flagged"], "fail", 2000],
            [4, 2, ["is-drafted", "is-flagged", "is-returning"], "fail", 1700],
            [5, 2, ["is-drafted", "is-rewritten"], null, 2000],
            [6, 3, ["is-drafted", "is-rewritten"], "pass", 1800],
            [7, 4, ["is-drafted", "is-rewritten", "is-delivered"], "pass", 2200],
            [8, 5, ["is-drafted", "is-rewritten", "is-delivered"], "pass", 2600]
        ];

        var apply = function (row) {
            pipeline.dataset.phase = row[0];
            light(row[1]);
            flag(row[2]);
            setChecks(row[3]);
        };

        if (reduceMotion) {
            apply(script[script.length - 1]);
        } else {
            var running = false;
            var visible = false;
            var run = async function () {
                if (running) return;
                running = true;
                while (visible) {
                    for (var i = 0; i < script.length; i++) {
                        apply(script[i]);
                        await wait(script[i][4]);
                    }
                }
                running = false;
            };
            apply(script[0]);
            watch(pipeline, function (v) {
                visible = v;
                if (v) run();
            }, { threshold: 0.35 });
        }
    }

    /* ---------------------------------------------------------------- What's next: the moment demo */

    // A student gets stuck; Sunny notices why, checks a picture, then draws it.
    var moment = document.querySelector("[data-moment]");
    if (moment) {
        var NS = "http://www.w3.org/2000/svg";
        var canvas = moment.querySelector("[data-canvas]");
        var mTabs = Array.prototype.slice.call(moment.querySelectorAll(".moment-tab"));
        var avatar = moment.querySelector("[data-avatar]");
        var kidText = moment.querySelector("[data-kid]");
        var noticedText = moment.querySelector("[data-noticed]");
        var sayText = moment.querySelector("[data-say]");
        var checkLis = Array.prototype.slice.call(moment.querySelectorAll(".moment-checks li"));
        var beats = {};
        moment.querySelectorAll("[data-beat]").forEach(function (b) { beats[b.dataset.beat] = b; });

        var el = function (tag, attrs, parent) {
            var node = document.createElementNS(NS, tag);
            Object.keys(attrs || {}).forEach(function (k) {
                if (k === "text") node.textContent = attrs[k];
                else node.setAttribute(k, attrs[k]);
            });
            (parent || canvas).appendChild(node);
            return node;
        };
        // Staggered timing for the drawing. In instant mode (reduced motion) every
        // step runs synchronously, in order, so the finished picture is exact.
        var instant = false;
        var later = function (fn, ms) {
            if (instant) fn();
            else setTimeout(fn, ms || 0);
        };
        var show = function (node, delay) {
            later(function () { node.classList.remove("pre"); }, delay);
        };
        var frac = function (x, y, n, d) {
            var g = el("g", { "class": "cv-fade pre" });
            el("text", { x: x, y: y - 6, "class": "cv-frac", text: n }, g);
            el("line", { x1: x - 11, y1: y, x2: x + 11, y2: y, "class": "cv-frac-line" }, g);
            el("text", { x: x, y: y + 22, "class": "cv-frac", text: d }, g);
            return g;
        };

        /* Scene 1: is 1/3 bigger than 1/2? Two equal bars, cut fairly. */
        var fractions = function () {
            var X = 50, W = 400, H = 48, ys = [58, 168], parts = [2, 3], f = {};
            var defs = el("defs", {});
            f.bars = []; f.cuts = []; f.shades = []; f.labels = [];
            ys.forEach(function (y, b) {
                var clip = el("clipPath", { id: "cv-clip-" + b }, defs);
                el("rect", { x: X, y: y, width: W, height: H, rx: 10 }, clip);
                f.bars.push(el("rect", { x: X, y: y, width: W, height: H, rx: 10, "class": "cv-bar cv-grow-x pre" }));
                f.shades.push(el("rect", { x: X, y: y, width: W / parts[b], height: H, "clip-path": "url(#cv-clip-" + b + ")", "class": "cv-shade cv-grow-x pre" + (b ? " alt" : "") }));
                var cuts = [];
                for (var c = 1; c < parts[b]; c++) {
                    var cx = X + (W / parts[b]) * c;
                    cuts.push(el("line", { x1: cx, y1: y, x2: cx, y2: y + H, "class": "cv-cut cv-grow-y pre" }));
                }
                f.cuts.push(cuts);
                f.bars.push(el("rect", { x: X, y: y, width: W, height: H, rx: 10, "class": "cv-outline cv-grow-x pre" }));
                f.labels.push(frac(X + W + 36, y + H / 2 - 2, "1", String(parts[b])));
            });
            var third = X + W / 3, half = X + W / 2;
            f.gap = el("rect", { x: third, y: ys[1], width: half - third, height: H, "class": "cv-gap cv-fade pre" });
            f.guides = [third, half].map(function (gx) {
                return el("line", { x1: gx, y1: 40, x2: gx, y2: 234, "class": "cv-guide cv-fade pre" });
            });
            f.result = el("text", { x: X + W / 2, y: 278, "class": "cv-say cv-fade pre", text: "1/2 is bigger than 1/3" });
            return [
                { say: "Let's draw it. Here are two bars, exactly the same size.", wait: 1900, run: function () {
                    f.bars.forEach(function (b, i) { show(b, i * 80); });
                } },
                { say: "Cut this one into 2 equal pieces. One piece is one half.", wait: 2500, run: function () {
                    f.cuts[0].forEach(function (c) { show(c); });
                    show(f.shades[0], 500);
                    show(f.labels[0], 900);
                } },
                { say: "Cut this one into 3 equal pieces. One piece is one third.", wait: 2700, run: function () {
                    f.cuts[1].forEach(function (c, i) { show(c, i * 220); });
                    show(f.shades[1], 650);
                    show(f.labels[1], 1050);
                } },
                { say: "See? More pieces means smaller pieces. 1/2 is bigger than 1/3.", wait: 3000, run: function () {
                    f.guides.forEach(function (g, i) { show(g, i * 150); });
                    show(f.gap, 450);
                    show(f.result, 800);
                } }
            ];
        };

        /* Scene 2: 52 − 27 = 35. Base-ten blocks, trading a ten. */
        var regroup = function () {
            var rods = [], ones = [];
            var scaffold = [
                el("text", { x: 128, y: 290, "class": "cv-label cv-fade pre", text: "tens" }),
                el("text", { x: 386, y: 290, "class": "cv-label cv-fade pre", text: "ones" }),
                el("line", { x1: 282, y1: 40, x2: 282, y2: 262, "class": "cv-divider cv-fade pre" })
            ];
            var result = el("text", { x: 392, y: 120, "class": "cv-say cv-fade pre", text: "52 − 27 = 25" });
            var rodPos = function (i, j) { return [52 + i * 42, 56 + j * 20]; };
            var onePos = function (k) { return [338 + (k % 4) * 26, 236 - Math.floor(k / 4) * 26]; };
            var place = function (c, p) { c.style.transform = "translate(" + p[0] + "px," + p[1] + "px)"; };
            var cube = function (kind, p) {
                var c = el("rect", { width: 18, height: 18, rx: 3, "class": "cube " + kind });
                place(c, p);
                c.style.opacity = 0;
                return c;
            };
            for (var i = 0; i < 5; i++) {
                var rod = [];
                for (var j = 0; j < 10; j++) rod.push(cube("ten", rodPos(i, j)));
                rods.push(rod);
            }
            ones.push(cube("one", onePos(0)), cube("one", onePos(1)));
            return [
                { say: "Let's build 52 with blocks: five tens and two ones.", wait: 2200, run: function () {
                    scaffold.forEach(function (n) { show(n); });
                    rods.forEach(function (rod, i) {
                        rod.forEach(function (c) { later(function () { c.style.opacity = 1; }, i * 130); });
                    });
                    ones.forEach(function (c, k) { later(function () { c.style.opacity = 1; }, 750 + k * 130); });
                } },
                { say: "We can't take 7 ones from 2 ones, so let's trade one ten for ten ones.", wait: 3000, run: function () {
                    rods[4].slice().reverse().forEach(function (c, n) {
                        later(function () {
                            c.setAttribute("class", "cube one");
                            place(c, onePos(2 + n));
                        }, n * 55);
                        ones.push(c);
                    });
                } },
                { say: "Now there are 12 ones. Take away 7.", wait: 2300, run: function () {
                    ones.slice(5).forEach(function (c, n) {
                        later(function () { c.classList.add("gone"); }, n * 90);
                    });
                } },
                { say: "And take away 2 tens.", wait: 2100, run: function () {
                    rods[2].concat(rods[3]).forEach(function (c, n) {
                        later(function () { c.classList.add("gone"); }, (n % 10) * 40 + (n >= 10 ? 260 : 0));
                    });
                } },
                { say: "2 tens and 5 ones are left. 52 − 27 = 25!", wait: 2800, run: function () {
                    rods[0].concat(rods[1], ones.slice(0, 5)).forEach(function (c) { c.classList.add("keep"); });
                    show(result);
                } }
            ];
        };

        /* Scene 3: 8 + 5 = 12. Hops on a number line, counted from the next number. */
        var hops = function () {
            var x = function (n) { return 40 + (n - 5) * 44; };
            var Y = 204, ticks = [], hopEls = [], counts = [], mark8;
            var line = el("line", { x1: 22, y1: Y, x2: 498, y2: Y, "class": "cv-line cv-grow-x pre" });
            for (var n = 5; n <= 15; n++) {
                ticks.push(el("line", { x1: x(n), y1: Y - 8, x2: x(n), y2: Y + 8, "class": "cv-tick cv-fade pre" }));
                var label = el("text", { x: x(n), y: Y + 32, "class": "cv-num cv-fade pre", text: String(n) });
                ticks.push(label);
                if (n === 8) mark8 = label;
            }
            for (var k = 0; k < 5; k++) {
                var a = x(8 + k), b = x(9 + k), m = (a + b) / 2;
                hopEls.push(el("path", { d: "M" + a + " " + (Y - 6) + " Q" + m + " " + (Y - 62) + " " + b + " " + (Y - 6), pathLength: 1, "class": "cv-hop" }));
                counts.push(el("text", { x: m, y: Y - 44, "class": "cv-count cv-fade pre", text: String(k + 1) }));
            }
            var start = el("circle", { cx: x(8), cy: Y, r: 9, "class": "cv-dot cv-pop pre" });
            var end = el("circle", { cx: x(13), cy: Y, r: 9, "class": "cv-dot good cv-pop pre" });
            var result = el("text", { x: 260, y: 88, "class": "cv-say cv-fade pre", text: "8 + 5 = 13" });
            return [
                { say: "Let's use a number line. Start at 8.", wait: 2300, run: function () {
                    show(line);
                    ticks.forEach(function (t, i) { show(t, 200 + i * 25); });
                    show(start, 900);
                    later(function () { mark8.classList.add("is-mark"); }, 900);
                } },
                { say: "Now hop forward 5 times, one number at a time.", wait: 3300, run: function () {
                    hopEls.forEach(function (h, i) {
                        later(function () { h.classList.add("is-drawn"); }, i * 560);
                        show(counts[i], i * 560 + 250);
                    });
                } },
                { say: "We land on 13. So 8 + 5 = 13!", wait: 2800, run: function () {
                    show(end);
                    show(result, 300);
                } }
            ];
        };

        var scenes = [
            { draw: fractions, avatar: "assets/art/avatars/fox.webp",
              kid: "Isn't 1/3 bigger than 1/2? 3 is bigger than 2.",
              noticed: "They think a bigger bottom number means a bigger piece.",
              checks: ["Both bars are the same size", "Every piece is cut evenly", "Matches the math: 1/2 > 1/3"],
              label: "Two bars the same size. One is cut into 2 equal pieces, the other into 3. One half is bigger than one third." },
            { draw: regroup, avatar: "assets/art/avatars/otter.webp",
              kid: "52 − 27 = 35",
              noticed: "They took 2 from 7 instead of trading a ten.",
              checks: ["Trading keeps the total at 52", "Takes away exactly 27", "Matches the math: 52 − 27 = 25"],
              label: "Base-ten blocks for 52. One ten is traded for ten ones, then 7 ones and 2 tens are taken away, leaving 25." },
            { draw: hops, avatar: "assets/art/avatars/owl.webp",
              kid: "8 + 5 = 12",
              noticed: "They counted the 8 as the first hop.",
              checks: ["Every hop is the same size", "Starts at 8 and hops exactly 5 times", "Matches the math: 8 + 5 = 13"],
              label: "A number line from 5 to 15. Starting at 8, five equal hops land on 13." }
        ];

        var token = 0;
        var sceneAt = 0;
        var mVisible = false;

        var selectTab = function (i) {
            mTabs.forEach(function (t, j) {
                t.classList.toggle("is-active", i === j);
                t.setAttribute("aria-selected", String(i === j));
                t.style.setProperty("--p", 0);
            });
        };
        var setBeat = function (name, on) { beats[name].classList.toggle("is-on", on); };
        var setSay = async function (text, alive) {
            sayText.classList.add("is-changing");
            await wait(220);
            if (alive && !alive()) return;
            sayText.textContent = text;
            sayText.classList.remove("is-changing");
        };
        var prepare = function (i) {
            var sc = scenes[i];
            sceneAt = i;
            selectTab(i);
            canvas.textContent = "";
            canvas.setAttribute("aria-label", sc.label);
            avatar.src = sc.avatar;
            kidText.textContent = sc.kid;
            noticedText.textContent = sc.noticed;
            sayText.textContent = "";
            checkLis.forEach(function (li, k) {
                li.classList.remove("is-pass");
                li.querySelector("[data-check]").textContent = sc.checks[k];
            });
            Object.keys(beats).forEach(function (b) { setBeat(b, false); });
            moment.classList.remove("is-drawing");
            return sc.draw();
        };

        // Reduced motion: every scene shows its finished picture.
        var still = function (i) {
            var steps = prepare(i);
            Object.keys(beats).forEach(function (b) { setBeat(b, true); });
            checkLis.forEach(function (li) { li.classList.add("is-pass"); });
            instant = true;
            steps.forEach(function (st) { st.run(); });
            instant = false;
            sayText.textContent = steps[steps.length - 1].say;
        };

        var play = async function (i) {
            var mine = ++token;
            var alive = function () { return mine === token; };
            var steps = prepare(i);
            var total = 350 + 1300 + 1200 + checkLis.length * 380 + 500 + 3200 +
                steps.reduce(function (n, st) { return n + st.wait + 220; }, 0);
            var t0 = performance.now();
            (function progress() {
                if (!alive()) return;
                mTabs[i].style.setProperty("--p", Math.min(1, (performance.now() - t0) / total).toFixed(4));
                requestAnimationFrame(progress);
            })();

            await wait(350); if (!alive()) return;
            setBeat("kid", true);
            await wait(1300); if (!alive()) return;
            setBeat("noticed", true);
            await wait(1200); if (!alive()) return;
            setBeat("checks", true);
            for (var k = 0; k < checkLis.length; k++) {
                await wait(380); if (!alive()) return;
                checkLis[k].classList.add("is-pass");
            }
            await wait(500); if (!alive()) return;
            setBeat("say", true);
            moment.classList.add("is-drawing");
            for (var s = 0; s < steps.length; s++) {
                await setSay(steps[s].say, alive); if (!alive()) return;
                steps[s].run();
                await wait(steps[s].wait); if (!alive()) return;
            }
            moment.classList.remove("is-drawing");
            await wait(3200); if (!alive()) return;
            if (mVisible) play((i + 1) % scenes.length);
        };

        mTabs.forEach(function (t, i) {
            t.addEventListener("click", function () {
                if (reduceMotion) still(i);
                else play(i);
            });
        });

        if (reduceMotion) {
            still(0);
        } else {
            prepare(0);
            watch(moment, function (v) {
                mVisible = v;
                if (v) play(sceneAt);
                else token++;
            }, { threshold: 0.35 });
        }
    }

    /* ---------------------------------------------------------------- Model swap */

    var swap = document.querySelector("[data-swap]");
    if (swap && !reduceMotion) {
        var chips = swap.querySelectorAll(".swap-chip");
        var swapAt = 0;
        var timer = null;
        watch(swap, function (v) {
            clearInterval(timer);
            if (!v) return;
            timer = setInterval(function () {
                chips[swapAt].classList.remove("is-active");
                swapAt = (swapAt + 1) % chips.length;
                chips[swapAt].classList.add("is-active");
            }, 2200);
        }, { threshold: 0.4 });
    }
})();
