// 3Dの画面が重い端末では、絵のきめ細かさを自動で少しずつ下げる（なめらかさを優先する）
// 使い方：const aq = autoQuality(renderer, onChange); 毎フレーム aq.tick(dt) を呼ぶ
export function autoQuality(renderer, onChange, { start = Math.min(devicePixelRatio, 1.5), floor = 0.75 } = {}) {
  let ratio = start, sum = 0, n = 0, calm = 0, drops = 0;
  renderer.setPixelRatio(ratio);
  return {
    get ratio() { return ratio; },
    tick(dt) {
      if (dt <= 0 || dt > 0.25) return;   // 画面を切りかえた直後などの大きな待ちは数えない
      sum += dt; n += 1;
      if (n < 45) return;
      const avg = sum / n; sum = 0; n = 0;
      if (avg > 1 / 40 && ratio > floor && ++drops <= 2) {   // 40コマ/秒を下回る → きめ細かさを下げる（2回まで）
        ratio = Math.max(floor, +(ratio * 0.8).toFixed(2));
        renderer.setPixelRatio(ratio); onChange?.(); calm = 0;
      }   // 下げたら戻さない（上げ下げをくり返すと、そのたびに画面が一瞬止まるため）
    },
  };
}
// 細かい画面（スマホ）では、ふちのギザギザ取りはなくてもきれいなので、使わない（重いため）
export const wantAntialias = (low) => !low && devicePixelRatio < 1.5;
