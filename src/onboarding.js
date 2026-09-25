// Application entry and track navigation. Sailing objectives stay in LessonManager.
import { storage } from './storage.js';
import { byId } from './curriculum.js';
import { THEORY_STAGES } from './theory.js';
import { theoryChartMarkup } from './theory-chart.js';
import { MOB_DEMO_STEPS } from './mob-drill.js';
const PREF_KEY = 'sail.onboarding.v1';
const MOB_DEMO_KEY = 'sail.mobDemo.v1';
const $ = (id) => document.getElementById(id);

export class SailingFlow {
  constructor(lessons, start, onStateChange, controls, onTheoryStage = () => {}, onMobDemo = () => null) {
    this.lessons = lessons;
    this.start = start;
    this.onStateChange = onStateChange;
    this.controls = controls;
    this.onTheoryStage = onTheoryStage;
    this.onMobDemo = onMobDemo;
    this.pendingDemoItem = null;
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
    $('introBack').addEventListener('click', () => this.welcome(this.forceTheory));
    $('setSailBtn').addEventListener('click', () => {
      this.track = this.pendingTrack;
      if (this.track === 'exam') this.forceTheory = false;
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
    if (item.type === 'lesson' && (!this.theorySeen || this.forceTheory)) {
      this.pendingTheoryItem = { item, review };
      this.showTheory(0);
      return;
    }
    // The man-overboard demo plays once, before the first MOB lesson.
    if (item.demo === 'mob' && !review && storage.getItem(MOB_DEMO_KEY) !== '1') {
      this.showMobDemo(item);
      return;
    }
    this.start(item);
    this.sail();
  }

  // Watch the whole recovery sailed with a voiceover, then take the helm.
  showMobDemo(item) {
    this.pendingDemoItem = item;
    const steps = MOB_DEMO_STEPS.map((step, i) =>
      `<li><button type="button" data-step="${i}"><span class="mob-step-n" aria-hidden="true">${i + 1}</span><span class="mob-step-title">${step.title}</span></button></li>`).join('');
    this.screen('mob-demo', `
      <div class="theory-header">
        <span class="theory-count">DEMO · MAN OVERBOARD · <bdi lang="he">אדם בים</bdi></span>
        <button id="mobDemoSkip" class="theory-skip">Skip demo</button>
      </div>
      <h1 id="introTitle" tabindex="-1">Watch the recovery</h1>
      <p class="theory-lead">The exam procedure, sailed for you with a voiceover. Wind blows from the north, the top of the overhead view.</p>
      <ol id="mobDemoSteps" class="mob-steps" aria-label="Recovery steps">${steps}</ol>
      <div class="theory-readout"><p id="mobDemoCaption" aria-live="polite"></p></div>
      <div class="mob-progress" aria-hidden="true"><span id="mobDemoBar"></span></div>
      <div class="theory-playback">
        <button id="mobDemoPause" type="button">Pause</button>
        <button id="mobDemoReplay" type="button">Replay</button>
        <button id="mobDemoVoice" type="button" aria-pressed="true">🔊 Voice on</button>
      </div>
      <div class="theory-nav">
        <span></span>
        <button id="mobDemoDone" class="primary">Start ${item.title.split('·')[0].trim()} <span aria-hidden="true">→</span></button>
      </div>`);
    const demo = this.onMobDemo();
    $('mobDemoSteps').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-step]');
      if (button) demo?.seek(Number(button.dataset.step));
    });
    $('mobDemoPause').addEventListener('click', () => demo?.togglePause());
    $('mobDemoReplay').addEventListener('click', () => demo?.replay());
    $('mobDemoVoice').addEventListener('click', () => demo?.toggleVoice());
    $('mobDemoSkip').addEventListener('click', () => this.finishMobDemo());
    $('mobDemoDone').addEventListener('click', () => this.finishMobDemo());
  }

  finishMobDemo() {
    const item = this.pendingDemoItem;
    if (!item) return;
    this.pendingDemoItem = null;
    storage.setItem(MOB_DEMO_KEY, '1');
    this.start(item);
    this.sail();
  }

  showTheory(index) {
    this.theoryStage = index;
    const stage = THEORY_STAGES[index];
    this.screen('theory', `
      <div class="theory-header">
        <span class="theory-count">THEORY · ${index + 1} OF ${THEORY_STAGES.length}</span>
        <button id="theorySkip" class="theory-skip">Skip, take me to the boat</button>
      </div>
      <h1 id="introTitle" tabindex="-1">${stage.title}</h1>
      <p class="theory-focus">${stage.focus}</p>
      <p class="theory-lead">${stage.lead}</p>
      ${index < 2 ? theoryChartMarkup() : ''}
      <div class="theory-readout"><span id="theoryPoint">Wind and boat</span><p id="theoryCaption"></p></div>
      <div class="theory-playback">
        <button id="theoryPause" type="button">Pause motion</button>
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
      pauseButton.disabled = !!demo?.reducedMotion;
      pauseButton.textContent = demo?.reducedMotion ? 'Motion reduced' : demo?.paused ? 'Play motion' : 'Pause motion';
    };
    syncPlayback();
    pauseButton.addEventListener('click', () => { demo?.togglePause(); syncPlayback(); });
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
