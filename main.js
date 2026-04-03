(() => {
	// ---------- Math ----------
	class Vec2 {
		constructor(x = 0, y = 0) {
			this.x = x;
			this.y = y;
		}

		clone() { return new Vec2(this.x, this.y); }

		set(x, y) {
			this.x = x;
			this.y = y;
			return this;
		}

		add(v) {
			this.x += v.x;
			this.y += v.y;
			return this;
		}

		sub(v) {
			this.x -= v.x;
			this.y -= v.y;
			return this;
		}

		scale(s) {
			this.x *= s;
			this.y *= s;
			return this;
		}

		len() { return Math.hypot(this.x, this.y); }
		lenSq() { return this.x * this.x + this.y * this.y; }

		normalize() {
			const l = this.len();
			if (l > 1e-6) {
				this.x /= l;
				this.y /= l;
			}
			return this;
		}

		limit(max) {
			const l2 = this.lenSq();
			if (l2 > max * max) {
				const l = Math.sqrt(l2);
				this.x = (this.x / l) * max;
				this.y = (this.y / l) * max;
			}
			return this;
		}

		dot(v) { return this.x * v.x + this.y * v.y; }

		perp() { return new Vec2(-this.y, this.x); }

		static add(a, b) { return new Vec2(a.x + b.x, a.y + b.y); }
		static sub(a, b) { return new Vec2(a.x - b.x, a.y - b.y); }
		static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
		static fromAngle(a) { return new Vec2(Math.cos(a), Math.sin(a)); }
	}

	function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

	// ---------- Agent ----------
	class Boid {
		constructor(x, y, color = "#e5e7eb") {
			this.pos = new Vec2(x, y);
			this.vel = Vec2.fromAngle(Math.random() * Math.PI * 2).scale(80);
			this.acc = new Vec2();

			this.maxSpeed = 170;
			this.maxForce = 260;
			this.radius = 10;
			this.color = color;
			this.heading = this.vel.clone().normalize();
		}

		applyForce(force) {
			this.acc.add(force);
		}

		seek(target) {
			const desired = Vec2.sub(target, this.pos).normalize().scale(this.maxSpeed);
			return desired.sub(this.vel).limit(this.maxForce);
		}

		flee(target) {
			const desired = Vec2.sub(this.pos, target).normalize().scale(this.maxSpeed);
			return desired.sub(this.vel).limit(this.maxForce);
		}

		pursuit(targetBoid) {
			const toTarget = Vec2.sub(targetBoid.pos, this.pos);
			const dist = toTarget.len();

			const relativeSpeed = this.maxSpeed + targetBoid.vel.len();
			const prediction = clamp(dist / Math.max(relativeSpeed, 1), 0.2, 5.3);

			const futurePos = Vec2.add(
				targetBoid.pos,
				targetBoid.vel.clone().scale(prediction)
			);

			return this.seek(futurePos);
		}

		update(dt) {
			this.vel.add(this.acc.clone().scale(dt)).limit(this.maxSpeed);
			this.pos.add(this.vel.clone().scale(dt));

			if (this.vel.lenSq() > 1e-6) {
				this.heading = this.vel.clone().normalize();
			}

			this.acc.set(0, 0);
		}

		draw(ctx) {
			const a = Math.atan2(this.heading.y, this.heading.x);

			ctx.save();
			ctx.translate(this.pos.x, this.pos.y);
			ctx.rotate(a);

			ctx.beginPath();
			ctx.moveTo(this.radius * 1.3, 0);
			ctx.lineTo(-this.radius, this.radius * 0.7);
			ctx.lineTo(-this.radius * 0.55, 0);
			ctx.lineTo(-this.radius, -this.radius * 0.7);
			ctx.closePath();

			ctx.fillStyle = this.color;
			ctx.fill();

			ctx.restore();
		}
	}

	// ---------- Wall helpers ----------
	function raySegmentIntersection(rayOrigin, rayDir, a, b) {
		const v1 = Vec2.sub(rayOrigin, a);
		const v2 = Vec2.sub(b, a);
		const cross = rayDir.x * v2.y - rayDir.y * v2.x;

		if (Math.abs(cross) < 1e-8) return null;

		const t = (v2.x * v1.y - v2.y * v1.x) / cross;
		const u = (rayDir.x * v1.y - rayDir.y * v1.x) / cross;

		if (t >= 0 && u >= 0 && u <= 1) {
			return {
				t,
				point: new Vec2(rayOrigin.x + rayDir.x * t, rayOrigin.y + rayDir.y * t)
			};
		}
		return null;
	}

	function nearestPointOnSegment(p, a, b) {
		const ab = Vec2.sub(b, a);
		const ap = Vec2.sub(p, a);
		const abLenSq = ab.lenSq();
		if (abLenSq <= 1e-8) return a.clone();

		const t = clamp(ap.dot(ab) / abLenSq, 0, 1);
		return new Vec2(a.x + ab.x * t, a.y + ab.y * t);
	}

	// ---------- App ----------
	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");

	const btns = [...document.querySelectorAll(".btn[data-scene]")];
	const resetBtn = document.getElementById("resetBtn");

	const mouse = new Vec2(canvas.width * 0.5, canvas.height * 0.5);
	let activeScene = "flee";

	const scenes = {
		flee: createFleeScene(),
		pursuit: createPursuitScene(),
		wall: createWallScene()
	};

	function setScene(name) {
		activeScene = name;
		btns.forEach(b => b.classList.toggle("active", b.dataset.scene === name));
		scenes[name].reset();
	}

	btns.forEach(b => {
		b.addEventListener("click", () => setScene(b.dataset.scene));
	});

	resetBtn.addEventListener("click", () => scenes[activeScene].reset());

	canvas.addEventListener("mousemove", (e) => {

		const r = canvas.getBoundingClientRect();
		mouse.set(
			((e.clientX - r.left) / r.width) * canvas.width,
			((e.clientY - r.top) / r.height) * canvas.height
		);
	});

	canvas.addEventListener("mousedown", () => {
		scenes[activeScene].onClick(mouse.clone());
	});

	// ---------- Scene: Flee ----------
	function createFleeScene() {
		const boid = new Boid(canvas.width * 0.5, canvas.height * 0.5, "#22d3ee");
		boid.maxSpeed = 220;
		boid.maxForce = 320;

		let threat = mouse.clone();
		const dangerRadius = 180;

		return {
			reset() {
				boid.pos.set(canvas.width * 0.5, canvas.height * 0.5);
				boid.vel = Vec2.fromAngle(Math.random() * Math.PI * 2).scale(100);
				threat = mouse.clone();
			},

			onClick(pos) {
				threat = pos;
			},

			update(dt) {
				const d = Vec2.dist(boid.pos, threat);
				if (d < dangerRadius) {
					const force = boid.flee(threat).scale(1 + (dangerRadius - d) / dangerRadius);
					boid.applyForce(force);
				} else {
					// Light stabilization so the agent does not fully stop.
					boid.applyForce(boid.seek(new Vec2(canvas.width * 0.5, canvas.height * 0.5)).scale(0.15));
				}

				keepInside(boid, 25);
				boid.update(dt);
			},

			draw() {
				drawCross(threat, "#f43f5e");
				drawCircle(threat, dangerRadius, "rgba(244,63,94,0.15)");
				boid.draw(ctx);
				drawLabel("S-Flee", "#f43f5e");
			}
		};
	}

	// ---------- Scene: Pursuit ----------
	function createPursuitScene() {
		const target = new Boid(canvas.width * 0.25, canvas.height * 0.5, "#34d399");
		target.maxSpeed = 185;
		target.maxForce = 300;

		const hunter = new Boid(canvas.width * 0.75, canvas.height * 0.5, "#f43f5e");
		hunter.maxSpeed = 210;
		hunter.maxForce = 290;

		let t = 0;
		let wasTouching = false;

		function targetWanderForce() {
			const ang = t * 1.8;
			const circleCenter = target.heading.clone().scale(170);
			const displacement = Vec2.fromAngle(ang).scale(100);
			const desired = Vec2.add(target.vel.clone().normalize().scale(target.maxSpeed), Vec2.add(circleCenter, displacement));
			return desired.sub(target.vel).limit(target.maxForce);
		}

		return {
			reset() {
				target.pos.set(canvas.width * 0.25, canvas.height * 0.5);
				target.vel = Vec2.fromAngle(0.3).scale(120);

				hunter.pos.set(canvas.width * 0.75, canvas.height * 0.5);
				hunter.vel = Vec2.fromAngle(Math.PI).scale(140);

				t = 0;
				wasTouching = false;
			},

			onClick() {},

			update(dt) {
				t += dt;

				target.applyForce(targetWanderForce().scale(0.85));
				keepInside(target, 30);

				const d = Vec2.dist(hunter.pos, target.pos);
				const touching = d < (hunter.radius + target.radius + 6);
				if (touching) {
					hunter.vel.scale(0);
				}

				hunter.applyForce(hunter.pursuit(target));
				keepInside(hunter, 30);

				target.update(dt);
				hunter.update(dt);
			},

			draw() {
				target.draw(ctx);
				hunter.draw(ctx);

				// Hunter to target visual connection.
				ctx.beginPath();
				ctx.moveTo(hunter.pos.x, hunter.pos.y);
				ctx.lineTo(target.pos.x, target.pos.y);
				ctx.strokeStyle = "rgba(255,255,255,0.15)";
				ctx.stroke();

				drawLabel("S-Pursuit", "#34d399");
			}
		};
	}

	// ---------- Scene: WallAvoidance ----------
	function createWallScene() {
		const boid = new Boid(120, canvas.height * 0.5, "#22d3ee");
		boid.maxSpeed = 190;
		boid.maxForce = 330;

		let goal = new Vec2(canvas.width - 80, canvas.height * 0.5);
		let detourTarget = null;
		let detourTimer = 0;
		let debugFeelers = [];

		const walls = [
			[new Vec2(320, 120), new Vec2(320, 430)],
			[new Vec2(520, 170), new Vec2(760, 170)],
			[new Vec2(560, 460), new Vec2(900, 330)],
			[new Vec2(860, 80), new Vec2(860, 260)]
		];

		function clampPointToArena(p, margin = 16) {
			return new Vec2(
				clamp(p.x, margin, canvas.width - margin),
				clamp(p.y, margin, canvas.height - margin)
			);
		}

		function findBlockingWall(from, to) {
			const rayDir = Vec2.sub(to, from);
			let best = null;

			for (let i = 0; i < walls.length; i++) {
				const wall = walls[i];
				const hit = raySegmentIntersection(from, rayDir, wall[0], wall[1]);
				if (!hit || hit.t > 1) continue;

				if (!best || hit.t < best.hit.t) {
					best = { hit, wall, index: i };
				}
			}

			return best;
		}

		function chooseDetourAroundWall(agentPos, wall) {
			const [a, b] = wall;
			const wallDir = Vec2.sub(b, a).normalize();
			const endPad = 44;

			const viaA = clampPointToArena(Vec2.add(a, wallDir.clone().scale(-endPad)));
			const viaB = clampPointToArena(Vec2.add(b, wallDir.clone().scale(endPad)));

			const pathA = Vec2.dist(agentPos, viaA) + Vec2.dist(viaA, goal);
			const pathB = Vec2.dist(agentPos, viaB) + Vec2.dist(viaB, goal);

			return pathA <= pathB ? viaA : viaB;
		}

		return {
			reset() {
				boid.pos.set(120, canvas.height * 0.5);
				boid.vel = new Vec2(140, 0);
				goal = new Vec2(canvas.width - 80, canvas.height * 0.5);
				detourTarget = null;
				detourTimer = 0;
				debugFeelers = [];
			},

			onClick(pos) {
				goal = pos;
				detourTarget = null;
				detourTimer = 0;
			},

			update(dt) {
				detourTimer = Math.max(0, detourTimer - dt);
				const goalStopRadius = 5;
				const reachedGoal = Vec2.dist(boid.pos, goal) < goalStopRadius;

				if (reachedGoal) {
					detourTarget = null;
					boid.vel.scale(0.82);
					if (boid.vel.len() < 6) {
						boid.vel.set(0, 0);
					}
					boid.update(dt);
					return;
				}

				const speedFactor = clamp(boid.vel.len() / boid.maxSpeed, 0.35, 1);
				const mainLen = 80 + 90 * speedFactor;
				const sideLen = mainLen * 0.68;
				const sideAngle = 0.55;
				const baseAngle = Math.atan2(boid.heading.y, boid.heading.x);

				const feelers = [
					{
						from: boid.pos.clone(),
						to: Vec2.add(boid.pos, boid.heading.clone().scale(mainLen)),
						role: "front"
					},
					{
						from: boid.pos.clone(),
						to: Vec2.add(boid.pos, Vec2.fromAngle(baseAngle + sideAngle).scale(sideLen)),
						role: "left"
					},
					{
						from: boid.pos.clone(),
						to: Vec2.add(boid.pos, Vec2.fromAngle(baseAngle - sideAngle).scale(sideLen)),
						role: "right"
					}
				];

				debugFeelers = feelers.map((f) => {
					const dir = Vec2.sub(f.to, f.from);
					let nearestHit = null;
					for (const wall of walls) {
						const hit = raySegmentIntersection(f.from, dir, wall[0], wall[1]);
						if (!hit || hit.t > 1) continue;
						if (!nearestHit || hit.t < nearestHit.t) {
							nearestHit = hit;
						}
					}

					return {
						...f,
						hit: nearestHit,
						active: !!nearestHit
					};
				});

				const blockedToGoal = findBlockingWall(boid.pos, goal);
				if (!detourTarget && blockedToGoal) {
					detourTarget = chooseDetourAroundWall(boid.pos, blockedToGoal.wall);
					detourTimer = 0.9;
				}

				if (detourTarget) {
					const reachedDetour = Vec2.dist(boid.pos, detourTarget) < 26;
					const stillBlocked = !!findBlockingWall(boid.pos, goal);
					if ((reachedDetour && !stillBlocked) || (!stillBlocked && detourTimer <= 0)) {
						detourTarget = null;
					}
				}

				const navTarget = detourTarget || goal;

				let nearestPoint = null;
				let minDist = Infinity;

				for (const wall of walls) {
					const p = nearestPointOnSegment(boid.pos, wall[0], wall[1]);
					const d = Vec2.dist(boid.pos, p);
					if (d < minDist) {
						minDist = d;
						nearestPoint = p;
					}
				}

				const seekForce = boid.seek(navTarget).scale(detourTarget ? 0.9 : 0.65);
				let totalForce = seekForce.clone();

				const avoidRadius = boid.radius + 9;
				if (minDist < avoidRadius) {
					const wallDir = Vec2.sub(boid.pos, nearestPoint).normalize();
					const avoidStrength = (1 - minDist / avoidRadius) * boid.maxForce * 0.9;
					totalForce.add(wallDir.scale(avoidStrength));
				}

				const frontFeeler = debugFeelers.find(f => f.role === "front");
				if (frontFeeler && frontFeeler.hit) {
					const perpDir = boid.heading.clone().perp().normalize();

					const leftFeeler = debugFeelers.find(f => f.role === "left");
					const rightFeeler = debugFeelers.find(f => f.role === "right");
					const leftFree = leftFeeler && !leftFeeler.hit;
					const rightFree = rightFeeler && !rightFeeler.hit;

					let steerDir = null;
					if (leftFree && !rightFree) {
						steerDir = perpDir;
					} else if (rightFree && !leftFree) {
						steerDir = perpDir.clone().scale(-1);
					} else {
						const leftScore = leftFeeler && leftFeeler.hit ? leftFeeler.hit.t : 1;
						const rightScore = rightFeeler && rightFeeler.hit ? rightFeeler.hit.t : 1;
						steerDir = leftScore >= rightScore ? perpDir : perpDir.clone().scale(-1);
					}

					const proximity = 1 - frontFeeler.hit.t;
					const turnStrength = boid.maxForce * (0.32 + 0.48 * proximity);
					totalForce.add(steerDir.scale(turnStrength));
				}

				boid.applyForce(totalForce.limit(boid.maxForce * 1.8));
				keepInside(boid, 12);
				boid.update(dt);
			},

			draw() {
				for (const [a, b] of walls) {
					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(b.x, b.y);
					ctx.lineWidth = 4;
					ctx.strokeStyle = "#f59e0b";
					ctx.stroke();
				}
				ctx.lineWidth = 1;

				for (const f of debugFeelers) {
					ctx.beginPath();
					ctx.moveTo(f.from.x, f.from.y);
					if (f.hit) {
						ctx.lineTo(f.hit.point.x, f.hit.point.y);
						ctx.strokeStyle = "rgba(244,63,94,0.9)";
						ctx.lineWidth = 2;
						ctx.stroke();

						ctx.beginPath();
						ctx.moveTo(f.hit.point.x, f.hit.point.y);
						ctx.lineTo(f.to.x, f.to.y);
						ctx.strokeStyle = "rgba(244,63,94,0.22)";
						ctx.lineWidth = 1;
						ctx.stroke();
					} else {
						ctx.lineTo(f.to.x, f.to.y);
						ctx.strokeStyle = "rgba(34,211,238,0.5)";
						ctx.lineWidth = 1.5;
						ctx.stroke();
					}
				}
				ctx.lineWidth = 1;

				drawCross(goal, "#34d399");
				if (detourTarget) {
					drawCross(detourTarget, "#f59e0b");
				}
				boid.draw(ctx);

				ctx.fillStyle = "rgba(229,231,235,0.9)";
				ctx.font = "12px Trebuchet MS, sans-serif";
				ctx.fillText("лучи: бирюзовый = свободно, красный = есть пересечение", 18, 54);
				drawLabel("S-WallAvoidance", "#f59e0b");
			}
		};
	}

	// ---------- Utilities ----------
	function keepInside(boid, margin = 20) {
		// Clamp position to bounds
		if (boid.pos.x < margin) {
			boid.pos.x = margin;
			boid.vel.x = Math.max(0, boid.vel.x);
		}
		if (boid.pos.x > canvas.width - margin) {
			boid.pos.x = canvas.width - margin;
			boid.vel.x = Math.min(0, boid.vel.x);
		}
		if (boid.pos.y < margin) {
			boid.pos.y = margin;
			boid.vel.y = Math.max(0, boid.vel.y);
		}
		if (boid.pos.y > canvas.height - margin) {
			boid.pos.y = canvas.height - margin;
			boid.vel.y = Math.min(0, boid.vel.y);
		}
	}

	function drawCross(p, color) {
		ctx.beginPath();
		ctx.moveTo(p.x - 8, p.y);
		ctx.lineTo(p.x + 8, p.y);
		ctx.moveTo(p.x, p.y - 8);
		ctx.lineTo(p.x, p.y + 8);
		ctx.strokeStyle = color;
		ctx.stroke();
	}

	function drawCircle(center, r, fill) {
		ctx.beginPath();
		ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
	}

	function drawLabel(text, color) {
		ctx.fillStyle = color;
		ctx.font = "bold 20px Trebuchet MS, sans-serif";
		ctx.fillText(text, 18, 34);
	}

	// ---------- Loop ----------
	let lastTime = performance.now();
	let accumulator = 0;
	const fixedDt = 1 / 120;

	function frame(now) {
		const dt = Math.min((now - lastTime) / 1000, 0.05);
		lastTime = now;
		accumulator += dt;

		while (accumulator >= fixedDt) {
			scenes[activeScene].update(fixedDt);
			accumulator -= fixedDt;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		scenes[activeScene].draw();

		requestAnimationFrame(frame);
	}

	setScene("flee");
	requestAnimationFrame(frame);
})();
