'use strict';
/**
 * Quanto do processador o programa usa: "leve" ou "total".
 *
 * Total: transcricao e corte usam quase todos os nucleos - mais rapido, mas o
 * PC trabalha no maximo (PC fraco ou mal ventilado esquenta e pode desligar).
 * Leve: metade dos nucleos e prioridade baixa - demora mais, o PC esquenta bem
 * menos e continua usavel enquanto gera os cortes.
 *
 * A escolha fica no config.json (o mesmo da pasta de salvar) e vale na hora.
 * A gravacao da live NUNCA fica com prioridade baixa: perder pedaco da live e pior.
 */

const os = require('os');
const pastas = require('./pastas');

const MODOS = ['leve', 'total'];

/** O que a pessoa escolheu, ou null se ainda nao escolheu (primeira vez). */
function escolhido() {
  const m = pastas.lerConfig().desempenho;
  return MODOS.includes(m) ? m : null;
}

/** O modo que vale agora (sem escolha ainda: o recomendado pro PC). */
function modo() {
  return escolhido() || recomendado();
}

function definir(m) {
  if (!MODOS.includes(m)) throw new Error('Modo invalido.');
  const cfg = pastas.lerConfig();
  cfg.desempenho = m;
  pastas.gravarConfig(cfg);
  return m;
}

/**
 * O Windows mostra um pouco menos de RAM do que o pente tem (a placa de video
 * integrada reserva uma parte): 16 GB aparecem como 15,4. Mostra o tamanho do pente.
 */
function ramDoPente(gb) {
  const tamanhos = [2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128];
  return tamanhos.find((t) => gb <= t && gb >= t * 0.85) || Math.round(gb);
}

/** O PC da pessoa, pra mostrar na tela e recomendar. */
function pc() {
  const cpus = os.cpus() || [];
  return {
    nucleos: cpus.length || 1,
    ramGb: ramDoPente(os.totalmem() / 1073741824),
    processador: String((cpus[0] && cpus[0].model) || '').replace(/\s+/g, ' ').replace(/\(R\)|\(TM\)|CPU|@.*$/gi, '').trim(),
  };
}

/**
 * Leve pra PC com menos de 12 GB de RAM ou ate 4 nucleos (threads); total pro resto.
 */
function recomendado() {
  const p = pc();
  return p.ramGb < 12 || p.nucleos <= 4 ? 'leve' : 'total';
}

/** Quantos nucleos a transcricao e o corte podem usar. */
function nucleos() {
  const n = pc().nucleos;
  return modo() === 'leve' ? Math.max(1, Math.floor(n / 2)) : Math.max(1, n - 2);
}

/** No modo leve, o processo roda com prioridade baixa (o resto do PC passa na frente). */
function aliviar(proc) {
  if (modo() !== 'leve' || !proc || !proc.pid) return;
  try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) { /* processo ja terminou */ }
}

/** Pro ffmpeg que recodifica (libx264): no modo leve, limita os nucleos. */
function argsDoFfmpeg(args) {
  if (modo() !== 'leve') return args;
  const i = args.indexOf('libx264');
  if (i < 0 || args.includes('-threads')) return args;
  const novo = args.slice();
  novo.splice(i + 1, 0, '-threads', String(nucleos()));
  return novo;
}

function resumo() {
  return { modo: modo(), escolhido: escolhido(), recomendado: recomendado(), pc: pc() };
}

module.exports = { modo, escolhido, definir, pc, recomendado, nucleos, aliviar, argsDoFfmpeg, resumo };
