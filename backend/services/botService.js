const Message = require('../models/Message');

const BOT_ID = 'ecoroute-bot';
const BOT_NAME = 'EcoBot';
const BOT_ROLE = 'BOT';

const STATE = {
  INIT: 'INIT',
  MENU: 'MENU',
  SUBMENU: 'SUBMENU',
  COLLECTING_CONTACT: 'COLLECTING_CONTACT',
  CONFIRMING_HANDOFF: 'CONFIRMING_HANDOFF',
  HANDED_OFF: 'HANDED_OFF',
  FINISHED: 'FINISHED'
};

const sessions = new Map();

const MENU = [
  {
    id: '1',
    title: 'Agendar coleta de resíduos',
    response: 'Para agendar uma coleta, acesse o menu *Pontos de Coleta* → *Adicionar Ponto*, ou *Rotas* → *Gerar Rota*. O sistema calcula automaticamente a melhor data com SLA de 2 dias úteis.\n\nPosso ajudar em mais alguma coisa?'
  },
  {
    id: '2',
    title: 'Cadastrar / editar ponto de coleta',
    response: 'Para cadastrar um novo ponto, vá em *Pontos de Coleta* → *Adicionar*. Você precisa informar: nome, endereço (ou CEP), capacidade em kg e os tipos de resíduo aceitos.\n\nPara editar, clique no ponto na listagem e selecione *Editar*.\n\nPosso ajudar em mais alguma coisa?'
  },
  {
    id: '3',
    title: 'Dúvidas sobre rotas e otimização',
    response: 'O EcoRoute calcula rotas otimizadas usando o algoritmo Nearest Neighbor. Para gerar uma rota, vá em *Rotas* → *Gerar de Pontos* (vincula 2+ pontos com coordenadas). A rota mostra distância total, combustível estimado e pegada de CO₂.\n\nPosso ajudar em mais alguma coisa?'
  },
  {
    id: '4',
    title: 'Materiais aceitos / tipos de resíduo',
    response: 'O EcoRoute trabalha com os seguintes tipos: *plástico, papel, vidro, metal, orgânico e eletrônico*. Ao cadastrar um ponto, você seleciona quais materiais ele recebe.\n\nPosso ajudar em mais alguma coisa?'
  },
  {
    id: '5',
    title: 'Status de uma coleta / rota',
    response: 'Acesse *Rotas* na barra lateral. Cada rota tem um status: *Planejada*, *Em andamento*, *Concluída* ou *Cancelada*. Clique na rota para ver detalhes de cada ponto.\n\nPosso ajudar em mais alguma coisa?'
  },
  {
    id: '6',
    title: 'Falar com um atendente humano',
    handoff: true
  }
];

const POST_RESPONSE_OPTIONS = [
  { id: 'menu', label: 'Voltar ao menu' },
  { id: 'human', label: 'Falar com atendente' },
  { id: 'end', label: 'Encerrar conversa' }
];

function getRoom(userId) {
  return `bot_${userId}`;
}

function buildMessage(content, options = null, extras = {}) {
  return {
    _id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content,
    sender: BOT_ID,
    senderName: BOT_NAME,
    senderRole: BOT_ROLE,
    isBot: true,
    timestamp: new Date(),
    options,
    ...extras
  };
}

function buildMenuMessage(greetingName) {
  const greeting = greetingName
    ? `Olá, *${greetingName}*! Sou o EcoBot, assistente virtual do EcoRoute. 🌱\n\n`
    : 'Olá! Sou o EcoBot, assistente virtual do EcoRoute. 🌱\n\n';

  const menuText = MENU.map(item => `*${item.id}* — ${item.title}`).join('\n');

  return buildMessage(
    `${greeting}Como posso te ajudar hoje? Digite o número da opção ou descreva sua dúvida:\n\n${menuText}`,
    MENU.map(item => ({ id: item.id, label: item.title }))
  );
}

function startSession(user) {
  const userId = user._id.toString();
  const session = {
    userId,
    userName: user.name,
    userRole: user.role,
    state: STATE.MENU,
    history: [],
    selectedTopic: null,
    startedAt: new Date()
  };
  sessions.set(userId, session);

  const message = buildMenuMessage(user.name);
  session.history.push({ from: 'bot', content: message.content, at: new Date() });

  return { session, message, room: getRoom(userId) };
}

function getSession(userId) {
  return sessions.get(userId.toString());
}

function endSession(userId) {
  sessions.delete(userId.toString());
}

function normalize(text) {
  return (text || '').toString().trim().toLowerCase();
}

function detectHumanIntent(text) {
  const t = normalize(text);
  if (!t) return false;
  const keywords = [
    'atendente', 'humano', 'pessoa', 'falar com alguem', 'falar com alguém',
    'suporte humano', 'quero falar', 'transferir', 'agente'
  ];
  return keywords.some(k => t.includes(k));
}

function detectEndIntent(text) {
  const t = normalize(text);
  return ['sair', 'encerrar', 'fim', 'tchau', 'obrigado', 'obrigada', 'nao', 'não'].includes(t);
}

function detectMenuIntent(text) {
  const t = normalize(text);
  return ['menu', 'voltar', 'inicio', 'início', 'opcoes', 'opções'].includes(t);
}

