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

// Exporta o cliente diretamente.
module.exports = supabase;
