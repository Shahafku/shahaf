// Presentation-only yacht state. It reuses the simulator mesh and sea without
// touching the exercise boat, LessonManager, marks, timers, or scoring.
import { Boat, Wind, DEG } from './physics.js';
import { nextTheoryBeatElapsed, sampleTheoryPose } from './theory.js';
import { updateTheoryChart } from './theory-chart.js';

export class TheoryDemo {
  constructor({ view, env, coast, streaks, camera }) {
    this.view = view;
    this.env = env;
    this.coast = coast;
    this.streaks = streaks;
    this.camera = camera;
    this.boat = new Boat();
    this.wind = new Wind(0, 6.2);
    this.wind.gustiness = 0;
    this.wind.shiftiness = 0;
    this.active = false;
    this.stage = 0;
    this.elapsed = 0;
    this.paused = false;
    this.reducedMotion = false;
  }

  setStage(index) {
    this.stage = index;
    this.elapsed = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.paused = this.reducedMotion;
    this.active = true;
    this.boat.latVel = 0;
    this.boat.boom = 0;
    this.coast.setLocation('tel-aviv');
    this.env.setSeaState('calm');
    this.update(0, this.reducedMotion);
  }

  togglePause() {
    if (!this.reducedMotion) this.paused = !this.paused;
    return this.paused;
  }

  nextPosition() {
    this.elapsed = nextTheoryBeatElapsed(this.stage, this.elapsed);
    this.paused = true;
    this.update(0, this.reducedMotion);
  }

  update(dt, reducedMotion = false) {
    if (!this.active) return;
    this.reducedMotion = reducedMotion;
    if (!this.paused && !reducedMotion) this.elapsed += dt;
    const pose = sampleTheoryPose(this.stage, this.elapsed);
    this.boat.heading = pose.heading;
    this.boat.sheet = pose.sheet;
    this.boat.speed = pose.speed;
    this.boat.rudder = 0;
    const visualDt = this.paused || reducedMotion ? 0 : dt;
    this.boat.update(visualDt, this.wind);
    if (dt === 0) {
      this.boat.boom = -Math.sign(this.boat.awa || 1) * Math.min(this.boat.sheet, Math.abs(this.boat.awa));
      this.boat.update(0, this.wind);
    }
    this.boat.heading = pose.heading;
    this.boat.pos.x = 0;
    this.boat.pos.z = 0;
    this.boat.speed = pose.speed;
    this.view.update(visualDt, this.boat, this.wind, this.env.time, { wake: false });
    this.camera.position.set(30, 20, 28);
    this.camera.lookAt(0, this.camera.aspect < 0.8 ? -3 : 6.5, 0);
    this.env.update(visualDt, this.camera, this.boat.pos);
    this.streaks.update(visualDt, this.wind, this.boat.pos, this.env.time);
    const point = document.getElementById('theoryPoint');
    const caption = document.getElementById('theoryCaption');
    if (point) point.textContent = `${pose.point} · ${Math.round(pose.heading / DEG)}° to wind`;
    if (caption && caption.textContent !== pose.caption) caption.textContent = pose.caption;
    updateTheoryChart(pose.heading, pose.point);
  }

  stop() { this.active = false; }
}
