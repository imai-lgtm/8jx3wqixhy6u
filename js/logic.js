// ゲームのルールと筋書きだけ（画面を描く処理は入れない）。ブラウザでもテスト（Node）でも同じものが動く
// 「はじめての担当 ― 宙 SORA の一泊二日」

export const STEP = 1 / 60;          // ルールはいつもこの刻みで進める（描画の速さに左右されない）
const MAX_CATCH_UP = 0.5;            // 1回の描画で追いかける時間の上限

// 難しさなどの数字はここだけ（check.mjs の結果を見て直す）
export const CONFIG = {
  // お出迎え（玄関から廊下をとおって、ロビーの窓ぎわの席まで歩く）
  walk: {
    length: 14,          // 歩く道のり（m）：廊下の奥の、光の差すロビーの入口まで
    corridorEnd: 14,     // 廊下の終わり（ここで光に包まれて、ロビーの場面になる）
    playerSpeed: 1.25,   // 押している間の自分の速さ（m/秒）
    fatherSpeed: 0.8,    // お父さまの速さ（杖）
    slow: [[3, 5, 0.42], [11, 13, 0.45]],   // ゆっくりになる所：玄関の上がり口・ロビーへの段差
    stopAt: 6.5, stopFor: 2.2,   // お父さまが廊下の生け花の前で足を止める
    goodGap: 2.6,        // お父さまとの間がこれ以下なら「つかず離れず」
    farGap: 3.4,         // これより離れると「離れすぎ」
    farLimit: 2.6,       // 離れすぎの時間がこれ以下なら「お父さまの足」に気づけた
    hintAfter: 3.2,      // 離れすぎてから先輩が声をかけるまで（気づけなかったあとに助ける）
  },
  // ウェルカムドリンク（ご案内の前の、飲み終えるまでの間。お話をしていれば、ちょうど飲み終える長さ）
  drink: { seconds: 16 },
  // 朝食のお箸（ヒントが出るまで・あきらめるまで）
  chopsticks: { hintAfter: 9, giveUpAfter: 20 },
  // 205号室のサプライズ：彼氏さんの合図
  surprise: {
    firstSignal: [4.5, 5.5], every: [3.2, 5], signalLen: 1.6,   // 合図が出るまで・次の合図まで・合図が続く時間（秒）
    firstLook: [1.6, 2.4], lookLen: 1.3,   // お連れさまがふすまの方をちらっと見る（最初の合図の前に1回・合図のあいだにも時々）
    hintAfter: 9,        // 合図を待てずにいると、先輩が声をかける
  },
  // 記念写真
  photo: {
    reactDelay: 0.6,     // 声をかけてから、こちらを向くまで
    smileHold: 2.6,      // 笑顔が続く時間
    blinkEvery: [1.4, 2.6], // お父さまのまばたきの間かくの範囲（秒）
    blinkLen: 0.18,      // まばたきの長さ
    sizeMin: 1.12, sizeMax: 1.55,   // いちばん引いたときより何倍に写れば「ちょうどよい」（ズームのつまみの真ん中あたり）
  },
};

// 再現できる乱数（テストで同じ流れを何度でも試すため）
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- 人と場所 ----------------
export const PEOPLE = {
  me: { name: 'あなた' },
  senpai: { name: '先輩・早川', role: 'サービス3年目' },
  front: { name: 'フロント・高木' },
  chef: { name: '調理・長尾' },
  naimu: { name: '内務・森' },
  father: { name: 'お父さま' },
  mother: { name: 'お母さま' },
  daughter: { name: '娘さま' },
  boy: { name: '205号室・中島さま' },
  girl: { name: '205号室・お連れさま' },
};

// 気づき（ふり返りの画面に出る6つ）
export const KIZUKI = [
  { id: 'pace', title: 'お父さまの足', done: '歩く速さを合わせた', miss: 'お父さまが遅れていた' },
  { id: 'seat', title: '椅子席の個室', done: '夕食の席を変えてもらった', miss: '掘りごたつのままだった' },
  { id: 'drink', title: '飲み終えるまで', done: 'ドリンクの間を待てた', miss: '飲み終える前にご案内した' },
  { id: 'anniv', title: '35年ぶりの旅', done: 'お祝いに気づいた', miss: 'お祝いを聞きのがした' },
  { id: 'cake', title: 'ケーキの約束', done: '頼まれたケーキを用意した', miss: 'ケーキを忘れていた' },
  { id: 'lefty', title: 'お母さまは左利き', done: '朝のお箸の向き', miss: 'お箸がいつもの向きのまま' },
];

