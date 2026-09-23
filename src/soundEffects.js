// أصوات اللعبة — متولّدة برمجيًا بـ Web Audio API (مفيش ملفات صوت خارجية،
// فمش محتاجين نت أو أصول إضافية، والحجم فاضل صغير).
//
// كل صوت بقى متكوّن من أكتر من "طبقة" فوق بعض (زي صوت حقيقي بيتسجل من مصادر
// مختلفة: احتكاك الورق + طقة التلامس) بدل نغمة واحدة مسطحة، ومع شوية عشوائية
// بسيطة في كل مرة عشان الصوت ميبقاش مكرر وروبوتي.

let ctx = null;
function getCtx() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// بافر "خشخشة" (نويز أبيض) بنستخدمه كأساس لصوت الورق — بنعمله مرة واحدة بس ونعيد استخدامه
let noiseBuffer = null;
function getNoiseBuffer(audioCtx) {
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// طبقة "خشخشة ورق" مفلترة — ده حجر الأساس لأي صوت ورق واقعي، وبنركّب منها أكتر
// من طبقة فوق بعض بترددات وتوقيتات مختلفة عشان يحس السامع إنه صوت "مادة" حقيقية
// مش صفارة إلكترونية.
function noiseLayer(audioCtx, { start = 0, duration = 0.1, filterType = 'bandpass', freq = 2500, freqEnd = null, Q = 1, gain = 0.3 } = {}) {
  const source = audioCtx.createBufferSource();
  source.buffer = getNoiseBuffer(audioCtx);

  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  const t0 = audioCtx.currentTime + start;
  filter.frequency.setValueAtTime(freq, t0);
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  filter.Q.value = Q;

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.008, duration * 0.25));
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  source.start(t0);
  source.stop(t0 + duration + 0.02);
}

// "طقة" جسدية خفيفة — سينوسويد قصير بيهبط بسرعة، بيدي إحساس وزن الورقة وهي
// بتلمس الكومة أو الطاولة (مش موجودة في نويز عادي، وده اللي بيخلي الصوت حقيقي).
function thump(audioCtx, { start = 0, duration = 0.05, freq = 130, freqEnd = 60, gain = 0.18 } = {}) {
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  const t0 = audioCtx.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(gain, t0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// سحب ورقة — "شيك" حاد لحظة الفصل من فوق الكومة + ذيل قصير من احتكاك الورق
// وهو بيتزحلق برّه، زي لما تسحب كارت من إيدك فعلاً
export function playDrawSound() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const j = rand(0.92, 1.08);
    noiseLayer(audioCtx, { start: 0, duration: 0.045, filterType: 'highpass', freq: 3900 * j, Q: 0.7, gain: 0.32 });
    noiseLayer(audioCtx, { start: 0.012, duration: 0.09, filterType: 'bandpass', freq: 2300 * j, freqEnd: 1300, Q: 1.1, gain: 0.16 });
  } catch {
    // تجاهل لو المتصفح رفض يشغل صوت (زي أول تحميل من غير تفاعل من اليوزر)
  }
}

// رمي ورقة — فرقعة الورقة وهي طايرة في الهوا، بعدها طقة وقوعها على الكومة
// (نويز حاد + طقة جسدية خفيفة) عشان يحس إن للورقة وزن فعلاً
export function playDiscardSound() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const j = rand(0.9, 1.1);
    noiseLayer(audioCtx, { start: 0, duration: 0.07, filterType: 'bandpass', freq: 2600 * j, freqEnd: 1150, Q: 0.9, gain: 0.26 });
    noiseLayer(audioCtx, { start: 0.065, duration: 0.1, filterType: 'bandpass', freq: 1400 * j, Q: 1.3, gain: 0.3 });
    thump(audioCtx, { start: 0.065, duration: 0.06, freq: 145 * j, freqEnd: 55, gain: 0.16 });
  } catch {
    // تجاهل
  }
}

// جمعية اتحسبت — نغمة احتفال قصيرة فوق صوت ورق واقعي
export function playJam3eyaSound() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const j = rand(0.95, 1.05);
    noiseLayer(audioCtx, { start: 0, duration: 0.05, filterType: 'highpass', freq: 3600 * j, Q: 0.7, gain: 0.3 });
    noiseLayer(audioCtx, { start: 0.01, duration: 0.1, filterType: 'bandpass', freq: 2100 * j, freqEnd: 1300, Q: 0.9, gain: 0.18 });

    const now = audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99]; // دو - مي - صول (نغمة صاعدة مبهجة)
    freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + 0.05 + i * 0.09;
      gainNode.gain.setValueAtTime(0, start);
      gainNode.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  } catch {
    // تجاهل
  }
}
