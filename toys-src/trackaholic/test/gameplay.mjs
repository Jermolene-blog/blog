/*
Gameplay test for Trackaholic: drives single cars round a fixed set of tracks through the game's own physics
(stepCar), with simulated drivers, and measures how drivable the game is. Results are compared with a committed
baseline, so the effect of any change to the physics or the controls can be seen at a glance.

Usage, from anywhere (needs Playwright: cd toys-src && npm install):
  node toys-src/trackaholic/test/gameplay.mjs            run, and compare with baseline.json
  node toys-src/trackaholic/test/gameplay.mjs --save     run, and save the results as the new baseline
  node toys-src/trackaholic/test/gameplay.mjs --detail   also print each track's results
  node toys-src/trackaholic/test/gameplay.mjs --set tip.k=0 --set assist=0
                                                         try other values of the car's settings (CAR in the toy)
                                                         without editing it; can be repeated

Drivers:
  bot       the game's own bot (botInput), as a reference
  tilt      a person steering by tilting: turns the device in proportion to the angle between the car's heading
            and a point on the road ahead, with a reaction delay, a lagging hand and a tremor, through the game's
            own tilt curve (tiltCurve) and smoothing; brakes by eye, a little late; uses the nitro on straights
  drag      the same person dragging a thumb (70 px is full lock, as in the game)
  keys      the same person on a keyboard: left and right are on or off, ramped as the game ramps them
The people don't know the steering curve; they correct by feel, so a curve that's too sensitive makes them weave
and one that's too dull makes them run wide, as it would a real player. Random numbers are seeded, so runs repeat
exactly.

Measures, per driver (summed or averaged over the tracks):
  km        distance covered along the track in the time allowed (higher is better)
  lap       mean lap time in seconds, over the laps completed
  off%      share of the time with the car's centre off the road
  flips     times the car went past 70 degrees of roll or pitch (upside down or on its side)
  resets    times the game had to put the car back on the road (flipped and stopped, or lost)
  lost      how many of those were because the car was too far from the road for too long
  jumps     times all four wheels left the ground for more than 0.25 s
  landed%   share of those jumps that landed on four wheels and stayed upright
  spins     times the car pointed more than 100 degrees away from the road's direction while moving
  weave     mean rate of change of the steering, per second: how hard the driver works the steering
*/
import {chromium} from "playwright";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const toy = path.resolve(here, "../../../static-assets/toys/trackaholic/index.html");
const baselineFile = path.join(here, "baseline.json");
const args = process.argv.slice(2), has = f => args.includes(f);
const sets = args.flatMap((a, i) => a === "--set" ? [args[i + 1]] : []).map(a => { const [k, v] = a.split("="); return [k.split("."), +v]; });
const SEEDS = [1234, 2718, 3141, 4669, 5772, 8128], SECS = 150, DRIVERS = ["bot", "tilt", "drag", "keys"];

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 400, height: 300}});
const errors = [];
page.on("pageerror", e => errors.push(e.message));
// the toy's libraries come from CDNs: keep copies in test/.cache (not committed) so that runs don't depend on the network
const cacheDir = path.join(here, ".cache");
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.abort());
await page.route(/^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)\//, async route => {
	const url = route.request().url(), file = path.join(cacheDir, url.replace(/^https:\/\//, "").replace(/[^\w.@-]+/g, "_"));
	if(!fs.existsSync(file)) { const res = await route.fetch(); fs.mkdirSync(cacheDir, {recursive: true}); fs.writeFileSync(file, await res.body()); }
	route.fulfill({body: fs.readFileSync(file), contentType: "text/javascript", headers: {"access-control-allow-origin": "*"}});
});
await page.goto("file://" + toy + "?norender");
// wait for the car model, which sets the wheels' positions and size (the Race button is enabled then)
await page.waitForFunction(() => window.GW && GW.T && GW.CAR.wheels && !document.getElementById("bSolo").disabled, null, {timeout: 60000});

