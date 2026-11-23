# Relatório de Auditoria de Segurança e Melhorias — Cinética

**Data:** 17/11/2026 · **Escopo:** todo o repositório (`src/`, `supabase/`, configuração Next.js) · **Stack:** Next.js 16, React 19, Supabase (Postgres + RLS + Storage), Mercado Pago

---

## 1. Resumo executivo

Foram encontradas **35 vulnerabilidades**: **11 críticas**, **10 altas**, **9 médias** e **5 baixas**. Várias críticas permitiam, **sem nenhuma habilidade especial**:

- **Ingressos de graça:** chamar uma RPC pública ou inserir direto na tabela `ingressos`.
- **Ingresso caro pelo preço de um barato/gratuito:** misturar o lote de um evento com outro evento.
- **Pedido caro marcado como pago:** usar o `payment_id` de uma compra barata.
- **Virar diretor de qualquer atlética** (inclusive a Cinética) e **alterar a chave Pix** dela.
- **Aprovar a si mesmo como diretor** chamando a RPC de aprovação.
- **XSS / open redirect** no login (`?redirecionar=javascript:...`).
- **Upload e remoção anônimos de arquivos** no Storage.

**Todas as vulnerabilidades foram corrigidas no código** (rotas de API, proxy, front-end) e na **nova migração SQL `033_hardening_seguranca_e_sorteios.sql`**. Também foram adicionados **104 novos testes automatizados** (de 84 para 188, todos passando), alguns deles reproduzindo os próprios ataques. O build de produção, o TypeScript e o ESLint (sem erros) passam.

> ⚠️ **Ação obrigatória:** as correções de banco (RLS, RPCs, triggers, Storage, tabela de sorteios) **só passam a valer depois de executar `supabase/migracoes/033_hardening_seguranca_e_sorteios.sql` no SQL Editor do Supabase**. Até lá, as vulnerabilidades críticas C1–C7 continuam exploráveis direto pela API do Supabase com a chave pública (anon).

---

## 2. Vulnerabilidades encontradas e correções

Legenda de severidade: 🔴 Crítica · 🟠 Alta · 🟡 Média · 🔵 Baixa

### 2.1 Banco de dados (RLS, RPCs, triggers, Storage)

