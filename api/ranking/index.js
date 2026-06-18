const supabase = require('../../lib/supabase');
const { verifyAuth } = require('../../lib/auth');

/**
 * GET /api/ranking
 * Header: Authorization: Bearer <jwt>
 * Query: ?tipo=turmas|escola
 *
 * tipo=turmas  → ranking de minutos por turma
 * tipo=escola  → total acumulado de toda a escola (termômetro)
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const { user, error: authError } = await verifyAuth(req, res);
  if (authError) return;

  const tipo = req.query?.tipo || 'turmas';

  // ----- Termômetro geral da escola -----
  if (tipo === 'escola') {
    const { data, error } = await supabase
      .from('registros_leitura')
      .select('minutos');

    if (error) {
      console.error('[ranking/escola] Error:', error.message);
      return res.status(500).json({ error: 'Erro ao buscar total da escola.' });
    }

    const totalEscola = (data || []).reduce((acc, r) => acc + r.minutos, 0);
    const META_ESCOLA = 100000; // meta da escola em minutos — ajuste conforme necessário

    return res.status(200).json({
      totalEscola,
      meta: META_ESCOLA,
      percentual: Math.min(100, ((totalEscola / META_ESCOLA) * 100).toFixed(1)),
    });
  }

  // ----- Ranking por turma -----
  // Busca todos os alunos com suas turmas e soma os minutos lidos
  const { data: alunos, error: alunosError } = await supabase
    .from('alunos')
    .select('id, turma, ano');

  if (alunosError) {
    console.error('[ranking/turmas] Alunos error:', alunosError.message);
    return res.status(500).json({ error: 'Erro ao buscar turmas.' });
  }

  const { data: registros, error: regError } = await supabase
    .from('registros_leitura')
    .select('aluno_id, minutos');

  if (regError) {
    console.error('[ranking/turmas] Registros error:', regError.message);
    return res.status(500).json({ error: 'Erro ao buscar registros.' });
  }

  // Mapa aluno_id → turma
  const turmaMap = {};
  for (const a of alunos || []) {
    turmaMap[a.id] = `${a.turma} - ${a.ano}`;
  }

  // Soma por turma
  const somaPorTurma = {};
  for (const r of registros || []) {
    const turma = turmaMap[r.aluno_id] || 'Sem turma';
    somaPorTurma[turma] = (somaPorTurma[turma] || 0) + r.minutos;
  }

  // Ordena do maior para o menor
  const ranking = Object.entries(somaPorTurma)
    .map(([turma, totalMinutos]) => ({ turma, totalMinutos }))
    .sort((a, b) => b.totalMinutos - a.totalMinutos)
    .map((item, index) => ({ posicao: index + 1, ...item }));

  return res.status(200).json({ ranking });
};
