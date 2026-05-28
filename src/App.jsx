import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// Em desenvolvimento usa localhost; em produção usa a variável VITE_WS_URL do .env
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000";

const ADJECTIVE_PAIRS = [
  ["Alegre", "Triste"], ["Rápido", "Lento"], ["Grande", "Pequeno"],
  ["Forte", "Fraco"], ["Quente", "Frio"], ["Alto", "Baixo"],
  ["Rico", "Pobre"], ["Novo", "Velho"], ["Limpo", "Sujo"],
  ["Claro", "Escuro"], ["Gordo", "Magro"], ["Duro", "Mole"],
  ["Bonito", "Feio"], ["Inteligente", "Burro"], ["Corajoso", "Covarde"],
  ["Generoso", "Egoísta"], ["Sincero", "Mentiroso"], ["Educado", "Rude"],
  ["Animado", "Entediado"], ["Gentil", "Cruel"],
];

const DIFFICULTY = {
  "fácil":   { pairs: 6,  label: "Fácil",   cols: 3 },
  "médio":   { pairs: 10, label: "Médio",   cols: 4 },
  "difícil": { pairs: 16, label: "Difícil", cols: 4 },
};

const PLAYER_COLORS = ["#a78bfa","#34d399","#f87171","#fbbf24","#60a5fa","#f472b6"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(numPairs) {
  const chosen = shuffleArray(ADJECTIVE_PAIRS).slice(0, numPairs);
  const cards = [];
  chosen.forEach(([adj, opp], i) => {
    cards.push({ id: `${i}-a`, word: adj, groupId: i, side: "a" });
    cards.push({ id: `${i}-b`, word: opp, groupId: i, side: "b" });
  });
  return shuffleArray(cards);
}

// ─── WEBSOCKET HOOK ───────────────────────────────────────────────────────────
// FIX: onOpen agora recebe (sendFn) e é chamado corretamente quando a conexão abre
function useWebSocket(onMessage, onOpen) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;

  const send = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // FIX: send é estável (useCallback sem deps), então pode ficar em useEffect sem loop
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (onOpenRef.current) onOpenRef.current(send);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch (_) { /* ignora JSON inválido */ }
    };

    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { send, connected };
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
function LandingPage({ onCreateRoom, onJoinRoom }) {
  const [joinId, setJoinId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [checking, setChecking] = useState(false);
  // FIX: joinId precisa estar em ref para ser acessado dentro do callback do WS
  const joinIdRef = useRef(joinId);
  joinIdRef.current = joinId;

  const { send, connected } = useWebSocket((msg) => {
    if (msg.type === "ROOM_STATE") {
      setChecking(false);
      if (!msg.payload) {
        setJoinError("Sala não encontrada. Verifique o código.");
      } else if (msg.payload.gameStarted) {
        setJoinError("O jogo já começou nessa sala.");
      } else {
        onJoinRoom(joinIdRef.current.trim().toUpperCase());
      }
    }
  });

  const handleJoin = () => {
    const id = joinId.trim().toUpperCase();
    if (!id) { setJoinError("Digite o código da sala"); return; }
    setChecking(true);
    send("GET_ROOM", { roomId: id });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#f0eefc", fontFamily: "'Trebuchet MS', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        .land-hero { background: radial-gradient(ellipse at 60% 40%, #2a1a6e 0%, #0a0a14 70%); }
        .card-float  { animation: floatCard 3s   ease-in-out infinite; }
        .card-float-2{ animation: floatCard 3.5s ease-in-out infinite 0.5s; }
        .card-float-3{ animation: floatCard 2.8s ease-in-out infinite 1s; }
        @keyframes floatCard { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-12px) rotate(-4deg)} }
        .btn-primary  { background: linear-gradient(135deg,#6c47ff,#9f6cff); border:none; color:#fff; padding:14px 32px; border-radius:12px; font-size:16px; font-weight:500; cursor:pointer; transition:transform .15s,box-shadow .15s; box-shadow:0 4px 24px #6c47ff55; font-family:'DM Sans',sans-serif; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 32px #6c47ff88; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .btn-secondary{ background:transparent; border:1.5px solid #6c47ff; color:#a78bfa; padding:14px 32px; border-radius:12px; font-size:16px; cursor:pointer; transition:all .15s; font-family:'DM Sans',sans-serif; }
        .btn-secondary:hover{ background:#6c47ff22; color:#c4b5fd; }
        .feature-card { background:#13112a; border:1px solid #2a2460; border-radius:16px; padding:24px; transition:border-color .2s; }
        .feature-card:hover { border-color:#6c47ff; }
        .join-input { background:#13112a; border:1.5px solid #2a2460; border-radius:10px; padding:12px 16px; color:#f0eefc; font-size:18px; letter-spacing:4px; text-align:center; font-family:'DM Sans',sans-serif; outline:none; width:200px; text-transform:uppercase; }
        .join-input:focus { border-color:#6c47ff; }
        .mini-card { width:56px; height:80px; border-radius:8px; background:linear-gradient(135deg,#2a1a6e,#4a2dbf); border:1px solid #6c47ff55; display:flex; align-items:center; justify-content:center; font-size:11px; color:#c4b5fd; text-align:center; }
        .ws-dot { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:6px; }
      `}</style>

      {/* Status WS */}
      <div style={{ position: "fixed", top: 12, right: 16, fontSize: 12, color: connected ? "#34d399" : "#f87171", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", zIndex: 100 }}>
        <span className="ws-dot" style={{ background: connected ? "#34d399" : "#f87171" }} />
        {connected ? "Servidor online" : "Servidor offline"}
      </div>

      <div className="land-hero" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 60, left: "10%", opacity: 0.6 }}>
          <div className="mini-card card-float"><span>Alegre</span></div>
        </div>
        <div style={{ position: "absolute", top: 100, right: "12%", opacity: 0.5 }}>
          <div className="mini-card card-float-2"><span>Triste</span></div>
        </div>
        <div style={{ position: "absolute", bottom: 80, left: "8%", opacity: 0.4 }}>
          <div className="mini-card card-float-3"><span>Forte</span></div>
        </div>
        <div style={{ position: "absolute", bottom: 100, right: "9%", opacity: 0.4 }}>
          <div className="mini-card card-float"><span>Fraco</span></div>
        </div>

        <div style={{ fontSize: 13, letterSpacing: 4, color: "#9f6cff", textTransform: "uppercase", marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>Jogo da Memória</div>
        <h1 style={{ fontFamily: "'Abril Fatface',serif", fontSize: "clamp(48px,8vw,96px)", lineHeight: 1, margin: "0 0 24px", background: "linear-gradient(135deg,#c4b5fd,#fff 50%,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Opostos<br />Perfeitos
        </h1>
        <p style={{ fontSize: 18, color: "#a094c8", maxWidth: 480, margin: "0 0 48px", lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
          Um jogo de memória multiplayer onde você precisa encontrar pares de adjetivos opostos. Quanto mais opostos, mais pontos!
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn-primary" onClick={onCreateRoom} disabled={!connected}>✦ Criar uma Sala</button>
          <button className="btn-secondary" onClick={() => setShowJoin(v => !v)}>↗ Entrar em uma Sala</button>
        </div>

        {!connected && (
          <p style={{ color: "#f87171", fontSize: 13, marginTop: 16, fontFamily: "'DM Sans',sans-serif" }}>
            ⚠️ Servidor offline. Rode <code style={{ background: "#1e1a3f", padding: "2px 6px", borderRadius: 4 }}>node server.js</code> no terminal.
          </p>
        )}

        {showJoin && (
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <p style={{ color: "#9f7cff", fontSize: 14, fontFamily: "'DM Sans',sans-serif", margin: 0 }}>Digite o código da sala</p>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="join-input"
                value={joinId}
                onChange={e => { setJoinId(e.target.value); setJoinError(""); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                maxLength={6}
                placeholder="XXXXXX"
              />
              <button className="btn-primary" style={{ padding: "12px 20px" }} onClick={handleJoin} disabled={checking}>
                {checking ? "..." : "Entrar"}
              </button>
            </div>
            {joinError && <p style={{ color: "#f87171", fontSize: 13, margin: 0, fontFamily: "'DM Sans',sans-serif" }}>{joinError}</p>}
          </div>
        )}
      </div>

      <div style={{ background: "#0d0c1e", padding: "60px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
            {[
              { icon: "🧠", title: "Adjetivos Opostos",  desc: "Encontre pares de palavras com significados contrários para marcar pontos." },
              { icon: "👥", title: "Multiplayer",         desc: "Jogue com 2 a 6 amigos em tempo real via WebSocket." },
              { icon: "🎯", title: "3 Dificuldades",      desc: "Escolha entre fácil, médio e difícil para ajustar a quantidade de cartas." },
              { icon: "🏆", title: "Pódio & Ranking",     desc: "Ao final do jogo, veja o pódio com os melhores jogadores." },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#e0d9f7", marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>{f.title}</div>
                <div style={{ fontSize: 14, color: "#6e618f", lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "20px", color: "#3d3560", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
        Opostos Perfeitos — Jogo da Memória de Adjetivos
      </div>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({ roomId, isHost, onGameStart, onBack }) {
  const [room, setRoom] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  // FIX: myId gerado uma única vez com função inicializadora
  const [myId] = useState(() => `p_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [difficulty, setDifficulty] = useState("médio");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const { send, connected } = useWebSocket((msg) => {
    if (msg.type === "ROOM_STATE" && msg.payload) {
      setRoom(msg.payload);
      if (msg.payload.gameStarted) onGameStart(msg.payload, myId);
    }
    if (msg.type === "ERROR") setError(msg.payload);
  });

  const joinRoom = () => {
    const name = playerName.trim();
    if (!name) { setError("Digite seu nome"); return; }
    send("JOIN_ROOM", {
      roomId,
      player: { id: myId, name },
      isHost,
      difficulty,
      maxPlayers,
    });
    setNameSet(true);
  };

  const updateSettings = (diff, maxP) => {
    setDifficulty(diff);
    setMaxPlayers(maxP);
    send("UPDATE_SETTINGS", { roomId, difficulty: diff, maxPlayers: maxP });
  };

  const startGame = () => {
    if (!room || room.players.length < 2) { setError("Mínimo 2 jogadores para começar!"); return; }
    const cfg = DIFFICULTY[room.difficulty];
    send("START_GAME", { roomId, deck: buildDeck(cfg.pairs) });
  };

  const copyCode = () => {
    try {
      navigator.clipboard.writeText(roomId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (_) {}
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#f0eefc", fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        .lobby-card { background:#13112a; border:1px solid #2a2460; border-radius:20px; padding:32px; width:100%; max-width:560px; box-sizing:border-box; }
        .player-tag { background:#1e1a3f; border:1px solid #3730a3; border-radius:8px; padding:8px 16px; font-size:14px; display:flex; align-items:center; gap:8px; }
        .diff-btn { padding:8px 20px; border-radius:8px; border:1.5px solid #2a2460; background:transparent; color:#a094c8; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:14px; transition:all .15s; }
        .diff-btn.active { background:#6c47ff22; border-color:#6c47ff; color:#c4b5fd; }
        .start-btn { background:linear-gradient(135deg,#6c47ff,#9f6cff); border:none; color:#fff; padding:16px 40px; border-radius:12px; font-size:18px; cursor:pointer; width:100%; margin-top:24px; font-family:'DM Sans',sans-serif; font-weight:500; transition:opacity .15s; }
        .start-btn:disabled { opacity:.4; cursor:not-allowed; }
        .name-input { background:#1e1a3f; border:1.5px solid #2a2460; border-radius:10px; padding:12px 16px; color:#f0eefc; font-size:16px; font-family:'DM Sans',sans-serif; outline:none; width:100%; box-sizing:border-box; }
        .name-input:focus { border-color:#6c47ff; }
        .code-box { background:#0d0c1e; border:1.5px dashed #3730a3; border-radius:12px; padding:16px 24px; text-align:center; cursor:pointer; transition:border-color .15s; }
        .code-box:hover { border-color:#6c47ff; }
      `}</style>

      <button onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#9f7cff", cursor: "pointer", fontSize: 14, marginBottom: 24 }}>← Voltar</button>

      <h2 style={{ fontFamily: "'Abril Fatface',serif", fontSize: 36, marginBottom: 8, textAlign: "center" }}>
        {isHost ? "Sua Sala" : "Entrar na Sala"}
      </h2>

      <div className="code-box" style={{ marginBottom: 24 }} onClick={copyCode}>
        <div style={{ fontSize: 12, color: "#6e618f", marginBottom: 4 }}>Código da sala</div>
        <div style={{ fontSize: 32, letterSpacing: 8, fontWeight: 500, color: "#c4b5fd" }}>{roomId}</div>
        <div style={{ fontSize: 12, color: "#6e618f", marginTop: 4 }}>{copied ? "✓ Copiado!" : "Clique para copiar"}</div>
      </div>

      <div className="lobby-card">
        {/* FIX: estrutura condicional JSX corrigida — div/Fragment fechados corretamente */}
        {!nameSet ? (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#9f7cff", marginBottom: 8 }}>Seu nome</div>
              <input
                className="name-input"
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && joinRoom()}
                maxLength={20}
                placeholder="Digite seu nome..."
                autoFocus
              />
            </div>
            {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <button className="start-btn" onClick={joinRoom} disabled={!connected}>
              Entrar na Sala
            </button>
          </div>
        ) : (
          /* FIX: Fragment corretamente fechado dentro do div.lobby-card */
          <div>
            {isHost && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, color: "#9f7cff", marginBottom: 12 }}>Dificuldade</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(DIFFICULTY).map(([key, cfg]) => (
                    <button
                      key={key}
                      className={`diff-btn ${(room?.difficulty || difficulty) === key ? "active" : ""}`}
                      onClick={() => updateSettings(key, maxPlayers)}
                    >
                      {cfg.label} ({cfg.pairs * 2} cartas)
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#9f7cff", margin: "20px 0 12px" }}>Máx. jogadores</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      className={`diff-btn ${(room?.maxPlayers || maxPlayers) === n ? "active" : ""}`}
                      onClick={() => updateSettings(difficulty, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#9f7cff" }}>Jogadores</div>
                <div style={{ fontSize: 13, color: "#6e618f" }}>{room?.players?.length || 0}/{room?.maxPlayers || maxPlayers}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(room?.players || []).map((p, i) => (
                  <div key={p.id} className="player-tag">
                    <span style={{ background: `hsl(${i * 60},70%,60%)`, width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    {p.isHost && <span style={{ fontSize: 11, color: "#9f7cff" }}>Host</span>}
                    {p.id === myId && <span style={{ fontSize: 11, color: "#6e618f" }}>você</span>}
                  </div>
                ))}
                {(room?.players?.length || 0) < 2 && (
                  <div style={{ fontSize: 13, color: "#6e618f", textAlign: "center", padding: 8 }}>
                    Aguardando mais jogadores... (mínimo 2)
                  </div>
                )}
              </div>
            </div>

            {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            {isHost ? (
              <button className="start-btn" onClick={startGame} disabled={(room?.players?.length || 0) < 2}>
                {(room?.players?.length || 0) < 2 ? "Aguardando jogadores..." : "▶ Iniciar Jogo"}
              </button>
            ) : (
              <div style={{ textAlign: "center", color: "#6e618f", fontSize: 14, marginTop: 16 }}>
                Aguardando o host iniciar o jogo...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GAME BOARD ───────────────────────────────────────────────────────────────
function GameBoard({ roomId, myId, onGameOver }) {
  const [room, setRoom] = useState(null);

  // FIX: onOpen passado corretamente como segundo argumento para buscar estado ao conectar
  const { send } = useWebSocket(
    (msg) => {
      if (msg.type === "ROOM_STATE" && msg.payload) {
        setRoom(msg.payload);
        if (msg.payload.gameOver) onGameOver(msg.payload);
      }
    },
    (sendFn) => sendFn("GET_ROOM", { roomId, playerId: myId })
  );

  const isMyTurn = room && room.players[room.currentPlayerIndex]?.id === myId;
  const currentPlayer = room?.players?.[room.currentPlayerIndex];

  const flipCard = (cardId) => {
    if (!room || !isMyTurn) return;
    if (room.flipped.length >= 2) return;
    if (room.flipped.includes(cardId) || room.matched.includes(cardId)) return;
    send("FLIP_CARD", { roomId, cardId, playerId: myId });
  };

  if (!room) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontFamily: "'DM Sans',sans-serif" }}>
        Carregando jogo...
      </div>
    );
  }

  const cfg = DIFFICULTY[room.difficulty] || DIFFICULTY["médio"];
  const cols = cfg.cols;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#f0eefc", fontFamily: "'DM Sans',sans-serif", padding: "24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        .mem-card { perspective:1000px; cursor:pointer; width:100%; }
        .mem-card-inner { position:relative; width:100%; padding-bottom:140%; transition:transform .4s; transform-style:preserve-3d; }
        .mem-card-inner.flipped { transform:rotateY(180deg); }
        .mem-card-front,.mem-card-back { position:absolute; width:100%; height:100%; backface-visibility:hidden; border-radius:12px; display:flex; align-items:center; justify-content:center; }
        .mem-card-front { background:linear-gradient(135deg,#1e1a3f,#2a1f6e); border:1.5px solid #3730a380; }
        .mem-card-front:hover { border-color:#6c47ff; }
        .mem-card-back { transform:rotateY(180deg); background:linear-gradient(135deg,#2a1060,#4c2a9e); border:1.5px solid #6c47ff; }
        .mem-card-back.matched { background:linear-gradient(135deg,#064e3b,#059669); border-color:#10b981; }
        .score-card { background:#13112a; border:1px solid #2a2460; border-radius:12px; padding:12px 16px; display:flex; align-items:center; gap:10px; }
        .score-card.active { border-color:#6c47ff; background:#1e1a3f; }
        .turn-badge { background:linear-gradient(135deg,#6c47ff,#9f6cff); border-radius:8px; padding:8px 20px; font-size:14px; font-weight:500; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Abril Fatface',serif", fontSize: 22, color: "#c4b5fd" }}>Opostos Perfeitos</div>
          <div style={{ fontSize: 12, color: "#6e618f" }}>Sala {roomId} • {cfg.label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isMyTurn
            ? <div className="turn-badge">Sua vez!</div>
            : <div style={{ fontSize: 14, color: "#9f7cff" }}>Vez de: {currentPlayer?.name}</div>
          }
          <div style={{ fontSize: 13, color: "#6e618f" }}>{room.matched.length / 2}/{room.deck.length / 2} pares</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {room.players.map((p, i) => (
          <div key={p.id} className={`score-card ${i === room.currentPlayerIndex ? "active" : ""}`} style={{ flex: "1 1 120px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLAYER_COLORS[i % PLAYER_COLORS.length], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>{p.score}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, maxWidth: 700, margin: "0 auto" }}>
        {room.deck.map((card) => {
          const isFlipped = room.flipped.includes(card.id) || room.matched.includes(card.id);
          const isMatched = room.matched.includes(card.id);
          return (
            <div key={card.id} className="mem-card" onClick={() => flipCard(card.id)}>
              <div className={`mem-card-inner ${isFlipped ? "flipped" : ""}`}>
                <div className="mem-card-front">
                  <span style={{ fontSize: 28, opacity: 0.3 }}>?</span>
                </div>
                <div className={`mem-card-back ${isMatched ? "matched" : ""}`}>
                  <span style={{ fontSize: "clamp(11px,2.5vw,15px)", textAlign: "center", padding: "0 8px", fontWeight: 500, color: isMatched ? "#d1fae5" : "#e9d5ff" }}>
                    {card.word}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: 24, color: "#4a4272", fontSize: 13 }}>
        Encontre pares de adjetivos <strong style={{ color: "#6c47ff" }}>opostos</strong> para marcar pontos • Cartas do mesmo par têm significados contrários
      </div>
    </div>
  );
}

// ─── VICTORY SCREEN ───────────────────────────────────────────────────────────
function VictoryScreen({ room, myId, onRestart, onHome }) {
  const sorted = [...(room?.players || [])].sort((a, b) => b.score - a.score);
  const podiumHeights = [120, 160, 90];
  const podiumColors = ["#c0c0c0", "#ffd700", "#cd7f32"];
  const podiumLabels = ["2º", "1º", "3º"];
  const myRank = sorted.findIndex(p => p.id === myId) + 1;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#f0eefc", fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes confettiFall { 0%{transform:translateY(-100px) rotate(0deg);opacity:1} 100%{transform:translateY(110vh) rotate(720deg);opacity:0} }
        .confetti-piece { position:fixed; width:10px; height:10px; pointer-events:none; animation:confettiFall linear infinite; }
        @keyframes podiumRise { from{transform:scaleY(0);transform-origin:bottom} to{transform:scaleY(1)} }
        .podium-block { animation:podiumRise .6s ease-out; animation-fill-mode:both; }
        @keyframes crownBounce { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-8px) rotate(5deg)} }
        .crown { animation:crownBounce 1.5s ease-in-out infinite; display:inline-block; }
        .action-btn { padding:14px 32px; border-radius:12px; font-size:16px; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:500; transition:all .15s; }
        .rank-row { background:#13112a; border:1px solid #2a2460; border-radius:10px; padding:10px 16px; display:flex; align-items:center; gap:12px; }
        .rank-row.me { border-color:#6c47ff; background:#1e1a3f; }
      `}</style>

      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          background: ["#a78bfa","#34d399","#f87171","#fbbf24","#60a5fa","#f472b6"][i % 6],
          animationDuration: `${2 + Math.random() * 3}s`,
          animationDelay: `${Math.random() * 2}s`,
          borderRadius: Math.random() > 0.5 ? "50%" : "0",
        }} />
      ))}

      <div style={{ textAlign: "center", marginBottom: 40, position: "relative" }}>
        <div style={{ fontFamily: "'Abril Fatface',serif", fontSize: 14, letterSpacing: 4, color: "#9f6cff", textTransform: "uppercase", marginBottom: 8 }}>Fim de Jogo!</div>
        <h1 style={{ fontFamily: "'Abril Fatface',serif", fontSize: "clamp(40px,8vw,72px)", margin: 0, background: "linear-gradient(135deg,#ffd700,#fff 50%,#ffd700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          🏆 {sorted[0]?.name} Venceu!
        </h1>
        {myRank === 1 && <div style={{ fontSize: 18, color: "#fbbf24", marginTop: 8 }}>Parabéns! Você é o campeão! <span className="crown">👑</span></div>}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, marginBottom: 40, width: "100%", maxWidth: 400 }}>
        {[sorted[1], sorted[0], sorted[2]].map((player, vi) => {
          if (!player) return <div key={vi} style={{ flex: 1 }} />;
          const h = podiumHeights[vi];
          const color = podiumColors[vi];
          const label = podiumLabels[vi];
          return (
            <div key={player.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ marginBottom: 8, textAlign: "center" }}>
                {vi === 1 && <div style={{ fontSize: 28, marginBottom: 4 }}>👑</div>}
                <div style={{ fontSize: 14, fontWeight: 500, color: "#e0d9f7", wordBreak: "break-word" }}>{player.name}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color }}>{player.score} pts</div>
              </div>
              <div className="podium-block" style={{ width: "100%", height: h, background: `linear-gradient(180deg,${color}55,${color}22)`, border: `2px solid ${color}`, borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", animationDelay: `${vi * 0.15}s` }}>
                <span style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'Abril Fatface',serif" }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ width: "100%", maxWidth: 500, marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: "#9f7cff", marginBottom: 12, textAlign: "center", letterSpacing: 2, textTransform: "uppercase" }}>Placar Final</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((p, i) => (
            <div key={p.id} className={`rank-row ${p.id === myId ? "me" : ""}`}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: PLAYER_COLORS[i % PLAYER_COLORS.length] + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: PLAYER_COLORS[i % PLAYER_COLORS.length], flexShrink: 0 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}º`}
              </div>
              <div style={{ flex: 1 }}>{p.name}</div>
              {p.id === myId && <span style={{ fontSize: 11, color: "#6e618f" }}>você</span>}
              <div style={{ fontSize: 20, fontWeight: 500, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>{p.score}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="action-btn" onClick={onRestart} style={{ background: "linear-gradient(135deg,#6c47ff,#9f6cff)", border: "none", color: "#fff" }}>
          🔄 Jogar Novamente
        </button>
        <button className="action-btn" onClick={onHome} style={{ background: "transparent", border: "1.5px solid #6c47ff", color: "#a78bfa" }}>
          🏠 Página Inicial
        </button>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState(null);
  const [finalRoom, setFinalRoom] = useState(null);

  const handleCreateRoom = () => {
    setRoomId(generateRoomId());
    setIsHost(true);
    setScreen("lobby");
  };

  const handleJoinRoom = (id) => {
    setRoomId(id);
    setIsHost(false);
    setScreen("lobby");
  };

  const handleGameStart = (room, pId) => {
    setMyId(pId);
    setScreen("game");
  };

  const handleGameOver = (room) => {
    setFinalRoom(room);
    setScreen("victory");
  };

  // FIX: handleRestart volta para o lobby (não para o jogo direto),
  // assim o host pode reiniciar corretamente via servidor
  const handleRestart = () => {
    setScreen("lobby");
  };

  return (
    <>
      {screen === "landing"  && <LandingPage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />}
      {screen === "lobby"    && <Lobby roomId={roomId} isHost={isHost} onGameStart={handleGameStart} onBack={() => setScreen("landing")} />}
      {screen === "game"     && <GameBoard roomId={roomId} myId={myId} onGameOver={handleGameOver} />}
      {screen === "victory"  && <VictoryScreen room={finalRoom} myId={myId} onRestart={handleRestart} onHome={() => setScreen("landing")} />}
    </>
  );
}
