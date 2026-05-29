import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000";

// ─── 100 PARES DE ADJETIVOS ───────────────────────────────────────────────────
// As palavras são armazenadas codificadas em base64 para não aparecerem em texto
// claro no DOM antes de serem reveladas pelo jogador
const _RAW_PAIRS = [
  ["Alegre","Triste"],["Rápido","Lento"],["Grande","Pequeno"],["Forte","Fraco"],
  ["Quente","Frio"],["Alto","Baixo"],["Rico","Pobre"],["Novo","Velho"],
  ["Limpo","Sujo"],["Claro","Escuro"],["Gordo","Magro"],["Duro","Mole"],
  ["Bonito","Feio"],["Inteligente","Burro"],["Corajoso","Covarde"],
  ["Generoso","Egoísta"],["Sincero","Mentiroso"],["Educado","Rude"],
  ["Animado","Entediado"],["Gentil","Cruel"],["Ativo","Preguiçoso"],
  ["Calmo","Agitado"],["Certo","Errado"],["Cheio","Vazio"],["Caro","Barato"],
  ["Fácil","Difícil"],["Feliz","Infeliz"],["Gordo","Magro"],["Grosso","Fino"],
  ["Largo","Estreito"],["Legal","Ilegal"],["Leve","Pesado"],["Longo","Curto"],
  ["Macio","Áspero"],["Moderno","Antigo"],["Molhado","Seco"],["Nobre","Humilde"],
  ["Obediente","Rebelde"],["Ocupado","Livre"],["Ousado","Tímido"],
  ["Paciente","Impaciente"],["Perigoso","Seguro"],["Positivo","Negativo"],
  ["Profundo","Raso"],["Próximo","Distante"],["Público","Privado"],
  ["Rígido","Flexível"],["Sábio","Ignorante"],["Saudável","Doente"],
  ["Simples","Complexo"],["Sólido","Líquido"],["Suave","Brusco"],
  ["Superior","Inferior"],["Tranquilo","Nervoso"],["Útil","Inútil"],
  ["Valente","Medroso"],["Verdadeiro","Falso"],["Vivo","Morto"],
  ["Aberto","Fechado"],["Abundante","Escasso"],["Agradável","Desagradável"],
  ["Amigável","Hostil"],["Amplo","Restrito"],["Antigo","Recente"],
  ["Áspero","Liso"],["Belo","Horrível"],["Bravo","Manso"],["Brilhante","Opaco"],
  ["Capaz","Incapaz"],["Cauteloso","Descuidado"],["Civilizado","Selvagem"],
  ["Confiante","Inseguro"],["Constante","Variável"],["Contente","Insatisfeito"],
  ["Criativo","Repetitivo"],["Culpado","Inocente"],["Curioso","Indiferente"],
  ["Dedicado","Negligente"],["Delicado","Grosseiro"],["Denso","Ralo"],
  ["Direto","Indireto"],["Disciplinado","Indisciplinado"],["Doce","Amargo"],
  ["Doméstico","Selvagem"],["Duradouro","Passageiro"],["Eficiente","Ineficiente"],
  ["Elegante","Desleixado"],["Empolgado","Apático"],["Engraçado","Sério"],
  ["Equilibrado","Instável"],["Estável","Caótico"],["Eterno","Temporário"],
  ["Evidente","Oculto"],["Exato","Impreciso"],["Famoso","Desconhecido"],
  ["Fantástico","Terrível"],["Firme","Frágil"],["Fluente","Travado"],
  ["Formal","Informal"],["Frequente","Raro"],["Funcional","Quebrado"],
];

// Codifica cada palavra em base64 para não aparecer como texto legível no HTML
const ADJECTIVE_PAIRS = _RAW_PAIRS.map(([a, b]) => [btoa(unescape(encodeURIComponent(a))), btoa(unescape(encodeURIComponent(b)))]);
const decodeWord = (b64) => { try { return decodeURIComponent(escape(atob(b64))); } catch { return b64; } };

const DIFFICULTY = {
  "fácil":   { pairs: 7,  label: "Fácil",   cols: 4 },  // 14 cartas → 7 pares
  "médio":   { pairs: 11, label: "Médio",   cols: 5 },  // 22 cartas → 11 pares
  "difícil": { pairs: 17, label: "Difícil", cols: 6 },  // 34 cartas → 17 pares
};

const PLAYER_COLORS = ["#a78bfa","#34d399","#f87171","#fbbf24","#60a5fa","#f472b6"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function generateRoomId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildDeck(numPairs) {
  const chosen = shuffleArray(ADJECTIVE_PAIRS).slice(0, numPairs);
  const cards = [];
  chosen.forEach(([adjB64, oppB64], i) => {
    // Armazena apenas o id e groupId; a palavra fica em base64 e só é decodificada na hora de exibir
    cards.push({ id: `${i}-a`, wordB64: adjB64, groupId: i, side: "a" });
    cards.push({ id: `${i}-b`, wordB64: oppB64, groupId: i, side: "b" });
  });
  return shuffleArray(cards);
}

// ─── WEBSOCKET HOOK ───────────────────────────────────────────────────────────
function useWebSocket(onMessage, onOpen) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;

  const send = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type, payload }));
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); if (onOpenRef.current) onOpenRef.current(send); };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => { try { onMessageRef.current(JSON.parse(e.data)); } catch (_) {} };
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { send, connected };
}

