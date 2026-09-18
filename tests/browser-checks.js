// Integration fixtures run the real app and animation loop, with isolated storage.
const results = document.getElementById('results');
const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, message) { if (!condition) throw new Error(message); }
const pref = (track) => JSON.stringify({ version: 1, track });
const progress = (done) => JSON.stringify({ done });
let frame;
async function fixture(values = {}, blocked = false, touch = false) {
  if (frame) {
    frame.contentDocument.querySelector('#app canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    frame.remove();
  }
  frame = document.createElement('iframe');
  const html = await (await fetch('../index.html')).text();
  const bootstrap = `<base href="${new URL('../', location.href)}"><script>
    const values = ${JSON.stringify(values)};
    window.fixtureValues = values;
    if (${touch}) {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => query === '(pointer: coarse)' ? { matches: true } : nativeMatchMedia(query);
    }
    Object.defineProperty(window, 'localStorage', { value: {
      getItem(key) { if (${blocked}) throw new Error('Storage disabled'); return values[key] ?? null; },
      setItem(key, value) { if (${blocked}) throw new Error('Storage disabled'); values[key] = String(value); }
    }});
  <\/script>`;
  frame.srcdoc = html.replace('<head>', '<head>' + bootstrap);
  document.getElementById('preview').append(frame);
  for (let i = 0; i < 200 && !frame.contentWindow.__sail; i++) await pause(30);
  const w = frame.contentWindow, d = w.document, app = w.__sail;
  assert(app, 'app boots');
  const click = (id) => { const el = d.getElementById(id); assert(el, `${id} exists`); el.click(); };
  const key = (code, type = 'keydown', target = w) => target.dispatchEvent(new w.KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
  return { w, d, app, click, key };
}
const cases = [
  ['welcome and lesson introduction freeze input before direct simulator entry', async () => {
    const { app: a, d, click, key } = await fixture();
    assert(a.flow.state === 'welcome' && d.getElementById('simulator').inert, 'welcome isolates simulator');
    const initial = JSON.stringify({ pos: a.boat.pos, heading: a.boat.heading, sheet: a.boat.sheet, ctx: a.lessons.ctx });
    key('ArrowUp'); key('ArrowRight'); key('KeyT'); key('Digit2');
    await pause(300);
    assert(initial === JSON.stringify({ pos: a.boat.pos, heading: a.boat.heading, sheet: a.boat.sheet, ctx: a.lessons.ctx }), 'welcome is frozen');
    click('chooseExam'); click('introBack'); click('chooseLearn');
    const pos = JSON.stringify(a.boat.pos), context = JSON.stringify(a.lessons.ctx);
    key('ArrowUp'); key('ArrowRight'); await pause(300);
    assert(a.flow.state === 'track-introduction' && JSON.stringify(a.lessons.ctx) === context && JSON.stringify(a.boat.pos) === pos, 'lesson introduction freezes sailing');
    click('setSailBtn'); await pause();
    assert(a.flow.state === 'sailing' && a.lessons.ctx.t > 0 && a.boat.sheet === 80 * Math.PI / 180, 'starts directly without leaking held intro input');
    assert(a.boat.autoTrim === false && !d.getElementById('tutorialCoach').hidden, 'starts with manual trim and visible contextual coaching');
    assert(d.getElementById('coachAction').textContent.includes('Hold ↑'), 'first control is explained inside simulator');
    click('guidanceToggle'); assert(a.lessons.guidanceHidden, 'guidance hides');
    click('guidanceToggle'); assert(!a.lessons.guidanceHidden, 'guidance reopens');
    const sheet = a.boat.sheet;
    d.getElementById('guidanceToggle').focus();
    key('ArrowUp', 'keydown', d.activeElement); await pause(200); key('ArrowUp', 'keyup', d.activeElement);
    assert(a.boat.sheet < sheet, 'keyboard sailing still works after focus moves to a button');
  }],
  ['fresh Exam, passing, retry, direct review and track switching', async () => {
    const { app: a, click, w } = await fixture();
    click('chooseExam'); click('setSailBtn');
    assert(a.lessons.current.id === 't-course' && a.flow.state === 'sailing', 'fresh Exam enters Test 1');
    assert(!a.lessons.isUnlocked(a.byId('t-tack')), 'Test 2 locked before Test 1');
    a.boat.pos.x = -260; a.boat.pos.z = 10; await pause();
    assert(a.lessons.completed && a.flow.state === 'result', 'actual ring arrival passes Test 1');
    click('nextLessonBtn'); assert(a.lessons.current.id === 't-tack', 'next stays in Exam');
    a.lessons.ctx.t = 181; await pause();
    assert(a.lessons.failed, 'existing test time limit still fails');
    click('retakeBtn'); assert(!a.lessons.failed && a.lessons.ctx.t < 1, 'retake resets attempt');
    a.lessons.ctx.t = 181; await pause(); click('reviewBtn');
    assert(a.lessons.current.id === 'tack' && a.flow.track === 'learn', 'review bypasses unfinished earlier lessons');
    click('examTrack'); assert(a.lessons.current.id === 't-tack', 'switch resumes next unfinished exam');
    assert(!a.lessons.progress.has('course') && !a.lessons.progress.has('upwind'), 'review never completes skipped lessons');
    assert(JSON.parse(w.fixtureValues['sail.onboarding.v1']).track === 'exam', 'track persists separately');
  }],
  ['returning users resume gaps and old passes remain replayable', async () => {
    const { app: a } = await fixture({ 'sail.onboarding.v1': pref('exam'), 'sail.progress.v2': progress(['t-course', 't-gybe']) });
    assert(a.flow.state === 'sailing' && a.lessons.current.id === 't-tack', 'resume first unfinished exam');
    assert(a.lessons.isUnlocked(a.byId('t-gybe')), 'old passed test still replayable');
  }],
  ['legacy progress survives the new welcome', async () => {
    const { app: a, click } = await fixture({ 'sail.unlocked': '2', 'sail.seenIntro': '1' });
    assert(a.flow.state === 'welcome', 'old intro preference does not skip new welcome');
    assert(a.lessons.progress.has('course') && a.lessons.progress.has('upwind'), 'old progress migrates');
    click('chooseLearn'); click('setSailBtn');
    assert(a.lessons.current.id === 'tack', 'Learn resumes after migrated lessons');
  }],
  ['malformed and unavailable storage still permit sailing and completion', async () => {
    let f = await fixture({ 'sail.onboarding.v1': '{', 'sail.progress.v2': '{"done":42}' });
    assert(f.app.flow.state === 'welcome' && f.app.lessons.progress.size === 0, 'invalid values fall back safely');
    f = await fixture({}, true);
    f.click('chooseExam'); f.click('setSailBtn');
    f.app.boat.pos.x = -260; f.app.boat.pos.z = 10; await pause();
    assert(f.app.lessons.completed, 'completion works without storage');
    f.click('nextLessonBtn'); assert(f.app.lessons.current.id === 't-tack', 'session progress still unlocks next test');
  }],
  ['completed tracks offer replay, other track and Free Sail', async () => {
    const exams = ['t-course', 't-tack', 't-gybe', 't-mob', 't-beat', 't-triangle'];
    const { app: a, d, click } = await fixture({ 'sail.onboarding.v1': pref('exam'), 'sail.progress.v2': progress(exams) });
    assert(a.flow.state === 'track-complete' && d.querySelectorAll('#replayChoices button').length === 6, 'completed Exam shows all replays');
    d.querySelector('#replayChoices button').click();
    assert(a.lessons.current.id === 't-course', 'completed test replays');
    click('examTrack'); click('freeSail');
    assert(a.lessons.current.free && a.flow.track === 'exam', 'Free Sail preserves track');
    click('examTrack'); click('otherTrack');
    assert(a.lessons.current.id === 'course', 'other track opens Learn');
  }],
  ['helm conventions, touch input, cancellation and introduction replay', async () => {
    const { app: a, d, w, click, key } = await fixture({ 'sail.onboarding.v1': pref('learn') });
    key('ArrowRight'); await pause(200); key('ArrowRight', 'keyup');
    assert(a.boat.rudder < 0, 'tiller right moves bow left');
    click('helmBtn');
    key('ArrowRight'); await pause(300); key('ArrowRight', 'keyup');
    assert(a.boat.rudder > 0, 'wheel right moves bow right');
    const button = d.getElementById('btnIn');
    // Synthetic pointer events have no native active pointer to capture.
    button.setPointerCapture = () => {};
    const sheet = a.boat.sheet;
    button.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await pause(200);
    button.dispatchEvent(new w.PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    assert(a.boat.sheet < sheet, 'touch sail-in adjusts sheet');
    const stopped = a.boat.sheet; await pause();
    assert(a.boat.sheet === stopped, 'cancel releases sail input');
    click('replayIntroBtn'); assert(a.flow.state === 'welcome', 'menu can replay welcome');
    click('chooseLearn'); click('setSailBtn');
    assert(a.boat.autoTrim === false && a.lessons.stepIdx === 0, 'replay restarts tutorial');
    a.lessons.stepIdx = 1; a.lessons.renderTutorial(a.boat);
    assert(d.getElementById('coachHelm').textContent.includes('Wheel: turn right'), 'simulator guidance reflects saved helm');
  }],
  ['completed Learn and persisted helm/trim preferences remain usable', async () => {
    const lessons = ['course', 'upwind', 'tack', 'gybe', 'mob-easy', 'mob-med', 'mob-hard'];
    const { app: a, d, click } = await fixture({ 'sail.onboarding.v1': pref('learn'), 'sail.progress.v2': progress(lessons), helm: 'wheel', trimMin: '1' });
    assert(a.flow.state === 'track-complete' && d.querySelectorAll('#replayChoices button').length === 7, 'all seven lessons complete');
    d.querySelector('#replayChoices button').click();
    assert(a.flow.state === 'sailing', 'Lesson 1 replay enters simulator directly');
    assert(a.lessons.stepIdx === 0 && !a.boat.autoTrim, 'Lesson 1 replay starts fresh');
  }],
  ['touch guidance and modal keyboard focus adapt to the input device', async () => {
    const { app: a, d, w, click } = await fixture({}, false, true);
    click('chooseLearn');
    const back = d.getElementById('introBack'), sail = d.getElementById('setSailBtn');
    sail.focus();
    sail.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    assert(d.activeElement === back, 'Tab wraps to first modal button');
    back.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert(d.activeElement === sail, 'Shift-Tab wraps to last modal button');
    click('setSailBtn');
    assert(d.getElementById('coachAction').textContent.includes('Hold sail-in'), 'coach uses touch instructions');
    a.lessons._fail('Fixture result'); a.flow.showResult();
    const time = a.lessons.ctx.t, pos = JSON.stringify(a.boat.pos); await pause(250);
    assert(a.lessons.ctx.t === time && JSON.stringify(a.boat.pos) === pos, 'result also freezes timers and physics');
  }],
  ['Lesson 1 can be completed through actual trim and sailing physics', async () => {
    const { app: a, click, key } = await fixture({ 'sail.onboarding.v1': pref('learn') });
    // Step the real physics and runtime deterministically, including human sheet input.
    for (let i = 0; i < 600 && a.lessons.stepIdx === 0; i++) {
      a.boat.sheet = Math.max(2 * Math.PI / 180, a.boat.sheet - 0.55 / 60);
      a.wind.update(1 / 60); a.boat.update(1 / 60, a.wind);
      a.lessons.update(1 / 60, a.boat, a.wind, 0);
    }
    assert(a.lessons.stepIdx === 1 && a.lessons.ctx.onCourseTime === 0, 'real sheet-in advances and resets hold timer');
    // Pause through welcome so automatic frames cannot interfere with exact boundaries.
    a.flow.welcome();
    a.boat.pos.x = -260; a.boat.pos.z = 10;
    a.lessons.update(0.05, a.boat, a.wind, 0);
    assert(!a.lessons.completed && a.lessons.markIdx === 0, 'early ring arrival does not consume mark');
    a.boat.pos.x = 0; a.boat.pos.z = 0; a.boat.heading = 90 * Math.PI / 180; a.boat.speed = 2;
    a.lessons.update(14, a.boat, a.wind, 0);
    assert(a.lessons.stepIdx === 1, '14 seconds does not finish hold');
    a.boat.heading = 0; a.lessons.update(0.05, a.boat, a.wind, 0);
    assert(a.lessons.ctx.onCourseTime === 0, 'wandering resets the timer');
    a.boat.heading = 90 * Math.PI / 180;
    a.lessons.update(15, a.boat, a.wind, 0);
    assert(a.lessons.stepIdx === 2, '15 continuous seconds unlocks ring stage');
    a.flow.sail();
    a.boat.pos.x = -260; a.boat.pos.z = 10; await pause();
    assert(a.lessons.completed, 'ring now finishes Lesson 1');
    click('nextLessonBtn'); assert(a.lessons.current.id === 'upwind', 'Learn proceeds to Lesson 2');
  }],
];
document.getElementById('run').addEventListener('click', async (event) => {
  event.target.disabled = true; results.textContent = '';
  let failures = 0;
  for (const [name, run] of cases) {
    try { await run(); results.textContent += `PASS ${name}\n`; }
    catch (error) { failures++; results.textContent += `FAIL ${name}: ${error.message}\n`; }
  }
  results.textContent += `\n${cases.length - failures}/${cases.length} passed`;
  results.className = failures ? 'fail' : 'pass';
  event.target.disabled = false;
});
