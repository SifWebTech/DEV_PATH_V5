/*
 * Login do painel do operador. A senha vai uma vez num POST e vira um cookie de sessão
 * (HttpOnly, só deste site), em vez de andar na URL (?key=) como na V4.
 *
 * O cookie é ASSINADO com o SESSION_SECRET ("validade.assinatura"): o servidor não precisa
 * guardar nada, então o login sobrevive a reinícios e deploys na nuvem. Em HTTPS ele vai com Secure.
 */
'use strict';

const crypto = require('crypto');
const { ADMIN_KEY, SESSION_SECRET } = require('./config');
const { parseCookies } = require('./util');

const COOKIE = 'devpath_op';
const VALIDADE = 12 * 60 * 60 * 1000; // um dia de evento
const failures = new Map();           // ip → { n, ate }
const sign = (v) => crypto.createHmac('sha256', SESSION_SECRET).update('op:' + v).digest('base64url');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sameKey = (a) => crypto.timingSafeEqual(hash(a), hash(ADMIN_KEY));

// 5 senhas erradas seguidas bloqueiam aquele aparelho por 1 minuto
function login(key, ip, secure) {
  const f = failures.get(ip);
  if (f && f.n >= 5 && Date.now() < f.ate) return { error: 'Muitas tentativas. Espere 1 minuto.', status: 429 };
  if (!sameKey(key)) {
    const n = (f && Date.now() < f.ate ? f.n : 0) + 1;
    failures.set(ip, { n, ate: Date.now() + 60_000 });
    return { error: 'Senha incorreta. A senha aparece na janela preta do servidor.', status: 401 };
  }
  failures.delete(ip);
  const exp = String(Date.now() + VALIDADE);
  return { cookie: `${COOKIE}=${exp}.${sign(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${VALIDADE / 1000}${secure ? '; Secure' : ''}` };
}

function isAuthed(req) {
  const [exp, sig] = String(parseCookies(req)[COOKIE] || '').split('.');
  if (!exp || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Date.now() < Number(exp);
}

function logout(req, secure) {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

module.exports = { login, isAuthed, logout };
