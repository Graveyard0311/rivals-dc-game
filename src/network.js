export class NetworkClient {
  constructor(url = import.meta.env.VITE_WS_URL || 'ws://localhost:8787') {
    this.url = url;
    this.ws = null;
    this.playerId = null;
    this.lobbyCode = null;
    this.team = null;
    this.handlers = new Map();
    this.connected = false;
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    for (const fn of this.handlers.get(type) || []) fn(payload);
    for (const fn of this.handlers.get('*') || []) fn({ type, ...payload });
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve(this);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      const fail = event => {
        this.connected = false;
        reject(event instanceof Error ? event : new Error('WebSocket connection failed'));
      };

      ws.addEventListener('open', () => {
        this.connected = true;
        this.emit('connection', { connected: true });
        resolve(this);
      }, { once: true });

      ws.addEventListener('error', fail, { once: true });

      ws.addEventListener('close', () => {
        this.connected = false;
        this.emit('connection', { connected: false });
      });

      ws.addEventListener('message', event => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'hello') this.playerId = msg.playerId;
        if (msg.type === 'joined') {
          this.playerId = msg.playerId;
          this.lobbyCode = msg.lobbyCode;
          this.team = msg.team;
        }

        this.emit(msg.type, msg);
      });
    });
  }

  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  async createLobby({ name, heroId }) {
    await this.connect();
    this.send('create-lobby', { name, heroId });
  }

  async joinLobby({ lobbyCode, name, heroId }) {
    await this.connect();
    this.send('join-lobby', { lobbyCode, name, heroId });
  }

  setHero(heroId) {
    return this.send('set-hero', { heroId });
  }

  startMatch(mode = 'domination', arena = 'nexus') {
    return this.send('start-match', { mode, arena });
  }

  sendState(state) {
    return this.send('state', state);
  }

  sendCombatEvent(event) {
    return this.send('combat-event', { event });
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
