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
  const joinLines = (ls) => ls.join(' ').replace(/ {2,}/g, ' ').trim();

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

  // 빈 줄 기준 문단 → 문단마다 문장 배열
  function paragraphs(raw) {
    return clean(raw).split(/\n\s*\n/).map((p) => sentences(joinLines(p.split('\n')))).filter((p) => p.length);
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
      if (prev && 'text' in prev) prev.text += ' ' + l; else chunks.push({ text: l });
    }
    const blocks = [];
    let cur = null; // 마지막 절 번호
    for (const c of chunks) {
      if (c.h) { blocks.push({ t: 'h', text: c.h }); continue; }
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

  function mcCheyne(raw) {
    return clean(raw).split(/[□☐■▢✓✔,，、\n]+/).map((s) => s.trim()).filter(Boolean);
  }

  // '역대상 16:37~43' → { book:'역대상', chapter:'16' }
  function bookChapter(range) {
    const m = String(range || '').match(/^(.+?)\s*(\d+)\s*:/);
    return m ? { book: m[1].trim(), chapter: m[2] } : null;
  }

  return { clean, sentences, paragraphs, header, scripture, commentary, essay, oneVerse, quote, mcCheyne, bookChapter };
})();
