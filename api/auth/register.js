/**
 * POST /api/auth/register
 * Body: { rm, nome, turma, ano, senha }
 *
 * Cria o usuário no Supabase Auth e insere o perfil na tabela `alunos`.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  let supabase;
  try {
    supabase = require('../../lib/supabase');
    if (!supabase) {
      return res.status(500).json({ error: 'Variáveis de ambiente ausentes.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Erro de require: ' + err.message });
  }

  const { rm, nome, turma, ano, senha } = req.body || {};

  if (!rm || !nome || !turma || !ano || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios: rm, nome, turma, ano, senha.' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const email = `${String(rm).trim()}@aluno.sesi.sp.br`;

  // 1. Cria usuário no Supabase Auth (service_role ignora confirmação de e-mail)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, turma, ano, rm },
  });

  if (authError) {
    console.error('[register] Auth error:', authError.message);
    if (authError.message.includes('already registered')) {
      return res.status(409).json({ error: 'Este RM já possui cadastro.' });
    }
    return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
  }

  // 2. Insere perfil na tabela alunos
  const { error: dbError } = await supabase.from('alunos').insert({
    id: authData.user.id,
    rm: String(rm).trim(),
    nome: nome.trim(),
    turma: turma.trim(),
    ano: String(ano).trim(),
    email,
  });

  if (dbError) {
    console.error('[register] DB error:', dbError.message);
    // Rollback do usuário criado para não ficar órfão
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: 'Erro ao salvar perfil do aluno.' });
  }

  return res.status(201).json({ message: 'Cadastro realizado com sucesso!' });
};
