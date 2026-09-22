// Integration fixtures run the real app and animation loop, with isolated storage.
const results = document.getElementById('results');
const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, message) { if (!condition) throw new Error(message); }
const pref = (track) => JSON.stringify({ version: 1, track });
const progress = (done) => JSON.stringify({ done });
let frame;
async function fixture(values = {}, blocked = false, touch = false, compact = false, phone = false, reduced = false) {
  if (frame) {
    frame.contentDocument.querySelector('#app canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    frame.remove();
  }
  frame = document.createElement('iframe');
  if (phone) { frame.style.width = '390px'; frame.style.height = '760px'; }
  const html = await (await fetch('../index.html')).text();
  const bootstrap = `<base href="${new URL('../', location.href)}"><script>
    const values = ${JSON.stringify(values)};
    window.fixtureValues = values;
    if (${touch} || ${compact} || ${reduced}) {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (${touch} && query === '(pointer: coarse)') return { matches: true };
        if (${reduced} && query === '(prefers-reduced-motion: reduce)') return { matches: true };
        if (${compact} && query === '(max-width: 860px)') return {
          matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
        };
        return nativeMatchMedia(query);
      };
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
  ['Lesson 2 coaches the buoy attempt and each upwind diagonal', async () => {
    const { app: a, d } = await fixture({ 'sail.onboarding.v1': pref('learn'), 'sail.progress.v2': progress(['course']) });
    assert(a.lessons.current.id === 'upwind' && d.getElementById('coachTitle').textContent === 'Aim at the buoy', 'Lesson 2 starts with the upwind buoy');
    const coachRect = d.getElementById('lessonPanel').getBoundingClientRect();
    const instrumentRect = d.getElementById('instruments').getBoundingClientRect();
    assert(coachRect.bottom <= instrumentRect.top || instrumentRect.bottom <= coachRect.top, 'coach card does not overlap the instruments');
    assert(d.querySelectorAll('#coachSteps li').length === 5 && d.querySelector('#coachSteps [aria-current="step"]').textContent === '1', 'five-step strip shows the current phase');
    assert(d.getElementById('coachGoal').textContent.includes('direct route') && d.getElementById('coachSail').textContent.includes('sail'), 'first phase explains its goal and sail observation');
    const b = a.boat, m = a.lessons, wind = a.wind;
    b.heading = 0; b.twa = 0;
    m.update(2.6, b, wind, 0);
    assert(m.stepIdx === 1 && d.getElementById('coachAction').textContent.includes('no-go zone'), 'no-go discovery explains why the direct course fails');
    assert(d.querySelector('#coachSteps [aria-current="step"]').textContent === '2' && !d.getElementById('coachAdvance').hidden && d.getElementById('coachAdvance').textContent.includes('Aim at the buoy'), 'step transition visibly marks the completed step and next phase');
    b.inIrons = true; m.renderTutorial(b);
    assert(d.getElementById('coachRecovery').textContent.includes('no-go zone'), 'stalled recovery still explains the no-go zone');
    assert(!d.getElementById('coachAction').hidden && !d.getElementById('coachSailRow').hidden, 'steering and sail instructions remain visible during recovery');
    b.inIrons = false;
    b.heading = 45 * Math.PI / 180; b.twa = -45 * Math.PI / 180; b.speed = 2.1;
    b.sheet = 55 * Math.PI / 180; b.bestSheet = 12 * Math.PI / 180; b.luffing = true;
    m.renderTutorial(b);
    assert(d.getElementById('coachSail').textContent.includes('too loose'), 'coach responds to a loose upwind sail');
    b.luffing = false;
    m.update(0.01, b, wind, 0);
    assert(m.stepIdx === 2 && d.getElementById('coachTitle').textContent === 'Sail the first diagonal', 'coach names the first close-hauled leg');
    b.pos.z += 72;
    m.update(0.01, b, wind, 0);
    assert(m.stepIdx === 3 && d.getElementById('coachAction').textContent.includes('turn the bow through the wind'), 'coach prompts the tack');
    m.ctx.tacked = true; b.heading = -45 * Math.PI / 180; b.twa = 45 * Math.PI / 180;
    m.update(0.01, b, wind, 0);
    assert(m.stepIdx === 4 && d.getElementById('coachTitle').textContent === 'Zigzag to the buoy', 'coach continues toward the mark');
    b.pos.x = 90;
    m.update(0.01, b, wind, 0);
    assert(d.getElementById('coachAction').textContent.includes('west'), 'coach names the side of the buoy for the next tack');
  }],
  ['Lesson 2 phone coach shows steering and sail guidance together', async () => {
    const { app: a, d, w } = await fixture({ 'sail.onboarding.v1': pref('learn'), 'sail.progress.v2': progress(['course']) }, false, true, false, true);
    const panel = d.getElementById('lessonPanel').getBoundingClientRect();
    const sail = d.getElementById('coachSailRow').getBoundingClientRect();
    assert(w.innerWidth === 390 && panel.bottom < w.innerHeight - 150, 'phone guidance leaves the helm and sail controls reachable');
    assert(sail.top < panel.bottom && !d.getElementById('coachSailRow').hidden, 'sail guidance begins within the visible phone card');
    const panelNode = d.getElementById('lessonPanel');
    panelNode.scrollTop = panelNode.scrollHeight;
    assert(panelNode.scrollTop > 0, 'phone guidance scrolls when needed');
    a.boat.heading = 0; a.boat.twa = 0;
    a.lessons.update(2.6, a.boat, a.wind, 0);
    assert(panelNode.scrollTop === 0 && !d.getElementById('coachAdvance').hidden, 'new step brings its notice back into view');
  }],
  ['theory circle follows the yacht and pause and step hold each position', async () => {
    const { app: a, d, click } = await fixture();
    click('chooseLearn'); click('setSailBtn');
    const marker = d.getElementById('theoryBoatMarker');
    assert(d.getElementById('introTitle').textContent === 'Where can you sail?' && d.querySelector('.theory-focus').textContent.includes('COURSE'), 'stage one teaches the boat course');
    assert(marker && d.querySelector('[data-theory-point="In Irons — No-Go Zone"].current'), 'circle begins at no-go');
    assert(marker.getAttribute('transform').includes('translate(90 25)'), 'head-to-wind marker sits at the top of the circle');
    click('theoryPause');
    const held = marker.getAttribute('transform'), time = a.theoryDemo.elapsed;
    await pause(300);
    assert(a.theoryDemo.elapsed === time && marker.getAttribute('transform') === held, 'Pause freezes boat and diagram together');
    click('theoryStep');
    assert(Math.round(a.theoryDemo.boat.heading * 180 / Math.PI) === 45, 'step moves to close-hauled');
    assert(marker.getAttribute('transform').includes('translate(136 44)'), '45-degree marker follows the boat around the circle');
    assert(marker.getAttribute('transform') !== held && d.querySelector('[data-theory-point="Close-Hauled"].current'), 'circle highlights the new position');
    click('theoryPause');
    await pause(200);
    assert(a.theoryDemo.elapsed > 4, 'Play resumes the loop');
    click('theoryNext');
    assert(d.getElementById('introTitle').textContent === 'How far out should the sail be?' && d.querySelector('.theory-focus').textContent.includes('SAIL'), 'stage two shifts attention to sail trim');
    assert(d.getElementById('theoryBoatMarker') && d.querySelector('[data-theory-point="Close-Hauled"].current'), 'stage two starts with the same live circle');
    click('theoryStep');
    assert(Math.round(a.theoryDemo.boat.heading * 180 / Math.PI) === 90 && d.querySelector('[data-theory-point="Beam Reach"].current'), 'stage two advances chart and sail together');
  }],
  ['first Learn visit teaches on the boat before starting Lesson 1', async () => {
    const { app: a, d, w, click, key } = await fixture();
    click('chooseLearn'); click('setSailBtn');
    assert(a.flow.state === 'theory' && d.getElementById('simulator').inert, 'theory pauses simulator controls');
    assert(a.flow.theoryStage === 0 && d.getElementById('theoryCaption').textContent.includes('wind'), 'first wind demo appears');
    const before = JSON.stringify({ pos: a.boat.pos, sheet: a.boat.sheet, heading: a.boat.heading, ctx: a.lessons.ctx });
    key('ArrowRight'); key('ArrowUp'); await pause(200);
    assert(JSON.stringify({ pos: a.boat.pos, sheet: a.boat.sheet, heading: a.boat.heading, ctx: a.lessons.ctx }) === before, 'demo cannot alter the lesson boat or progress');
    assert(a.theoryDemo.boat !== a.boat && a.theoryDemo.active, 'demo uses its own yacht state');
    assert(a.view.wakeAge.every((life) => life === 0), 'stationary demonstration leaves no wake trail');
    click('theoryNext'); assert(a.flow.theoryStage === 1, 'Next opens sail trim');
    click('theoryNext'); assert(a.flow.theoryStage === 2, 'Next opens turning');
    click('theoryBack'); assert(a.flow.theoryStage === 1, 'Back returns to sail trim');
    click('theorySkip');
    assert(a.flow.state === 'sailing' && a.lessons.current.id === 'course', 'Skip enters Lesson 1');
    assert(JSON.parse(w.fixtureValues['sail.onboarding.v1']).theorySeen, 'Skip saves completion');
  }],
  ['first Exam bypasses theory but later Learn sees it once', async () => {
    const { app: a, d, click } = await fixture();
    click('chooseExam'); click('setSailBtn');
    assert(a.flow.state === 'sailing' && a.lessons.current.id === 't-course', 'exam begins directly');
    click('learnTrack');
    assert(a.flow.state === 'theory' && a.flow.theoryStage === 0, 'first Learn start opens theory');
    click('theoryNext'); click('theoryNext');
    assert(d.getElementById('theoryNext').textContent.includes('Take me to the boat'), 'final step names the destination');
    click('theoryNext');
    assert(a.flow.state === 'sailing' && a.lessons.current.id === 'course', 'finish enters guided lesson');
    click('replayIntroBtn'); click('chooseLearn'); click('setSailBtn');
    assert(a.flow.state === 'theory', 'Replay introduction reopens theory');
  }],
  ['interrupted theory restarts at stage one and replay Exam bypasses it', async () => {
    let f = await fixture();
    f.click('chooseLearn'); f.click('setSailBtn'); f.click('theoryNext'); f.click('theoryNext');
    assert(f.app.flow.theoryStage === 2, 'learner can reach the third stage');
    const saved = { ...f.w.fixtureValues };
    assert(JSON.parse(saved['sail.onboarding.v1']).theorySeen === false, 'unfinished theory remains pending');
    f = await fixture(saved);
    assert(f.app.flow.state === 'theory' && f.app.flow.theoryStage === 0, 'reload restarts theory at stage one');
    f.click('theorySkip');
    f.click('replayIntroBtn'); f.click('chooseExam'); f.click('setSailBtn');
    assert(f.app.flow.state === 'sailing' && f.app.lessons.current.type === 'test', 'replayed Exam bypasses theory');
  }],
  ['Skip works on each stage and repeated replay keeps one coast scene', async () => {
    const f = await fixture();
    f.click('chooseLearn'); f.click('setSailBtn'); f.click('theorySkip');
    for (const stage of [1, 2]) {
      f.click('replayIntroBtn'); f.click('chooseLearn'); f.click('setSailBtn');
      for (let i = 0; i < stage; i++) f.click('theoryNext');
      assert(f.app.flow.theoryStage === stage, `replay reaches stage ${stage + 1}`);
      f.click('theorySkip');
      assert(f.app.flow.state === 'sailing' && f.app.lessons.current.id === 'course', `Skip from stage ${stage + 1} starts lesson`);
      assert(f.app.coast.scene.children.filter((child) => child.userData.coastScene).length === 1, 'replay retains one coastline scene');
    }
  }],
  ['phone theory keeps the boat above a scrollable card and Skip in reach', async () => {
    const { app: a, d, w, click } = await fixture({}, false, true, false, true);
    click('chooseLearn'); click('setSailBtn');
    const card = d.querySelector('#introOverlay .card').getBoundingClientRect();
    const skip = d.getElementById('theorySkip').getBoundingClientRect();
    assert(w.innerWidth === 390 && card.top > w.innerHeight * 0.4, 'boat has space above the bottom card');
    assert(skip.top >= card.top && skip.bottom <= w.innerHeight, 'Skip stays visible in the card');
    a.theoryDemo.camera.updateMatrixWorld();
    const hull = a.theoryDemo.camera.position.clone().set(0, 0, 0).project(a.theoryDemo.camera);
    const hullScreenY = (1 - hull.y) * w.innerHeight / 2;
    assert(hullScreenY < card.top - 6, `the yacht hull remains visible above the phone card (hull ${hullScreenY.toFixed(1)}, card ${card.top.toFixed(1)})`);
  }],
  ['reduced motion holds a stable yacht pose', async () => {
    const { app: a, click } = await fixture({}, false, false, false, false, true);
    click('chooseLearn'); click('setSailBtn');
    const heading = a.theoryDemo.boat.heading, viewTime = a.view.time;
    await pause(350);
    assert(a.theoryDemo.boat.heading === heading && a.view.time === viewTime, 'reduced-motion yacht does not turn or flutter');
  }],
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
    click('setSailBtn'); click('theorySkip'); await pause();
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
    a.lessons.ctx.t = 181; await pause(); click('reviewBtn'); click('theorySkip');
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
    assert(a.flow.state === 'theory', 'replay opens the theory demo');
    click('theorySkip');
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
  ['coast, sea and wind cues follow activities and Free Sail controls', async () => {
    const { app: a, d, w, click } = await fixture();
    click('chooseLearn'); click('setSailBtn'); click('theorySkip');
    assert(a.coast.locationId === 'tel-aviv', 'Lesson 1 loads Tel Aviv');
    assert(!a.scene.children.some((child) => child.name === 'True wind source teaching cue'), 'lesson has no teaching arrow');
    assert(a.streaks.count === 138, 'lesson shows denser wind streaks');
    assert(d.getElementById('environmentInfo').textContent.includes('Calm water'), 'briefing names sea state');
    assert(!d.getElementById('environmentInfo').textContent.includes('arrow'), 'briefing omits the removed arrow');
    a.flow.enterItem(a.byId('t-course'));
    assert(a.streaks.count === 138, 'exam retains the same wind streak density');
    for (const item of a.ALL) {
      a.lessons.start(item, a.boat, a.wind);
      assert(a.coast.locationId === item.environment.locationId, `${item.id} loads its coast`);
      assert(d.getElementById('environmentInfo').textContent.includes(a.coast.group.name.replace('Coast · ', '')), `${item.id} names its coast`);
      assert(a.coast.scene.children.filter((child) => child.userData.coastScene).length === 1, `${item.id} leaves one coast scene`);
    }
    a.flow.enterItem(a.byId('free'));
    a.boat.pos.x = 120;
    const coastSelect = d.getElementById('coastLocation');
    coastSelect.value = 'haifa';
    coastSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(a.coast.locationId === 'haifa' && a.boat.pos.x === 0, 'coast switch restarts Free Sail offshore');
    const group = a.coast.group;
    const seaSelect = d.getElementById('seaState');
    seaSelect.value = 'choppy';
    seaSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(a.coast.group === group, 'sea switch reuses coastline scene');
    assert(a.env.waterUniforms.uWaveScale.value > 1, 'choppy preset reaches water shader');
    assert(a.streaks.count === 138, 'Free Sail retains denser wind streaks');
  }],
  ['compact Free Sail settings open on demand', async () => {
    const { app: a, d, click } = await fixture({}, false, false, true);
    click('chooseLearn'); click('setSailBtn'); click('theorySkip');
    a.flow.enterItem(a.byId('free'));
    assert(d.body.classList.contains('free-panel-collapsed'), 'compact layout starts with settings collapsed');
    assert(d.getElementById('freePanelToggle').getAttribute('aria-expanded') === 'false', 'collapsed state is exposed');
    click('freePanelToggle');
    assert(!d.body.classList.contains('free-panel-collapsed'), 'settings can be expanded');
    assert(d.getElementById('freePanelToggle').getAttribute('aria-expanded') === 'true', 'expanded state is exposed');
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
    click('setSailBtn'); click('theorySkip');
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