// 働く魅力カード（先輩が教えてくれると「ピコン」と出る。数字は config.js の募集要項と合わせる）
export const PERKS = [
  { id: 'tantou', cat: '仕事', title: '担当制', text: '到着から翌朝のお見送りまで、同じお客さまを受け持つ。名前を覚えてもらえる仕事。' },
  { id: 'ojt', cat: '育てる', title: '先輩がつくOJT', text: '入社後の研修のあと、先輩がとなりについて教える。未経験からでも大丈夫。' },
  { id: 'kenshu', cat: '育てる', title: 'おもてなし研修', text: 'マナー研修・おもてなし研修・内定者の宿泊研修。言葉づかいや所作が身につく。' },
  { id: 'nakanuke', cat: '働き方', title: '朝と午後の勤務', text: '勤務は朝と午後に分かれる。間の時間は、すぐ近くの寮で休める。' },
  { id: 'onsen', cat: '暮らし', title: '温泉とサウナ', text: '仕事の前後に、館内の温泉とサウナを使える。' },
  { id: 'ryo', cat: '暮らし', title: '新しい寮', text: '2024年完成の1LDK。職場のすぐ近く。' },
  { id: 'yakin', cat: '働き方', title: '夜勤なし・休日', text: '夜勤はなし。年間休日108日、有給休暇は半日単位でも取れる。' },
  { id: 'taishoku', cat: '安心', title: '転勤なし・退職金', text: '転勤がないから、また来てくださるお客さまにも会える。退職金制度もある。' },
];

// 場面（時刻・背景の名前）
export const SCENES = {
  handover: { clock: '14:30', place: '出勤・引き継ぎ ・ バックヤード', bg: 'backyard' },
  welcome: { clock: '15:00', place: 'お出迎え', bg: 'walk' },
  lobby: { clock: '15:10', place: 'ロビー', bg: 'lobby_family' },
  kitchen: { clock: '18:20', place: '調理場の受け渡し', bg: 'kitchen' },
  dinner: { clock: '18:40', place: '夕食 ・ 202号室の個室', bg: 'dinner' },
  surprise: { clock: '19:20', place: '205号室 ・ 誕生日', bg: 'room205' },
  night: { clock: '20:30', place: '仕事のあと', bg: 'night' },
  breakfast: { clock: '7:00', place: '朝食', bg: 'breakfast' },
  farewell: { clock: '10:00', place: 'お見送り ・ 円石の前', bg: 'photo' },
};

// 調理場で聞けること（3つのうち2つ）と、夕食で伝えるひとこと
export const KITCHEN_Q = [
  { id: 'kuromai', ask: '八寸の、柿の器の中身は？', answer: '修善寺の特産の黒米を炊いて詰めてある。秋の色でしょう', tell: '「柿の器には、修善寺の特産の黒米を詰めております」', react: ['mother', 'まあ、黒米。修善寺の名物なのね。'] },
  { id: 'tachiuo', ask: '焼き物のお魚は？', answer: '駿河湾の太刀魚。ゆず香る幽庵焼きにしてある', tell: '「焼き物は、駿河湾の太刀魚の幽庵焼きでございます」', react: ['father', '駿河湾か。地のものはうまいなあ。'] },
  { id: 'utsuwa', ask: '器のこだわりは？', answer: '紅葉の季節だから、葉の形の小皿にした。器も月替わりなんだ', tell: '「紅葉の季節に合わせて、葉の形の器にしております」', react: ['daughter', 'ほんとだ、葉っぱの形！ かわいい。'] },
];

// ドリンクを飲み終えるまでの間に話せること（どちらも本当のこと。ロケ地の話は config.js の showDrama で消せる）
export const DRINK_TALK = {
  drama: {
    label: '「このロビーやお庭は、ドラマのロケ地にもなったんです」',
    lines: [['me', '実は、このロビーやお庭は、ドラマのロケ地にもなったんです。'], ['daughter', 'えっ、もしかして「逃げ恥」！？ 見てました！'], ['mother', 'あら、あのドラマ？ どおりで、見覚えがあると思ったわ。']],
  },
  mori: {
    label: '「お庭の奥には『森の庭』もございます」',
    lines: [['me', 'お庭の奥には「森の庭」もございます。鳥の声を聞きながら、のんびりできますよ。'], ['father', 'ほう。あとで、ゆっくり歩いてみようか。']],
  },
};

// ---------------- 筋書き ----------------
// 1つ1つを「ビート」とよぶ。t の種類：
//   scene（場面のはじまり） line（せりふ。perk で働く魅力カード、notice で気づきの印）
//   card（担当カード） choice（選ぶ） kitchen（2つ聞く） walk（お出迎えの3D）
//   serve（ドリンクをお出しする） drink（飲み終えるまでの間） surprise（205号室のサプライズ）
//   chopsticks（お箸を並べる） gift（お祝いの箸を渡す） photo（記念写真の3D）
//   when があれば、その条件のときだけ出す
const has = (k) => (g) => !!g.flags[k];
const not = (k) => (g) => !g.flags[k];
const picked = (id, i) => (g) => g.picks[id] === i;   // その問いで、何番目を選んだか

