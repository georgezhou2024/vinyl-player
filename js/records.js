const Library = {
  db: null,

  open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('vinyl-db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { this.db = req.result; res(req.result); };
      req.onerror = (e) => { console.error('IndexedDB error:', e); rej(e); };
    });
  },

  async add(name, blob) {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();
    const rec = { id, name, size: blob.size, added: Date.now(), blob };
    await new Promise((res, rej) => {
      const tx = this.db.transaction('tracks', 'readwrite');
      tx.objectStore('tracks').put(rec).onsuccess = res;
      tx.onerror = rej;
    });
    return rec;
  },

  async all() {
    return new Promise(res => {
      this.db.transaction('tracks').objectStore('tracks').getAll().onsuccess = r => res(r.target.result);
    });
  },

  async get(id) {
    return new Promise(res => {
      this.db.transaction('tracks').objectStore('tracks').get(id).onsuccess = r => res(r.target.result);
    });
  },

  async remove(id) {
    await new Promise(res => {
      const tx = this.db.transaction('tracks', 'readwrite');
      tx.objectStore('tracks').delete(id).onsuccess = res;
    });
  }
};
