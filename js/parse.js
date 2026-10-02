// 붙여넣은 텍스트를 섹션별 구조로 정리
const Parse = (() => {
  const REF = String.raw`\d+\s*[:：]\s*\d+(?:\s*[~\-–～]\s*\d+)?`;
  const HEAD_LINE = new RegExp(`^[^\\d\\s].{0,40}?${REF}$`); // '레위인과 제사장의 임무 16:37~40'
  const HEAD_GLUED = new RegExp(`^([^\\d\\s].{0,40}?${REF})\\s+(.+)$`); // 제목 뒤에 본문이 붙은 경우
  const ENDS_SENTENCE = /[.?!。？！]["'”’」』)\]]*$/;
  const IS_QUESTION = /[?？]["'”’」』)\]]*$/;

  function clean(raw) {
    return String(raw || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ ​﻿]/g, ' ')
      .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  const lines = (raw) => clean(raw).split('\n').filter(Boolean);

  // ── 줄바꿈 이어 붙이기 ──
  // 화면 너비대로 끊겨 복사된 글은 다음 줄이 조사·어미로 시작하면 앞말에 붙여야 함 ('섬기\n게' → '섬기게')
  const SUFFIX_TOKEN = new RegExp('^(?:들)?(?:' + [
    '은', '는', '가', '을', '를', '에', '에서', '에게', '에게서', '께', '께서', '의', '와', '과', '도', '만', '로', '으로',
    '부터', '까지', '마다', '처럼', '보다', '대로', '같이', '만큼', '라도', '이라도', '에도', '에는', '에서는', '로서', '으로서', '으로써', '나', '이나', '며', '이며', '요', '이요', '다', '이다', '라', '이라', '라고', '이라고',
    '게', '고', '지', '면', '서', '니', '까', '여', '어', '아', '야', '든지', '뿐', '밖에', '조차', '마저',
    '입니다', '이니', '습니다', '니다', '시고', '시며', '신', '심',
  ].join('|') + ')["\'”’」』)\\],.?!…]*$');
  // '하다·되다' 꼴: '감사\n하게' 는 붙이고, '섬기게\n합니다' 처럼 앞말이 어미로 끝나면 띄움
  const VERB_TOKEN = /^(?:하|했|하였|하시|하셨|되|됐|되었|된|될|됨|됩|한|할|함|합)[가-힣]*["'”’」』)\],.?!…]*$/;
  const ENDS_WITH_ENDING = /[게고지도서어아여를을이가은는에로와과의며면니다요]$/;
  const ENDS_HANGUL = /[가-힣]$/;
  const startsNewItem = (l) => /^(\d{1,3}\s|[-–•·▪◦*]\s)/.test(l);
  // 단어 중간에서 끊긴 경우('하\n나님', '왕\n조')를 알아보기 위한 큐티 글에 자주 나오는 단어
  const WORDS = (
    '하나님 하나님의 예수님 예수 그리스도 여호와 주님 성령 성부 성자 삼위일체 메시아 구세주 구원자 창조주 ' +
    '이스라엘 예루살렘 유다 다윗 솔로몬 사울 모세 아브라함 이삭 야곱 요셉 엘리야 엘리사 이사야 예레미야 에스겔 다니엘 ' +
    '바울 베드로 요한 야고보 마리아 나단 사무엘 여호수아 아삽 헤만 여두둔 오벧에돔 사독 기브온 바벨론 애굽 블레셋 ' +
    '왕조 왕국 왕위 왕권 성전 성막 제단 번제 번제단 제사 제사장 대제사장 레위인 선지자 언약 언약궤 율법 계명 규례 ' +
    '말씀 기도 찬양 찬송 예배 경배 성도 교회 공동체 제자 복음 구원 은혜 사랑 믿음 소망 순종 회개 용서 진리 생명 ' +
    '영원 영원히 영광 거룩 거룩한 임재 약속 축복 감사 묵상 섭리 주권 경건 고난 평강 평안 기쁨 겸손 인자 긍휼 자비 ' +
    '십자가 부활 천국 하늘 하늘나라 세상 백성 나라 민족 열방 이방인 자녀 아버지 어머니 아들 딸 형제 자매 조상 후손 ' +
    '마음 영혼 육체 인생 사람 사람들 우리 그들 자신 무엇 어떻게 왜냐하면 그러나 그리고 그러므로 그래서 하지만 ' +
    '날마다 항상 오늘 내일 어제 지금 모든 함께 다시 오직 바로 이제 결국 비로소 반드시 ' +
    '문지기 찬양대 악기 나팔 제금 수금 비파 휘장 장막 궁전 백향목 성소 지성소 산당 광야 ' +
    '하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열 스물 서른 마흔 쉰 백 천 만 ' +
    '어린양 목자 양 떼 열매 씨앗 포도나무 반석 등불 소금'
  ).split(' ').filter((w) => w.length >= 2);

  // 혼자서도 단어로 쓰이는 한 글자 (이 글자로 끝나거나 시작하면 잘린 조각으로 보지 않음)
  const SINGLE_WORDS = new Set((
    '그 이 저 내 네 제 너 나 왕 집 땅 날 때 일 것 수 더 또 곧 잘 다 못 안 참 큰 한 온 새 각 몇 주 줄 말 몸 맘 ' +
    '눈 손 발 귀 입 길 밤 낮 해 달 별 물 불 피 옷 양 소 떼 성 문 산 강 금 은 돈 빛 숨 꿈 힘 뜻 죄 복 벌 상 법 약 ' +
    '꽃 열 칠 백 천 만 등 및 왜 늘 꼭 좀 막 궤 단 떡 잔 칼 활 창 배 곳 쪽 편 끝 앞 뒤 위 밑 옆 속 중 간 번 분 ' +
    '년 시 장 절 권 책 글 곡 술 꿀 젖 뼈 혀 뭇 즉 오 아 저 첫 두 세 네 전 후 매 총 ' +
    '종 신 돌 흙 벗 적 빚 겉 틈 값 맛 덕 정 혼 영 육 의 악 선 굴 털 뿔 벽 탑 들 쌀 ' +
    '갈 올 볼 줄 알 될 살 할 쓸 설 와 가 봐 줘 해 돼 된 함 간 온 본 둔 준 산 든 난 찬 갈 잘 빈 옳 좋'
  ).split(' '));

  const HANGUL_ONLY = /^[가-힣]+/;
  const lastToken = (s) => (s.split(' ').pop().match(/[가-힣]+$/) || [''])[0];
  const firstToken = (s) => (s.split(' ')[0].match(HANGUL_ONLY) || [''])[0];

  // 이어 붙였을 때 사전 단어가 줄바꿈을 가로지르는지 ('하'+'나님' → 하나님)
  function spansDictWord(prev, next) {
    const a = lastToken(prev), b = firstToken(next);
    if (!a || !b) return false;
    const joined = a + b;
    return WORDS.some((w) => w.length > a.length && w.startsWith(a) && joined.startsWith(w));
  }

  function isSplitWord(prev, next) {
    const a = lastToken(prev), b = firstToken(next);
    if (!a || !b) return false;
    // ① 사전 단어가 줄바꿈을 가로지르면 붙임
    if (spansDictWord(prev, next)) return true;
    // ② 줄 끝/처음에 남은 한 글자가 혼자 쓰이는 단어가 아니면 잘린 조각으로 봄
    const prevWord = prev.split(' ').pop();
    const nextWord = next.split(' ')[0];
    if (a.length === 1 && prevWord === a && !SINGLE_WORDS.has(a)) return true;
    if (b.length === 1 && nextWord === b && !SINGLE_WORDS.has(b)) return true;
    return false;
  }

  // 동사가 끊겨 다음 줄이 활용 어미로 시작하는 경우 ('이루\n어질', '되\n었고', '받\n으시고')
  const VERB_CONT = /^(?:[었았였겠셨]|[어아여](?:지|질|진|짐|져|서|야|도|라|요|주|준|줄|줌|있|본|보|버|내|놓|두|오)|으(?:시|셔|며|면|니|나|러|려|므|신|실|심))/;
  const NOT_VERB_CONT = /^(아버|아내|아주|여주)/; // 어미처럼 보이지만 실제로는 단어인 것

  // 줄 이음을 판단할 수 있는 자리인지 (앞줄이 한글로 끝나고, 다음 줄이 새 항목이 아닐 때)
  const canJoin = (prev, next) => ENDS_HANGUL.test(prev) && !startsNewItem(next);

  // 문법상 확실한 붙임 (정밀 교정(Kiwi)을 쓸 때도 항상 적용)
  function strongJoin(prev, next) {
    if (!canJoin(prev, next)) return false;
    const token = next.split(' ')[0];
    // 앞말이 시제·높임 선어말어미로 끝나면 단어가 끝날 수 없음 ('지었\n고', '지키겠\n다고', '하셨\n다')
    if (/[었았였겠셨]$/.test(prev)) return true;
    // '세워\n지고', '이루어\n지다': 앞말이 '-어/-아/-여'로 끝나고 다음 줄이 '지-/져-'로 시작
    // ('은혜와\n진리', '여호와\n지키시는' 처럼 조사 '와' 뒤나 '진리·지혜' 같은 단어는 제외)
    if (/[어아여워춰줘봐]$/.test(prev) && /^(지(?:[고다며면니는기게도]|$)|져|졌)/.test(token)) return true;
    return spansDictWord(prev, next);
  }

  // 규칙만으로 판단 (정밀 교정을 쓰지 않을 때)
  function shouldJoin(prev, next) {
    if (!canJoin(prev, next)) return false;
    if (strongJoin(prev, next)) return true;
    const token = next.split(' ')[0];
    if (SUFFIX_TOKEN.test(token)) return true;
    if (VERB_CONT.test(token) && !NOT_VERB_CONT.test(token)) return true;
    if (VERB_TOKEN.test(token) && !ENDS_WITH_ENDING.test(prev)) return true;
    return isSplitWord(prev, next);
  }
  const joinTwo = (a, b) => (shouldJoin(a, b) ? a + b : a + ' ' + b);
  const joinLines = (ls) => ls.reduce((acc, l) => (acc ? joinTwo(acc, l) : l), '').replace(/ {2,}/g, ' ').trim();

  // 수정 화면에서 탭으로 고칠 수 있는 '줄이 바뀐 자리' 목록 (clean된 글 기준 위치)
  function junctions(raw) {
    const c = clean(raw);
    const out = [];
    let start = 0;
    const ls = c.split('\n');
    for (let i = 0; i < ls.length - 1; i++) {
      start += ls[i].length;
      const prev = ls[i], next = ls[i + 1];
      if (prev && next && !startsNewItem(next) && !HEAD_LINE.test(prev) && !HEAD_LINE.test(next)) {
        out.push({ pos: start, line: i, prev, next, join: shouldJoin(prev, next), strong: strongJoin(prev, next), judgeable: canJoin(prev, next) });
      }
      start += 1; // '\n'
    }
    return out;
  }
  // 사용자가 탭으로 바꾼 자리만 붙임('') 또는 띄움(' ')으로 확정. 나머지 줄바꿈은 그대로 둠
  function applyJunctions(raw, decisions) {
    const c = clean(raw);
    let out = '', last = 0;
    junctions(c).forEach((j, i) => {
      const d = decisions && decisions[i];
      if (typeof d !== 'boolean' || d === j.join) return;
      out += c.slice(last, j.pos) + (d ? '' : ' ');
      last = j.pos + 1;
    });
    return out + c.slice(last);
  }

  // 문장 끝(. ? !) 뒤에 공백이 올 때만 나눔 → '말입니다....하나님', '“영원하다.”라고' 는 나누지 않음
  function sentences(text) {
    const out = [];
    const re = /[.?!。？！]+["'”’」』)\]]*(?=\s)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      out.push(text.slice(last, end).trim());
      last = end;
    }
    const rest = text.slice(last).trim();
    if (rest) out.push(rest);
    return out.filter(Boolean);
  }

  // 빈 줄 기준 문단 → 문단마다 문장 배열. '- '로 시작하는 줄은 목록 항목(li)으로 따로 나눔
  const BULLET = /^[-–•·▪◦*]\s+(.+)$/;
  function paragraphs(raw) {
    const groups = [];
    for (const block of clean(raw).split(/\n\s*\n/)) {
      let cur = null;
      for (const l of block.split('\n')) {
        const b = l.match(BULLET);
        if (b || !cur) { cur = { li: !!b, lines: [] }; groups.push(cur); }
        cur.lines.push(b ? b[1] : l);
      }
    }
    return groups.map((g) => {
      const p = sentences(joinLines(g.lines));
      p.li = g.li;
      return p;
    }).filter((p) => p.length);
  }

  const normRef = (s) => s.replace(/\s*[:：]\s*/g, ':').replace(/\s*[~～\-–]\s*/g, '~');

  function header(raw) {
    const ls = lines(raw);
    if (!ls.length) return { range: '', title: '' };
    const refRe = new RegExp(REF);
    const i = ls.findIndex((l) => refRe.test(l));
    if (i === -1) return { range: '', title: joinLines(ls) };
    let range = ls[i];
    const rest = ls.filter((_, j) => j !== i);
    const glued = range.match(new RegExp(`^(.*?${REF})\\s+(.+)$`));
    if (glued) { range = glued[1]; rest.unshift(glued[2]); }
    return { range: normRef(range), title: joinLines(rest) };
  }

  // 성경 본문: 소제목 + 절 번호 단위
  function scripture(raw) {
    const chunks = []; // {h} | {text}
    for (const l of lines(raw)) {
      if (HEAD_LINE.test(l) && !/^\d/.test(l)) { chunks.push({ h: normRef(l) }); continue; }
      const g = l.match(HEAD_GLUED);
      if (g && /^\d{1,3}\s*\S/.test(g[2])) { chunks.push({ h: normRef(g[1]) }, { text: g[2] }); continue; }
      const prev = chunks[chunks.length - 1];
      // 절 번호로 시작하는 줄은 새 덩어리로 (번호가 건너뛰어도 절로 인정하기 위해)
      if (prev && 'text' in prev && !/^\d{1,3}\s/.test(l)) prev.text = joinTwo(prev.text, l); else chunks.push({ text: l });
    }
    const blocks = [];
    let cur = null; // 마지막 절 번호
    for (const c of chunks) {
      if (c.h) {
        blocks.push({ t: 'h', text: c.h });
        // 소제목의 절 범위(17:7~15)로 다음 절 번호(7)를 맞춤
        const r = c.h.match(/:(\d+)(?:~\d+)?$/);
        if (r) cur = Number(r[1]) - 1;
        continue;
      }
      const text = c.text.replace(/ {2,}/g, ' ');
      const re = /(^|\s)(\d{1,3})(?=\s*[^\d\s:~.,])/g;
      const cuts = [];
      let m;
      while ((m = re.exec(text))) {
        const n = Number(m[2]);
        const at = m.index + m[1].length;
        // 첫 절은 번호 그대로, 그다음부터는 이어지는 번호(이전 + 1)만 절로 인정
        // 단, 줄 맨 앞의 번호는 앞 절보다 크기만 하면 인정 (일부만 복사한 경우)
        if (cur === null || n === cur + 1 || (at === 0 && n > cur)) { cuts.push({ n, at, len: m[2].length }); cur = n; }
      }
      if (!cuts.length) {
        const last = blocks[blocks.length - 1];
        if (last && last.t === 'v') last.text += ' ' + text; else blocks.push({ t: 'h', text });
        continue;
      }
      const lead = text.slice(0, cuts[0].at).trim();
      if (lead) {
        const last = blocks[blocks.length - 1];
        if (last && last.t === 'v') last.text += ' ' + lead; else blocks.push({ t: 'h', text: lead });
      }
      cuts.forEach((c2, k) => {
        const end = k + 1 < cuts.length ? cuts[k + 1].at : text.length;
        blocks.push({ t: 'v', n: c2.n, text: text.slice(c2.at + c2.len, end).trim() });
      });
    }
    return blocks;
  }

  // 첫 줄이 소제목인지 판단해 분리
  function splitHeading(raw) {
    const c = clean(raw);
    const nl = c.indexOf('\n');
    const first = nl === -1 ? c : c.slice(0, nl);
    const rest = nl === -1 ? '' : c.slice(nl + 1);
    if (rest && (HEAD_LINE.test(first) || (first.length <= 30 && !ENDS_SENTENCE.test(first)))) {
      return { heading: normRefTail(first), body: rest };
    }
    const g = first.match(HEAD_GLUED);
    if (g) return { heading: normRefTail(g[1]), body: g[2] + (rest ? '\n' + rest : '') };
    return { heading: '', body: c };
  }
  const normRefTail = (s) => s.replace(new RegExp(`${REF}$`), (r) => normRef(r));

  // 본문 해설 파트: 소제목 / 해설 문단 / 끝의 질문 문장들
  function commentary(raw) {
    const { heading, body } = splitHeading(raw);
    const paras = paragraphs(body);
    const question = [];
    const total = paras.reduce((a, p) => a + p.length, 0);
    while (paras.length) {
      const p = paras[paras.length - 1];
      if (!IS_QUESTION.test(p[p.length - 1]) || question.length + 1 >= total) break;
      question.unshift(p.pop());
      if (!p.length) paras.pop();
    }
    return { heading, paras, question };
  }

  // 묵상 에세이: 제목 / 본문 / 출처(책/저자_출판사)
  function essay(raw) {
    const { heading, body } = splitHeading(raw);
    const ls = clean(body).split('\n');
    let source = '';
    const last = ls[ls.length - 1] || '';
    if (ls.length > 1 && last.includes('/') && last.length <= 60 && !ENDS_SENTENCE.test(last)) {
      source = last.replace(/\s*\/\s*/g, ' / ').replace(/\s*_\s*/g, ' · ');
      ls.pop();
    }
    return { heading, paras: paragraphs(ls.join('\n')), source };
  }

  // 한절 묵상: '역대상 16장 39~40절 | 본문'
  function oneVerse(raw) {
    const c = clean(raw);
    const m = c.match(/^([^|｜\n]{2,40}?)\s*[|｜]\s*([\s\S]+)$/) || c.match(/^(\S+\s*\d+\s*장\s*[\d~\-–\s]+절)\s*([\s\S]+)$/);
    return m ? { ref: m[1].trim(), paras: paragraphs(m[2]) } : { ref: '', paras: paragraphs(c) };
  }

  // 오늘의 명언: 마지막 '- 인물' 줄 분리
  function quote(raw) {
    const ls = clean(raw).split('\n');
    let author = '';
    const m = (ls[ls.length - 1] || '').match(/^[-–—―~]\s*(.+)$/);
    if (ls.length > 1 && m) { author = m[1]; ls.pop(); }
    return { paras: [sentences(joinLines(ls.filter(Boolean)))].filter((p) => p.length), author };
  }

  // 두란노 웹 「오늘의 QT」에서 한 번에 복사한 글 → 헤더 / 성경 본문 / 묵상 도우미 / 오늘의 기도로 나눔
  const WEB_JUNK = [
    /^본문\s*말씀$/, /^글씨\s*(크게|작게)$/, /^오늘의\s*찬송/, /^역본\s*선택/, /^\(새\s*\d+.*\)$/,
    /명이\s*아멘하셨습니다/, /^아멘하기/, /^QT\s*다이어리/, /^Copyright/i, /^QT\s*페이지\s*콘텐츠/,
    /^본문\s*해설,/, /^자세한\s*내용은/, /^\d{2}\.\d{2}$/, /^\d{4}\.\d{2}\.\d{2}/,
  ];
  const HELPER_MARK = /^묵상\s*도우미$/;
  const PRAYER_MARK = /^오늘의\s*기도$/;
  const isVerseLine = (l) => /^\d{1,3}\s/.test(l);

  // 웹 페이지의 버튼 문구: 휴대폰에서 복사하면 한 줄로 붙거나 표현이 달라질 수 있어 문구 단위로 지움
  const WEB_UI_PHRASES = /(본문\s*말씀|(말씀|글씨|글자)\s*크기(\s*(크게|작게))*|(글씨|글자|말씀)\s*(크게|작게)|(?:^|\s)(크게|작게)(?=\s|$))/g;

  function webBundle(raw) {
    let ls = clean(raw).split('\n');
    // 버튼 문구는 성경 본문(첫 절)보다 위쪽에만 있음 → 기도 속 '크게' 같은 말은 건드리지 않음
    const firstVerse = ls.findIndex(isVerseLine);
    ls = ls.map((l, i) => (firstVerse !== -1 && i >= firstVerse ? l : l.replace(WEB_UI_PHRASES, ' ').replace(/ {2,}/g, ' ').trim()));
    // 오늘의 찬송 가사 블록('오늘의 찬송' ~ '역본 선택') 제거
    const hymn = ls.findIndex((l) => /^오늘의\s*찬송/.test(l));
    if (hymn !== -1) {
      const ver = ls.findIndex((l, i) => i > hymn && /^역본\s*선택/.test(l));
      if (ver !== -1) ls.splice(hymn, ver - hymn + 1);
      else {
        const t = ls.findIndex((l, i) => i > hymn && /^\(새\s*\d+/.test(l));
        if (t !== -1) ls.splice(t, 1 + ls.slice(t + 1).findIndex(Boolean) + 1);
      }
    }
    ls = ls.filter((l) => !WEB_JUNK.some((r) => r.test(l)));
    // 페이지 아래쪽(회사 정보 등)까지 선택된 경우 잘라냄
    const footer = ls.findIndex((l) => /^(패밀리사이트|회사소개)/.test(l) || /저작권의 보호를 받고/.test(l));
    if (footer !== -1) ls = ls.slice(0, footer);
    const iHelper = ls.findIndex((l) => HELPER_MARK.test(l));
    const iPrayer = ls.findIndex((l) => PRAYER_MARK.test(l));
    if (iHelper === -1 && iPrayer === -1) return null;

    const bodyEnd = [iHelper, iPrayer].filter((i) => i !== -1).sort((a, b) => a - b)[0];
    const top = ls.slice(0, bodyEnd);
    const refRe = new RegExp(REF);
    let header = '';
    let bodyStart = top.findIndex((l) => refRe.test(l) || isVerseLine(l));
    const iRange = top.findIndex((l) => refRe.test(l));
    // 첫 번째 범위 줄 다음이 절이 아니면 그 줄은 '말씀 범위', 이어지는 줄은 '오늘의 제목'
    if (iRange !== -1 && iRange === bodyStart && top[iRange + 1] && !isVerseLine(top[iRange + 1])) {
      const next = top.findIndex((l, i) => i > iRange && (refRe.test(l) || isVerseLine(l)));
      const end = next === -1 ? top.length : next;
      header = top.slice(iRange, end).filter(Boolean).join('\n');
      bodyStart = end;
    }
    const scriptureText = bodyStart === -1 ? '' : top.slice(bodyStart).filter(Boolean).join('\n');

    const section = (from, to) => (from === -1 ? '' : ls.slice(from + 1, to === -1 || to < from ? ls.length : to).filter(Boolean).join('\n'));
    return {
      header,
      scripture: scriptureText,
      helper: section(iHelper, iPrayer),
      prayer: section(iPrayer, iHelper > iPrayer ? iHelper : -1),
    };
  }

  // 두플러스 생명의삶 웹큐티를 통째로 복사한 글 → 모든 섹션으로 나눔
  // 구분 제목: 성경 본문 / 오늘의 말씀 요약 / 본문 해설 / 오늘의 기도 / 묵상 에세이 / 한절 묵상 / 오늘의 명언
  const DU_MARKS = {
    hymn: /^오늘의\s*찬송$/,
    scripture: /^성경\s*본문$/,
    helper: /^묵상\s*도우미$/,
    summary: /^오늘의\s*말씀\s*요약$/,
    comm: /^본문\s*해설$/,
    prayer: /^오늘의\s*기도$/,
    essay: /^묵상\s*에세이$/,
    oneverse: /^한절\s*묵상$/,
    quote: /^오늘의\s*명언$/,
    mccheyne: /^맥체인/,
  };
  // 탭 이름이나 페이지 아래쪽 안내처럼 내용이 아닌 줄 (여기서 섹션이 끝남)
  const DU_STOP = /^(말씀|해설|에세이|아멘|묵상 완료|노트 쓰기|공지사항)$|명이 아멘하고|모바일 QT 앱|큐티 챌린지|서비스 이용약관|Copyright/;

  function duplusBundle(raw) {
    const ls = clean(raw).split('\n').map((l) => l.trim()).filter(Boolean);
    const at = {};
    for (const [k, re] of Object.entries(DU_MARKS)) at[k] = ls.findIndex((l) => re.test(l));
    if (at.scripture === -1 || (at.comm === -1 && at.essay === -1 && at.summary === -1)) return null;

    const markIdx = Object.values(at).filter((i) => i !== -1).sort((a, b) => a - b);
    const sectionLines = (k) => {
      if (at[k] === -1) return [];
      const end = markIdx.find((i) => i > at[k]) ?? ls.length;
      const out = [];
      for (const l of ls.slice(at[k] + 1, end)) {
        if (DU_STOP.test(l)) break;
        out.push(l);
      }
      return out;
    };

    // 머리글: 맨 처음 나오는 '책 장:절' 줄이 범위, 그다음 줄들이 오늘의 제목
    const first = Math.min(...[at.hymn, at.scripture].filter((i) => i !== -1));
    const refRe = /^[가-힣]+\s*\d+\s*[:：]\s*\d+/;
    const iRange = ls.findIndex((l, i) => i < first && refRe.test(l));
    let header = '';
    if (iRange !== -1) {
      const title = [];
      for (const l of ls.slice(iRange + 1, first)) { if (DU_STOP.test(l)) break; title.push(l); }
      header = [ls[iRange], ...title].join('\n');
    }

    // 본문 해설: 소제목('… 17:16~22')마다 한 파트
    const comm = [];
    for (const l of sectionLines('comm')) {
      if (HEAD_LINE.test(l)) comm.push([l]);
      else if (comm.length) comm[comm.length - 1].push(l);
      else comm.push([l]);
    }
    const commTexts = comm.map((p) => p[0] + '\n' + p.slice(1).join('\n\n'));

    // 성경 본문: 절 번호 줄 + 본문 줄 → '16 본문'. 해설 소제목의 절 범위로 성경 본문에도 소제목을 넣음
    const heads = comm.map((p) => p[0]).filter((h) => HEAD_LINE.test(h))
      .map((h) => ({ h, start: Number((h.match(/:\s*(\d+)/) || [])[1]) }));
    const verses = [];
    const sl = sectionLines('scripture');
    for (let i = 0; i < sl.length; i++) {
      if (/^\d{1,3}$/.test(sl[i]) && sl[i + 1] !== undefined) { verses.push({ n: Number(sl[i]), text: sl[i + 1] }); i++; }
      else if (/^\d{1,3}\s/.test(sl[i])) verses.push({ n: Number(sl[i].split(' ')[0]), text: sl[i].replace(/^\d{1,3}\s*/, '') });
      else if (verses.length) verses[verses.length - 1].text += ' ' + sl[i];
    }
    const scriptureLines = [];
    for (const v of verses) {
      const h = heads.find((x) => x.start === v.n);
      if (h) scriptureLines.push(h.h);
      scriptureLines.push(`${v.n} ${v.text}`);
    }

    // 맨 위의 '2026.10.02 금요일' → 그날 페이지에 넣기 위한 날짜
    const dm = ls.slice(0, first).join(' ').match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
    const date = dm ? `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}` : '';

    const prose = (k) => sectionLines(k).join('\n\n');
    return {
      date,
      header,
      scripture: scriptureLines.join('\n'),
      helper: sectionLines('helper').join('\n'),
      summary: prose('summary'),
      comm: commTexts,
      prayer: prose('prayer'),
      essay: (() => { const e = sectionLines('essay'); return e.length > 1 ? [e[0], e.slice(1, -1).join('\n\n'), e[e.length - 1]].filter(Boolean).join('\n') : e.join('\n'); })(),
      oneverse: sectionLines('oneverse').join(' '),
      quote: sectionLines('quote').join('\n'),
    };
  }

  // '역대상 16:37~43' → { book:'역대상', chapter:'16' }
  function bookChapter(range) {
    const m = String(range || '').match(/^(.+?)\s*(\d+)\s*:/);
    return m ? { book: m[1].trim(), chapter: m[2] } : null;
  }

  return { clean, sentences, paragraphs, header, scripture, commentary, essay, oneVerse, quote, bookChapter, junctions, applyJunctions, webBundle, duplusBundle, strongJoin };
})();
