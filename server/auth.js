/*
 * Login do painel do operador. A senha vai uma vez num POST e vira um cookie de sessão
 * (HttpOnly, só deste site), em vez de andar na URL (?key=) como na V4, onde ficava
 * no histórico do navegador e em qualquer link copiado.
 */
'use strict';

const crypto = require('crypto');
const { ADMIN_KEY } = require('./config');
const { parseCookies } = require('./util');

const COOKIE = 'devpath_op';
const VALIDADE = 12 * 60 * 60 * 1000; // um dia de evento
const sessions = new Map();           // token → expira em (ms)
const failures = new Map();           // ip → { n, ate }

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sameKey = (a) => crypto.timingSafeEqual(hash(a), hash(ADMIN_KEY));

// 5 senhas erradas seguidas bloqueiam aquele aparelho por 1 minuto
function login(key, ip) {
  const f = failures.get(ip);
  if (f && f.n >= 5 && Date.now() < f.ate) return { error: 'Muitas tentativas. Espere 1 minuto.', status: 429 };
  if (!sameKey(key)) {
    const n = (f && Date.now() < f.ate ? f.n : 0) + 1;
    failures.set(ip, { n, ate: Date.now() + 60_000 });
    return { error: 'Senha incorreta. A senha aparece na janela preta do servidor.', status: 401 };
  }
  failures.delete(ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + VALIDADE);
  return { cookie: `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${VALIDADE / 1000}` };
}

function isAuthed(req) {
  const token = parseCookies(req)[COOKIE];
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}

function logout(req) {
  sessions.delete(parseCookies(req)[COOKIE]);
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

module.exports = { login, isAuthed, logout };
