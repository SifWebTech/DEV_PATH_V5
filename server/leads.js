/*
 * Cadastro de leads: validação, gravação na planilha e exclusão (LGPD).
 * Contato aceito: e-mail, @ do Instagram ou WhatsApp com DDD.
 */
'use strict';

const crypto = require('crypto');
const store = require('./store');
const funil = require('./funil');
const sessao = require('./sessao');
const { stamp } = require('./util');
const { INTERESTS } = require('./config');

const CONTACT_TYPES = ['email', 'instagram', 'whatsapp'];
const VISITOR_RE = /^[A-Za-z0-9-]{8,40}$/;

// "(17) 99999-0000", "+55 17 99999 0000" → "5517999990000"; null se não for um número brasileiro
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return /^[1-9]{2}9?\d{8}$/.test(d) ? '55' + d : null;
}

function validateLead(b) {
  const name = String(b.name || '').replace(/\s+/g, ' ').trim();
  const raw = String(b.contact || '').trim();
  const interest = String(b.interest || '');
  const errors = {};
  if (name.length < 2 || name.length > 40) errors.name = 'Digite seu nome (2 a 40 letras).';

  // O celular informa o tipo; sem ele (versão antiga da página), deduz como na V4
  let contactType = CONTACT_TYPES.includes(b.contactType) ? b.contactType : (raw.includes('@') && !raw.startsWith('@') ? 'email' : 'instagram');
  let contact = raw;
  if (contactType === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw) || raw.length > 80) errors.contact = 'Digite um e-mail válido.';
  } else if (contactType === 'instagram') {
    if (!/^@?[A-Za-z0-9._]{2,30}$/.test(raw)) errors.contact = 'Digite seu @ do Instagram.';
    else contact = raw.startsWith('@') ? raw : '@' + raw;
  } else {
    contact = normalizePhone(raw);
    if (!contact) errors.contact = 'Digite o WhatsApp com DDD, ex.: (17) 99999-0000.';
  }
  if (!INTERESTS.includes(interest)) errors.interest = 'Escolha o que mais chama sua atenção.';
  if (b.consent !== true) errors.consent = 'Precisamos da sua autorização para entrar em contato.';
  return { errors, lead: { name, contact, contactType, interest } };
}

// Na planilha, Instagram e WhatsApp viram links clicáveis (e não começam com @ ou +, que o Excel trata como fórmula)
function contactCell(lead) {
  if (lead.contactType === 'instagram') return 'instagram.com/' + lead.contact.slice(1);
  if (lead.contactType === 'whatsapp') return 'wa.me/' + lead.contact;
  return lead.contact;
}

function create(body) {
  const { errors, lead } = validateLead(body);
  if (Object.keys(errors).length) return { errors };
  lead.id = crypto.randomUUID();
  lead.when = stamp();
  lead.evento = sessao.evento();
  lead.visitante = VISITOR_RE.test(body.visitante || '') ? body.visitante : '';
  store.appendLead(lead, contactCell(lead));
  funil.track('lead', lead.evento, { lead: lead.id, visitante: lead.visitante, interesse: lead.interest, contato: lead.contactType });
  sessao.addLead(lead);
  return { lead };
}

// Exclusão pedida pelo visitante (no celular) ou pelo operador. O funil mantém só o id anônimo.
function remove(id, quem) {
  const found = store.deleteLead(String(id || ''));
  if (!found) return false;
  const evento = sessao.leads.get(id)?.evento || sessao.evento();
  sessao.forget(id);
  funil.track('lead_excluido', evento, { lead: id, por: quem });
  return true;
}

module.exports = { create, remove, validateLead, normalizePhone, VISITOR_RE };
