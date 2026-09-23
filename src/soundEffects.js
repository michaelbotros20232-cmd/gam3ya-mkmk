// أصوات اللعبة — متولّدة برمجيًا بـ Web Audio API (مفيش ملفات صوت خارجية،
// فمش محتاجين نت أو أصول إضافية، والحجم فاضل صغير).

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

// صوت "فرقعة ورقة" قصير — النويز بيتفلتر عشان يحس إنه ورق مش شوشرة عشوائية
function playCardFlick({ duration = 0.12, filterFreq = 2500, filterQ = 0.8, gain = 0.3, filterType = 'bandpass' } = {}) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer(audioCtx);

    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(now);
    source.stop(now + duration + 0.02);
  } catch {
    // تجاهل لو المتصفح رفض يشغل صوت (زي أول تحميل من غير تفاعل من اليوزر)
  }
}

// سحب ورقة — صوت "شيك" سريع وحاد
export function playDrawSound() {
  playCardFlick({ duration: 0.08, filterFreq: 3400, filterQ: 0.6, gain: 0.28, filterType: 'highpass' });
}

// رمي ورقة — صوت أوسع وأخفض شوية زي "فرقعة" الورقة وهي بتقع
export function playDiscardSound() {
  playCardFlick({ duration: 0.16, filterFreq: 1500, filterQ: 1, gain: 0.34, filterType: 'bandpass' });
}

// جمعية اتحسبت — نغمة احتفال قصيرة فوق صوت ورق
export function playJam3eyaSound() {
  playCardFlick({ duration: 0.12, filterFreq: 2200, filterQ: 0.8, gain: 0.22, filterType: 'bandpass' });

  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99]; // دو - مي - صول (نغمة صاعدة مبهجة)
    freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + i * 0.09;
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
