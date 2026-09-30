// 둥근 라인아트 아이콘 (stroke = currentColor)
const ICON_PATHS = {
  chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  pencil: '<path d="M4.5 19.5l1-4.2L15.8 5a2.2 2.2 0 013.1 3.1L8.6 18.4l-4.1 1.1z"/><path d="M13.8 7l3.2 3.2"/>',
  clipboard: '<rect x="5.5" y="4.5" width="13" height="16" rx="3"/><path d="M9 4.5V4a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 4v.5"/><path d="M9 11h6M9 14.5h4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r=".6" fill="currentColor"/><circle cx="12" cy="14.5" r=".6" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  penOff: '<circle cx="12" cy="12" r="8"/><path d="M6.6 6.6l10.8 10.8"/>',
  book: '<path d="M12 6.8C9.8 5.3 6.8 4.8 4 5.3v13c2.8-.5 5.8 0 8 1.5 2.2-1.5 5.2-2 8-1.5v-13c-2.8-.5-5.8 0-8 1.5z"/><path d="M12 6.8v13"/>',
  sprout: '<path d="M12 20v-8"/><path d="M12 12.5C12 9 9.6 6.5 5.5 6.5c0 3.8 2.6 6 6.5 6z"/><path d="M12 14.5c0-3 2.3-5.5 6.5-5.5 0 3.3-2.4 5.5-6.5 5.5z"/><path d="M8 20h8"/>',
  cup: '<path d="M5 9.5h11v4.5a5 5 0 01-5 5h-1a5 5 0 01-5-5V9.5z"/><path d="M16 11h1.3a2.4 2.4 0 010 4.8H16"/><path d="M8.5 3.5c-.8 1 .8 1.9 0 3M12 3.5c-.8 1 .8 1.9 0 3"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
  heart: '<path d="M12 19.2s-7.2-4.4-7.2-9.4A3.9 3.9 0 0112 7.7a3.9 3.9 0 017.2 2.1c0 5-7.2 9.4-7.2 9.4z"/>',
  highlighter: '<path d="M9.2 16.2l-3.4-3.4 8.7-8.7a2.2 2.2 0 013.1 0l.3.3a2.2 2.2 0 010 3.1l-8.7 8.7z"/><path d="M5.8 12.8L4 17.5l2.5 2.5 4.7-1.8"/><path d="M13 20.5h7"/>',
  quote: '<path d="M9.5 8.5c-2.6.6-4 2.4-4 5.2V16h4v-4h-2.3c.1-1.3.9-2.2 2.3-2.6V8.5zM18.5 8.5c-2.6.6-4 2.4-4 5.2V16h4v-4h-2.3c.1-1.3.9-2.2 2.3-2.6V8.5z"/>',
  download: '<path d="M12 4.5v10M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V5M7.5 9L12 4.5 16.5 9"/><path d="M5 19.5h14"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14z"/><path d="M5 19l7.5-7.5"/>',
  sparkle: '<path d="M12 4c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z"/>',
  bookmark: '<path d="M7 4.5h10v15l-5-3.5-5 3.5z"/>',
  undo: '<path d="M8.5 8.5L5 12l3.5 3.5"/><path d="M5.5 12H15a4 4 0 010 8h-2"/>',
};

function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// 노트 하단 장식 일러스트 (책 + 커피잔 + 새싹 화분)
const ART_NOTE = `<svg class="art" viewBox="0 0 150 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 58h138"/>
  <path d="M14 58V46c6-2.5 13-2.5 19 0 6-2.5 13-2.5 19 0v12"/><path d="M33 46v12"/>
  <path d="M18 50.5c4-1 8-1 11 0M37 50.5c4-1 8-1 11 0"/>
  <path d="M66 36h20v10a9 9 0 01-9 9h-2a9 9 0 01-9-9V36z"/><path d="M86 39h2.5a4 4 0 010 8H86"/>
  <path d="M72 27c-1.2 1.6 1.2 3 0 4.6M79 25c-1.2 1.6 1.2 3 0 4.6"/>
  <path d="M110 58l-3-16h24l-3 16z"/><path d="M119 42V28"/>
  <path d="M119 33c0-6-4-10-11-10 0 6.4 4.4 10 11 10z"/><path d="M119 36.5c0-5 3.8-9 10.5-9 0 5.5-4 9-10.5 9z"/>
</svg>`;

// 수집 영역 빈 상태 일러스트
const ART_EMPTY = `<svg class="art" viewBox="0 0 120 56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="10" y="14" width="72" height="9" rx="4.5" class="fill-y" stroke="none"/>
  <path d="M12 18.5h58M12 32.5h66M12 46.5h40"/>
  <rect x="10" y="42" width="44" height="9" rx="4.5" class="fill-m" stroke="none"/>
  <path d="M96 40l-5-5 13-13a3 3 0 014.2 0l.8.8a3 3 0 010 4.2L96 40z"/><path d="M91 35l-3 7 3.8 3.8 7.2-3"/>
</svg>`;
