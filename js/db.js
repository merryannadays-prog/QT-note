// IndexedDB 저장소: 날짜('YYYY-MM-DD')를 key로 하루 기록을 보관
const DB = (() => {
  const NAME = 'qt-note';
  const STORE = 'days';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'date' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    getDay: (date) => tx('readonly', (s) => s.get(date)),
    saveDay: (day) => tx('readwrite', (s) => s.put({ ...day, updatedAt: Date.now() })),
    deleteDay: (date) => tx('readwrite', (s) => s.delete(date)),
    listDays: () => tx('readonly', (s) => s.getAll()),
    async exportAll() {
      return { app: 'qt-note', version: 1, exportedAt: new Date().toISOString(), days: await this.listDays() };
    },
    async importAll(data) {
      if (!data || data.app !== 'qt-note' || !Array.isArray(data.days)) throw new Error('큐티노트 백업 파일이 아니에요');
      await tx('readwrite', (s) => data.days.forEach((d) => d && d.date && s.put(d)));
      return data.days.length;
    },
  };
})();
