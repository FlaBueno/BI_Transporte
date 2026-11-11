// Função Netlify (v2) - Insights de Transportes Simpress
// Recebe { prompt, context } e devolve { Resposta: "texto" }
// Variáveis de ambiente necessárias: ANTHROPIC_API_KEY, SHARED_SECRET
// Opcional: CLAUDE_MODEL (padrão: claude-sonnet-5-5)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-shared-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const SYSTEM = [
  'Você é um analista de transportes e fretes da Simpress.',
  'Responda sempre em português do Brasil, de forma objetiva e executiva.',
  'Use SOMENTE os números do contexto fornecido; se faltar dado, diga que não há informação suficiente.',
  'Não invente valores, causas confirmadas ou nomes de clientes.',
  'Quando levantar causas possíveis, deixe claro que são hipóteses a validar.',
  'Formato: texto simples, sem markdown (sem asteriscos, sem #). Use parágrafos curtos ou linhas começando com hífen.',
  'Limite de aproximadamente 180 palavras.',
].join(' ');

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const secret = Netlify.env.get('SHARED_SECRET');
  if (!secret || req.headers.get('x-shared-secret') !== secret) {
    return json({ error: 'Não autorizado' }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const prompt = String(body.prompt || '').slice(0, 1000);
  const context = String(body.context || '').slice(0, 4000);
  if (!prompt) return json({ error: 'prompt vazio' }, 400);

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Chave da API não configurada' }, 500);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: Netlify.env.get('CLAUDE_MODEL') || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: SYSTEM + '\n\nDADOS DO RELATÓRIO:\n' + context,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Erro da API:', r.status, detail);
      return json({ error: 'Falha ao consultar o modelo (' + r.status + ')' }, 502);
    }

    const data = await r.json();
    const texto = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return json({ Resposta: texto || 'Sem resposta.' });
  } catch (e) {
    console.error(e);
    return json({ error: 'Erro interno' }, 500);
  }
};
