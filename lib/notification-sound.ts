// 알림 소리(Web Audio) + 브라우저 알림(Notification API) 공용 함수.
// useNotification 훅과 전역 알림 훅이 함께 사용하기 위해 React 의존 없이 분리.

// Web Audio API로 알림 소리 생성 (외부 파일 불필요)
export function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // 슬랙 스타일: 나무 노크 느낌의 두 번 톡톡
    const knocks = [
      { start: 0, freq: 800 },
      { start: 0.12, freq: 1000 },
    ];

    for (const knock of knocks) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(ctx.destination);

      // 밴드패스 필터로 나무 울림 느낌
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(knock.freq, t + knock.start);
      filter.Q.setValueAtTime(15, t + knock.start);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(knock.freq, t + knock.start);

      // 짧고 날카로운 어택 → 빠른 감쇠
      oscGain.gain.setValueAtTime(0.4, t + knock.start);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + knock.start + 0.08);

      osc.start(t + knock.start);
      osc.stop(t + knock.start + 0.08);
    }

    setTimeout(() => ctx.close(), 400);
  } catch {
    // AudioContext를 지원하지 않거나 백그라운드에서 막힌 경우 무시
  }
}

export function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// 탭이 백그라운드이거나 포커스가 없을 때만 브라우저 알림 표시.
// (포커스 상태에서 보고 있으면 화면에 메시지가 이미 보이므로 생략)
export function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  const notification = new Notification(title, {
    body: body.length > 100 ? body.slice(0, 100) + "..." : body,
    icon: "/icon.png",
    tag: "vteam-message",
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  setTimeout(() => notification.close(), 5000);
}