export const STORY = [
  { t: 'scene', id: 'handover' },
  { t: 'line', who: 'senpai', text: 'こんにちは！ 今日から、いよいよひとりで担当だね。' },
  { t: 'line', who: 'senpai', text: 'うちは担当制。到着から翌朝のお見送りまで、同じお客さまを受け持つよ。', perk: 'tantou' },
  { t: 'line', who: 'senpai', text: '研修でやったことを、今日は本番で。私もとなりについてるから、安心してね。', perk: 'ojt' },
  { t: 'line', who: 'front', text: '本日の担当カードです。202号室の佐倉さま、3名さま。娘さまのご予約です。' },
  { t: 'card' },
  { t: 'line', who: 'senpai', text: 'もう1組、205号室の中島さまも。実際は1日3〜4組だから、まずは2組からね。' },
  { t: 'line', who: 'senpai', text: 'カードは右上から、いつでも見なおせるよ。じゃあ、お出迎えに行こう！' },

  { t: 'scene', id: 'welcome' },
  { t: 'line', who: 'naimu', text: '佐倉さまのお車、着きました！ お車は駐車場へ回しておきますね。' },
  { t: 'line', who: 'senpai', text: 'ご家族を、廊下をとおって、ロビーの窓ぎわのお席までご案内しよう。あなたが先に立ってね。' },
  { t: 'walk' },
  { t: 'line', who: 'mother', text: 'まあ……！ 窓いっぱいの紅葉ね。' },
  { t: 'line', who: 'daughter', text: 'すごい……。お父さん、来てよかったね。' },
  { t: 'line', who: 'father', when: has('pace'), text: 'ああ。……ゆっくり歩いてくれて、ありがとう。' },
  { t: 'line', who: 'senpai', when: not('pace'), face: 'worry', text: '（小声で）お父さま、杖をついていらしたね。次は、うしろも見ながら歩こう。' },
  { t: 'line', who: 'me', text: 'どうぞ、窓ぎわのお席へおかけください。' },

  { t: 'scene', id: 'lobby' },
  { t: 'serve' },
  {
    t: 'choice', id: 'greet', prompt: 'ご家族に、ごあいさつ。',
    options: [
      { tag: 'ていねいに', text: '「本日ご担当いたします。どうぞよろしくお願いいたします」', good: true },
      { tag: '元気よく', text: '「担当です！ よろしくお願いしまーす！」' },
      { tag: 'さっそく', text: '「さっそくですが、お夕食のお時間をうかがえますか？」' },
    ],
  },
  { t: 'line', who: 'daughter', text: 'よろしくお願いします！ わあ、お庭がきれい……。' },
  { t: 'line', who: 'senpai', when: picked('greet', 0), text: '（小声で）研修で練習した言葉づかい、ばっちりだね。', perk: 'kenshu' },
  { t: 'line', who: 'senpai', when: (g) => g.picks.greet !== 0, face: 'worry', text: '（小声で）ごあいさつは、ていねいな言葉で、名のってからね。マナー研修でしっかり練習するから、大丈夫。', perk: 'kenshu' },
  { t: 'line', who: 'me', text: 'お夕食は、18時と18時40分からお選びいただけます。' },
  { t: 'line', who: 'daughter', text: '先にお風呂に入りたいから、18時40分でお願いします。' },
  { t: 'line', who: 'father', text: 'よっこいしょ……。いやあ、このところ、ひざがね。', notice: 'knee' },
  {
    t: 'choice', id: 'seat', prompt: 'お父さまのひと言。どう応える？', hint: 'お父さまのひざ、今夜のお食事は大丈夫かな？',
    options: [
      { tag: '気づかう', text: '「お部屋へは、お足もとに気をつけて、ゆっくりご案内いたしますね」' },
      { tag: '提案する', text: '「お夕食は、椅子席の個室もご用意できます。いかがですか？」', flag: 'seat' },
      { tag: '気づかう', text: '「ご無理なさらず、お部屋でゆっくりおくつろぎください」' },
    ],
  },
  { t: 'line', who: 'father', when: has('seat'), text: '椅子のお部屋か。それは助かるなあ。' },
  { t: 'line', who: 'senpai', when: has('seat'), text: '（小声で）内務の森さんに、お部屋の変更を伝えておくね。' },
  { t: 'line', who: 'father', when: not('seat'), text: 'そうかい。……まあ、なんとかなるだろう。' },
  { t: 'drink' },   // 飲み終えるまでの間：お庭やロケ地の話をして、飲み終えたらご案内
  { t: 'line', who: 'senpai', when: has('drink'), text: '飲み終えるまで待てたね。急かされると、せっかくのお庭も楽しめないから。' },
  { t: 'line', who: 'senpai', when: not('drink'), face: 'worry', text: 'あっ、まだお飲みものが残ってたかも。次はグラスを見てからにしよう。' },

  { t: 'line', who: 'senpai', text: 'ご案内おつかれさま！ 夕食まで、いったん休憩ね。勤務は朝と午後に分かれてて、間の時間は寮で休めるんだよ。', perk: 'nakanuke' },

  { t: 'scene', id: 'kitchen' },
  { t: 'line', who: 'chef', text: '202号室さんの八寸（はっすん）、もうすぐ出せるよ。季節の味を少しずつ盛り合わせた、会席のはじめのひと皿だ。聞いておきたいことはある？' },
  { t: 'kitchen' },
  { t: 'line', who: 'chef', text: 'お客さまに、よろしく伝えてね。' },

  { t: 'scene', id: 'dinner' },
  { t: 'line', who: 'senpai', when: not('seat'), face: 'worry', text: '（小声で）お父さま、掘りごたつに座るの、少しつらそうだね……。' },
  { t: 'line', who: 'father', when: has('seat'), text: '椅子だと楽だねえ。料理がいっそううまそうに見えるよ。' },
  { t: 'choice', id: 'explain', prompt: '八寸（季節の味の盛り合わせ）をお出しする。ひとこと添えるなら？', options: 'explain' },
  { t: 'react' },   // 料理のひとことへの、お客さまの反応（聞いたことで変わる）
  { t: 'line', who: 'mother', text: '（お箸を手に取って、向きを左右逆に置き直す）……あら、ごめんなさいね。私、左利きなものだから。' },
  { t: 'line', who: 'father', text: 'いやあ、修善寺は35年ぶりだなあ。あのときも、ちょうど紅葉がきれいでね。', notice: 'anniv' },
  { t: 'line', who: 'mother', text: 'ふふ。あれから、ちょうど35年。……あのときは、二人きりの旅だったわね。' },
  {
    t: 'choice', id: 'anniv', prompt: 'お父さまの言葉に、どうする？', hint: '今のお話、なにか気になることはない？',
    options: [
      { tag: 'たずねる', text: '「もしかして、何かの記念のご旅行ですか？」', flag: 'anniv' },
      { tag: '相づち', text: '「35年前も、紅葉の季節にいらしたんですね」' },
      { tag: '案内する', text: '「明日は竹林の小径もおすすめです」' },
    ],
  },
  { t: 'line', who: 'daughter', when: has('anniv'), text: '実は……両親の結婚35周年なんです。35年前の新婚旅行も、修善寺で。' },
  { t: 'line', who: 'mother', when: has('anniv'), text: 'もう、この子ったら。……でも、うれしいわ。' },
  { t: 'line', who: 'senpai', when: has('anniv'), text: '（小声で）すてき！ 明日の朝、旅館からお祝いのお箸をお渡ししよう。用意しておくね。' },
  { t: 'line', who: 'father', when: picked('anniv', 1), text: 'ああ。あのときは、まだ若かったなあ。……なあ、母さん。' },
  { t: 'line', who: 'mother', when: picked('anniv', 1), text: 'ふふ、そうね。' },
  { t: 'line', who: 'father', when: picked('anniv', 2), text: '竹林か。いいね、明日の朝、歩いてみようか。' },
  { t: 'line', who: 'senpai', when: not('anniv'), face: 'worry', text: '（小声で）「35年ぶり」に「あのとき」……。何か特別なご旅行なのかも。たずねてみてもよかったかもね。' },
  { t: 'line', who: 'naimu', text: '（そっと）205号室の中島さま、そろそろデザートです！' },

  { t: 'scene', id: 'surprise' },
  { t: 'line', who: 'me', text: '（ふすまのすき間から。中島さまとお連れさまが、楽しそうに話している）' },
  {
    t: 'choice', id: 'cake', prompt: '205号室のデザート。用意するのは？', hint: '担当カード、見てみた？',
    options: [
      { tag: '用意', text: 'いつもの季節のデザート' },
      { tag: '用意', text: 'お誕生日のケーキ', flag: 'cake' },
      { tag: '用意', text: '季節のデザートと、温かいお茶' },
    ],
  },
  { t: 'line', who: 'senpai', when: not('cake'), face: 'worry', text: '待って！ 中島さまのカードに「お誕生日のケーキを、お食事の最後に。ご本人には内緒」ってあったよ。ケーキを出そう。' },
  { t: 'line', who: 'senpai', text: 'ろうそくに火をつけたら、合図を待とう。中島さまが「ウインクとOKサイン」をくれたら運ぶ約束だよ。お連れさまがこっちを見ているときは、まだだめ。' },
  { t: 'surprise' },
  { t: 'line', who: 'me', text: 'お誕生日、おめでとうございます。' },
  { t: 'line', who: 'girl', when: has('surprise'), text: 'えっ……ケーキ！？ うそ、ぜんぜん気づかなかった……！ ありがとう！' },
  { t: 'line', who: 'girl', when: (g) => !g.flags.surprise && g.sur?.result === 'seen', text: 'あれ？ ……今、ふすまの向こうにケーキ、見えちゃった。ふふ。' },
  { t: 'line', who: 'boy', when: (g) => !g.flags.surprise && g.sur?.result !== 'seen', text: '（小声で）あっ……まだ、言う言葉を準備してたのに……。' },
  { t: 'line', who: 'girl', when: (g) => !g.flags.surprise && g.sur?.result !== 'seen', text: 'え、ケーキ？ ……ふふ、中島くん、なんだかあわててる。' },
  { t: 'line', who: 'boy', text: 'お誕生日、おめでとう。旅館の方にも、内緒で手伝ってもらったんだ。' },
  { t: 'line', who: 'girl', text: 'もう……ありがとう。すっごくうれしい！' },
  { t: 'line', who: 'boy', text: '本当にありがとうございました。一生の思い出になります。' },

  { t: 'scene', id: 'night' },
  { t: 'line', who: 'senpai', text: 'おつかれさま！ 仕事のあとは、館内の温泉とサウナに入れるんだよ。', perk: 'onsen' },
  {
    t: 'choice', id: 'night', prompt: '今日の仕事が終わった。',
    options: [
      { tag: '温泉', text: '温泉に入って帰る', flag: 'onsen' },
      { tag: '帰る', text: 'まっすぐ寮に帰る' },
    ],
  },
  { t: 'bath', when: has('onsen') },
  { t: 'line', who: 'me', when: has('onsen'), text: '（ふう……。湯気の向こうに、今日のお客さまの笑顔が浮かぶ）' },
  { t: 'line', who: 'senpai', text: '寮は歩いてすぐ。2024年にできた1LDKなんだ。', perk: 'ryo' },
  { t: 'line', who: 'senpai', text: '夜勤はないから、明日は朝7時から。ゆっくり休んでね。', perk: 'yakin' },

  { t: 'scene', id: 'breakfast' },
  { t: 'line', who: 'senpai', text: 'おはよう！ よく眠れた？ 今朝も、佐倉さまの朝食からだよ。' },
  { t: 'line', who: 'senpai', text: 'お膳にお箸を並べてね。昨日のこと、生かせるかな？' },
  { t: 'chopsticks' },
  // 間違えたとき：まちがえた所に、お客さまと先輩が反応する
  { t: 'line', who: 'father', when: (g) => g.chop?.wrongOthers, text: 'おや、お箸の向きが逆だね。……よいしょ。（向きを直す）' },
  { t: 'line', who: 'mother', when: (g) => !g.flags.lefty && !g.chop?.flipped.mother, text: '（お箸を手に取って、向きを左右逆に置き直す）' },
  { t: 'line', who: 'senpai', when: not('lefty'), face: 'worry', text: '（小声で）お母さまは左利き。昨日の夕食で、ご自分でお箸を置き直していたよね。左利きの方には箸先を右に、ほかの方はいつもどおり左に。次は気づけるといいね。' },
  { t: 'line', who: 'mother', when: has('lefty'), text: 'あら、お箸が……。昨日の夕食で、私が置き直していたの、覚えていてくださったの？' },
  { t: 'line', who: 'me', when: has('lefty'), text: 'はい。左手のほうが、お取りになりやすいかと思いまして。' },
  { t: 'line', who: 'mother', when: has('lefty'), text: 'まあ……うれしい。ありがとう。' },
  { t: 'line', who: 'senpai', when: has('lefty'), text: '（小声で）よく覚えていたね！ こういう小さな気づきが、お客さまの「また来たい」になるんだよ。' },
  { t: 'line', who: 'me', text: '炊きたての、土鍋ごはんです。' },
  { t: 'line', who: 'daughter', text: 'わあ、おいしそう！ お部屋もすてきだったね。窓いっぱいに紅葉が見えて。' },
  { t: 'line', who: 'father', text: 'お部屋の温泉も広くてね。夜と朝、2回も入ってしまったよ。' },
  { t: 'line', who: 'mother', text: '大浴場の「光の露天風呂」も、きれいだったわ。' },
  { t: 'gift', when: has('anniv') },
  { t: 'line', who: 'father', when: has('anniv'), text: 'これは……。35年前と同じ紅葉に、いい思い出がまたひとつ増えたよ。' },

  { t: 'scene', id: 'farewell' },
  { t: 'line', who: 'senpai', text: 'お見送りの前に、家族円満の「円石」の前で記念写真をお撮りしよう。' },
  { t: 'line', who: 'senpai', text: 'うちは転勤がないから、また来てくださったら、きっと会えるよ。', perk: 'taishoku' },
  { t: 'photo' },
];