| ID | Sev. | Onde | Problema | Impacto | Correção |
|---|---|---|---|---|---|
| C1 | 🔴 | `processar_pagamento_aprovado`, `processar_pedido_loja_aprovado` | RPCs `SECURITY DEFINER` executáveis por `anon`/`authenticated` (privilégio padrão `PUBLIC`) | Qualquer pessoa chamava a RPC com o próprio pedido e um ID de pagamento falso → **ingressos / pedidos da loja sem pagar** | `REVOKE EXECUTE` de PUBLIC/anon/authenticated; somente `service_role` |
| C2 | 🔴 | Políticas `ingressos_insert_service`, `pagamentos_insert_service`, `notificacoes_insert_service`, `webhook_logs_insert_service` | `WITH CHECK (true)` | Inserção direta de ingressos válidos, pagamentos falsos, spam de notificações e poluição de logs | Políticas removidas (o backend usa service role, que ignora RLS) |
| C3 | 🔴 | `aprovar_diretor_e_atletica`, `rejeitar_diretor_e_atletica` | Não verificavam se quem chama é admin | **Autoaprovação como diretor**; bloqueio de qualquer usuário; ativação de atléticas | Exigem admin ativo (ou service role); rejeição não derruba atlética já ativa nem bloqueia admin; removido o fallback "primeira atlética pendente" |
| C4 | 🔴 | `obter_role_usuario` / `obter_atletica_usuario` + trigger de signup | Diretor `pendente`/`bloqueado` mantinha todos os privilégios; o signup vincula por **nome** a uma atlética já existente | Cadastro com `atletica_nome = "Atlética Cinética"` → controle de eventos, lotes, produtos e **chave Pix** da atlética antes da aprovação | Funções só concedem privilégio com `status = 'ativo'`; políticas passam a exigir role + status |
| C5 | 🔴 | Política `profiles_insert_seguro` | `auth.uid() = id OR auth.uid() IS NULL` e nenhuma proteção de `role` no INSERT | Criação de perfil com `role = 'admin'` quando o trigger de signup falhava | Nova política `auth.uid() = id` + trigger `proteger_insercao_perfil` (força `cliente`, ou `diretor` + `pendente`) |
| C6 | 🔴 | `validar_ingresso` | Confiava no `p_validado_por` enviado pelo cliente | Qualquer usuário "queimava" ingressos de terceiros passando o UUID de um admin | Validador = `auth.uid()`; exige diretor/admin ativo da atlética do evento |
| C7 | 🔴 | Storage: bucket `imagens` | Upload, update e remoção liberados **para anônimos**; SVG permitido em todos os buckets | Apagar fotos de produtos/eventos, hospedar conteúdo malicioso, **XSS armazenado via SVG** | Upload só para diretor/admin ativo; update/delete só do dono do arquivo ou admin; SVG removido dos MIME aceitos |
| A1 | 🟠 | `atleticas_update` + ausência de trigger | Diretor podia alterar o `status` da própria atlética (pendente → ativa); qualquer autenticado criava atlética | Autoativação e spam de atléticas | Trigger `proteger_campos_atletica` (status só por admin); INSERT só por admin |
| A2 | 🟠 | `pedidos_insert_proprio` | Cliente inseria pedidos com qualquer valor e status | Pedidos "aprovados" forjados, inconsistência financeira | Política removida (pedidos criados só pelo backend) |
| A3 | 🟠 | `ingressos_update_diretor`, `lotes_gerenciar`, `eventos_update`, `store_products_update` | Sem `WITH CHECK`; colunas imutáveis editáveis | Mover evento/lote/produto para outra atlética; trocar `comprador_id`/`qr_code_hash` de ingressos; zerar `quantidade_vendida` | `WITH CHECK` em todas + triggers `proteger_campos_ingresso` e `proteger_campos_lote` |
| A4 | 🟠 | `proteger_campos_sensiveis_perfil` | `NULL <> 'admin'` não dispara a proteção; e-mail editável | Brecha na proteção de role/status; falsificar o e-mail do perfil | Reescrita como `SECURITY INVOKER`, com checagem robusta de contexto; e-mail e `criado_em` protegidos |
| M1 | 🟡 | `verificar_status_cadastro` | Retornava role/status de **qualquer** e-mail | Enumeração de contas (descobrir e-mails de admin) | Retorna apenas contas de diretor |
| M2 | 🟡 | RPC `processar_estorno_pagamento` | Chamada pelo webhook, mas **não existia** | Estornos tratados por fallback não atômico e sem devolução de estoque | Criada: atômica, cancela ingressos, devolve estoque da loja e marca `refunded`/`failed` |
| M3 | 🟡 | `processar_pagamento_aprovado` | Não validava lote × evento nem o limite de 1 gratuito; um pagamento podia liberar vários pedidos | Defesa em profundidade ausente; race condition em ingressos gratuitos | Valida `lote.evento_id`, limite gratuito sob lock e reuso de `payment_id` |

### 2.2 Rotas de API e servidor

