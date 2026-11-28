# CN-235 쌍발 터보프롭 소리 합성 — 4날개 프로펠러 둘(1,020rpm → 68Hz 날개 지나감 · 둘이 살짝 어긋나 맥놀이) · CT7 터빈(낮게) — 1.8kHz 위는 없다
# 6초 길이 · 모든 주파수가 1/6Hz 의 정수배 · 잡음은 주파수 영역에서 만들어 끝과 처음이 끊김 없이 이어진다.
import numpy as np, wave, sys
SR = 22050; T = 6.0; N = int(SR * T)
rng = np.random.default_rng(235)
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
    BPF1, BPF2 = 68.0, 409 / 6                      # 프로펠러 둘(4날개 × 1,020rpm/60 = 68Hz · 오른쪽은 0.17Hz 어긋나 6초에 한 번 맥놀이)
    prop = sum((np.sin(2 * np.pi * BPF1 * k * t + k) + 0.9 * np.sin(2 * np.pi * BPF2 * k * t + 2 * k)) / k ** 1.1 for k in range(1, 12))
    p1 = pulses(BPF1, 0.18, 2.0)
    buzz = bandpass(pnoise(60, 900, 1.2), 60, 900) * (0.4 + 0.6 * p1)
    # CT7 — 터빈 소리는 낮게만
    wh = (0.6 * np.sin(2 * np.pi * 760 * t) + 0.35 * np.sin(2 * np.pi * 1140 * t + 1)) * (0.9 + 0.1 * np.sin(2 * np.pi * (1 / 3) * t))
    hiss = bandpass(pnoise(300, 1500, 1.0), 300, 1500)
    rum = bandpass(pnoise(20, 200, 1.5), 20, 180)
    wind = bandpass(pnoise(150, 1200, 0.8), 150, 1200)
    if flight:
        x = 0.55 * prop / 3 + 0.80 * buzz + 0.12 * wh + 0.30 * hiss + 0.40 * rum + 0.45 * wind
    else:
        x = 0.40 * prop / 3 + 0.45 * buzz + 0.25 * wh + 0.35 * hiss + 0.30 * rum + 0.05 * wind
    x = bandpass(x, 0, 1800)
    x = x / np.sqrt(np.mean(x ** 2)) * 0.158
    x = x / max(1.0, np.max(np.abs(x)) / 0.95)
    return x

for name, fl in (('cn235-ground', False), ('cn235-flight', True)):
    x = make(fl)
    # 되풀이 이음매를 조용하고 매끄러운 자리로(주기 신호라 굴려도 그대로 이어진다)
    k = int(np.argmin(np.abs(x) + np.abs(x - np.roll(x, 1))))
    x = np.roll(x, -k)
    pcm = (x * 32767).astype('<i2')
    with wave.open(f'{sys.argv[1]}/{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(name, len(pcm) / SR, 's', 'rms', float(np.sqrt(np.mean(x ** 2))), 'edge', float(x[-1]), float(x[0]))