// 夕食のひとこと（調理場で聞いた2つは中身のある言葉、聞かなかった1つはあいまいな言葉）
function explainOptions(g) {
  return KITCHEN_Q.map((q) => (g.asked.includes(q.id)
    ? { tag: '伝える', text: q.tell, good: true, q: q.id }
    : { tag: '伝える', text: '「……こちらは、旬のものでございます」', q: null }));
}

// ---------------- 記念写真の見え方（3Dと同じ数字で、構図を判定する） ----------------
export const PHOTO_SCENE = {
  people: [
    { id: 'father', x: -0.62, z: -2.36, h: 1.69 },
    { id: 'mother', x: 0.02, z: -2.26, h: 1.57 },
    { id: 'daughter', x: 0.64, z: -2.32, h: 1.63 },
  ],
  stone: { x: 0.67, y: 0.81, z: -3.56 },       // 円石の中心（photo3d.js の絵の奥行きと同じ計算。高さ約1.6m・幅約2.1m）
  spots: [{ x: -0.9, y: 1.45, z: 0.45 }, { x: 0, y: 1.45, z: 0.6 }, { x: 0.9, y: 1.45, z: 0.45 }],   // 立ち位置（ご家族から約3m）
  start: { spot: 1, yaw: -0.16, pitch: -4 * Math.PI / 180, zoom: 0.85 },   // 最初はわざと寄りすぎ・左向き
  fov: (zoom, aspect) => (aspect > 1 ? 38 - zoom * 18 : 50 - zoom * 24),   // zoom 0〜1 → たての画角
  maxYaw: (fov, aspect) => Math.max(0, 33 - Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect) * 180 / Math.PI) * Math.PI / 180,
  pitchRange: (fov) => [(-29 + fov / 2) * Math.PI / 180, (21 - fov / 2) * Math.PI / 180],
};