| ID | Sev. | Onde | Problema | Impacto | Correção |
|---|---|---|---|---|---|
| C8 | 🔴 | `/api/payments/pix`, `/card`, `/gratuito` | O lote não era validado contra o `evento_id` | **Ingresso de evento caro pelo preço (ou gratuidade) de um lote de outro evento** | Novo `validarCompraIngresso` (`src/lib/pagamentos/ingressos.ts`): lote ∈ evento, evento publicado e dentro da janela de venda, estoque |
| C9 | 🔴 | `/api/consultar-status-pedido` | Aceitava `payment_id` / `evento_id` / `lote_id` da URL e **criava pedido + ingressos** a partir deles; filtro `.or()` montado com input do usuário | Comprar algo de R$1, informar o payment_id e o `evento_id` de um show → **ingressos grátis**; injeção de filtro PostgREST | Rota reescrita: só consulta pedido **do próprio usuário**; reconcilia apenas pagamentos com `external_reference = pedido.id` e valor ≥ total; nunca cria pedido |
| C10 | 🔴 | `/api/loja/consultar-status-pedido` | Confirmava o pedido com qualquer `payment_id` aprovado informado | Pedido caro da loja marcado como **pago** com o pagamento de outra compra | Usa só o pagamento do próprio pedido + checagem de valor (`confirmarPedidoLoja`) |
| C11 | 🔴 | `/api/payments/card`, `/api/loja/pagamentos/card`, webhook | **Fallback** emitia ingressos / marcava pago quando a RPC falhava, inclusive por `estoque_esgotado` | Sobrevenda (overselling) e emissão fora da transação atômica | Fallbacks removidos; emissão **somente** pela RPC atômica |
| A5 | 🟠 | `/api/payments/*` (upsert do pedido) | `upsert` com o `pedido_id` enviado pelo cliente | Sobrescrever pedido de **outro usuário** (trocar comprador / resetar status) | `criarOuReutilizarPedidoPendente`: só reaproveita pedido pendente do mesmo usuário e da mesma compra |
| A6 | 🟠 | `/api/webhook-mercadopago` | HMAC opcional quando o secret não estava configurado; sem checagem de valor/pedido; pedido recriado a partir de metadados | Webhook forjado / processamento de pagamentos que não correspondem ao pedido | HMAC obrigatório em produção; `data.id` numérico; libera só se `external_reference` = pedido e o valor cobre o total |
| A7 | 🟠 | `/api/diretor/lotes` | Lote atualizado pelo `lote_id` sem verificar se pertence ao `evento_id` | **IDOR**: diretor da atlética A altera preço/estoque de lote da atlética B | Lote filtrado por `evento_id`; checagem de role + status + atlética |
| A8 | 🟠 | Proxy (ex-middleware) e rotas `/api/diretor/*` | Só checavam `role`, não `status` | Diretor pendente/bloqueado acessava o painel e as APIs | Exigem `status = 'ativo'` (helpers em `src/lib/autenticacaoApi.ts`) |
| A9 | 🟠 | Login admin/diretor/cliente | `window.location.href = searchParams.redirecionar` | **XSS** (`javascript:`) e open redirect para phishing | `sanitizarRedirecionamento` (`src/lib/validacoes.ts`) |
| A10 | 🟠 | `/cliente/autenticacao/callback` | Bypass do filtro (`https://evil.com/autenticacao/redefinir-senha`) e host vindo de `x-forwarded-host` | Open redirect / Host header injection no link de recuperação | Sanitizador + lista de hosts permitidos |
| M4 | 🟡 | `/api/auth/rate-limit` | `registrar_sucesso` zerava o contador sem login; captcha opcional (bastava omitir o token) | Força bruta ilimitada contornando o bloqueio | Reset só com sessão autenticada; Turnstile obrigatório quando configurado; rate limit no próprio endpoint |
| M5 | 🟡 | `obterIPCliente` / rotas | Confiava em `cf-connecting-ip` / `x-forwarded-for` enviados pelo cliente | Burlar o rate limit trocando cabeçalho | `cf-connecting-ip` só com `CONFIAR_CF_CONNECTING_IP=true`; prioridade para `x-real-ip` da plataforma |
| M6 | 🟡 | Rate limit em memória | Não compartilhado entre instâncias serverless | Limites ineficazes em produção | Rate limit **distribuído** no Postgres (`rate_limits` + RPC `registrar_rate_limit`) com fallback em memória; limites por IP **e** por usuário; anti card-testing (5 tentativas/10 min) |
| M7 | 🟡 | Loja: pix/card/gratuito/carrinho | Itens duplicados burlavam estoque e limite de gratuidade; tamanho não validado; quantidade sem teto; baixa de estoque do gratuito não atômica | Sobrevenda, vários brindes por usuário | `validarItensLoja`: agrupa itens, valida tamanho, estoque agregado, teto de 20 unidades, 1 brinde por usuário; gratuito usa a RPC atômica |
| M8 | 🟡 | Várias rotas | `error.message` do banco/gateway devolvido ao cliente | Vazamento de detalhes internos | Mensagem genérica (`MENSAGEM_ERRO_INTERNO`) + log no servidor |
| M9 | 🟡 | `/api/perfil/sincronizar` | CPF/telefone sem validação | Dados inválidos usados no Mercado Pago | Validação de CPF (dígitos verificadores), telefone e nome + rate limit |
| B1 | 🔵 | Crons / suíte de testes | Comparação de segredo não constante; `TEST_SUITE_SECRET` opcional | Timing attack; endpoint de testes aberto em dev | `validarBearer` (timing-safe); segredo obrigatório |
| B2 | 🔵 | `next.config.ts` | Cabeçalhos incompletos; respostas de API cacheáveis | Cache de dados pessoais em proxy/CDN | `Cache-Control: no-store` em `/api/*`, `X-Robots-Tag`, COOP, `strict-origin-when-cross-origin`, `poweredByHeader: false` |
| B3 | 🔵 | `/api/diretor/loja/pedidos/entregar` | Retornava o CPF do comprador; permitia "entregar" pedido não pago | Exposição desnecessária de dado pessoal (LGPD) | CPF removido da resposta; exige pedido `paid` |
| B4 | 🔵 | Upload de imagens (diretor) | Extensão vinda do nome do arquivo | Arquivos com extensão enganosa | Extensão derivada do MIME + limite de tamanho |
| B5 | 🔵 | Dependências | `next@16.4.2` vulnerável (GHSA-mfr8-8qww-v76h, moderada) | Vazamento de info com `'use cache'` + `unstable_cache` (o projeto não usa) | Atualizado para `next@16.4.6`; `npm audit` → **0 vulnerabilidades** |

