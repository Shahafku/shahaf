// Application entry and track navigation. Sailing objectives stay in LessonManager.
import { storage } from './storage.js';
import { byId } from './curriculum.js';
const PREF_KEY = 'sail.onboarding.v1';
const $ = (id) => document.getElementById(id);

export class SailingFlow {
  constructor(lessons, start, onStateChange, controls) {
    this.lessons = lessons;
    this.start = start;
    this.onStateChange = onStateChange;
    this.controls = controls;
    this.overlay = $('introOverlay');
    this.content = $('introContent');
    this.track = 'learn';
    this.state = 'welcome';
    let pref;
    try { pref = JSON.parse(storage.getItem(PREF_KEY)); } catch { /* show welcome */ }
    this.hasPreference = pref?.version === 1 && ['learn', 'exam'].includes(pref.track);
    if (this.hasPreference) this.track = pref.track;

    $('learnTrack').addEventListener('click', () => this.switchTrack('learn'));
    $('examTrack').addEventListener('click', () => this.switchTrack('exam'));
    $('replayIntroBtn').addEventListener('click', () => this.welcome());
    // Modal focus stays within the active screen, including result dialogs.
    document.addEventListener('keydown', (event) => {
      if (this.state === 'sailing' || event.key !== 'Tab') return;
      const dialog = this.state === 'result'
        ? $(this.lessons.failed ? 'failOverlay' : 'completeOverlay') : this.overlay;
      const buttons = [...dialog.querySelectorAll('button')].filter((el) => !el.hidden && el.style.display !== 'none');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
  }

  boot() { this.hasPreference ? this.resume() : this.welcome(); }

  setState(state) {
    this.state = state;
    document.body.dataset.flow = state;
    const modal = !['sailing', 'result'].includes(state);
    this.overlay.hidden = !modal;
    $('simulator').inert = state !== 'sailing';
    document.body.classList.remove('menu-open');
    this.onStateChange(state);
  }

  screen(state, html) {
    this.lessons.overlay.classList.remove('show');
    this.lessons.failOverlay.classList.remove('show');
    this.content.innerHTML = html;
    this.setState(state);
    this.content.querySelector('h1, h2').focus();
  }

  saveTrack() {
    storage.setItem(PREF_KEY, JSON.stringify({ version: 1, track: this.track }));
    $('learnTrack').setAttribute('aria-pressed', String(this.track === 'learn'));
    $('examTrack').setAttribute('aria-pressed', String(this.track === 'exam'));
  }

  welcome() {
    this.screen('welcome', `
      <div class="intro-eyebrow">SAIL TRAINER 3D</div>
      <h1 id="introTitle" tabindex="-1">Welcome aboard</h1>
      <p class="intro-lead">Learn to handle the sails, or put your sailing skills to the test.</p>
      <h2 class="choice-question">How much sailing experience do you have?</h2>
      <div class="track-choices">
        <button id="chooseLearn" class="track-choice"><span class="choice-label">I’m new to sailing</span><span>Teach me how to steer, adjust the sails, and work with the wind.</span><span class="choice-route">LEARN →</span></button>
        <button id="chooseExam" class="track-choice"><span class="choice-label">I know the basics</span><span>I’ve learned the theory and know how to handle the sails. I’m ready to test my skills.</span><span class="choice-route">EXAM →</span></button>
      </div>`);
    $('chooseLearn').addEventListener('click', () => this.introduce('learn'));
    $('chooseExam').addEventListener('click', () => this.introduce('exam'));
  }

  introduce(track) {
    this.pendingTrack = track;
    const learn = track === 'learn';
    this.screen('track-introduction', `
      <div class="intro-eyebrow">${learn ? 'LEARN · ONE STEP AT A TIME' : 'EXAM · SIX TESTS'}</div>
      <h1 id="introTitle" tabindex="-1">${learn ? 'Let’s start with the basics.' : 'Put your skills to the test.'}</h1>
      ${learn ? `<p>Lesson 1 provides guidance one action at a time. First fill the sail, then hold your course, and sail through the ring.</p><p>Steer to point the bow toward your destination. Adjust the sail by sheeting in to bring it closer, or easing out to let it open. We’ll show you the controls before you start.</p>`
        : `<p>Take six sequential tests. Each gives you a goal and a pass/fail result, without coaching. Pass a test to unlock the next; retake passed tests whenever you like.</p><p>You can switch to Learn anytime.</p>`}
      <div class="btnrow"><button id="introBack">← Back</button><button id="setSailBtn" class="primary">Set sail →</button></div>`);
    $('introBack').addEventListener('click', () => this.welcome());
    $('setSailBtn').addEventListener('click', () => {
      this.track = this.pendingTrack;
      this.hasPreference = true;
      this.saveTrack();
      this.resume();
    });
  }

  switchTrack(track) { this.track = track; this.saveTrack(); this.resume(); }

  resume() {
    const next = this.lessons.resumeTarget(this.track);
    if (next) this.enterItem(next);
    else this.trackComplete();
  }

  enterItem(item, { review = false } = {}) {
    if (!item || (!review && !this.lessons.isUnlocked(item))) return;
    if (!item.free) this.track = item.type === 'test' ? 'exam' : 'learn';
    this.saveTrack();
    this.start(item);
    if (item.tutorial) this.controlsIntro(item.tutorial);
    else this.sail();
  }

  controlsIntro(tutorial) {
    const { touch, helm } = this.controls();
    this.screen('controls-introduction', `
      <div class="intro-eyebrow">LESSON 1 · CONTROLS</div>
      <h2 id="introTitle" tabindex="-1">${tutorial.introTitle}</h2>
      <p>${tutorial.intro}</p><p>${tutorial[touch ? 'touch' : 'keyboard']}</p>
      <p>${tutorial[helm]}</p><p>${tutorial.sheet}</p>
      <div class="btnrow"><button id="beginLesson" class="primary">Start sailing →</button></div>`);
    $('beginLesson').addEventListener('click', () => this.sail());
  }

  sail() {
    this.setState('sailing');
    $('lessonTitle').focus();
  }

  showResult() {
    this.setState('result');
    $(this.lessons.failed ? 'retakeBtn' : 'nextLessonBtn').focus();
  }

  next() {
    const target = this.lessons.nextTarget();
    if (target) this.enterItem(target);
    else this.resume();
  }

  trackComplete() {
    const label = this.track === 'learn' ? 'Learn' : 'Exam';
    this.screen('track-complete', `
      <div class="intro-eyebrow">${label.toUpperCase()} · COMPLETE</div>
      <h1 id="introTitle" tabindex="-1">${label === 'Exam' ? 'All six tests passed.' : 'Your lessons are complete.'}</h1>
      <p>Return to a favorite exercise, try the other track, or enjoy Free Sail.</p>
      <div id="replayChoices" class="replay-choices"></div>
      <div class="btnrow"><button id="otherTrack">Switch to ${label === 'Learn' ? 'Exam' : 'Learn'}</button><button id="freeSail" class="primary">Free Sail →</button></div>`);
    for (const item of this.lessons.trackItems(this.track)) {
      const button = document.createElement('button');
      button.textContent = item.title;
      button.addEventListener('click', () => this.enterItem(item));
      $('replayChoices').appendChild(button);
    }
    $('otherTrack').addEventListener('click', () => this.switchTrack(this.track === 'learn' ? 'exam' : 'learn'));
    $('freeSail').addEventListener('click', () => this.enterItem(byId('free')));
  }
}