// 点 p を、カメラ cam（x,y,z,yaw,pitch,fov,aspect）から見た画面の位置（-1〜1）に
export function project(cam, p) {
  const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  // 向き：yaw=0 で -z を見る。yaw が正だと右（+x）を向く（photo3d.js と同じ）
  const x1 = dx * cy + dz * sy;          // 右
  const fh = dx * sy - dz * cy;          // 水平の前
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const y2 = dy * cp - fh * sp;          // 上
  const f2 = dy * sp + fh * cp;          // 前
  if (f2 <= 0.01) return { x: 9, y: 9 };
  const t = Math.tan(cam.fov / 2 * Math.PI / 180);
  return { x: x1 / (f2 * t * cam.aspect), y: y2 / (f2 * t) };
}
const inFrame = (q) => Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1;

export function judgeFrame(cam) {
  let heads = 0, feet = 0;
  for (const p of PHOTO_SCENE.people) {
    if (inFrame(project(cam, { x: p.x, y: p.h - 0.06, z: p.z }))) heads++;
    if (inFrame(project(cam, { x: p.x, y: 0.05, z: p.z }))) feet++;
  }
  const stone = inFrame(project(cam, PHOTO_SCENE.stone));
  // 大きさ：いちばん引いた（ズーム0）ときと比べて、何倍に写っているか。縦長でも横長でも、つまみの真ん中あたりがちょうどよい
  const fov0 = PHOTO_SCENE.fov(0, cam.aspect);
  const size = Math.tan(fov0 / 2 * Math.PI / 180) / Math.tan(cam.fov / 2 * Math.PI / 180);
  const sizeOk = size >= CONFIG.photo.sizeMin && size <= CONFIG.photo.sizeMax;
  return { heads, feet, stone, size, sizeOk };
}

