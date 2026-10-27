const Library = {
  db: null,

  open() {
    return new Promise((res, rej) => {
      const d = indexedDB.open('vinyl-db', 1);
      d.onupgradeneeded = () => d.createObjectStore('tracks', { keyPath: 'id' });
      d.onsuccess = () => { this.db = d.result; res(d.result); };
      d.onerror = e => rej(e);
    });
  },

  async add(name, blob) {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();
    const rec = { id, name, size: blob.size, added: Date.now(), blob };
    await new Promise((res, rej) => {
      const tx = this.db.transaction('tracks', 'readwrite');
      tx.objectStore('tracks').put(rec).onsuccess = res;
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
