const supabase = require('../../lib/supabase');
const { verifyAuth } = require('../../lib/auth');

const LIMITE_DIARIO = 16; // minutos máximos por dia

/**
 * POST /api/leitura/registrar
 * Header: Authorization: Bearer <jwt>
 * Body: { minutos: number }
 *
 * Regras:
 *  - Máximo de 16 minutos acumulados por dia por aluno
 *  - Validação dupla: front-end (JS) + back-end (aqui)
 *  - Cada registro ganha timestamp automático
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  // 1. Autenticação
  const { user, error: authError } = await verifyAuth(req, res);
  if (authError) return;

  // 2. Validação do body
  const minutos = Number(req.body?.minutos);

  if (!Number.isInteger(minutos) || minutos <= 0) {
    return res.status(400).json({ error: 'Informe um número inteiro positivo de minutos.' });
  }

  if (minutos > LIMITE_DIARIO) {
    return res.status(400).json({
      error: `Você não pode registrar mais de ${LIMITE_DIARIO} minutos de uma só vez.`,
      limite: LIMITE_DIARIO,
    });
  }

  // 3. Calcula total já lido hoje
  const hoje = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const { data: registrosHoje, error: fetchError } = await supabase
    .from('registros_leitura')
    .select('minutos')
    .eq('aluno_id', user.id)
    .gte('criado_em', `${hoje}T00:00:00.000Z`)
    .lte('criado_em', `${hoje}T23:59:59.999Z`);

  if (fetchError) {
    console.error('[registrar] Fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Erro ao verificar registros do dia.' });
  }

  const totalHoje = (registrosHoje || []).reduce((acc, r) => acc + r.minutos, 0);
  const restante = LIMITE_DIARIO - totalHoje;

  if (restante <= 0) {
    return res.status(400).json({
      error: `Você já atingiu o limite diário de ${LIMITE_DIARIO} minutos. Volte amanhã! 📚`,
      totalHoje,
      limite: LIMITE_DIARIO,
    });
  }

  if (minutos > restante) {
    return res.status(400).json({
      error: `Você já leu ${totalHoje} min hoje. Você pode registrar no máximo ${restante} min a mais.`,
      totalHoje,
      restante,
      limite: LIMITE_DIARIO,
    });
  }

  // 4. Insere o registro
  const { data: novoRegistro, error: insertError } = await supabase
    .from('registros_leitura')
    .insert({
      aluno_id: user.id,
      minutos,
      criado_em: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('[registrar] Insert error:', insertError.message);
    return res.status(500).json({ error: 'Erro ao salvar registro de leitura.' });
  }

  return res.status(201).json({
    message: `✅ ${minutos} minuto(s) registrado(s) com sucesso!`,
    totalHoje: totalHoje + minutos,
    restanteHoje: restante - minutos,
    registro: novoRegistro,
  });
};
