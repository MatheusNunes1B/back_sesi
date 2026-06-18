const supabase = require('../../lib/supabase');
const { verifyAuth } = require('../../lib/auth');

/**
 * GET /api/leitura/progresso?periodo=semana|mes
 * Header: Authorization: Bearer <jwt>
 *
 * Retorna os minutos lidos agrupados por dia para o aluno autenticado.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const { user, error: authError } = await verifyAuth(req, res);
  if (authError) return;

  // Período: semana (7 dias) ou mês (30 dias)
  const periodo = req.query?.periodo === 'mes' ? 30 : 7;
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - periodo);

  const { data: registros, error } = await supabase
    .from('registros_leitura')
    .select('minutos, criado_em')
    .eq('aluno_id', user.id)
    .gte('criado_em', dataInicio.toISOString())
    .order('criado_em', { ascending: true });

  if (error) {
    console.error('[progresso] Error:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar progresso.' });
  }

  // Agrupa por dia
  const porDia = {};
  for (const r of registros || []) {
    const dia = r.criado_em.slice(0, 10);
    porDia[dia] = (porDia[dia] || 0) + r.minutos;
  }

  const totalPeriodo = Object.values(porDia).reduce((a, b) => a + b, 0);

  // Status de hoje
  const hoje = new Date().toISOString().slice(0, 10);
  const lidoHoje = porDia[hoje] || 0;

  return res.status(200).json({
    periodo,
    totalPeriodo,
    lidoHoje,
    restanteHoje: Math.max(0, 16 - lidoHoje),
    porDia,
  });
};
