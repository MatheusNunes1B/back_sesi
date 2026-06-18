const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Inicializa o supabase apenas se as variáveis existirem.
// O tratamento de erro foi removido daqui para não quebrar o cold boot 
// (o que causa erro de CORS no front-end em vez de um erro claro).
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = new Proxy({}, {
  get(target, prop) {
    if (!supabase) {
      throw new Error('As variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias e não foram encontradas na Vercel.');
    }
    const value = supabase[prop];
    if (typeof value === 'function') {
      return value.bind(supabase);
    }
    return value;
  }
});