### 2.3 Problemas de build e funcionamento

| Problema | Correção |
|---|---|
| `.gitignore` com `supabase/` ignorava `src/lib/supabase/` → **qualquer clone do repositório não compilava** | Padrão corrigido para `/supabase/` (só a pasta raiz) |
| `middleware.ts` está depreciado no Next 16 | Migrado para `src/proxy.ts` (`export function proxy`) |
| Polling do Pix da loja nunca detectava o pagamento (a API devolvia `status_pedido`, a tela lia `status`) | A API devolve os dois campos; a tela trata `failed`/`refunded`/`stock_unavailable` |
| Status `em_analise` gravado em `pedidos`, mas inexistente no enum (falhava em silêncio) | Pedidos em análise permanecem `pendente` |
| Testes antigos reimplementavam a lógica e não testavam o código real; o alias `@/` não resolvia no Vitest | `vitest.config.ts` criado; novos testes importam os módulos reais |
| 3 erros de ESLint já existentes (`Date.now` durante o render) | Corrigidos |

---

## 3. Melhorias nas abas

### Sorteios (antes 100% mockado)
- **Nova tabela `public.sorteios`** com RLS e constraints (cotas vendidas ≤ total, tamanhos de texto, status válidos).
- **Página pública** (`/sorteios`) lê **exclusivamente do banco**: filtros com contagem (Todos / Em andamento / Em breve / Encerrados), barra de progresso, ganhador, regulamento e forma de apuração por sorteio. Estados de carregamento, vazio e erro com "tentar novamente".
- **Chave Pix e WhatsApp vêm da atlética** (`atleticas.chave_pix` / `whatsapp`). Antes eram fixos no código, com um número fictício `5563999999999`.
- Participação bloqueada quando o sorteio está esgotado, encerrado ou passou da data; o seletor de cotas respeita o restante disponível.
- **Novo painel da diretoria** (`/diretor/sorteios`, no menu lateral): criar, editar, excluir, upload de imagem, ajuste rápido de cotas vendidas (−1 / +1 / +10) e registro do ganhador. Validação em `src/lib/sorteios.ts`.

### Eventos
- Campo de **busca** visível (o estado existia, mas não havia input) por título, local, cidade ou atlética.
- Filtro **Próximos / Todos / Encerrados** (padrão: próximos).
- Filtro de **cidade** gerado a partir dos eventos do banco.
- **Paginação** "Carregar mais" (antes havia um limite fixo de 50 eventos).
- Estado de erro com "tentar novamente" e mensagens de vazio adequadas a cada filtro.
- Checkout reforçado: evento precisa estar publicado e dentro da janela de vendas.

### Loja
- **Categorias geradas a partir dos produtos do banco**, com contagem (somem categorias sem produto).
- Filtro **"Somente disponíveis"**; produtos esgotados vão para o fim da lista.
- Estado de erro com "tentar novamente".
- Polling do Pix corrigido (bug funcional), validação de tamanho e teto de quantidade no carrinho, e checkout gratuito atômico.

---

## 4. Testes automatizados

`npm test` → **11 arquivos, 188 testes, todos passando**.

| Arquivo | O que cobre |
|---|---|
| `seguranca.test.ts` | Open redirect / `javascript:` XSS, validação de IDs (anti-injeção PostgREST), comparação de segredos, IP confiável |
| `pagamentos-comum.test.ts` | Vínculo pagamento ↔ pedido e valor, montagem do payer, normalização dos dados do cartão |
| `pagamentos-ingressos.test.ts` | Cálculo de taxa, **lote de outro evento bloqueado**, evento rascunho/encerrado, estoque, não sobrescrever pedido alheio, liberação só com pagamento válido, sem fallback |
| `pagamentos-loja.test.ts` | Preço do banco, estoque agregado, tamanho, regras de brinde, bloqueio de reuso de pagamento / valor menor |
| `rotas-pagamento.test.ts` | **Integração das rotas** (Supabase e Mercado Pago simulados): webhook sem assinatura/forjado → 401; valor menor não libera; ataque do payment_id barato; ataque via URL; IDOR de pedido; IDOR de lote entre atléticas; diretor pendente → 403 |
| `sorteios.test.ts` | Progresso, disponibilidade, link do WhatsApp, ordenação, validação do formulário |
| `rate-limit.test.ts` | Janela deslizante, bloqueio progressivo (cliente e admin), cooldown de recuperação, fallback do limitador distribuído |
| (existentes) | CPF, filtro de cidades, SEO/JSON-LD, fluxo de pagamento |