function processInput(userId, input) {
  const session = getSession(userId);
  if (!session) {
    return { error: 'Sessão do bot não iniciada. Envie bot:start primeiro.' };
  }

  const text = (input || '').toString().trim();
  session.history.push({ from: 'user', content: text, at: new Date() });

  if (detectHumanIntent(text)) {
    return askConfirmHandoff(session);
  }

  if (session.state === STATE.CONFIRMING_HANDOFF) {
    return handleHandoffConfirmation(session, text);
  }

  if (detectEndIntent(text)) {
    session.state = STATE.FINISHED;
    return {
      action: 'reply',
      message: buildMessage('Obrigado por usar o EcoRoute! 🌱 Sempre que precisar, é só chamar.')
    };
  }

  if (detectMenuIntent(text)) {
    session.state = STATE.MENU;
    return {
      action: 'reply',
      message: buildMenuMessage(null)
    };
  }

  if (session.state === STATE.MENU) {
    return handleMenuChoice(session, text);
  }

  if (session.state === STATE.SUBMENU) {
    return handleSubmenuChoice(session, text);
  }

  return {
    action: 'reply',
    message: buildMessage(
      'Desculpe, não entendi. Digite *menu* para ver as opções novamente ou *atendente* para falar com um humano.'
    )
  };
}

function handleMenuChoice(session, text) {
  const choice = MENU.find(m => m.id === text.trim());

  if (!choice) {
    return {
      action: 'reply',
      message: buildMessage(
        'Não reconheci essa opção. Por favor, digite um número de *1* a *6*, ou *atendente* para falar com um humano.'
      )
    };
  }

  if (choice.handoff) {
    return askConfirmHandoff(session);
  }

  session.selectedTopic = choice.id;
  session.state = STATE.SUBMENU;

  return {
    action: 'reply',
    message: buildMessage(
      choice.response,
      POST_RESPONSE_OPTIONS
    )
  };
}

function handleSubmenuChoice(session, text) {
  const t = normalize(text);

  if (t === 'menu' || t === '1') {
    session.state = STATE.MENU;
    session.selectedTopic = null;
    return { action: 'reply', message: buildMenuMessage(null) };
  }

  if (t === 'human' || t === 'atendente' || t === '2') {
    return askConfirmHandoff(session);
  }

  if (t === 'end' || t === 'encerrar' || t === '3') {
    session.state = STATE.FINISHED;
    return {
      action: 'reply',
      message: buildMessage('Obrigado por usar o EcoRoute! 🌱 Conversa encerrada.')
    };
  }

  session.state = STATE.MENU;
  return {
    action: 'reply',
    message: buildMessage(
      'Não entendi. Voltando ao menu principal.\n\n' + buildMenuMessage(null).content
    )
  };
}

function askConfirmHandoff(session) {
  session.state = STATE.CONFIRMING_HANDOFF;
  return {
    action: 'reply',
    message: buildMessage(
      'Vou te encaminhar para um atendente humano. Antes disso, pode me descrever brevemente sua dúvida ou problema? Isso ajuda o atendente a te ajudar mais rápido.\n\nDigite sua mensagem ou *confirmar* para transferir agora.',
      [
        { id: 'confirm', label: 'Transferir agora' },
        { id: 'cancel', label: 'Cancelar' }
      ]
    )
  };
}

function handleHandoffConfirmation(session, text) {
  const t = normalize(text);

  if (t === 'cancel' || t === 'cancelar' || t === 'não' || t === 'nao') {
    session.state = STATE.MENU;
    return {
      action: 'reply',
      message: buildMessage(
        'Tudo bem, vou continuar te atendendo. ' + buildMenuMessage(null).content
      )
    };
  }

  const userDescription =
    t === 'confirm' || t === 'confirmar' || t === 'transferir' || t.length === 0
      ? '(sem descrição adicional)'
      : text.trim();

  session.handoffDescription = userDescription;
  session.state = STATE.HANDED_OFF;

  return {
    action: 'handoff',
    message: buildMessage(
      '🔄 Estou te encaminhando para um atendente humano. Aguarde um momento enquanto verifico quem está disponível...'
    ),
    context: buildHandoffContext(session)
  };
}

function buildHandoffContext(session) {
  const topic = session.selectedTopic
    ? MENU.find(m => m.id === session.selectedTopic)?.title
    : null;

  const transcript = session.history
    .map(h => `${h.from === 'user' ? '👤 ' + session.userName : '🤖 EcoBot'}: ${h.content}`)
    .join('\n');

  return {
    userId: session.userId,
    userName: session.userName,
    userRole: session.userRole,
    topic: topic || 'Não classificado',
    description: session.handoffDescription || '(sem descrição)',
    transcript,
    startedAt: session.startedAt
  };
}

async function persistMessage(room, content, userIdRef) {
  try {
    const msg = new Message({
      content,
      room,
      sender: userIdRef,
      senderName: BOT_NAME,
      senderRole: 'ADMIN',
      isSupportMessage: true,
      status: 'delivered'
    });
    await msg.save();
    return msg;
  } catch (err) {
    console.error('⚠️ Bot: erro ao persistir mensagem:', err.message);
    return null;
  }
}

module.exports = {
  BOT_ID,
  BOT_NAME,
  STATE,
  startSession,
  processInput,
  endSession,
  getSession,
  getRoom,
  buildMessage,
  persistMessage
};
