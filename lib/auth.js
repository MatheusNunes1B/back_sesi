const supabase = require('./supabase');

/**
 * Verifica o token JWT do Supabase Auth enviado no header Authorization.
 * Retorna { user } em caso de sucesso ou encerra a resposta com 401.
 *
 * Uso nas serverless functions:
 *   const { user, error } = await verifyAuth(req, res);
 *   if (error) return; // resposta já enviada
 */
async function verifyAuth(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return { user: null, error: true };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return { user: null, error: true };
  }

  return { user: data.user, error: null };
}

module.exports = { verifyAuth };