// ---------------- ゲーム本体 ----------------
// on: { beat(b), scene(id), flag(id), perk(p), finish() } は画面側の演出用
export function createGame({ config = CONFIG, random = Math.random, on = {} } = {}) {
  let carry = 0;
  const emit = (name, ...a) => { if (on[name]) on[name](...a); };
  const rr = (a, b) => a + random() * (b - a);

  const g = {
    config,
    phase: 'title',          // title → play → result
    index: -1,               // STORY の何番目か
    beat: null,              // いま出ているビート
    sceneId: null,
    flags: {},
    picks: {},               // 問いごとに選んだ答え（何番目か）
    perks: [],               // 集めた働く魅力カード
    asked: [],               // 調理場で聞いたこと
    explained: null,         // 夕食で伝えたひとこと（KITCHEN_Q の id。あいまいなら null）
    hospitality: 0,          // 料理の説明・サプライズの成功
    look: 'f',               // あなたの姿（f / m）
    elapsed: 0,
    sceneTime: 0,
    log: [],
    walk: null, drink: null, chop: null, photo: null, sur: null,
    hint: null,              // 先輩のヒント（画面に出す文字）

    start(look = 'f') {
      Object.assign(g, {
        phase: 'play', index: -1, beat: null, sceneId: null, flags: {}, picks: {}, perks: [], asked: [], explained: null, hospitality: 0,
        look, elapsed: 0, sceneTime: 0, log: [], walk: null, drink: null, chop: null, photo: null, sur: null, hint: null,
      });
      carry = 0;
      g.next();
    },

    setFlag(id) {
      if (!g.flags[id]) { g.flags[id] = true; emit('flag', id); }
    },
    addPerk(id) {
      if (g.perks.includes(id)) return;
      g.perks.push(id);
      emit('perk', PERKS.find((p) => p.id === id));
    },

    // 次のビートへ（when が合わないものは飛ばす）
    next() {
      if (g.phase !== 'play') return;
      for (;;) {
        g.index += 1;
        const b = STORY[g.index];
        if (!b) { g.finish(); return; }
        if (b.when && !b.when(g)) continue;
        if (b.t === 'scene') { g.sceneId = b.id; g.sceneTime = 0; g.hint = null; emit('scene', b.id); continue; }
        let beat = b;
        if (b.t === 'choice' && b.options === 'explain') beat = { ...b, options: explainOptions(g) };
        if (b.t === 'react') {
          const q = KITCHEN_Q.find((x) => x.id === g.explained);
          beat = q ? { t: 'line', who: q.react[0], text: q.react[1] } : { t: 'line', who: 'father', text: 'ふむ。……きれいな料理だね。' };
        }
        g.beat = beat;
        g.hint = null;
        if (b.t === 'walk') g.walk = { p: 0, f: -1.6, m: -1.2, d: -0.9, holding: false, far: 0, farNow: 0, stopLeft: 0, stopped: false, done: false };
        if (b.t === 'serve') g.drink = { served: [], left: config.drink.seconds, talked: {}, started: false };
        if (b.t === 'chopsticks') g.chop = { flipped: { father: false, mother: false, daughter: false }, t: 0, done: false };
        if (b.t === 'surprise') g.sur = makeSurprise();
        if (b.t === 'photo') g.photo = makePhoto();
        if (b.perk) g.addPerk(b.perk);
        g.log.push({ at: g.elapsed, t: b.t, who: b.who, id: b.id });
        emit('beat', g.beat);
        return;
      }
    },

    // せりふ・カード・お祝いの箸・温泉を読み終えた
    tap() {
      if (g.phase !== 'play' || !g.beat) return;
      if (['line', 'card', 'gift', 'bath'].includes(g.beat.t)) g.next();
    },

    // 気づきの印をタップ（気づいたことを記録するだけ。選ぶのはこのあと）
    tapNotice(id) { g.log.push({ at: g.elapsed, notice: id }); g.flags['saw_' + id] = true; },

    // 選ぶ
    choose(i) {
      const b = g.beat;
      if (!b || b.t !== 'choice') return;
      const o = b.options[i];
      if (!o) return;
      if (o.flag) g.setFlag(o.flag);
      g.picks[b.id] = i;
      if (b.id === 'explain') { g.explained = o.q || null; if (o.good) g.hospitality += 1; }
      g.log.push({ at: g.elapsed, choose: b.id, i });
      g.next();
    },

    // 調理場：3つのうち2つ聞く
    ask(id) {
      if (!g.beat || g.beat.t !== 'kitchen' || g.asked.includes(id)) return;
      g.asked.push(id);
      emit('asked', id);
      if (g.asked.length >= 2) g.next();
    },

    // お出迎え：押している間だけ歩く
    hold(on) { if (g.walk) g.walk.holding = !!on; },

    // ロビー：ドリンクをお出しする（3人分）
    serve(who) {
      const d = g.drink;
      if (!d || g.beat?.t !== 'serve' || d.served.includes(who)) return;
      d.served.push(who);
      if (d.served.length >= 3) { d.started = true; g.next(); }
    },
    // ロビー：飲み終えるまでの間（話す・ご案内する）
    drinkTalk(kind) { const d = g.drink; if (d) d.talked[kind] = true; },
    guide() {
      const d = g.drink;
      if (!d || g.beat?.t !== 'drink') return;
      if (d.left <= 0) g.setFlag('drink');
      g.next();
    },

    // 205号室のサプライズ
    light(i) {
      const s = g.sur;
      if (!s || s.stage !== 'candle' || s.lit[i]) return;
      s.lit[i] = true;
      if (s.lit.every(Boolean)) { s.stage = 'wait'; s.waitT = 0; }
    },
    bringCake() {   // ケーキを運ぶ
      const s = g.sur;
      if (!s || s.stage !== 'wait') return;
      s.stage = 'done';
      s.result = s.signal ? 'perfect' : s.look ? 'seen' : 'early';
      if (s.signal) { g.setFlag('surprise'); g.hospitality += 1; }
      g.next();
    },

    // 朝食：お箸の向きを変える
    flip(seat) {
      const c = g.chop;
      if (!c || c.done) return;
      c.flipped[seat] = !c.flipped[seat];
    },
    chopDone() {
      const c = g.chop;
      if (!c || c.done) return;
      c.done = true;
      const f = c.flipped;
      if (f.mother && !f.father && !f.daughter) g.setFlag('lefty');
      c.wrongOthers = f.father || f.daughter;   // 右利きの方の箸先を右にしてしまった
      g.next();
    },

    // 記念写真
    photoCall() { const p = g.photo; if (p && !p.shot) { p.callAt = p.t; emit('photo'); } },
    // cam: { spot(0-2), yaw, pitch, zoom(0-1), aspect }
    shoot(camIn) {
      const p = g.photo;
      if (!p || p.shot) return null;
      const s = PHOTO_SCENE.spots[camIn.spot ?? 1];
      const cam = { ...s, yaw: camIn.yaw ?? 0, pitch: camIn.pitch ?? 0, aspect: camIn.aspect ?? 0.8, fov: PHOTO_SCENE.fov(camIn.zoom ?? 0.35, camIn.aspect ?? 0.8) };
      const f = judgeFrame(cam);
      const shot = { ...f, mood: g.photoMood(), at: p.t };
      p.tries.push(shot);
      emit('photo');
      return shot;
    },
    photoKeep() {   // この1枚に決める
      const p = g.photo;
      if (!p || !p.tries.length) return;
      p.shot = p.tries[p.tries.length - 1];
      g.next();
    },
    // いまのご家族の様子：'smile'（こちらを向いて笑顔）／'blink'（お父さまがまばたき）／'off'（よそ見をしている：お母さまは紅葉、娘さまは手もとのバッグを見ている）
    photoMood() {
      const p = g.photo;
      if (!p || p.callAt == null) return 'off';
      const since = p.t - p.callAt;
      if (since < config.photo.reactDelay || since > config.photo.reactDelay + config.photo.smileHold) return 'off';
      return p.blinking ? 'blink' : 'smile';
    },

    // 実際に過ぎた時間を受け取り、一定の刻みでルールを進める
    advance(realDt) {
      if (g.phase !== 'play') return;
      carry += Math.min(realDt, MAX_CATCH_UP);
      while (carry >= STEP && g.phase === 'play') { g.step(STEP); carry -= STEP; }
    },

    step(dt) {
      g.elapsed += dt;
      g.sceneTime += dt;
      const b = g.beat;
      if (!b) return;
      // ドリンクは、ご案内の前の「間」で減っていく（それまでのお話の間は、まだたっぷり残っている）
      if (g.drink?.started && b.t === 'drink') g.drink.left = Math.max(0, g.drink.left - dt);
      if (b.t === 'walk') stepWalk(dt);
      if (b.t === 'chopsticks') {
        const c = g.chop; c.t += dt;
        if (!c.done && c.t > config.chopsticks.hintAfter) g.hint = '昨日の夕食で、お母さまがお箸をどうしていたか、覚えてる？';
        if (!c.done && c.t > config.chopsticks.giveUpAfter) g.chopDone();
      }
      if (b.t === 'surprise') stepSurprise(dt);
      if (b.t === 'photo') stepPhoto(dt);
    },

    // テスト用：その場面のはじめまで飛ぶ（flags で立てたい気づきを渡せる）
    skipTo(sceneId, flags = {}) {
      const i = STORY.findIndex((b) => b.t === 'scene' && b.id === sceneId);
      if (i < 0) return;
      if (g.phase !== 'play') g.start(g.look);
      Object.assign(g.flags, flags);
      g.index = i - 1; g.walk = g.drink = g.chop = g.photo = g.sur = null;
      g.next();
    },

    finish() {
      g.phase = 'result';
      g.beat = null;
      emit('finish');
    },

    // ふり返りの中身
    result() {
      const got = KIZUKI.filter((k) => g.flags[k.id]);
      const shot = g.photo?.shot;
      const photoPts = shot ? (shot.heads === 3) + shot.stone + (shot.mood === 'smile') + shot.sizeOk : 0;
      const smile = got.length + g.hospitality + photoPts;        // 0〜12
      // 最後の写真のお客さまの表情：タイミングが合っていれば笑顔、気づきが多いほど大きな笑顔
      const face = !shot || shot.mood === 'off' ? 'off' : shot.mood === 'blink' ? 'blink' : got.length >= 4 ? 'big' : 'smile';
      return { got: got.map((k) => k.id), count: got.length, perks: g.perks.slice(), hospitality: g.hospitality, photoPts, smile, face, shot, surprise: !!g.flags.surprise, onsen: !!g.flags.onsen };
    },
  };

  function stepWalk(dt) {
    const w = g.walk, c = config.walk;
    if (w.done) return;
    if (w.holding) w.p = Math.min(c.length, w.p + c.playerSpeed * dt);
    // お父さまは杖でゆっくり。段差でさらにゆっくり、廊下の生け花の前で少し足を止める
    let fs = c.fatherSpeed;
    for (const [a, b2, s] of c.slow) if (w.f > a && w.f < b2) fs = s;
    if (!w.stopped && w.f >= c.stopAt) { w.stopped = true; w.stopLeft = c.stopFor; }
    if (w.stopLeft > 0) { w.stopLeft -= dt; fs = 0; }
    const want = (gap) => Math.max(0, w.p - gap);
    w.f = Math.min(want(1.3), w.f + fs * dt);
    w.m = Math.min(want(0.9), Math.max(w.f + 0.5, w.m), w.m + 1.0 * dt);   // お母さまはお父さまのそば
    w.d = Math.min(want(0.6), w.d + 1.1 * dt);
    const gap = w.p - w.f;
    if (gap > c.farGap) { w.far += dt; w.farNow += dt; } else w.farNow = 0;
    g.hint = w.farNow > c.hintAfter ? 'うしろ、見て！ お父さまが遅れてるよ' : (w.stopLeft > 0 && gap < c.farGap ? 'お父さま、生け花を見ていらっしゃるね' : null);
    if (w.p >= c.length && w.f >= c.length - 1.4) {
      w.done = true;
      if (w.far <= c.farLimit) g.setFlag('pace');
      g.next();
    }
  }

  function makeSurprise() {
    const c = config.surprise;
    return { stage: 'candle', lit: [false, false, false], waitT: 0, signal: false, nextSignal: rr(...c.firstSignal), signalLeft: 0, signals: 0,
      look: false, nextLook: rr(...c.firstLook), lookLeft: 0, result: null };
  }
  function stepSurprise(dt) {
    const s = g.sur, c = config.surprise;
    if (s.stage !== 'wait') return;
    s.waitT += dt;
    if (s.look) { s.lookLeft -= dt; if (s.lookLeft <= 0) { s.look = false; s.nextLook = s.nextSignal + rr(1.2, 2); } }
    else if (s.signal) { s.signalLeft -= dt; if (s.signalLeft <= 0) { s.signal = false; s.nextSignal = s.waitT + rr(...c.every); s.nextLook = s.nextSignal - rr(1.4, 1.9); } }
    else if (s.waitT >= s.nextLook && s.waitT < s.nextSignal - 0.4) { s.look = true; s.lookLeft = c.lookLen; }
    else if (s.waitT >= s.nextSignal) { s.signal = true; s.signalLeft = c.signalLen; s.signals += 1; }
    g.hint = s.waitT > c.hintAfter && !s.signal ? '中島さまの目くばせが、運ぶ合図だよ' : null;
  }

  function makePhoto() {
    return { t: 0, callAt: null, blinking: false, nextBlink: 1 + random() * 1.5, blinkLeft: 0, tries: [], shot: null };
  }
  function stepPhoto(dt) {
    const p = g.photo, c = config.photo;
    p.t += dt;
    if (p.blinking) { p.blinkLeft -= dt; if (p.blinkLeft <= 0) p.blinking = false; }
    else if (p.t >= p.nextBlink) {
      p.blinking = true; p.blinkLeft = c.blinkLen;
      p.nextBlink = p.t + c.blinkEvery[0] + random() * (c.blinkEvery[1] - c.blinkEvery[0]);
    }
  }

  return g;
}