const results = await page.evaluate(({SEEDS, SECS, DRIVERS, sets}) => {
	const {CAR, HZ, HALF_W} = GW, h = 1 / HZ;
	for(const [keys, v] of sets) { let o = CAR; for(const k of keys.slice(0, -1)) o = o[k]; o[keys[keys.length - 1]] = v; }
	const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
	const realRandom = Math.random;
	const out = {};
	for(const seed of SEEDS) {
		GW.rebuildCourse(seed);
		const T = GW.T;
		for(const driver of DRIVERS) {
			Math.random = mulberry(seed * 7 + driver.length);
			const rnd = Math.random;
			const c = GW.newCar("t", "Test", "#fff", driver === "bot" ? "bot" : "human");
			c.ai.skill = 1;
			GW.placeCar(c, 0);
			// the person: reaction delay, a lagging hand, a tremor, cornering judged by eye
			const delay = Math.round(0.2 / h), queue = [];
			let hand = 0, tremor = 0, tiltOut = 0, kSteer = 0;
			const m = {t: 0, laps: 0, lapTimes: [], lastLap: null, offT: 0, flips: 0, flipped: false, resets: 0, flipResets: 0, jumps: 0, landed: 0,
				airT: 0, landing: null, spins: 0, spun: false, weave: 0, prevSteer: 0, start: null};
			const qq = {};
			for(let i = 0; i < SECS / h; i++) {
				const vf = c.v.length();
				let inp;
				if(driver === "bot") inp = GW.botInput(c, h);
				else {
					// aim at the middle of the road ahead
					const S = T.S, look = 6 + vf * 0.45, j = (c.idx + Math.round(look / 2)) % S;
					const lx = T.X[j] - c.p.x, lz = T.Z[j] - c.p.z;
					const fx = 2 * (c.q.x * c.q.z + c.q.w * c.q.y), fz = 1 - 2 * (c.q.x * c.q.x + c.q.y * c.q.y);
					const alpha = Math.atan2(fx * lz - fz * lx, fx * lx + fz * lz) * 180 / Math.PI; // positive: the road is to the right
					queue.push(alpha);
					const seen = queue.length > delay ? queue.shift() : 0;
					// brake by eye: the corner a little way ahead, entered about 10% too fast
					let vc = 1e9; for(let k = 2; k < 8; k++) vc = Math.min(vc, T.VC[(c.idx + k) % S]);
					const brk = vf > vc * 1.1 + 2 ? 1 : 0;
					let straight = true; for(let k = 0; k < 40; k += 4) if(T.VC[(c.idx + k) % S] < 40) straight = false;
					tremor += (rnd() - 0.5) * 0.6 - tremor * 0.02;
					let steer;
					if(driver === "tilt") {
						const want = Math.max(-45, Math.min(45, seen * 0.7));
						hand += (want - hand) * Math.min(1, h / 0.12);
						const deg = hand + tremor * 1.5;
						tiltOut += (GW.tiltCurve(deg) - tiltOut) * Math.min(1, h * 18);
						steer = tiltOut;
					} else if(driver === "drag") {
						const want = Math.max(-70, Math.min(70, seen * 3.5));
						hand += (want - hand) * Math.min(1, h / 0.08);
						const dx = Math.max(-70, Math.min(70, hand + tremor * 4));
						steer = Math.sign(dx) * Math.pow(Math.abs(dx) / 70, 1.3);
					} else {
						const k = seen > 6 ? 1 : seen < -6 ? -1 : 0;
						kSteer += Math.max(-4 * h, Math.min(4 * h, k - kSteer)); if(!k && Math.abs(kSteer) < 0.06) kSteer = 0;
						steer = kSteer;
					}
					const fast = vf > 9, drift = false;
					steer = Math.max(-1, Math.min(1, steer));
					// on a touch screen the car accelerates by itself, through the game's own automatic throttle (autoGas)
					const ag = driver === "keys" ? {thr: 1, brk: 0} : GW.autoGas(c);
					inp = {steer, thr: brk ? 0 : ag.thr, brk: Math.max(brk, ag.brk), drift, nitro: driver === "tilt" && straight && c.nitro > 0.3};
				}
				const p0 = c.p.clone(), lap0 = c.lap, flipT0 = c.flipT;
				GW.stepCar(c, inp, h);
				m.t += h;
				// resets: the car jumps back onto the road
				if(c.p.distanceTo(p0) > 4) { m.resets++; if(flipT0 > 1.5) m.flipResets++; }
				if(c.lap > lap0) { if(m.lastLap !== null) m.lapTimes.push(m.t - m.lastLap); m.lastLap = m.t; }
				GW.trackQuery(c.p.x, c.p.z, c.hint, qq);
				if(qq.dist > HALF_W) m.offT += h;
				const upY = 1 - 2 * (c.q.x * c.q.x + c.q.z * c.q.z);
				if(upY < 0.34 && !m.flipped) { m.flipped = true; m.flips++; } else if(upY > 0.8) m.flipped = false;
				const air = !c.contact.some(Boolean);
				if(air) m.airT += h;
				else {
					if(m.airT > 0.25) { m.jumps++; m.landing = {t: m.t, ok: upY > 0.7}; }
					m.airT = 0;
				}
				if(m.landing && m.t - m.landing.t > 1.5) { if(m.landing.ok && !m.landing.spoilt) m.landed++; m.landing = null; }
				if(m.landing && upY < 0.5) m.landing.spoilt = true;
				const fx = 2 * (c.q.x * c.q.z + c.q.w * c.q.y), fz = 1 - 2 * (c.q.x * c.q.x + c.q.y * c.q.y), fl = Math.hypot(fx, fz) || 1;
				const cosA = (fx * qq.tx + fz * qq.tz) / fl;
				if(vf > 5 && cosA < Math.cos(100 * Math.PI / 180) && !m.spun) { m.spun = true; m.spins++; } else if(cosA > 0.5) m.spun = false;
				m.weave += Math.abs(inp.steer - m.prevSteer); m.prevSteer = inp.steer;
				if(m.start === null) m.start = c.prog;
			}
			if(m.landing && m.landing.ok && !m.landing.spoilt) m.landed++;
			out[seed + "/" + driver] = {
				km: +((c.prog - m.start) * 2 / 1000).toFixed(3),
				lap: m.lapTimes.length ? +(m.lapTimes.reduce((a, b) => a + b, 0) / m.lapTimes.length).toFixed(1) : null,
				laps: m.lapTimes.length,
				offPct: +(m.offT / m.t * 100).toFixed(1),
				flips: m.flips, resets: m.resets, lost: m.resets - m.flipResets, jumps: m.jumps, landed: m.landed, landedPct: m.jumps ? Math.round(m.landed / m.jumps * 100) : null, spins: m.spins,
				weave: +(m.weave / m.t).toFixed(2)
			};
		}
	}
	Math.random = realRandom;
	return out;
}, {SEEDS, SECS, DRIVERS, sets});
await browser.close();

