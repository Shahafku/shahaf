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
    this.content.innerHTML = `<div class="intro-brand"><svg aria-hidden="true" viewBox="0 0 32 38"><path d="M17 2 4 29h13V2Zm3 7v20h10L20 9ZM3 32h27l-3 4H6Z" fill="currentColor"/></svg><span>Sail Trainer 3D</span></div><div class="intro-page">${html}</div>`;
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
      <div class="welcome-main">
        <h1 id="introTitle" tabindex="-1">Learn to sail</h1>
        <p class="intro-lead">Build confidence on the water,<br class="wide-break"> one lesson at a time.</p>
        <p class="intro-meta">7 guided lessons · No experience needed</p>
        <button id="chooseLearn" class="primary intro-cta">Start sailing <span aria-hidden="true">→</span></button>
      </div>
      <section class="intro-secondary" aria-labelledby="examChoiceTitle">
        <h2 id="examChoiceTitle">Already know how to sail?</h2>
        <p>Put your skills to the test with 6 practical challenges.</p>
        <button id="chooseExam" class="intro-link">Test my skills <span aria-hidden="true">→</span></button>
      </section>
      <p class="intro-footnote">You can switch tracks at any time.</p>`);
    $('chooseLearn').addEventListener('click', () => this.introduce('learn'));
    $('chooseExam').addEventListener('click', () => this.introduce('exam'));
  }

  introduce(track) {
    this.pendingTrack = track;
    const learn = track === 'learn';
    const next = this.lessons.resumeTarget(track);
    const firstLesson = learn && next?.tutorial;
    this.screen('track-introduction', `
      <button id="introBack" class="intro-back">← Back</button>
      <p class="intro-meta">${firstLesson ? 'Learn to sail · Lesson 1 of 7' : learn ? 'Learn to sail' : 'Test your skills · 6 practical tests'}</p>
      <h1 id="introTitle" tabindex="-1">${firstLesson ? 'Feel the wind' : learn ? 'Keep learning' : 'Put your skills to the test'}</h1>
      <p class="intro-lead">${firstLesson ? 'Start with a simple course. We’ll guide you through each step.' : learn ? 'Continue your guided lessons and build confidence at the helm.' : 'Sail independently, with clear goals and no coaching.'}</p>
      ${firstLesson ? `<ol class="intro-objectives">
        <li><strong>Fill the sail</strong><p>Adjust the sail until it catches the wind.</p></li>
        <li><strong>Hold your course</strong><p>Stay on course for 15 seconds.</p></li>
        <li><strong>Reach the ring</strong><p>Steer through the ring to finish.</p></li>
      </ol>` : learn ? '<p>Your saved progress is ready when you are.</p>' : `<ul class="intro-exam-details"><li>Pass each test to unlock the next.</li><li>Get a clear pass or fail result.</li><li>Retry anytime, or switch to guided lessons.</li></ul>`}
      <button id="setSailBtn" class="primary intro-cta">${learn ? 'Start sailing' : 'Start testing'} <span aria-hidden="true">→</span></button>
      <p class="intro-footnote">${learn ? 'We’ll explain the controls in the simulator.' : 'Your test starts when you’re ready.'}</p>`);
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
    this.sail();
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