Também verificados: `tsc --noEmit` ✅ · `eslint` sem erros ✅ · `next build` ✅ · `npm audit` 0 vulnerabilidades ✅

---

## 5. O que você precisa fazer (não dá para fazer pelo código)

1. **Executar a migração no Supabase (obrigatório):** abrir o SQL Editor e rodar `supabase/migracoes/033_hardening_seguranca_e_sorteios.sql`. Ela é idempotente. Para projetos novos, o `schema_unificado.sql` já inclui a migração no final (seção 13).
2. **Reiniciar o `next dev`:** o servidor que estava aberto quebrou depois da atualização do Next (`ensureInstrumentationRegisteredWithDeferredSpans is not a function`). Basta parar e rodar `npm run dev` de novo.
3. **Variáveis de ambiente em produção:**
   - `MERCADOPAGO_WEBHOOK_SECRET`: **obrigatória**; sem ela todo webhook é recusado (401) em produção.
   - `CONFIAR_CF_CONNECTING_IP=true`: **apenas** se o site estiver atrás do Cloudflare.
   - `CRON_SECRET`, `TEST_SUITE_SECRET`, `QR_CODE_SECRET`: valores longos e aleatórios.
4. **Supabase Auth (painel):** ativar **CAPTCHA (Turnstile)** em *Authentication → Attack Protection* e revisar os rate limits de login/cadastro. O login é feito direto no Supabase pelo navegador, então o rate limit da aplicação é só complementar; a proteção definitiva contra força bruta é a do próprio Supabase Auth.
5. **Versionar as migrações:** a pasta `supabase/` continua no `.gitignore`, por escolha anterior. Recomendo versioná-la (não contém segredos) para que o schema de segurança não se perca.

---

## 6. Riscos residuais e recomendações

| Risco | Recomendação |
|---|---|
| CSP com `'unsafe-inline'` em `script-src` (exigido pelo SDK do Mercado Pago e pelo Next) | Migrar para CSP com nonce (`proxy.ts`) quando possível |
| `connect-src https:` amplo | Restringir aos domínios do Supabase, Mercado Pago e Cloudflare |
| CPF armazenado em texto puro | Avaliar criptografia em coluna (`pgsodium`) e política de retenção (LGPD) |
| Sorteios com pagamento manual (Pix + comprovante) | Futuro: venda de cotas com Pix automático pelo mesmo fluxo de pedidos, com números gerados no banco |
| `obter_role_usuario(uuid)` executável por `authenticated` (revela se um UUID é admin) | Baixo impacto (exige conhecer o UUID); pode virar função sem parâmetro (`auth.uid()` interno) |
| Diretor pode excluir/alterar arquivos que ele mesmo enviou para outra atlética | Organizar o Storage em pastas por `atletica_id` e restringir políticas por prefixo |
| Pedidos de loja com produtos de atléticas diferentes ficam vinculados à atlética do 1º item | Separar o carrinho por atlética ou dividir o pedido |

---

## 7. Arquivos principais alterados ou criados

- **Banco:** `supabase/migracoes/033_hardening_seguranca_e_sorteios.sql` (nova) · `supabase/schema_unificado.sql` (seção 13)
- **Novos módulos:** `src/lib/seguranca.ts`, `src/lib/validacoes.ts`, `src/lib/autenticacaoApi.ts`, `src/lib/pagamentos/{comum,ingressos,loja}.ts`, `src/lib/sorteios.ts`
- **Rotas reescritas:** `payments/{pix,card,gratuito}`, `loja/pagamentos/{pix,card,gratuito}`, `webhook-mercadopago`, `consultar-status-pedido`, `loja/consultar-status-pedido`, `cron/reconciliar-pedidos`, `admin/reconciliar-pagamentos`, `diretor/{lotes,ingressos/cancelar,loja/pedidos/entregar}`, `perfil/sincronizar`, `auth/rate-limit`
- **Telas:** `cliente/sorteios`, `diretor/sorteios` (nova), `cliente/eventos`, `cliente/loja`, logins e callback
- **Infra:** `src/proxy.ts` (ex-`middleware.ts`), `next.config.ts`, `.gitignore`, `vitest.config.ts`, `package.json` (Next 16.4.6)
