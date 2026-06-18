const supabase = require('../../lib/supabase');

const ALLOWED_METHODS = ['POST', 'OPTIONS'];

/**
 * POST /api/auth/login
 * Body: { identifier: string, password: string }
 *
 * Aceita RM (ex: "123456") ou e-mail completo.
 * Se for RM, converte para e-mail padrão: <rm>@aluno.sesi.sp.br
 */
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identificador e senha são obrigatórios.' });
  }

  // Normaliza: RM puro → e-mail institucional
  const isEmail = identifier.includes('@');
  const email = isEmail ? identifier.trim().toLowerCase() : `${identifier.trim()}@aluno.sesi.sp.br`;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[login] Supabase error:', error.message);
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu RM/e-mail e senha.' });
  }

  return res.status(200).json({
    message: 'Login realizado com sucesso.',
    session: data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
    },
  });
};
