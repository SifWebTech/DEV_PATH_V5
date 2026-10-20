/*
 * Saudação com o nome do visitante ("Olá, Ana! Que bom ter você aqui!") na mesma voz neural dos MP3
 * da narração (Thalita, pt-BR), gerada aqui no servidor pelo serviço de voz do Microsoft Edge (msedge-tts).
 *
 * Por que no servidor: a voz do navegador (speechSynthesis) fica bloqueada na TV aberta sozinha em
 * tela cheia, sem ninguém clicar, e aí o nome só aparecia na legenda.
 *
 *   voz.preparar(lead)  → começa a gerar assim que o visitante se cadastra (fica pronta antes da TV pedir)
 *   voz.ola(id)         → Promise<Buffer | null>   (null = sem internet ou serviço fora do ar)
 *
 * A TV pede GET /api/voz/ola/<id do cadastro>.mp3. Sem o MP3, ela tenta a voz do navegador e,
 * por último, o "Olá. Seu DEV PATH começa agora." gravado.
 */
'use strict';

const VOZ = 'pt-BR-ThalitaMultilingualNeural';
const PROSODIA = { rate: '+12%', pitch: '+6Hz' }; // igual a ferramentas/gerar_narracao.py: voz animada
const TEXTO = (nome) => `Olá, ${nome}! Que bom ter você aqui!`; // o mesmo texto do manifesto (narration.js → boot)
const LIMITE = 200;                                 // saudações guardadas na memória
const cache = new Map();                            // id do cadastro → Promise<Buffer | null>

// Só o primeiro nome, só letras (o texto vai dentro de um SSML)
const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '').slice(0, 30);

async function gerar(nome) {
  let MsEdgeTTS, OUTPUT_FORMAT;
  try { ({ MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts')); } catch { return null; }
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(TEXTO(nome), PROSODIA);
    const partes = [];
    await new Promise((ok, falha) => {
      const t = setTimeout(() => falha(new Error('tempo esgotado')), 10_000);
      audioStream.on('data', (c) => partes.push(c));
      audioStream.on('close', () => { clearTimeout(t); ok(); });
      audioStream.on('error', (e) => { clearTimeout(t); falha(e); });
    });
    const mp3 = Buffer.concat(partes);
    return mp3.length > 1000 ? mp3 : null;
  } catch (err) {
    console.warn(`  ⚠ Voz com o nome: falhou (${err.message}).`);
    return null;
  } finally {
    try { tts.close(); } catch {}
  }
}

function preparar(lead) {
  const nome = primeiroNome(lead?.name);
  if (!lead?.id || !nome || cache.has(lead.id)) return;
  // o serviço às vezes recusa por excesso de pedidos (429): uma segunda tentativa logo depois resolve
  const p = gerar(nome).then((mp3) => mp3 || new Promise((r) => setTimeout(r, 1500)).then(() => gerar(nome)));
  cache.set(lead.id, p);
  p.then((mp3) => { if (!mp3) cache.delete(lead.id); }); // falhou: tenta de novo quando a TV pedir
  while (cache.size > LIMITE) cache.delete(cache.keys().next().value);
}

function ola(lead) {
  if (!lead) return Promise.resolve(null);
  preparar(lead);
  return cache.get(lead.id) || Promise.resolve(null);
}

const esquecer = (id) => cache.delete(id);

module.exports = { preparar, ola, esquecer, TEXTO };
