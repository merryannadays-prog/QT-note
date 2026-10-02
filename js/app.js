// 나의 큐티노트 — 화면 렌더링과 동작
(() => {
  const $app = document.getElementById('app');
  const $penbar = document.getElementById('penbar');
  const $toast = document.getElementById('toast');
  const $importFile = document.getElementById('importFile');

  const DUPLUS_URL = 'https://www.du.plus/?main=true';
  // 안드로이드에서는 두플러스 앱(com.duranno.durannoplus)을 바로 실행. 앱이 없으면 플레이스토어로 이동
  const DUPLUS_APP = 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;'
    + 'package=com.duranno.durannoplus;'
    + 'S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.duranno.durannoplus') + ';end';
  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  const WEB_TIP = '맨 위 카드에 두플러스 큐티 전체를 붙여넣으면 한 번에 채워져요.';
  const WEB_KEYS = ['header', 'scripture', 'prayer'];
  const WEB_NAMES = { header: '말씀 범위·제목', scripture: '성경 본문', prayer: '오늘의 기도' };

  // 하루 페이지의 섹션 순서 (divider = 그룹 구분 제목)
  const LAYOUT = [
    { id: 'scripture', label: '성경 본문', type: 'scripture', hint: `소제목과 절 번호가 있는 본문 전체를 붙여넣어 주세요. ${WEB_TIP}` },
    { id: 'summary', label: '오늘의 말씀 요약', type: 'prose' },
    { divider: '본문 해설' },
    { id: 'comm', label: '본문 해설', type: 'commentary', repeat: true, hint: '소제목부터 마무리 질문까지 한 파트씩 붙여넣어 주세요' },
    { id: 'prayer', label: '오늘의 기도', type: 'prose', hint: `'오늘의 기도' 내용을 붙여넣어 주세요. ${WEB_TIP}` },
    { divider: '묵상 에세이' },
    { id: 'essay', label: '묵상 에세이', type: 'essay', hint: '제목, 본문, 참고 도서 줄까지 붙여넣어 주세요' },
    { id: 'oneverse', label: '한절 묵상', type: 'oneverse' },
    { id: 'quote', label: '오늘의 명언', type: 'quote', hint: '명언과 “- 인물” 줄까지 붙여넣어 주세요' },
    { id: 'card', label: '오늘의 기도 카드', type: 'card' },
  ];
  const ORDER = { scripture: 0, summary: 2, prayer: 40, essay: 50, oneverse: 51, quote: 52 };
  const orderOf = (sid) => (sid.startsWith('comm') ? 10 + Number(sid.slice(4)) : ORDER[sid] ?? 99);
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  const S = {
    date: null,
    day: null,
    pen: 'y',
    editing: new Set(),   // 수정 중인 섹션 id
    folded: new Set(),    // 접은 섹션 id
    expanded: false,      // 마친 날에 본문을 펼쳤는지
    jn: {},               // 수정 중인 섹션의 줄 이음 선택 { sid: [true|false|undefined, ...] }
    calMonth: null,       // 캘린더에서 보고 있는 달 (Date, 1일)
    saveTimer: null,
  };

  // ───────── 유틸 ─────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayKey = () => keyOf(new Date());
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (k) => { const d = parseKey(k); return `${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())}`; };
  const weekday = (k) => WEEK[parseKey(k).getDay()] + '요일';

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 2000);
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // ───────── 데이터 ─────────
  const emptyDay = (date) => ({
    date,
    raw: { header: '', scripture: '', summary: '', comm: [''], prayer: '', essay: '', oneverse: '', quote: '' },
    marks: [],   // { k, c, t, l, o }
    note: '',
    finished: false,
  });

  const getRaw = (sid) => (sid.startsWith('comm') ? S.day.raw.comm[Number(sid.slice(4))] || '' : S.day.raw[sid] || '');
  function setRaw(sid, v) {
    if (sid.startsWith('comm')) S.day.raw.comm[Number(sid.slice(4))] = v;
    else S.day.raw[sid] = v;
  }
  const hasAnyContent = (d) => Object.entries(d.raw).some(([k, v]) => k !== 'header' && (Array.isArray(v) ? v.some(Boolean) : v));
  const isWorthSaving = (d) => hasAnyContent(d) || d.raw.header || d.note.trim() || d.marks.length;

  function save(immediate = false) {
    clearTimeout(S.saveTimer);
    const day = S.day;
    const run = () => (isWorthSaving(day) ? DB.saveDay(day) : DB.deleteDay(day.date)).catch((e) => toast('저장 실패: ' + e.message));
    if (immediate) return run();
    S.saveTimer = setTimeout(run, 400);
  }

  function flush() {
    if (S.saveTimer && S.day) save(true);
  }

  // ───────── 라우팅 ─────────
  async function route() {
    flush();
    const h = location.hash;
    const m = h.match(/^#\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (m) return showDay(m[1]);
    if (h === '#/calendar') return showCalendar();
    location.replace('#/day/' + todayKey());
  }

  // ───────── 하루 페이지 ─────────
  async function showDay(date) {
    const stored = await DB.getDay(date);
    S.date = date;
    S.day = Object.assign(emptyDay(date), stored || {});
    if (!Array.isArray(S.day.raw.comm) || !S.day.raw.comm.length) S.day.raw.comm = [''];
    S.editing.clear();
    S.folded.clear();
    S.expanded = false;
    renderDay();
    window.scrollTo(0, 0);
  }

  function renderDay() {
    const d = S.day;
    const collapsed = d.finished && !S.expanded;
    $app.innerHTML = `
      <div class="${d.finished ? 'finished' : ''}">
        ${renderHero()}
        ${collapsed ? renderFoldedCard() : `<div class="content">${renderContent()}${d.finished ? `<button class="fold-again" data-act="refold">${icon('chevronDown')} 본문 접기</button>` : ''}</div>`}
        ${renderMine()}
      </div>`;
    $app.querySelectorAll('textarea').forEach(autoGrow);
    updatePenbar();
  }

  function renderHero() {
    const d = S.day;
    const h = Parse.header(d.raw.header);
    const editing = S.editing.has('header');
    let body;
    if (!d.raw.header || editing) {
      body = pasteBox('header', { label: '말씀 범위 · 오늘의 제목', hint: '예) 역대상 16:37~43 / 날마다 이어 갈 영적 예배. 아래 카드에 두플러스 큐티 전체를 붙여넣으면 함께 채워져요.', hero: true });
    } else {
      body = `<div class="hero-body">
        ${h.range ? `<h1 class="hero-range">${esc(h.range)}</h1>` : ''}
        ${h.title ? `<p class="hero-title">${esc(h.title)}</p>` : ''}
        <button class="edit-btn" data-act="edit" data-sid="header" aria-label="수정">${icon('pencil')}</button>
      </div>`;
    }
    return `<header class="hero">
      <div class="topbar">
        <button class="back" data-act="calendar">${icon('chevronLeft')} 캘린더</button>
        ${d.finished ? `<span class="badge-done">${icon('check')} 큐티 완료</span>` : ''}
      </div>
      <div class="hero-date">${icon('sun')} ${fmtDate(d.date)} · ${weekday(d.date)}</div>
      ${body}
    </header>`;
  }

  function renderFoldedCard() {
    const h = Parse.header(S.day.raw.header);
    return `<button class="folded-card appear" data-act="expand">
      <span class="fc-ic">${icon('book')}</span>
      <span><small>오늘의 말씀</small><b>${esc(h.range || '본문 보기')}</b></span>
      <span class="fc-go">펼치기 ${icon('chevronDown')}</span>
    </button>`;
  }

  function renderContent() {
    const out = [];
    const finished = S.day.finished;
    if (!finished && !S.day.raw.scripture) out.push(renderWebCard());
    for (const cfg of LAYOUT) {
      if (cfg.divider) { out.push(`<h2 class="divider">${cfg.divider}</h2>`); continue; }
      if (cfg.repeat) {
        const parts = S.day.raw.comm;
        parts.forEach((_, i) => out.push(renderSection(cfg, `comm${i}`, i)));
        if (parts[parts.length - 1] && !finished) {
          out.push(`<button class="add-part" data-act="add-part">${icon('plus')} 해설 파트 추가</button>`);
        }
        continue;
      }
      out.push(renderSection(cfg, cfg.id));
    }
    // 마친 날 펼쳐볼 때는 비어 있는 섹션과 그 그룹 제목을 숨김
    return out.filter(Boolean).join('').replace(/<h2 class="divider">[^<]*<\/h2>(?=<h2|$)/g, '');
  }

  function renderSection(cfg, sid, partIdx = 0) {
    const raw = cfg.type === 'card' ? S.day.raw.prayer : getRaw(sid);
    const editing = S.editing.has(sid);
    const folded = S.folded.has(sid) ? ' folded' : '';

    if (cfg.type === 'card') {
      if (!raw) return '';
      return `<section class="sec${folded}" id="sec-card">${label(cfg.label, sid, false)}<div class="sec-body">${renderCard()}</div></section>`;
    }
    if (!raw || editing) {
      if (S.day.finished && !editing) return '';
      const name = cfg.repeat ? `${cfg.label} ${partIdx + 1}` : cfg.label;
      return `<section class="sec" id="sec-${sid}">${pasteBox(sid, { label: name, hint: cfg.hint || `'${cfg.label}' 내용을 붙여넣어 주세요` })}</section>`;
    }

    const U = unitMaker(sid, cfg);
    const editBtn = `<button class="edit-btn" data-act="edit" data-sid="${sid}" aria-label="수정">${icon('pencil')}</button>`;

    switch (cfg.type) {
      case 'scripture': {
        const bc = Parse.bookChapter(Parse.header(S.day.raw.header).range);
        const blocks = Parse.scripture(raw).map((b) =>
          b.t === 'h'
            ? `<h3 class="sh">${shText(b.text)}</h3>`
            : `<div class="verse"><span class="vn">${b.n}</span><span class="vt">${U(b.text, bc ? `${bc.book} ${bc.chapter}:${b.n}` : `${b.n}절`, 'vt')}</span></div>`
        ).join('');
        return sec(sid, folded, label(cfg.label, sid, true), blocks);
      }
      case 'prose':
        return sec(sid, folded, label(cfg.label, sid, true), `<div class="prose">${paras(Parse.paragraphs(raw), U, cfg.label)}</div>`);
      case 'commentary': {
        const c = Parse.commentary(raw);
        const l = c.heading ? `본문 해설 · ${c.heading.replace(/\s*\d+:\d+(~\d+)?$/, '')}` : '본문 해설';
        const head = c.heading
          ? `<div class="sh-row"><h3 class="sh">${shText(c.heading)}</h3>${editBtn}</div>`
          : `<div class="sh-row"><span class="sh"></span>${editBtn}</div>`;
        const body = paras(c.paras, U, l); // 본문 → 질문 순서로 번호를 매겨야 모은 말씀 순서가 맞음
        const q = c.question.length
          ? `<div class="q"><div class="q-label">${icon('sparkle')} 생각해 볼 질문</div><p>${c.question.map((s) => U(s, l)).join(' ')}</p></div>`
          : '';
        return `<section class="sec" id="sec-${sid}">${head}<div class="prose">${body}</div>${q}</section>`;
      }
      case 'essay': {
        const e = Parse.essay(raw);
        return sec(sid, folded, label(cfg.label, sid, true), `
          ${e.heading ? `<h3 class="essay-title">${esc(e.heading)}</h3>` : ''}
          <div class="prose">${paras(e.paras, U, '묵상 에세이')}</div>
          ${e.source ? `<div class="source">${icon('book')}<span>${esc(e.source)}</span></div>` : ''}`);
      }
      case 'oneverse': {
        const o = Parse.oneVerse(raw);
        return sec(sid, folded, label(cfg.label, sid, true), `
          ${o.ref ? `<span class="ref-chip">${icon('bookmark')} ${esc(o.ref)}</span>` : ''}
          <div class="prose">${paras(o.paras, U, '한절 묵상')}</div>`);
      }
      case 'quote': {
        const q = Parse.quote(raw);
        return sec(sid, folded, label(cfg.label, sid, true), `
          <div class="quote">${icon('quote')}${q.paras.map((p) => `<p>${p.map((s) => U(s, '오늘의 명언' + (q.author ? ` · ${q.author}` : ''))).join(' ')}</p>`).join('')}
          ${q.author ? `<div class="author">— ${esc(q.author)}</div>` : ''}</div>`);
      }
    }
    return '';
  }

  const sec = (sid, folded, labelHtml, body) => `<section class="sec${folded}" id="sec-${sid}">${labelHtml}<div class="sec-body">${body}</div></section>`;

  function label(text, sid, editable) {
    return `<div class="sec-label"><i class="dot"></i>
      <button class="sec-toggle" data-act="toggle" data-sid="${sid}">${esc(text)} ${icon('chevronDown')}</button>
      ${editable ? `<button class="edit-btn" data-act="edit" data-sid="${sid}" aria-label="수정">${icon('pencil')}</button>` : ''}
    </div>`;
  }

  // '레위인과 제사장의 임무 16:37~40' → 제목 + 민트색 절 범위
  function shText(t) {
    const m = t.match(/^(.*?)\s*(\d+:\d+(?:~\d+)?)$/);
    return m && m[1] ? `${esc(m[1])} <span class="ref">${esc(m[2])}</span>` : esc(t);
  }

  function paras(list, U, l) {
    return list.map((p) => `<p${p.li ? ' class="li"' : ''}>${p.map((s) => U(s, l)).join(' ')}</p>`).join('');
  }

  // 웹에서 한 번에 가져오기 카드 (두플러스 웹큐티 / 두란노 「오늘의 QT」)
  function renderWebCard() {
    return `<section class="webqt" id="sec-web">
      <div class="paste-head"><span class="pic">${icon('globe')}</span>
        <div><b>오늘 큐티 한 번에 붙여넣기</b><small>두플러스 큐티를 통째로 복사해 붙여넣으면 모든 칸이 알아서 채워져요</small></div></div>
      <ol class="webqt-steps">
        <li>아래 버튼으로 두플러스를 열고 오늘 큐티로 이동</li>
        <li>날짜부터 오늘의 명언까지 전체 선택해서 복사</li>
        <li>돌아와서 아래 칸에 붙여넣기</li>
      </ol>
      ${IS_ANDROID
        ? `<a class="btn btn-primary webqt-clip" href="${DUPLUS_APP}">${icon('external')} 두플러스 앱 열기</a>`
        : `<a class="btn btn-primary webqt-clip" href="${DUPLUS_URL}" target="_blank" rel="noopener">${icon('external')} 두플러스 큐티 열기</a>`}
      ${pasteBox('web', { label: '복사한 내용 붙여넣기', hint: '한 번에 붙여넣으면 아래 칸들이 채워져요' })}
    </section>`;
  }

  // 수정 화면의 '줄이 바뀐 자리' 미리보기: 점을 탭해서 붙임/띄움을 바꿈
  function renderJunctions(sid, text) {
    const c = Parse.clean(text);
    const js = Parse.junctions(c);
    if (!js.length) return '';
    const dec = S.jn[sid] || [];
    let html = '', last = 0;
    js.forEach((j, i) => {
      const join = typeof dec[i] === 'boolean' ? dec[i] : j.join;
      html += esc(c.slice(last, j.pos)).replace(/\n/g, '<br>');
      html += `<button type="button" class="jn ${join ? 'is-join' : 'is-gap'}" data-act="jn" data-sid="${sid}" data-i="${i}" aria-label="${join ? '붙임' : '띄움'}"></button>`;
      last = j.pos + 1;
    });
    html += esc(c.slice(last)).replace(/\n/g, '<br>');
    return `<div class="jn-help">줄이 바뀐 자리예요. 띄어쓰기가 틀린 곳의 점을 탭하세요
      <span><i class="jn-key is-join"></i>붙임 <i class="jn-key is-gap"></i>띄움</span></div>
      <div class="jn-text">${html}</div>`;
  }

  function refreshJunctions(sid) {
    const box = document.querySelector(`.paste[data-sid="${sid}"] .jn-box`);
    const ta = document.querySelector(`.paste[data-sid="${sid}"] textarea`);
    if (box && ta) box.innerHTML = renderJunctions(sid, ta.value);
  }

  // 형광펜을 칠할 수 있는 단위(span) 생성기
  function unitMaker(sid, cfg) {
    let i = 0;
    const marks = new Map(S.day.marks.map((m) => [m.k, m.c]));
    return (text, l) => {
      const k = `${sid}:${i++}`;
      const c = marks.get(k);
      return `<span class="u" data-k="${k}" data-l="${esc(l || cfg.label)}"${c ? ` data-c="${c}"` : ''}>${esc(text)}</span>`;
    };
  }

  function renderCard() {
    const d = S.day;
    const h = Parse.header(d.raw.header);
    const text = Parse.paragraphs(d.raw.prayer).map((p) => p.join(' ')).join(' ');
    return `<div class="pcard">
      <span class="pcard-date">${fmtDate(d.date).replace(/\./g, '')}</span>
      ${h.range ? `<div class="pcard-range">${esc(h.range)}</div>` : ''}
      ${icon('quote', 'qm')}
      <p>${esc(text)}</p>
      <div class="pcard-foot">${icon('sprout')} 나의 큐티노트</div>
    </div>`;
  }

  function pasteBox(sid, { label: name, hint, hero = false }) {
    const editing = S.editing.has(sid);
    const raw = getRawAny(sid);
    return `<div class="paste${hero ? ' paste--hero' : ''}${editing ? ' editing' : ''}${raw ? ' has-text' : ''}" data-sid="${sid}">
      <div class="paste-head"><span class="pic">${icon(editing ? 'pencil' : 'clipboard')}</span>
        <div><b>${esc(name)}</b><small>${esc(editing ? '오타를 고친 뒤 저장을 눌러 주세요' : hint)}</small></div></div>
      <textarea class="paste-ta" rows="2" placeholder="이곳을 길게 눌러 붙여넣기">${esc(raw)}</textarea>
      ${editing && sid !== 'header' ? `<div class="jn-box">${renderJunctions(sid, raw)}</div>` : ''}
      <div class="paste-actions">
        ${editing ? `<button class="btn btn-danger" data-act="clear" data-sid="${sid}">비우기</button><button class="btn btn-ghost" data-act="cancel" data-sid="${sid}">취소</button>` : ''}        <button class="btn btn-soft" data-act="clip" data-sid="${sid}">${icon('clipboard')} 붙여넣기</button>
        <button class="btn btn-primary btn-done" data-act="done" data-sid="${sid}">${editing ? '저장' : '완료'}</button>
      </div>
    </div>`;
  }
  const getRawAny = (sid) => (sid === 'header' ? S.day.raw.header : sid === 'web' ? '' : getRaw(sid));

  // ───────── 나의 영역 (모은 말씀 + 노트) ─────────
  function renderMine() {
    const d = S.day;
    return `<section class="mine" id="mine">
      <div class="mine-eyebrow">${icon('highlighter')} MY QT</div>
      <h2 class="mine-h">오늘 모은 말씀 ${d.marks.length ? `<span class="count">${d.marks.length}</span>` : ''}</h2>
      <div class="col-list" id="colList">${renderCollected()}</div>

      <div class="note-wrap">
        <div class="mine-eyebrow">${icon('sprout')} NOTE</div>
        <h2 class="mine-h">나의 묵상 노트</h2>
        <p class="note-sub">${fmtDate(d.date)} ${weekday(d.date)}</p>
        <div class="paper">
          <textarea class="note-ta" id="note" placeholder="오늘 말씀을 통해 받은 은혜를 적어 보세요">${esc(d.note)}</textarea>
          <span class="saved" id="saved">저장됨</span>
          ${ART_NOTE}
        </div>
      </div>

      ${d.finished
        ? `<div class="finished-note">${icon('heart')}${signHtml(getSign())}오늘의 큐티를 마쳤어요<br><button data-act="reopen">다시 이어서 하기</button></div>`
        : `<button class="finish" data-act="finish">${icon('check')} 오늘 큐티 마치기</button>`}
    </section>`;
  }

  function renderCollected() {
    const marks = [...S.day.marks].sort((a, b) => a.o - b.o);
    if (!marks.length) {
      return `<div class="col-empty">${ART_EMPTY}본문의 문장을 톡 누르면<br>형광펜과 함께 이곳에 차곡차곡 모여요</div>`;
    }
    return `<div class="col-card">${marks.map((m) => `<div class="col-item" data-c="${m.c}" data-act="goto" data-k="${m.k}">
      <div class="col-src"><i></i>${esc(m.l)}</div>
      <div class="col-text"><span class="mark" data-c="${m.c}">${esc(m.t)}</span></div>
      <button class="col-del" data-act="unmark" data-k="${m.k}" aria-label="형광펜 지우기">${icon('x')}</button>
    </div>`).join('')}</div>`;
  }

  // ───────── 서명 설정 ─────────
  const SIGN_MAX = 10;
  function getSign() {
    try { return localStorage.getItem('qt-sign') || ''; } catch (_) { return ''; }
  }
  function setSign(v) {
    try { localStorage.setItem('qt-sign', v); } catch (_) { toast('이 브라우저에서는 설정을 저장할 수 없어요'); }
  }
  // 한글이 들어가면 한글 손글씨체, 아니면 영문 필기체
  function signHtml(name, preview = false) {
    if (!name) return preview ? '<span class="sign empty">서명이 여기에 표시돼요</span>' : '';
    return `<span class="sign${/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(name) ? ' ko' : ''}">${esc(name)}</span>`;
  }

  function openSettings() {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="설정">
      <div class="sheet-grip"></div>
      <h2>설정</h2>
      <label class="field-label" for="signInput">나의 서명 <small id="signCount">0/${SIGN_MAX}</small></label>
      <input class="field" id="signInput" maxlength="${SIGN_MAX}" placeholder="한나 또는 Hannah" value="${esc(getSign())}" autocomplete="off">
      <p class="field-help">큐티를 마친 날, 하트 아래에 필기체로 연하게 표시돼요. 한글이나 영어로 ${SIGN_MAX}자까지 쓸 수 있어요.</p>
      <div class="sign-preview">${icon('heart')}<div id="signPreview"></div></div>

      <div class="sheet-actions">
        <button class="btn btn-ghost" data-sheet="cancel">취소</button>
        <button class="btn btn-primary" data-sheet="save">저장</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
    const input = bg.querySelector('#signInput');
    const sync = () => {
      bg.querySelector('#signPreview').innerHTML = signHtml(input.value.trim(), true);
      bg.querySelector('#signCount').textContent = `${input.value.length}/${SIGN_MAX}`;
    };
    sync();
    input.addEventListener('input', sync);
    bg.addEventListener('click', (e) => {
      const act = e.target.closest('[data-sheet]')?.dataset.sheet;
      if (e.target === bg || act === 'cancel') bg.remove();
      if (act === 'save') {
        setSign(input.value.trim().slice(0, SIGN_MAX));
        bg.remove();
        toast(input.value.trim() ? '서명을 저장했어요' : '서명을 지웠어요');
      }
    });
  }

  function refreshCollected() {
    const list = document.getElementById('colList');
    if (list) list.innerHTML = renderCollected();
    const h = document.querySelector('#mine .mine-h');
    if (h) h.innerHTML = `오늘 모은 말씀 ${S.day.marks.length ? `<span class="count">${S.day.marks.length}</span>` : ''}`;
  }

  // ───────── 형광펜 ─────────
  function toggleMark(el) {
    if (!S.pen) { toast('아래에서 형광펜 색을 골라 주세요'); return; }
    const k = el.dataset.k;
    const marks = S.day.marks;
    const i = marks.findIndex((m) => m.k === k);
    if (i >= 0 && marks[i].c === S.pen) {
      marks.splice(i, 1);
      el.removeAttribute('data-c');
    } else if (i >= 0) {
      marks[i].c = S.pen;
      el.dataset.c = S.pen;
    } else {
      const [sid, idx] = k.split(':');
      marks.push({ k, c: S.pen, t: el.textContent, l: el.dataset.l, o: orderOf(sid) * 1000 + Number(idx) });
      el.dataset.c = S.pen;
      if (navigator.vibrate) navigator.vibrate(8);
    }
    refreshCollected();
    save();
  }

  function unmark(k) {
    S.day.marks = S.day.marks.filter((m) => m.k !== k);
    const el = document.querySelector(`.u[data-k="${k}"]`);
    if (el) el.removeAttribute('data-c');
    refreshCollected();
    save();
  }

  function gotoUnit(k) {
    const find = () => document.querySelector(`.u[data-k="${k}"]`);
    if (!find()) {
      if (S.day.finished && !S.expanded) { S.expanded = true; renderDay(); }
      const sid = k.split(':')[0];
      if (S.folded.delete(sid)) renderDay();
    }
    const el = find();
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function updatePenbar() {
    const onDay = !!S.day && location.hash.startsWith('#/day/');
    const contentVisible = onDay && !(S.day.finished && !S.expanded) && hasAnyContent(S.day);
    const typing = document.activeElement && document.activeElement.tagName === 'TEXTAREA';
    const mine = document.getElementById('mine');
    const inMine = mine && mine.getBoundingClientRect().top < window.innerHeight * 0.6; // 모은 말씀·노트 영역에서는 숨김
    $penbar.hidden = !contentVisible || typing || inMine;
    $penbar.querySelectorAll('.pen').forEach((b) => b.classList.toggle('on', (b.dataset.pen || null) === S.pen));
  }

  // ───────── 붙여넣기 · 수정 ─────────
  // 섹션이 바뀌어도 화면 위치가 튀지 않도록 기준 요소의 위치를 유지
  function rerenderKeeping(anchorSel) {
    const before = document.querySelector(anchorSel);
    const top = before ? before.getBoundingClientRect().top : null;
    renderDay();
    const after = document.querySelector(anchorSel);
    if (after && top !== null) window.scrollBy(0, after.getBoundingClientRect().top - top);
    return after;
  }

  // 웹에서 통째로 복사한 글을 칸마다 나눠 넣음 (두플러스 웹큐티 / 두란노 「오늘의 QT」)
  const ALL_NAMES = { ...WEB_NAMES, summary: '말씀 요약', comm: '본문 해설', essay: '묵상 에세이', oneverse: '한절 묵상', quote: '오늘의 명언' };
  function distributeWeb(b) {
    const has = (k) => (Array.isArray(b[k]) ? b[k].some(Boolean) : !!b[k]);
    const current = (k) => (k === 'comm' ? S.day.raw.comm.filter(Boolean).join('\n\n') : getRawAny(k));
    const incoming = (k) => (k === 'comm' ? b.comm.map(Parse.clean).join('\n\n') : Parse.clean(b[k]));
    const keys = Object.keys(ALL_NAMES).filter((k) => k in b && has(k));
    if (!keys.length) { toast('나눠 넣을 내용을 찾지 못했어요'); return; }
    const overwrite = keys.filter((k) => current(k) && current(k) !== incoming(k));
    if (overwrite.length && !confirm(`이미 내용이 있는 칸(${overwrite.map((k) => ALL_NAMES[k]).join(', ')})을 새 내용으로 바꿀까요?`)) return;
    keys.forEach((k) => {
      if (current(k) === incoming(k)) return;
      if (k === 'header') S.day.raw.header = incoming(k);
      else if (k === 'comm') {
        S.day.raw.comm = b.comm.map(Parse.clean).filter(Boolean);
        S.day.marks = S.day.marks.filter((m) => !m.k.startsWith('comm'));
      } else {
        setRaw(k, incoming(k));
        S.day.marks = S.day.marks.filter((m) => !m.k.startsWith(k + ':'));
      }
    });
    S.editing.clear();
    renderDay();
    save();
    toast(keys.length > 4 ? '오늘 큐티를 한 번에 채웠어요' : `${keys.map((k) => ALL_NAMES[k]).join(', ')}을 채웠어요`);
  }

  function commit(sid, text) {
    // 두플러스 웹큐티 전체를 붙여넣었으면 모든 칸에 나눠 넣음 (어느 칸에 붙여넣어도 됨)
    if (sid === 'web' || !S.editing.has(sid)) {
      const du = Parse.duplusBundle(text);
      if (du) { distributeWeb(du); return; }
    }
    // 웹 「오늘의 QT」를 통째로 붙여넣었으면 칸마다 나눠 넣음
    if (sid === 'web' || (WEB_KEYS.includes(sid) && !S.editing.has(sid))) {
      const bundle = Parse.webBundle(text);
      if (bundle) { distributeWeb(bundle); return; }
      if (sid === 'web') { toast("'묵상 도우미'나 '오늘의 기도'까지 함께 복사해 주세요"); return; }
    }
    const v = Parse.clean(text);
    if (!v) { toast('붙여넣은 내용이 없어요'); return; }
    if (v !== getRawAny(sid)) {
      if (sid === 'header') S.day.raw.header = v;
      else {
        setRaw(sid, v);
        S.day.marks = S.day.marks.filter((m) => !m.k.startsWith(sid + ':'));
      }
    }
    S.editing.delete(sid);
    const el = rerenderKeeping(sid === 'header' ? '.hero' : `#sec-${sid}`);
    if (el && sid !== 'header') el.classList.add('appear');
    save();
  }

  function clearSection(sid) {
    if (!confirm('이 섹션의 내용을 비울까요? (칠한 형광펜도 함께 지워져요)')) return;
    if (sid === 'header') S.day.raw.header = '';
    else if (sid.startsWith('comm') && S.day.raw.comm.length > 1) {
      // 해설 파트는 통째로 제거하고 뒤 파트의 형광펜 번호를 당김
      const idx = Number(sid.slice(4));
      S.day.raw.comm.splice(idx, 1);
      S.day.marks = S.day.marks
        .filter((m) => !m.k.startsWith(sid + ':'))
        .map((m) => {
          const [s, u] = m.k.split(':');
          if (!s.startsWith('comm') || Number(s.slice(4)) < idx) return m;
          const ns = `comm${Number(s.slice(4)) - 1}`;
          return { ...m, k: `${ns}:${u}`, o: orderOf(ns) * 1000 + Number(u) };
        });
    } else {
      setRaw(sid, '');
      S.day.marks = S.day.marks.filter((m) => !m.k.startsWith(sid + ':'));
    }
    S.editing.delete(sid);
    renderDay();
    save();
  }

  async function pasteFromClipboard(sid) {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { /* 권한 거부 등 */ }
    const box = document.querySelector(`.paste[data-sid="${sid}"]`);
    if (!text) {
      toast('입력칸을 길게 눌러 붙여넣기 해 주세요');
      box?.querySelector('textarea')?.focus();
      return;
    }
    if (S.editing.has(sid)) {
      const ta = box.querySelector('textarea');
      ta.value = text;
      autoGrow(ta);
      box.classList.add('has-text');
      S.jn[sid] = [];
      refreshJunctions(sid);
    } else commit(sid, text);
  }

  // ───────── 캘린더 페이지 ─────────
  async function showCalendar() {
    S.day = null;
    updatePenbar();
    const days = await DB.listDays();
    const map = new Map(days.map((d) => [d.date, d]));
    if (!S.calMonth) {
      const base = S.date ? parseKey(S.date) : new Date();
      S.calMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    }
    const y = S.calMonth.getFullYear();
    const mo = S.calMonth.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const last = new Date(y, mo + 1, 0).getDate();
    const tk = todayKey();

    let cells = WEEK.map((w) => `<div class="cal-wd">${w}</div>`).join('');
    for (let i = 0; i < first; i++) cells += '<div></div>';
    for (let dd = 1; dd <= last; dd++) {
      const k = `${y}-${pad2(mo + 1)}-${pad2(dd)}`;
      const rec = map.get(k);
      const wd = (first + dd - 1) % 7;
      const cls = ['cal-day', wd === 0 && 'sun', wd === 6 && 'sat', k === tk && 'today', rec && 'has', rec?.finished && 'done'].filter(Boolean).join(' ');
      cells += `<button class="${cls}" data-act="open" data-date="${k}"><span>${dd}</span></button>`;
    }

    const monthRecs = days.filter((d) => d.date.startsWith(`${y}-${pad2(mo + 1)}`)).sort((a, b) => b.date.localeCompare(a.date));
    const today = map.get(tk);
    const th = today ? Parse.header(today.raw.header) : null;

    $app.innerHTML = `<div class="cal-page">
      <div class="brand"><span class="brand-ic">${icon('sprout')}</span><div><h1>나의 큐티노트</h1><p>날마다 이어 가는 말씀 묵상</p></div>
        <button class="gear" data-act="settings" aria-label="설정">${icon('gear')}</button></div>

      <button class="today-card" data-act="open" data-date="${tk}">
        <span><small>TODAY · ${fmtDate(tk)} ${weekday(tk)}</small>
          <b>${today ? esc(th.range || '오늘의 큐티') : '오늘 큐티 시작하기'}</b>
          <span class="t">${today ? esc(th.title || (today.finished ? '큐티 완료' : '이어서 하기')) : '말씀을 붙여넣고 묵상을 시작해요'}</span></span>
        <span class="go">${icon('chevronRight')}</span>
      </button>

      <div class="cal-card">
        <div class="cal-nav">
          <button data-act="month" data-d="-1" aria-label="이전 달">${icon('chevronLeft')}</button>
          <h2>${y}년 ${mo + 1}월</h2>
          <button data-act="month" data-d="1" aria-label="다음 달">${icon('chevronRight')}</button>
        </div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-legend"><span><i style="background:var(--mint)"></i>기록</span><span><i style="background:var(--mint-deep)"></i>큐티 완료</span></div>
      </div>

      <h3 class="list-h">${mo + 1}월의 큐티</h3>
      ${monthRecs.length ? monthRecs.map(recItem).join('') : `<div class="rec-empty">${icon('leaf')}이 달에는 아직 기록이 없어요</div>`}

      <div class="backup">
        <h3>백업</h3>
        <p>기록은 이 폰 안에만 저장돼요. 가끔 백업 파일을 저장해 두면 안전해요.</p>
        <div class="backup-row">
          <button class="btn btn-soft" data-act="export">${icon('download')} 백업 저장</button>
          <button class="btn btn-soft" data-act="import">${icon('upload')} 불러오기</button>
        </div>
      </div>
    </div>`;
    window.scrollTo(0, 0);
  }

  function recItem(d) {
    const h = Parse.header(d.raw.header);
    const dt = parseKey(d.date);
    return `<button class="rec" data-act="open" data-date="${d.date}">
      <span class="rec-date"><b>${dt.getDate()}</b><small>${WEEK[dt.getDay()]}</small></span>
      <span class="rec-main"><b>${esc(h.range || '제목 없음')}</b><span>${esc(h.title || d.note.slice(0, 40) || '')}</span></span>
      <span class="rec-meta">
        ${d.marks.length ? `<span class="row">${icon('highlighter')}${d.marks.length}</span>` : ''}
        ${d.finished ? `<span class="row done">${icon('check')}완료</span>` : ''}
      </span>
    </button>`;
  }

  async function exportBackup() {
    const data = await DB.exportAll();
    data.settings = { sign: getSign() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qt-note-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`${data.days.length}일의 기록을 백업했어요`);
  }

  $importFile.addEventListener('change', async () => {
    const f = $importFile.files[0];
    $importFile.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm(`백업 파일의 ${data.days?.length ?? 0}일 기록을 불러올까요?\n같은 날짜의 기록은 백업 내용으로 바뀌어요.`)) return;
      const n = await DB.importAll(data);
      if (data.settings && typeof data.settings.sign === 'string') setSign(data.settings.sign.slice(0, SIGN_MAX));
      toast(`${n}일의 기록을 불러왔어요`);
      showCalendar();
    } catch (e) {
      toast('불러오기 실패: ' + e.message);
    }
  });

  // ───────── 이벤트 ─────────
  $app.addEventListener('click', (e) => {
    const u = e.target.closest('.u');
    if (u && !e.target.closest('.paste')) { toggleMark(u); return; }

    const t = e.target.closest('[data-act]');
    if (!t) return;
    const { act, sid } = t.dataset;
    switch (act) {
      case 'calendar': location.hash = '#/calendar'; break;
      case 'open': location.hash = '#/day/' + t.dataset.date; break;
      case 'month': S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + Number(t.dataset.d), 1); showCalendar(); break;
      case 'export': exportBackup(); break;
      case 'settings': openSettings(); break;
      case 'import': $importFile.click(); break;
      case 'toggle': {
        const s = document.getElementById('sec-' + sid);
        if (S.folded.has(sid)) S.folded.delete(sid); else S.folded.add(sid);
        s?.classList.toggle('folded', S.folded.has(sid));
        break;
      }
      case 'edit':
        S.editing.add(sid);
        S.jn[sid] = [];
        rerenderKeeping(sid === 'header' ? '.hero' : `#sec-${sid}`);
        document.querySelector(`.paste[data-sid="${sid}"] textarea`)?.focus({ preventScroll: true });
        updatePenbar();
        break;
      case 'cancel': S.editing.delete(sid); rerenderKeeping(sid === 'header' ? '.hero' : `#sec-${sid}`); break;
      case 'clear': clearSection(sid); break;
      case 'clip': pasteFromClipboard(sid); break;
      case 'done': {
        const v = t.closest('.paste').querySelector('textarea').value;
        commit(sid, S.editing.has(sid) ? Parse.applyJunctions(v, S.jn[sid]) : v);
        break;
      }
      case 'jn': {
        const i = Number(t.dataset.i);
        const dec = S.jn[sid] || (S.jn[sid] = []);
        dec[i] = !t.classList.contains('is-join');
        refreshJunctions(sid);
        break;
      }
      case 'add-part':
        S.day.raw.comm.push('');
        renderDay();
        document.getElementById(`sec-comm${S.day.raw.comm.length - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case 'goto': if (!e.target.closest('.col-del')) gotoUnit(t.dataset.k); break;
      case 'unmark': unmark(t.dataset.k); break;
      case 'finish':
        S.day.finished = true;
        S.expanded = false;
        S.editing.clear();
        save(true);
        renderDay();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('오늘의 큐티를 마쳤어요');
        break;
      case 'reopen': S.day.finished = false; save(); renderDay(); break;
      case 'expand': S.expanded = true; rerenderKeeping('#mine'); break;
      case 'refold': S.expanded = false; renderDay(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    }
  });

  // 비어 있던 입력칸에 붙여넣으면 바로 정리된 본문으로 변환
  $app.addEventListener('paste', (e) => {
    const ta = e.target.closest('.paste-ta');
    if (!ta) return;
    const sid = ta.closest('.paste').dataset.sid;
    if (S.editing.has(sid) || ta.value.trim()) return;
    const text = e.clipboardData?.getData('text/plain');
    if (text) { e.preventDefault(); commit(sid, text); }
  });

  $app.addEventListener('input', (e) => {
    const ta = e.target;
    if (ta.classList.contains('paste-ta')) {
      autoGrow(ta);
      const box = ta.closest('.paste');
      box.classList.toggle('has-text', !!ta.value.trim());
      // 글을 고치면 줄 위치가 바뀌므로 줄 이음 선택을 처음부터 다시 계산
      if (S.editing.has(box.dataset.sid)) { S.jn[box.dataset.sid] = []; refreshJunctions(box.dataset.sid); }
    } else if (ta.id === 'note') {
      autoGrow(ta);
      S.day.note = ta.value;
      save();
      const s = document.getElementById('saved');
      s.classList.add('show');
      clearTimeout(s.t);
      s.t = setTimeout(() => s.classList.remove('show'), 1200);
    }
  });

  $app.addEventListener('focusin', updatePenbar);
  $app.addEventListener('focusout', () => setTimeout(updatePenbar, 50));

  $penbar.querySelector('.penbar-ic').innerHTML = icon('highlighter');
  $penbar.querySelector('.pen-off').innerHTML = icon('penOff');
  $penbar.addEventListener('click', (e) => {
    const b = e.target.closest('.pen');
    if (!b) return;
    S.pen = b.dataset.pen || null;
    try { localStorage.setItem('qt-pen', S.pen || ''); } catch (_) { /* 무시 */ }
    updatePenbar();
  });
  try { const p = localStorage.getItem('qt-pen'); if (p !== null) S.pen = p || null; } catch (_) { /* 무시 */ }

  let scrollTick = false;
  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => { scrollTick = false; if (S.day) updatePenbar(); });
  }, { passive: true });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  route();
})();
