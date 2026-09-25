// voiceover.js — narration through the browser's built-in speech synthesis.
// No audio files: the voice depends on the device, and captions always carry
// the same text, so a missing or muted voice never hides anything.
import { storage } from './storage.js';

const PREF_KEY = 'sail.voice';

export class Voiceover {
  constructor() {
    this.synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    this.enabled = storage.getItem(PREF_KEY) !== 'off';
    this.talking = false;
    this.voice = null;
    this.utterance = null; // held so Chrome can't collect it before onend fires
    if (this.synth) {
      this._pickVoice();
      this.synth.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  get available() { return !!this.synth; }

  // Also ask the engine: a blocked or dropped utterance may never fire onend.
  get speaking() {
    return this.talking && !!this.synth && (this.synth.speaking || this.synth.pending);
  }

  _pickVoice() {
    const voices = this.synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    this.voice = voices.find((v) => v.localService && /^en[-_]US/i.test(v.lang)) ||
      voices.find((v) => v.localService) || voices[0] || null;
  }

  speak(text) {
    this.cancel();
    if (!this.synth || !this.enabled || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang || 'en-US';
    u.rate = 1;
    u.onend = u.onerror = () => {
      if (this.utterance === u) { this.talking = false; this.utterance = null; }
    };
    this.utterance = u;
    this.talking = true;
    this.synth.speak(u);
  }

  cancel() {
    this.talking = false;
    this.utterance = null;
    this.synth?.cancel();
  }

  setEnabled(on) {
    this.enabled = on;
    storage.setItem(PREF_KEY, on ? 'on' : 'off');
    if (!on) this.cancel();
  }
}
