// 絵の割り当て（縦長＝p、横長＝w）。無い絵は仮の板（label）を出す
// W・H は絵の大きさ（気づきの印を、絵の中の場所に合わせて置くため）
const P = { W: 1024, H: 1536 }, L = { W: 1536, H: 1024 };
export const BG = {
  lobby: { p: 'img/walk.webp', w: 'img/walk_wide.webp', label: 'ロビー', pos: '50% 50%' },
  walk: { p: 'img/corridor.webp', w: 'img/corridor_wide.webp', label: '廊下' },
  lobby_view_f: { p: 'img/lobby_view_f.webp', w: 'img/lobby_view_f_wide.webp', label: 'ロビーの窓' },
  lobby_view_m: { p: 'img/lobby_view_m.webp', w: 'img/lobby_view_m_wide.webp', label: 'ロビーの窓' },
  lobby_noglass: { p: 'img/lobby_noglass.webp', w: 'img/lobby_noglass_wide.webp', label: 'ロビー（ご家族）', pos: '50% 45%' },
  lobby_family: { p: 'img/lobby_family.webp', w: 'img/lobby_family_wide.webp', label: 'ロビー（ご家族）', pos: '50% 45%' },
  kitchen: { p: 'img/kitchen.webp', w: 'img/kitchen_wide.webp', label: '調理場の受け渡し', pos: '50% 30%' },
  dinner: { p: 'img/dinner_family.webp', w: 'img/dinner_wide.webp', label: '個室（掘りごたつ）', pos: '50% 40%' },
  dinner_chair: { p: 'img/dinner_chair.webp', w: 'img/dinner_chair_wide.webp', label: '個室（椅子席）', pos: '50% 40%' },
  room205_base: { p: 'img/room205_base.webp', w: 'img/room205_base_wide.webp', label: '205号室', pos: '50% 25%' },
  room205_sig: { p: 'img/room205_sig.webp', w: 'img/room205_sig_wide.webp', label: '205号室', pos: '50% 25%' },
  room205_look: { p: 'img/room205_look.webp', w: 'img/room205_look_wide.webp', label: '205号室', pos: '50% 25%' },
  room205_joy: { p: 'img/room205_joy.webp', w: 'img/room205_joy_wide.webp', label: '205号室', pos: '50% 25%' },
  night: { p: 'img/night.webp', w: 'img/night_wide.webp', label: '大浴場' },
  breakfast: { p: 'img/breakfast.webp', w: 'img/breakfast_wide.webp', label: '朝食の個室' },
  photo: { p: null, w: null, label: '' },
};
export const SIZE = { p: P, w: L };

// 話す人の立ち絵。x は体の中心の位置（画面の幅の何%）。縦長 p・横長 w
// 先輩は、ふだん（a）・教える（b：働く魅力を話すとき）・小声（c）の3つのポーズ。心配そうな顔（wa・wc）は face: 'worry' のセリフで
export const CHARA = {
  senpai: {
    src: (b) => {
      const whisper = /^（(小声|そっと)/.test(b?.text || '');
      if (b?.face === 'worry') return whisper ? 'img/senpai_wc.webp' : 'img/senpai_wa.webp';   // お客さまを気づかう場面は、笑わない顔
      return whisper ? 'img/senpai_c.webp' : b?.perk ? 'img/senpai_b.webp' : 'img/senpai_a.webp';
    },
    side: 'l', x: { p: 40, w: 33 },
  },
  front: { src: () => 'img/front.webp', side: 'r', x: { p: 60, w: 67 } },
  chef: { src: () => 'img/chef.webp', side: 'r', x: { p: 60, w: 67 } },
  // 内務：お車のお預かりのときは車のスマートキーを持ち、それ以外は手を前で重ねる
  naimu: { src: (b) => (/お車/.test(b?.text || '') ? 'img/naimu_key.webp' : 'img/naimu_hands.webp'), side: 'l', x: { p: 40, w: 33 } },
};

// 気づきの印（背景ごと）。u・v は絵の中の場所（0〜1）。古い形（x・y：画面の%）もそのまま使える
export const NOTICE = {
  lobby_family: { p: { u: 0.255, v: 0.525 }, w: { u: 0.372, v: 0.565 } },
  dinner: { p: { x: 36, y: 37, fx: 32, fy: 25.5 }, w: { x: 38.5, y: 36, fx: 33, fy: 24 }, short: { x: 36, y: 34, fx: 32, fy: 23 } },
  dinner_chair: { p: { x: 27, y: 36.5, fx: 26, fy: 27 }, w: { x: 41.5, y: 40, fx: 37, fy: 29 }, short: { x: 30, y: 38, fx: 28, fy: 29 } },
};
// 印をタップしたときに出るひとこと
export const NOTICE_TEXT = { knee: 'ひざが、つらそう……？', anniv: '「35年ぶり」……？' };

// ロビーでお出ししたグラス（背景の絵の中の四角 [左, 上, 右, 下]。お一人ずつ重ねる）
export const GLASS = {
  father: { p: [224, 754, 527, 1127], w: [524, 544, 787, 752] },
  mother: { p: [364, 554, 727, 927], w: [664, 344, 917, 647] },
  daughter: { p: [554, 754, 857, 1127], w: [799, 544, 1062, 752] },
};

// ロビー：お茶が減っていくグラスの絵を重ねる所（グラスのまわりだけの小さな四角）
export const LEVEL = {
  father: { p: [330, 820, 410, 920], w: [610, 560, 690, 650] },
  mother: { p: [520, 585, 585, 675], w: [775, 380, 835, 465] },
  daughter: { p: [660, 820, 740, 920], w: [890, 560, 970, 650] },
};

// 205号室：お持ちしたケーキを机に置く位置（背景の絵の中。cx 中心・bot 下の端・w 幅）
export const CAKE_AT = { w: { cx: 768, bot: 682, w: 210 }, p: { cx: 512, bot: 905, w: 250 } };

// 205号室の「ふすまのすき間」から見える所（横長の絵の中の四角。2人の顔と手もと）
export const PEEK = { x: 290, y: 110, w: 930, h: 450 };

// 小物（朝食のお膳・お箸・お祝いの箸・ケーキ）。炎の位置はケーキの絵の中の%
export const PROPS = {
  tray: 'img/tray.webp', chop: 'img/chop.webp', gift: 'img/gift.webp',
  cake: 'img/cake_base.webp', flames: ['img/flame0.webp', 'img/flame1.webp', 'img/flame2.webp'],
  wicks: [{ x: 31.2, y: 12 }, { x: 52.5, y: 7 }, { x: 73.8, y: 12.5 }],
};

// 記念写真の人（ふつう・笑顔・タイミング外れ）
export const FAMILY = ['father', 'mother', 'daughter'].map((id) => ({
  id, base: `img/${id}.webp`, smile: `img/${id}_smile.webp`, off: `img/${id}_off.webp`,
}));

// ふり返りの「本物の宙 SORA」（公式サイトの写真）
export const REAL = [
  { src: 'img/real_garden.webp', alt: 'ロビーから見る庭園' },
  { src: 'img/real_dining.webp', alt: '掘りごたつの個室' },
  { src: 'img/real_stone.webp', alt: '奥の院の円石' },
];
