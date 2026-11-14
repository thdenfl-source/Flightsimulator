# Bell 206B-3 단발 소리 합성 — 두 날개 주로터(394rpm → 13Hz 'whop') · 꼬리로터(85Hz) · Allison 250 터빈 한 대의 휘파람
# 6초 길이 · 모든 주파수가 1/6Hz 의 정수배 · 잡음은 주파수 영역에서 만들어 끝과 처음이 끊김 없이 이어진다.
import numpy as np, wave, sys
SR = 22050; T = 6.0; N = int(SR * T)
rng = np.random.default_rng(206)
t = np.arange(N) / SR

def pnoise(lo, hi, tilt=1.0):
    """주기적 잡음(띠 lo~hi Hz, 1/f^tilt)"""
    F = np.fft.rfftfreq(N, 1 / SR)
    mag = np.where((F >= lo) & (F <= hi), 1.0 / np.maximum(F, 1) ** (tilt / 2), 0)
    ph = rng.uniform(0, 2 * np.pi, len(F))
    x = np.fft.irfft(mag * np.exp(1j * ph), N)
    return x / np.max(np.abs(x))

def bandpass(x, lo, hi):
    F = np.fft.rfftfreq(N, 1 / SR); X = np.fft.rfft(x)
    X[(F < lo) | (F > hi)] = 0
    return np.fft.irfft(X, N)

def pulses(rate, width, sharp):
    """원형(끝과 처음이 이어지는) 날개 지나감 펄스 — 날카로울수록 'whop'"""
    ph = (t * rate) % 1.0
    d = np.minimum(ph, 1 - ph)                       # 펄스 가운데로부터의 거리(주기의 몫)
    return np.exp(-(d / width) ** sharp)

def make(flight):
    BPF = 13.0                                      # 주로터 날개 지나감(2날개 × 394rpm/60 ≈ 13.1)
    p = pulses(BPF, 0.09 if flight else 0.13, 2.0)
    # 주로터 — 낮은 'thump'(펄스로 감싼 저역 잡음 + 날개 지나감 배음)
    low = bandpass(pnoise(30, 400, 1.2), 30, 300)
    thump = low * (0.25 + 0.75 * p)
    harm = sum(np.sin(2 * np.pi * BPF * k * t + k) / k for k in range(1, 7))
    slap = bandpass(pnoise(300, 3000, 1.0), 300, 2500) * p ** 3     # 공중 — 날개끝 slap
    # 꼬리로터 — 85Hz 버즈(배음)
    TR = 85.0
    tr = sum(np.sin(2 * np.pi * TR * k * t + 0.7 * k) / k ** 1.3 for k in range(1, 9))
    tr *= 0.85 + 0.15 * np.sin(2 * np.pi * BPF * t)
    # Allison 250 — 터빈 한 대의 휘파람(가는 순음 둘 + 고역 바람)
    wh = (0.6 * np.sin(2 * np.pi * 6200 * t) + 0.35 * np.sin(2 * np.pi * 3100 * t + 1)
          + 0.2 * np.sin(2 * np.pi * 4650 * t + 2)) * (0.9 + 0.1 * np.sin(2 * np.pi * (1 / 3) * t))
    hiss = bandpass(pnoise(1500, 9000, 0.6), 1500, 9000)
    # 배기·기어박스 웅웅
    rum = bandpass(pnoise(20, 200, 1.5), 20, 180)
    if flight:
        x = 1.00 * thump + 0.35 * harm / 2 + 0.55 * slap + 0.30 * tr + 0.10 * wh + 0.25 * hiss + 0.45 * rum
    else:
        x = 0.70 * thump + 0.20 * harm / 2 + 0.10 * slap + 0.30 * tr + 0.20 * wh + 0.30 * hiss + 0.30 * rum
    x = x / np.sqrt(np.mean(x ** 2)) * 0.158          # 흰수리 녹음과 같은 크기(RMS)
    x = x / max(1.0, np.max(np.abs(x)) / 0.95)
    return x

for name, fl in (('b206-ground', False), ('b206-flight', True)):
    x = make(fl)
    # 되풀이 이음매를 조용하고 매끄러운 자리로(주기 신호라 굴려도 그대로 이어진다)
    k = int(np.argmin(np.abs(x) + np.abs(x - np.roll(x, 1))))
    x = np.roll(x, -k)
    pcm = (x * 32767).astype('<i2')
    with wave.open(f'{sys.argv[1]}/{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(name, len(pcm) / SR, 's', 'rms', float(np.sqrt(np.mean(x ** 2))), 'edge', float(x[-1]), float(x[0]))