// totals per driver over the tracks
const summary = {};
for(const d of DRIVERS) {
	const rows = SEEDS.map(s => results[s + "/" + d]), sum = k => rows.reduce((a, r) => a + r[k], 0);
	const laps = rows.filter(r => r.lap !== null), jumps = sum("jumps");
	summary[d] = {
		km: +sum("km").toFixed(2),
		lap: laps.length ? +(laps.reduce((a, r) => a + r.lap * r.laps, 0) / laps.reduce((a, r) => a + r.laps, 0)).toFixed(1) : null,
		offPct: +(sum("offPct") / rows.length).toFixed(1),
		flips: sum("flips"), resets: sum("resets"), lost: sum("lost"), jumps,
		landedPct: jumps ? Math.round(sum("landed") / jumps * 100) : null,
		spins: sum("spins"),
		weave: +(sum("weave") / rows.length).toFixed(2)
	};
}

const COLS = [["km", "km", 1], ["lap", "lap", -1], ["offPct", "off%", -1], ["flips", "flips", -1], ["resets", "resets", -1], ["lost", "lost", -1],
	["jumps", "jumps", 0], ["landedPct", "landed%", 1], ["spins", "spins", -1], ["weave", "weave", -1]];
const base = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : null;
const fmt = v => v === null || v === undefined ? "-" : String(v);
const show = (title, table, ref) => {
	console.log("\n" + title);
	console.log("driver".padEnd(8) + COLS.map(([, n]) => n.padStart(15)).join(""));
	for(const [d, r] of Object.entries(table)) {
		console.log(d.padEnd(8) + COLS.map(([k, , better]) => {
			let cell = fmt(r[k]);
			const b = ref && ref[d] && ref[d][k];
			if(ref && b !== undefined && b !== null && r[k] !== null && r[k] !== b) {
				const delta = +(r[k] - b).toFixed(2), good = better && Math.sign(delta) === better;
				cell += " (" + (delta > 0 ? "+" : "") + delta + (better ? (good ? " ✓" : " ✗") : "") + ")";
			}
			return cell.padStart(15);
		}).join(""));
	}
};
if(has("--detail")) for(const s of SEEDS) show("track " + s, Object.fromEntries(DRIVERS.map(d => [d, results[s + "/" + d]])), base && base.results && Object.fromEntries(DRIVERS.map(d => [d, base.results[s + "/" + d]])));
if(sets.length) console.log("\nWith " + sets.map(([k, v]) => k.join(".") + "=" + v).join(", "));
show(`All ${SEEDS.length} tracks, ${SECS} s each` + (base ? ` (in brackets: change since the baseline of ${base.date}${base.settings && base.settings.length ? ", run with " + base.settings.join(" ") : ""})` : " (no baseline yet: run with --save)"), summary, base && base.summary);
if(errors.length) console.log("\nPage errors:", errors);
if(has("--save")) {
	fs.writeFileSync(baselineFile, JSON.stringify({date: new Date().toISOString().slice(0, 10), settings: sets.map(([k, v]) => k.join(".") + "=" + v), summary, results}, null, "\t") + "\n");
	console.log("\nSaved as the baseline in " + path.relative(process.cwd(), baselineFile));
}