// ─── TUTORIAL ─────────────────────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  { msg: "👋 Bem-vindo ao tutorial! Aqui você aprende a jogar sozinho antes de desafiar amigos.", action: null },
  { msg: "🃏 O tabuleiro tem cartas viradas para baixo. Clique em uma carta para virá-la!", action: "flip1" },
  { msg: "🔍 Boa! Agora clique em outra carta. Tente achar o oposto da que você virou.", action: "flip2" },
  { msg: "✅ Par correto! Adjetivos opostos formam um par. Você ganha 1 ponto por par encontrado!", action: "match" },
  { msg: "❌ Par errado! Quando as cartas não são opostas, elas voltam para baixo e passa a vez.", action: "miss" },
  { msg: "🔄 A cada rodada, os adjetivos são sorteados aleatoriamente de uma lista de 100 pares!", action: null },
  { msg: "🏆 Quem encontrar mais pares vence! Agora você está pronto. Crie uma sala e convide amigos!", action: "done" },
];

function Tutorial({ onFinish }) {
  const [step, setStep] = useState(0);
  const [deck] = useState(() => {
    // Mini deck de demonstração com 3 pares fixos decodificados diretamente
    const pairs = [["Alegre","Triste"],["Forte","Fraco"],["Rápido","Lento"]];
    const cards = [];
    pairs.forEach(([a,b],i) => {
      cards.push({ id:`t${i}-a`, word: a, groupId: i, side:"a" });
      cards.push({ id:`t${i}-b`, word: b, groupId: i, side:"b" });
    });
    return shuffleArray(cards);
  });
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [lastResult, setLastResult] = useState(null); // "match" | "miss" | null
  const [locked, setLocked] = useState(false);
  const [botFlipping, setBotFlipping] = useState(false);

  const currentAction = TUTORIAL_STEPS[step]?.action;

  const flipCard = (cardId) => {
    if (locked || matched.includes(cardId) || flipped.includes(cardId)) return;
    if (flipped.length >= 2) return;
    // Só permite clicar nas fases certas
    if (currentAction !== "flip1" && currentAction !== "flip2" && currentAction !== "match" && currentAction !== "miss") return;

    const newFlipped = [...flipped, cardId];
    setFlipped(newFlipped);

    if (step === 1) setStep(2); // foi flip1, avança para flip2

    if (newFlipped.length === 2) {
      setLocked(true);
      const [a, b] = newFlipped.map(id => deck.find(c => c.id === id));
      const isMatch = a.groupId === b.groupId && a.side !== b.side;
      setTimeout(() => {
        if (isMatch) {
          setMatched(m => [...m, a.id, b.id]);
          setFlipped([]);
          setLastResult("match");
          setStep(s => s + 1); // avança para step de acerto
        } else {
          setFlipped([]);
          setLastResult("miss");
          setStep(4); // vai direto para o step de erro
        }
        setLocked(false);
      }, 900);
    }
  };

  // Bot demonstra um erro se step === "miss"
  useEffect(() => {
    if (currentAction === "miss" && !botFlipping && flipped.length === 0 && !locked) {
      setBotFlipping(true);
      const unmatched = deck.filter(c => !matched.includes(c.id));
      if (unmatched.length >= 2) {
        // escolhe dois que NÃO sejam par
        const wrong = unmatched.filter(c => c.groupId !== unmatched[0].groupId);
        if (wrong.length > 0) {
          setTimeout(() => { setFlipped([unmatched[0].id]); }, 600);
          setTimeout(() => { setFlipped([unmatched[0].id, wrong[0].id]); setLocked(true); }, 1300);
          setTimeout(() => { setFlipped([]); setLocked(false); setBotFlipping(false); setStep(5); }, 2400);
        } else { setStep(5); setBotFlipping(false); }
      } else { setStep(5); setBotFlipping(false); }
    }
  }, [currentAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = TUTORIAL_STEPS[step] || TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a14", color:"#f0eefc", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", padding:"32px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        .tut-card { perspective:800px; cursor:pointer; }
        .tut-inner { position:relative; width:90px; height:126px; transition:transform .4s; transform-style:preserve-3d; }
        .tut-inner.flipped { transform:rotateY(180deg); }
        .tut-front,.tut-back { position:absolute; width:100%; height:100%; backface-visibility:hidden; border-radius:10px; display:flex; align-items:center; justify-content:center; }
        .tut-front { background:linear-gradient(135deg,#1e1a3f,#2a1f6e); border:1.5px solid #3730a380; }
        .tut-front:hover { border-color:#6c47ff; }
        .tut-back { transform:rotateY(180deg); background:linear-gradient(135deg,#2a1060,#4c2a9e); border:1.5px solid #6c47ff; font-size:13px; font-weight:500; color:#e9d5ff; text-align:center; padding:4px; }
        .tut-back.matched { background:linear-gradient(135deg,#064e3b,#059669); border-color:#10b981; color:#d1fae5; }
        .bubble { background:#13112a; border:1px solid #6c47ff55; border-radius:16px; padding:20px 28px; max-width:520px; text-align:center; font-size:15px; line-height:1.6; color:#d4cff0; position:relative; }
        .bubble::after { content:''; position:absolute; bottom:-12px; left:50%; transform:translateX(-50%); border:6px solid transparent; border-top-color:#6c47ff55; }
        .step-dot { width:8px; height:8px; border-radius:50%; background:#2a2460; transition:background .2s; }
        .step-dot.active { background:#6c47ff; }
        @media(max-width:480px){ .tut-inner{width:70px;height:98px;} .tut-back{font-size:11px;} }
      `}</style>

      <button onClick={onFinish} style={{ alignSelf:"flex-start", background:"none", border:"none", color:"#9f7cff", cursor:"pointer", fontSize:14, marginBottom:24 }}>← Voltar</button>

      <div style={{ fontFamily:"'Abril Fatface',serif", fontSize:28, color:"#c4b5fd", marginBottom:4 }}>Tutorial</div>
      <div style={{ fontSize:13, color:"#6e618f", marginBottom:32 }}>Aprenda a jogar antes de criar uma sala</div>

      {/* Balão de dica */}
      <div className="bubble" style={{ marginBottom:36 }}>{cur.msg}</div>

      {/* Mini tabuleiro 3x2 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,auto)", gap:12, marginBottom:32, justifyContent:"center" }}>
        {deck.map(card => {
          const isFlippedCard = flipped.includes(card.id) || matched.includes(card.id);
          const isMatchedCard = matched.includes(card.id);
          const canClick = (currentAction === "flip1" || currentAction === "flip2") && !isFlippedCard && !isMatchedCard;
          return (
            <div key={card.id} className="tut-card" onClick={() => flipCard(card.id)} style={{ opacity: canClick ? 1 : 0.85 }}>
              <div className={`tut-inner ${isFlippedCard ? "flipped" : ""}`}>
                <div className="tut-front"><span style={{ fontSize:22, opacity:0.3 }}>?</span></div>
                <div className={`tut-back ${isMatchedCard ? "matched" : ""}`}>{card.word}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progresso */}
      <div style={{ display:"flex", gap:6, marginBottom:28 }}>
        {TUTORIAL_STEPS.map((_,i) => <div key={i} className={`step-dot ${i <= step ? "active" : ""}`} />)}
      </div>

      {/* Botões de navegação */}
      <div style={{ display:"flex", gap:12 }}>
        {currentAction !== "flip1" && currentAction !== "flip2" && currentAction !== "miss" && currentAction !== "match" && (
          <button onClick={() => { if (currentAction === "done") onFinish(); else setStep(s => Math.min(s+1, TUTORIAL_STEPS.length-1)); }}
            style={{ background:"linear-gradient(135deg,#6c47ff,#9f6cff)", border:"none", color:"#fff", padding:"12px 28px", borderRadius:10, fontSize:15, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            {currentAction === "done" ? "🎮 Jogar agora!" : "Próximo →"}
          </button>
        )}
        {currentAction === "flip1" && (
          <div style={{ fontSize:13, color:"#9f7cff", padding:"12px 0" }}>👆 Clique em uma carta acima para continuar</div>
        )}
        {currentAction === "flip2" && (
          <div style={{ fontSize:13, color:"#9f7cff", padding:"12px 0" }}>👆 Clique em outra carta para tentar formar um par</div>
        )}
      </div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
function LandingPage({ onCreateRoom, onJoinRoom, onTutorial }) {
  const [joinId, setJoinId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [checking, setChecking] = useState(false);
  const joinIdRef = useRef(joinId);
  joinIdRef.current = joinId;

  const { send, connected } = useWebSocket((msg) => {
    if (msg.type === "ROOM_STATE") {
      setChecking(false);
      if (!msg.payload) setJoinError("Sala não encontrada. Verifique o código.");
      else if (msg.payload.gameStarted) setJoinError("O jogo já começou nessa sala.");
      else onJoinRoom(joinIdRef.current.trim().toUpperCase());
    }
  });

  const handleJoin = () => {
    const id = joinId.trim().toUpperCase();
    if (!id) { setJoinError("Digite o código da sala"); return; }
    setChecking(true);
    send("GET_ROOM", { roomId: id });
  };

  const features = [
    { icon:"🧠", title:"Adjetivos Opostos", desc:"Encontre pares de palavras com significados contrários para marcar pontos." },
    { icon:"👥", title:"Multiplayer Global",  desc:"Jogue com 2 a 6 amigos em tempo real via WebSocket, de qualquer lugar do mundo." },
    { icon:"🎯", title:"3 Dificuldades",      desc:"Escolha entre Fácil (14 cartas / 7 pares), Médio (22 cartas / 11 pares) e Difícil (34 cartas / 17 pares)." },
    { icon:"🏆", title:"Pódio & Ranking",     desc:"Ao final do jogo veja o pódio animado com os melhores jogadores da partida." },
    { icon:"📚", title:"100 Pares Únicos",    desc:"Mais de 100 pares de adjetivos sorteados aleatoriamente a cada partida, garantindo variedade sempre." },
    { icon:"🎓", title:"Tutorial Interativo", desc:"Nunca jogou? Aprenda as regras jogando um mini tutorial com dicas passo a passo antes de entrar em uma sala." },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a14", color:"#f0eefc", fontFamily:"'Trebuchet MS',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        .land-hero { background: radial-gradient(ellipse at 60% 40%, #2a1a6e 0%, #0a0a14 70%); }
        .card-float   { animation: floatCard 3s   ease-in-out infinite; }
        .card-float-2 { animation: floatCard 3.5s ease-in-out infinite 0.5s; }
        .card-float-3 { animation: floatCard 2.8s ease-in-out infinite 1s; }
        @keyframes floatCard { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-12px) rotate(-4deg)} }
        .btn-primary   { background:linear-gradient(135deg,#6c47ff,#9f6cff); border:none; color:#fff; padding:14px 32px; border-radius:12px; font-size:16px; font-weight:500; cursor:pointer; transition:transform .15s,box-shadow .15s; box-shadow:0 4px 24px #6c47ff55; font-family:'DM Sans',sans-serif; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 32px #6c47ff88; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .btn-secondary { background:transparent; border:1.5px solid #6c47ff; color:#a78bfa; padding:14px 32px; border-radius:12px; font-size:16px; cursor:pointer; transition:all .15s; font-family:'DM Sans',sans-serif; }
        .btn-secondary:hover { background:#6c47ff22; color:#c4b5fd; }
        .btn-ghost     { background:transparent; border:1.5px solid #3730a3; color:#7c6fb0; padding:14px 32px; border-radius:12px; font-size:16px; cursor:pointer; transition:all .15s; font-family:'DM Sans',sans-serif; }
        .btn-ghost:hover { border-color:#6c47ff; color:#a78bfa; }
        .feature-card  { background:#13112a; border:1px solid #2a2460; border-radius:16px; padding:24px; transition:border-color .2s,transform .2s; }
        .feature-card:hover { border-color:#6c47ff; transform:translateY(-3px); }
        .join-input    { background:#13112a; border:1.5px solid #2a2460; border-radius:10px; padding:12px 16px; color:#f0eefc; font-size:18px; letter-spacing:4px; text-align:center; font-family:'DM Sans',sans-serif; outline:none; width:200px; text-transform:uppercase; }
        .join-input:focus { border-color:#6c47ff; }
        .mini-card     { width:56px; height:80px; border-radius:8px; background:linear-gradient(135deg,#2a1a6e,#4a2dbf); border:1px solid #6c47ff55; display:flex; align-items:center; justify-content:center; font-size:11px; color:#c4b5fd; text-align:center; }
        .ws-dot        { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:6px; }
        @media(max-width:600px){ .hero-btns { flex-direction:column; align-items:stretch; } .hero-btns button { text-align:center; } }
      `}</style>

      <div style={{ position:"fixed", top:12, right:16, fontSize:12, color: connected?"#34d399":"#f87171", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", zIndex:100 }}>
        <span className="ws-dot" style={{ background: connected?"#34d399":"#f87171" }} />
        {connected ? "Servidor online" : "Servidor offline"}
      </div>

      <div className="land-hero" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:60, left:"10%", opacity:0.6 }}><div className="mini-card card-float"><span>Alegre</span></div></div>
        <div style={{ position:"absolute", top:100, right:"12%", opacity:0.5 }}><div className="mini-card card-float-2"><span>Triste</span></div></div>
        <div style={{ position:"absolute", bottom:80, left:"8%", opacity:0.4 }}><div className="mini-card card-float-3"><span>Forte</span></div></div>
        <div style={{ position:"absolute", bottom:100, right:"9%", opacity:0.4 }}><div className="mini-card card-float"><span>Fraco</span></div></div>

        <div style={{ fontSize:13, letterSpacing:4, color:"#9f6cff", textTransform:"uppercase", marginBottom:16, fontFamily:"'DM Sans',sans-serif" }}>Jogo da Memória</div>
        <h1 style={{ fontFamily:"'Abril Fatface',serif", fontSize:"clamp(48px,8vw,96px)", lineHeight:1, margin:"0 0 24px", background:"linear-gradient(135deg,#c4b5fd,#fff 50%,#a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Opostos<br/>Perfeitos
        </h1>
        <p style={{ fontSize:18, color:"#a094c8", maxWidth:480, margin:"0 0 48px", lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>
          Um jogo de memória multiplayer onde você precisa encontrar pares de adjetivos opostos. Quanto mais opostos, mais pontos!
        </p>

        <div className="hero-btns" style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
          <button className="btn-primary"    onClick={onCreateRoom} disabled={!connected}>✦ Criar uma Sala</button>
          <button className="btn-secondary"  onClick={() => setShowJoin(v => !v)}>↗ Entrar em uma Sala</button>
          <button className="btn-ghost"      onClick={onTutorial}>🎓 Tutorial</button>
        </div>

        {!connected && (
          <p style={{ color:"#f87171", fontSize:13, marginTop:16, fontFamily:"'DM Sans',sans-serif" }}>
            ⚠️ Servidor offline. Rode <code style={{ background:"#1e1a3f", padding:"2px 6px", borderRadius:4 }}>node server.js</code> no terminal.
          </p>
        )}

        {showJoin && (
          <div style={{ marginTop:32, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <p style={{ color:"#9f7cff", fontSize:14, fontFamily:"'DM Sans',sans-serif", margin:0 }}>Digite o código da sala</p>
            <div style={{ display:"flex", gap:10 }}>
              <input className="join-input" value={joinId}
                onChange={e => { setJoinId(e.target.value); setJoinError(""); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                maxLength={6} placeholder="XXXXXX" />
              <button className="btn-primary" style={{ padding:"12px 20px" }} onClick={handleJoin} disabled={checking}>
                {checking ? "..." : "Entrar"}
              </button>
            </div>
            {joinError && <p style={{ color:"#f87171", fontSize:13, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{joinError}</p>}
          </div>
        )}
      </div>

      {/* Cards informativos */}
      <div style={{ background:"#0d0c1e", padding:"60px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ fontSize:13, letterSpacing:4, color:"#9f6cff", textTransform:"uppercase", marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>Por que jogar?</div>
            <h2 style={{ fontFamily:"'Abril Fatface',serif", fontSize:"clamp(24px,4vw,40px)", margin:0, color:"#e0d9f7" }}>Tudo que você precisa saber</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
            {features.map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize:32, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontSize:16, fontWeight:500, color:"#e0d9f7", marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>{f.title}</div>
                <div style={{ fontSize:14, color:"#6e618f", lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign:"center", padding:"20px", color:"#3d3560", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
        Opostos Perfeitos — Jogo da Memória de Adjetivos<br></br>
        ⚡Criado pela Tropa do Gabigol⚡ 
      </div>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({ roomId, isHost, onGameStart, onBack }) {
  const [room, setRoom] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [myId] = useState(() => `p_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [difficulty, setDifficulty] = useState("médio");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const { send, connected } = useWebSocket((msg) => {
    if (msg.type === "ROOM_STATE" && msg.payload) {
      setRoom(msg.payload);
      // Só redireciona para o jogo se o jogador já entrou na sala (nameSet)
      // Isso evita redirect imediato ao voltar para o lobby após "Jogar Novamente"
      if (msg.payload.gameStarted && nameSet) onGameStart(msg.payload, myId);
    }
    if (msg.type === "ERROR") setError(msg.payload);
  });

  // Ao montar o Lobby vindo de "Jogar Novamente", reseta o estado da sala no servidor
  const resetDoneRef = useRef(false);
  useEffect(() => {
    if (!resetDoneRef.current) {
      resetDoneRef.current = true;
      // Pequeno delay para garantir que a conexão WS está aberta
      const t = setTimeout(() => {
        send("RESET_ROOM", { roomId });
      }, 300);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = () => {
    const name = playerName.trim();
    if (!name) { setError("Digite seu nome"); return; }
    send("JOIN_ROOM", { roomId, player: { id: myId, name }, isHost, difficulty, maxPlayers });
    setNameSet(true);
  };

  const updateSettings = (diff, maxP) => {
    setDifficulty(diff); setMaxPlayers(maxP);
    send("UPDATE_SETTINGS", { roomId, difficulty: diff, maxPlayers: maxP });
  };

  const startGame = () => {
    if (!room || room.players.length < 2) { setError("Mínimo 2 jogadores para começar!"); return; }
    const cfg = DIFFICULTY[room.difficulty];
    send("START_GAME", { roomId, deck: buildDeck(cfg.pairs) });
  };

  const copyCode = () => {
    try { navigator.clipboard.writeText(roomId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); } catch (_) {}
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a14", color:"#f0eefc", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 24px" }}>
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

      <button onClick={onBack} style={{ alignSelf:"flex-start", background:"none", border:"none", color:"#9f7cff", cursor:"pointer", fontSize:14, marginBottom:24 }}>← Voltar</button>
      <h2 style={{ fontFamily:"'Abril Fatface',serif", fontSize:36, marginBottom:8, textAlign:"center" }}>{isHost ? "Sua Sala" : "Entrar na Sala"}</h2>

      <div className="code-box" style={{ marginBottom:24 }} onClick={copyCode}>
        <div style={{ fontSize:12, color:"#6e618f", marginBottom:4 }}>Código da sala</div>
        <div style={{ fontSize:32, letterSpacing:8, fontWeight:500, color:"#c4b5fd" }}>{roomId}</div>
        <div style={{ fontSize:12, color:"#6e618f", marginTop:4 }}>{copied ? "✓ Copiado!" : "Clique para copiar"}</div>
      </div>

      <div className="lobby-card">
        {!nameSet ? (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, color:"#9f7cff", marginBottom:8 }}>Seu nome</div>
              <input className="name-input" value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && joinRoom()}
                maxLength={20} placeholder="Digite seu nome..." autoFocus />
            </div>
            {error && <p style={{ color:"#f87171", fontSize:13, margin:"0 0 12px" }}>{error}</p>}
            <button className="start-btn" onClick={joinRoom} disabled={!connected}>Entrar na Sala</button>
          </div>
        ) : (
          <div>
            {isHost && (
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:13, color:"#9f7cff", marginBottom:12 }}>Dificuldade</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {Object.entries(DIFFICULTY).map(([key, cfg]) => (
                    <button key={key} className={`diff-btn ${(room?.difficulty||difficulty)===key?"active":""}`}
                      onClick={() => updateSettings(key, maxPlayers)}>
                      {cfg.label} ({cfg.pairs*2} cartas)
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:13, color:"#9f7cff", margin:"20px 0 12px" }}>Máx. jogadores</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[2,3,4,5,6].map(n => (
                    <button key={n} className={`diff-btn ${(room?.maxPlayers||maxPlayers)===n?"active":""}`}
                      onClick={() => updateSettings(difficulty, n)}>{n}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:13, color:"#9f7cff" }}>Jogadores</div>
                <div style={{ fontSize:13, color:"#6e618f" }}>{room?.players?.length||0}/{room?.maxPlayers||maxPlayers}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {(room?.players||[]).map((p,i) => (
                  <div key={p.id} className="player-tag">
                    <span style={{ background:`hsl(${i*60},70%,60%)`, width:8, height:8, borderRadius:"50%", flexShrink:0 }} />
                    <span style={{ flex:1 }}>{p.name}</span>
                    {p.isHost && <span style={{ fontSize:11, color:"#9f7cff" }}>Host</span>}
                    {p.id === myId && <span style={{ fontSize:11, color:"#6e618f" }}>você</span>}
                  </div>
                ))}
                {(room?.players?.length||0) < 2 && (
                  <div style={{ fontSize:13, color:"#6e618f", textAlign:"center", padding:8 }}>Aguardando mais jogadores... (mínimo 2)</div>
                )}
              </div>
            </div>

            {error && <p style={{ color:"#f87171", fontSize:13, marginBottom:12 }}>{error}</p>}
            {isHost ? (
              <button className="start-btn" onClick={startGame} disabled={(room?.players?.length||0) < 2}>
                {(room?.players?.length||0) < 2 ? "Aguardando jogadores..." : "▶ Iniciar Jogo"}
              </button>
            ) : (
              <div style={{ textAlign:"center", color:"#6e618f", fontSize:14, marginTop:16 }}>Aguardando o host iniciar o jogo...</div>
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

  if (!room) return (
    <div style={{ minHeight:"100vh", background:"#0a0a14", display:"flex", alignItems:"center", justifyContent:"center", color:"#c4b5fd", fontFamily:"'DM Sans',sans-serif" }}>
      Carregando jogo...
    </div>
  );

  const cfg = DIFFICULTY[room.difficulty] || DIFFICULTY["médio"];
  const totalCards = room.deck.length;

  // Sempre 4 colunas por linha; última linha centralizada se incompleta
  const COLS = 4;
  const lastRowCount = totalCards % COLS || COLS; // quantas cartas na última linha
  const hasIncompleteRow = totalCards % COLS !== 0;
  // Agrupa as cartas em linhas de 4
  const rows = [];
  for (let i = 0; i < totalCards; i += COLS) {
    rows.push(room.deck.slice(i, i + COLS));
  }
  const maxBoardWidth = 560;

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a14", color:"#f0eefc", fontFamily:"'DM Sans',sans-serif", padding:"16px", boxSizing:"border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');
        .mem-card { perspective:1000px; cursor:pointer; }
        .mem-card-inner { position:relative; width:100%; padding-bottom:140%; transition:transform .4s; transform-style:preserve-3d; }
        .mem-card-inner.flipped { transform:rotateY(180deg); }
        .mem-card-front,.mem-card-back { position:absolute; width:100%; height:100%; backface-visibility:hidden; border-radius:10px; display:flex; align-items:center; justify-content:center; }
        .mem-card-front { background:linear-gradient(135deg,#1e1a3f,#2a1f6e); border:1.5px solid #3730a380; transition:border-color .15s; }
        .mem-card-front:hover { border-color:#6c47ff; }
        .mem-card-back { transform:rotateY(180deg); background:linear-gradient(135deg,#2a1060,#4c2a9e); border:1.5px solid #6c47ff; }
        .mem-card-back.matched { background:linear-gradient(135deg,#064e3b,#059669); border-color:#10b981; }
        .mem-card.disabled { cursor:not-allowed; opacity:.7; }
        .score-row { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
        .score-card { background:#13112a; border:1px solid #2a2460; border-radius:10px; padding:8px 14px; display:flex; align-items:center; gap:8px; flex-shrink:0; min-width:0; }
        .score-card.active { border-color:#6c47ff; background:#1e1a3f; }
        .turn-badge { background:linear-gradient(135deg,#6c47ff,#9f6cff); border-radius:8px; padding:6px 16px; font-size:13px; font-weight:500; white-space:nowrap; }
        .board-grid { display:grid; gap:8px; }
        @media(max-width:480px){
          .board-grid { gap:5px !important; }
          .mem-card-back span { font-size:10px !important; }
        }
        @media(min-width:481px) and (max-width:768px){
          .mem-card-back span { font-size:12px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontFamily:"'Abril Fatface',serif", fontSize:"clamp(16px,4vw,22px)", color:"#c4b5fd" }}>Opostos Perfeitos</div>
          <div style={{ fontSize:11, color:"#6e618f" }}>Sala {roomId} • {cfg.label} • {totalCards} cartas</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          {isMyTurn
            ? <div className="turn-badge">✦ Sua vez!</div>
            : <div style={{ fontSize:13, color:"#9f7cff", whiteSpace:"nowrap" }}>Vez de: {currentPlayer?.name}</div>
          }
          <div style={{ fontSize:12, color:"#6e618f", whiteSpace:"nowrap" }}>{room.matched.length/2}/{totalCards/2} pares</div>
        </div>
      </div>

      {/* Placar horizontal */}
      <div className="score-row" style={{ marginBottom:12 }}>
        {room.players.map((p,i) => (
          <div key={p.id} className={`score-card ${i===room.currentPlayerIndex?"active":""}`}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:PLAYER_COLORS[i%PLAYER_COLORS.length], flexShrink:0 }} />
            <div style={{ fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:80 }}>{p.name}</div>
            <div style={{ fontSize:17, fontWeight:600, color:PLAYER_COLORS[i%PLAYER_COLORS.length], marginLeft:2 }}>{p.score}</div>
          </div>
        ))}
      </div>

      {/* Tabuleiro — 4 colunas fixas, última linha centralizada */}
      <div style={{ maxWidth: maxBoardWidth, margin:"0 auto", width:"100%", display:"flex", flexDirection:"column", gap:8 }}>
        {rows.map((rowCards, rowIdx) => {
          const isLastRow = rowIdx === rows.length - 1 && hasIncompleteRow;
          return (
            <div key={rowIdx} style={{
              display:"flex",
              gap:8,
              justifyContent: isLastRow ? "center" : "stretch",
            }}>
              {rowCards.map((card) => {
                const isFlipped = room.flipped.includes(card.id) || room.matched.includes(card.id);
                const isMatched = room.matched.includes(card.id);
                const word = decodeWord(card.wordB64);
                // Largura: (maxBoardWidth - 3*gap) / 4 = (560-24)/4 = 134px fixo
                const cardW = (maxBoardWidth - (COLS - 1) * 8) / COLS;
                return (
                  <div
                    key={card.id}
                    className={`mem-card ${!isMyTurn || isMatched ? "disabled" : ""}`}
                    onClick={() => flipCard(card.id)}
                    style={{ width: cardW, flexShrink: 0 }}
                  >
                    <div className={`mem-card-inner ${isFlipped ? "flipped" : ""}`}>
                      <div className="mem-card-front">
                        <span style={{ fontSize:"clamp(16px,3vw,24px)", opacity:0.25 }}>?</span>
                      </div>
                      <div className={`mem-card-back ${isMatched ? "matched" : ""}`}>
                        <span style={{ fontSize:"clamp(9px,1.8vw,13px)", textAlign:"center", padding:"0 6px", fontWeight:500, color: isMatched?"#d1fae5":"#e9d5ff", lineHeight:1.3 }}>
                          {isFlipped ? word : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign:"center", marginTop:16, color:"#4a4272", fontSize:12 }}>
        Encontre pares de adjetivos <strong style={{ color:"#6c47ff" }}>opostos</strong> para marcar pontos
      </div>
    </div>
  );
}

// ─── VICTORY SCREEN ───────────────────────────────────────────────────────────
function VictoryScreen({ room, myId, onRestart, onHome }) {
  const sorted = [...(room?.players||[])].sort((a,b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const tiedPlayers = sorted.filter(p => p.score === topScore);
  const isTie = tiedPlayers.length >= 2;
  const myRank = sorted.findIndex(p => p.id === myId) + 1;
  const iAmTied = isTie && tiedPlayers.some(p => p.id === myId);

  // Pódio: empate mostra os empatados lado a lado no topo, sem cor de ouro
  const podiumHeights = [110, 150, 80];
  const podiumColors  = isTie ? ["#6c7a8a","#8a9bb0","#4a5568"] : ["#c0c0c0","#ffd700","#cd7f32"];
  const podiumLabels  = isTie ? ["=","=","3º"] : ["2º","1º","3º"];

  return (
    <div style={{ minHeight:"100vh", background: isTie ? "#07090e" : "#08060f", color:"#e8e4f8", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 24px", overflow:"hidden", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@300;400;500&display=swap');

        /* ── fundo vitória: raios de luz dourada ── */
        .bg-win::before {
          content:'';
          position:fixed; inset:0; z-index:0; pointer-events:none;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%,   #7c3aed44 0%, transparent 65%),
            radial-gradient(ellipse 60% 40% at 20% 100%, #c0850022 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 80% 90%,  #ffd70018 0%, transparent 55%);
        }
        .bg-win::after {
          content:'';
          position:fixed; inset:0; z-index:0; pointer-events:none;
          background: repeating-conic-gradient(from 0deg at 50% -10%, #ffd70006 0deg 10deg, transparent 10deg 30deg);
          animation: rotateBg 30s linear infinite;
        }
        @keyframes rotateBg { to { transform: rotate(360deg); } }

        /* ── fundo empate: névoa fria e estática ── */
        .bg-tie::before {
          content:'';
          position:fixed; inset:0; z-index:0; pointer-events:none;
          background:
            radial-gradient(ellipse 70% 50% at 30% 20%, #0d2a3a33 0%, transparent 60%),
            radial-gradient(ellipse 60% 45% at 75% 80%, #0a1e2a22 0%, transparent 55%);
        }

        /* ── confete (só vitória) ── */
        @keyframes confettiFall { 0%{transform:translateY(-80px) rotate(0deg);opacity:1} 100%{transform:translateY(105vh) rotate(540deg);opacity:0} }
        .confetti-piece { position:fixed; width:9px; height:9px; pointer-events:none; animation:confettiFall linear infinite; z-index:1; }

        /* ── pódio ── */
        @keyframes podiumRise { from{transform:scaleY(0);transform-origin:bottom} to{transform:scaleY(1)} }
        .podium-block { animation:podiumRise .6s ease-out; animation-fill-mode:both; }

        /* ── empate ── */
        @keyframes tieFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .tie-icon { animation:tieFloat 2.4s ease-in-out infinite; display:inline-block; }

        /* ── shared ── */
        .action-btn { padding:14px 32px; border-radius:12px; font-size:16px; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:500; transition:all .15s; }
        .rank-row { background:#0f1018; border:1px solid #1e2030; border-radius:10px; padding:10px 16px; display:flex; align-items:center; gap:12px; position:relative; z-index:2; }
        .rank-row.me   { border-color:#4a4080; background:#13112a; }
        .rank-row.tied { border-color:#3a4a5a; background:#0d1220; }
        .tie-banner { background:linear-gradient(135deg,#0a1520,#101c28); border:1px solid #1e2e3a; border-radius:16px; padding:20px 32px; text-align:center; position:relative; z-index:2; }
        .end-content { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; width:100%; }
      `}</style>

      {/* camada de fundo condicional */}
      <div className={isTie ? "bg-tie" : "bg-win"} style={{ position:"fixed", inset:0, zIndex:0 }} />

      {/* confete apenas na vitória */}
      {!isTie && Array.from({length:22}).map((_,i) => (
        <div key={i} className="confetti-piece" style={{
          left:`${Math.random()*100}%`,
          background:["#a78bfa","#ffd700","#f87171","#fbbf24","#60a5fa","#f472b6","#34d399"][i%7],
          animationDuration:`${2.2+Math.random()*3}s`,
          animationDelay:`${Math.random()*2.5}s`,
          borderRadius: Math.random()>0.5?"50%":"2px",
          width: Math.random()>0.5 ? "8px" : "12px",
          height: Math.random()>0.5 ? "8px" : "5px",
        }}/>
      ))}

      <div className="end-content">

      {/* ── Cabeçalho ── */}
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontSize:12, letterSpacing:4, color:"#4a5070", textTransform:"uppercase", marginBottom:12, fontFamily:"'DM Sans',sans-serif" }}>Fim de Jogo</div>

        {isTie ? (
          <div className="tie-banner">
            <div style={{ fontSize:40, marginBottom:8 }}><span className="tie-icon">🤝</span></div>
            <h1 style={{ fontFamily:"'Abril Fatface',serif", fontSize:"clamp(32px,6vw,56px)", margin:"0 0 10px", color:"#8ab0cc" }}>
              Empate!
            </h1>
            <div style={{ fontSize:15, color:"#4a6070", lineHeight:1.6 }}>
              {tiedPlayers.map(p => p.name).join(" e ")} terminaram com <strong style={{ color:"#6a8a9a" }}>{topScore} {topScore === 1 ? "par" : "pares"}</strong>
            </div>
            {iAmTied && <div style={{ fontSize:14, color:"#5a7a8a", marginTop:8 }}>Você empatou em primeiro lugar.</div>}
          </div>
        ) : (
          <div>
            <h1 style={{ fontFamily:"'Abril Fatface',serif", fontSize:"clamp(36px,7vw,64px)", margin:0, color:"#c4b5fd" }}>
              {sorted[0]?.name} Venceu!
            </h1>
            {myRank === 1 && <div style={{ fontSize:16, color:"#7a6a9a", marginTop:8 }}>Você venceu esta partida.</div>}
          </div>
        )}
      </div>

      {/* ── Pódio ── */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:4, marginBottom:36, width:"100%", maxWidth:420 }}>
        {[sorted[1], sorted[0], sorted[2]].map((player, vi) => {
          if (!player) return <div key={vi} style={{ flex:1 }}/>;
          const isTiedSlot = isTie && player.score === topScore;
          const color = isTiedSlot ? "#6c7a8a" : podiumColors[vi];
          const label = isTiedSlot ? "=" : podiumLabels[vi];
          return (
            <div key={player.id} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ marginBottom:8, textAlign:"center" }}>
                {!isTie && vi===1 && <div style={{ fontSize:24, marginBottom:4, opacity:0.6 }}>🏆</div>}
                <div style={{ fontSize:13, fontWeight:500, color:"#9a94b8", wordBreak:"break-word" }}>{player.name}</div>
                <div style={{ fontSize:20, fontWeight:500, color }}>{player.score} pts</div>
              </div>
              <div className="podium-block" style={{
                width:"100%", height:podiumHeights[vi],
                background:`linear-gradient(180deg,${color}33,${color}11)`,
                border:`1.5px solid ${color}55`,
                borderRadius:"8px 8px 0 0",
                display:"flex", alignItems:"center", justifyContent:"center",
                animationDelay:`${vi*0.15}s`
              }}>
                <span style={{ fontSize:20, fontWeight:700, color:`${color}cc`, fontFamily:"'Abril Fatface',serif" }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Placar Final ── */}
      <div style={{ width:"100%", maxWidth:500, marginBottom:40 }}>
        <div style={{ fontSize:12, color:"#3a3860", marginBottom:12, textAlign:"center", letterSpacing:2, textTransform:"uppercase" }}>Placar Final</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sorted.map((p,i) => {
            const isTiedRow = isTie && p.score === topScore;
            return (
              <div key={p.id} className={`rank-row ${p.id===myId?"me":""} ${isTiedRow?"tied":""}`}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:PLAYER_COLORS[i%PLAYER_COLORS.length]+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:500, color:PLAYER_COLORS[i%PLAYER_COLORS.length]+"aa", flexShrink:0 }}>
                  {isTiedRow ? "=" : i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}
                </div>
                <div style={{ flex:1, color:"#b0aac8" }}>{p.name}</div>
                {p.id===myId && <span style={{ fontSize:11, color:"#3a3860" }}>você</span>}
                <div style={{ fontSize:18, fontWeight:500, color:PLAYER_COLORS[i%PLAYER_COLORS.length]+"aa" }}>{p.score}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ações ── */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        <button className="action-btn" onClick={onRestart} style={{ background: isTie ? "#111a22" : "#1a1430", border: isTie ? "1px solid #1e2e3a" : "1px solid #3a2860", color: isTie ? "#5a7888" : "#9a80c8" }}>🔄 Jogar Novamente</button>
        <button className="action-btn" onClick={onHome}    style={{ background:"transparent", border: isTie ? "1px solid #1a2530" : "1px solid #2a2040", color: isTie ? "#3a5060" : "#6a5890" }}>🏠 Página Inicial</button>
      </div>
      </div>{/* end-content */}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [roomId, setRoomId]   = useState(null);
  const [isHost, setIsHost]   = useState(false);
  const [myId, setMyId]       = useState(null);
  const [finalRoom, setFinalRoom] = useState(null);

  return (
    <>
      {screen === "landing"  && <LandingPage onCreateRoom={() => { setRoomId(generateRoomId()); setIsHost(true);  setScreen("lobby");   }}
                                              onJoinRoom={id  => { setRoomId(id);               setIsHost(false); setScreen("lobby");   }}
                                              onTutorial={() => setScreen("tutorial")} />}
      {screen === "tutorial" && <Tutorial onFinish={() => setScreen("landing")} />}
      {screen === "lobby"    && <Lobby roomId={roomId} isHost={isHost}
                                        onGameStart={(_, pId) => { setMyId(pId); setScreen("game"); }}
                                        onBack={() => setScreen("landing")} />}
      {screen === "game"     && <GameBoard roomId={roomId} myId={myId}
                                            onGameOver={r => { setFinalRoom(r); setScreen("victory"); }} />}
      {screen === "victory"  && <VictoryScreen room={finalRoom} myId={myId}
                                                onRestart={() => setScreen("lobby")}
                                                onHome={() => setScreen("landing")} />}
    </>
  );
}
