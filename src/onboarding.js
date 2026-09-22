// Application entry and track navigation. Sailing objectives stay in LessonManager.
import { storage } from './storage.js';
import { byId } from './curriculum.js';
import { THEORY_STAGES } from './theory.js';
import { theoryChartMarkup } from './theory-chart.js';
const PREF_KEY = 'sail.onboarding.v1';
const $ = (id) => document.getElementById(id);

export class SailingFlow {
  constructor(lessons, start, onStateChange, controls, onTheoryStage = () => {}) {
    this.lessons = lessons;
    this.start = start;
    this.onStateChange = onStateChange;
    this.controls = controls;
    this.onTheoryStage = onTheoryStage;
    this.overlay = $('introOverlay');
    this.content = $('introContent');
    this.track = 'learn';
    this.state = 'welcome';
    let pref;
    try { pref = JSON.parse(storage.getItem(PREF_KEY)); } catch { /* show welcome */ }
    this.hasPreference = pref?.version === 1 && ['learn', 'exam'].includes(pref.track);
    if (this.hasPreference) this.track = pref.track;
    // Existing preferences predate theory, so returning sailors remain where
    // they were. New preferences explicitly store unfinished theory as false.
    this.theorySeen = this.hasPreference ? pref.theorySeen !== false : this.lessons.progress.size > 0;
    this.forceTheory = false;
    this.pendingTheoryItem = null;
    this.theoryStage = 0;

    $('learnTrack').addEventListener('click', () => this.switchTrack('learn'));
    $('examTrack').addEventListener('click', () => this.switchTrack('exam'));
    $('replayIntroBtn').addEventListener('click', () => this.welcome(true));
    // Modal focus stays within the active screen, including result dialogs.
    document.addEventListener('keydown', (event) => {
      if (this.state === 'sailing' || event.key !== 'Tab') return;
      const dialog = this.state === 'result'
        ? $(this.lessons.failed ? 'failOverlay' : 'completeOverlay') : this.overlay;
      const buttons = [...dialog.querySelectorAll('button')].filter((el) => !el.hidden && !el.disabled && el.style.display !== 'none');
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
    if (state !== 'track-introduction') this.overlay.classList.remove('journey-active');
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
    storage.setItem(PREF_KEY, JSON.stringify({ version: 1, track: this.track, theorySeen: this.theorySeen }));
    $('learnTrack').setAttribute('aria-pressed', String(this.track === 'learn'));
    $('examTrack').setAttribute('aria-pressed', String(this.track === 'exam'));
  }

  welcome(replay = false) {
    this.forceTheory = replay;
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

  introduce(track, { fromTrackSwitch = false } = {}) {
    this.pendingTrack = track;
    const learn = track === 'learn';
    const showJourney = learn && (!this.theorySeen || this.forceTheory);
    const previousState = this.state;
    this.screen('track-introduction', `
      <div class="${showJourney ? 'journey-page' : ''}">
      <button id="introBack" class="intro-back">← Back</button>
      <p class="intro-meta">${learn ? 'Learn to sail' : 'Test your skills · 6 practical tests'}</p>
      <h1 id="introTitle" tabindex="-1">${showJourney ? 'Your sailing journey' : learn ? 'Keep learning' : 'Put your skills to the test'}</h1>
      <p class="intro-lead">${showJourney ? 'Your 3 steps to master sailing' : learn ? 'Continue your guided lessons and build confidence at the helm.' : 'Sail independently, with clear goals and no coaching.'}</p>
      ${showJourney ? `<div class="journey-map">
        <svg class="journey-route" viewBox="0 0 140 320" preserveAspectRatio="none" aria-hidden="true">
          <path class="journey-course" d="M 26 8 C 6 70 112 82 108 146 S 22 222 104 304" />
          <path class="journey-boat" d="M 49 63 L 49 45 L 59 62 Z M 51 67 L 65 67 L 61 71 L 54 71 Z" />
          <path class="journey-finish" d="M 104 304 L 104 283 M 104 284 L 116 287 L 104 291" />
        </svg>
        <ol class="journey-stops">
          <li><strong>Theory tutorials</strong><p>Explore how wind, course, and sail trim work.</p></li>
          <li><strong>Take the helm</strong><p>Practice aboard the boat with step-by-step guidance in each lesson.</p></li>
          <li><strong>Test your skills</strong><p>When you feel ready, try the six practical tests.</p></li>
        </ol>
      </div>` : learn ? '<p>Your saved progress is ready when you are.</p>' : `<ul class="intro-exam-details"><li>Pass each test to unlock the next.</li><li>Get a clear pass or fail result.</li><li>Retry anytime, or switch to guided lessons.</li></ul>`}
      <button id="setSailBtn" class="primary intro-cta">${showJourney ? 'Start the tutorials' : learn ? 'Start sailing' : 'Start testing'} <span aria-hidden="true">→</span></button>
      ${showJourney ? '' : `<p class="intro-footnote">${learn ? 'We’ll explain the controls in the simulator.' : 'Your test starts when you’re ready.'}</p>`}
      </div>`);
    this.overlay.classList.toggle('journey-active', showJourney);
    $('introBack').addEventListener('click', () => {
      if (!fromTrackSwitch) this.welcome(this.forceTheory);
      else if (previousState === 'result') this.showResult();
      else this.sail();
    });
    $('setSailBtn').addEventListener('click', () => {
      this.track = this.pendingTrack;
      if (this.track === 'exam') this.forceTheory = false;
      this.hasPreference = true;
      this.saveTrack();
      this.resume();
    });
  }

  switchTrack(track) {
    if (track === 'learn' && !this.theorySeen) {
      this.introduce(track, { fromTrackSwitch: true });
      return;
    }
    this.track = track;
    this.saveTrack();
    this.resume();
  }

  resume() {
    const next = this.lessons.resumeTarget(this.track);
    if (next) this.enterItem(next);
    else this.trackComplete();
  }

  enterItem(item, { review = false } = {}) {
    if (!item || (!review && !this.lessons.isUnlocked(item))) return;
    if (!item.free) this.track = item.type === 'test' ? 'exam' : 'learn';
    this.saveTrack();
    if (item.type === 'lesson' && (!this.theorySeen || this.forceTheory)) {
      this.pendingTheoryItem = { item, review };
      this.showTheory(0);
      return;
    }
    this.start(item);
    this.sail();
  }

  showTheory(index) {
    this.theoryStage = index;
    const stage = THEORY_STAGES[index];
    this.screen('theory', `
      <div class="theory-header">
        <span class="theory-count">THEORY · ${index + 1} OF ${THEORY_STAGES.length}</span>
        <button id="theorySkip" class="theory-skip">Skip, Take the helm</button>
      </div>
      <h1 id="introTitle" tabindex="-1">${stage.title}</h1>
      <p class="theory-focus">${stage.focus}</p>
      <p class="theory-lead">${stage.lead}</p>
      ${index < 2 ? theoryChartMarkup() : ''}
      <div class="theory-readout"><span id="theoryPoint">Wind and boat</span><p id="theoryCaption"></p></div>
      <div class="theory-playback">
        ${index === 0 ? '<button id="theoryPrevious" type="button">Previous position</button>' : '<button id="theoryPause" type="button">Pause motion</button>'}
        <button id="theoryStep" type="button">Next position</button>
      </div>
      <p class="theory-takeaway">${stage.takeaway}</p>
      <div class="theory-nav">
        ${index ? '<button id="theoryBack" class="intro-back">← Back</button>' : '<span></span>'}
        <button id="theoryNext" class="primary">${index === THEORY_STAGES.length - 1 ? 'Take me to the boat' : 'Next'} <span aria-hidden="true">→</span></button>
      </div>`);
    const demo = this.onTheoryStage(index);
    const pauseButton = $('theoryPause');
    const syncPlayback = () => {
      if (!pauseButton) return;
      pauseButton.disabled = !!demo?.reducedMotion;
      pauseButton.textContent = demo?.reducedMotion ? 'Motion reduced' : demo?.paused ? 'Play motion' : 'Pause motion';
    };
    syncPlayback();
    pauseButton?.addEventListener('click', () => { demo?.togglePause(); syncPlayback(); });
    $('theoryPrevious')?.addEventListener('click', () => demo?.previousPosition());
    $('theoryStep').addEventListener('click', () => { demo?.nextPosition(); syncPlayback(); });
    $('theorySkip').addEventListener('click', () => this.finishTheory());
    $('theoryBack')?.addEventListener('click', () => this.showTheory(index - 1));
    $('theoryNext').addEventListener('click', () => index === THEORY_STAGES.length - 1
      ? this.finishTheory() : this.showTheory(index + 1));
  }

  finishTheory() {
    const pending = this.pendingTheoryItem;
    if (!pending) return;
    this.pendingTheoryItem = null;
    this.theorySeen = true;
    this.forceTheory = false;
    this.saveTrack();
    this.enterItem(pending.item, { review: pending.review });
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
