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
    '부터', '까지', '마다', '처럼', '보다', '나', '이나', '며', '이며', '요', '이요', '다', '이다', '라', '이라', '라고', '이라고',
    '게', '고', '지', '면', '서', '니', '까', '여', '어', '아', '야', '든지', '뿐', '밖에', '조차', '마저',
    '입니다', '이니', '습니다', '니다', '시고', '시며', '신', '심',
  ].join('|') + ')["\'”’」』)\\],.?!…]*$');
  // '하다·되다' 꼴: '감사\n하게' 는 붙이고, '섬기게\n합니다' 처럼 앞말이 어미로 끝나면 띄움
  const VERB_TOKEN = /^(?:하|했|하였|하시|하셨|되|됐|되었|된|될|됨|됩|한|할|함|합)[가-힣]*["'”’」』)\],.?!…]*$/;
  const ENDS_WITH_ENDING = /[게고지도서어아여를을이가은는에로와과의며면니다요]$/;
  const ENDS_HANGUL = /[가-힣]$/;
  const startsNewItem = (l) => /^(\d{1,3}\s|[-–•·▪◦*]\s)/.test(l);
  function shouldJoin(prev, next) {
    if (!ENDS_HANGUL.test(prev) || startsNewItem(next)) return false;
    const token = next.split(' ')[0];
    if (SUFFIX_TOKEN.test(token)) return true;
    return VERB_TOKEN.test(token) && !ENDS_WITH_ENDING.test(prev);
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
        out.push({ pos: start, join: shouldJoin(prev, next) });
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
      if (prev && 'text' in prev) prev.text = joinTwo(prev.text, l); else chunks.push({ text: l });
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
        if (cur === null || n === cur + 1) { cuts.push({ n, at, len: m[2].length }); cur = n; }
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

  function webBundle(raw) {
    let ls = clean(raw).split('\n');
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

  // '역대상 16:37~43' → { book:'역대상', chapter:'16' }
  function bookChapter(range) {
    const m = String(range || '').match(/^(.+?)\s*(\d+)\s*:/);
    return m ? { book: m[1].trim(), chapter: m[2] } : null;
  }

  return { clean, sentences, paragraphs, header, scripture, commentary, essay, oneVerse, quote, bookChapter, junctions, applyJunctions, webBundle };
})();
