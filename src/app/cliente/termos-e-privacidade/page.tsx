'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usarCookies } from '@/contextos/ContextoCookies';
import Botao from '@/componentes/ui/Botao';
import {
  FileText,
  Lock,
  Cookie,
  CheckCircle,
  Shield,
  HelpCircle,
  ShoppingBag,
  Gift,
  Check,
  X,
} from 'lucide-react';

type Aba = 'termos' | 'privacidade' | 'cookies';

const ABAS: { id: Aba; curto: string; longo: string; icone: typeof FileText }[] = [
  { id: 'termos', curto: 'Termos', longo: 'Termos de Uso', icone: FileText },
  { id: 'privacidade', curto: 'Privacidade', longo: 'Política de Privacidade', icone: Lock },
  { id: 'cookies', curto: 'Cookies', longo: 'Uso de Cookies', icone: Cookie },
];

const ULTIMA_ATUALIZACAO = 'Novembro de 2026';

function ehAba(valor: string): valor is Aba {
  return valor === 'termos' || valor === 'privacidade' || valor === 'cookies';
}

function Secao({ titulo, icone = 'check', children }: { titulo: string; icone?: 'check' | 'shield'; children: ReactNode }) {
  const Icone = icone === 'shield' ? Shield : CheckCircle;
  return (
    <section className="space-y-2 sm:space-y-3">
      <h3 className="text-sm sm:text-base font-bold text-texto-principal flex items-start gap-2">
        <Icone size={16} className="text-ouro shrink-0 mt-0.5" />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 text-xs sm:text-sm text-texto-secundario">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function CabecalhoAba({ icone: Icone, titulo, subtitulo }: { icone: typeof FileText; titulo: string; subtitulo: string }) {
  return (
    <div className="border-b border-borda-sutil pb-3 sm:pb-4">
      <h2 className="text-lg sm:text-xl font-bold font-titulo text-texto-principal uppercase flex items-center gap-2 leading-tight">
        <Icone className="text-ouro shrink-0" size={20} />
        {titulo}
      </h2>
      <p className="text-[11px] sm:text-xs text-texto-secundario mt-1">{subtitulo}</p>
    </div>
  );
}

export default function PaginaTermosEPrivacidade() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('termos');
  const { abrirBanner, preferencias, aceitarApenasEssenciais } = usarCookies();

  // Permite links diretos como /termos-e-privacidade#cookies
  useEffect(() => {
    function sincronizarHash() {
      const hash = window.location.hash.replace('#', '');
      if (ehAba(hash)) setAbaAtiva(hash);
    }
    sincronizarHash();
    window.addEventListener('hashchange', sincronizarHash);
    return () => window.removeEventListener('hashchange', sincronizarHash);
  }, []);

  function selecionarAba(aba: Aba) {
    setAbaAtiva(aba);
    window.history.replaceState(null, '', `#${aba}`);
  }

  return (
    <div className="min-h-screen bg-fundo-principal text-texto-principal pb-16">
      {/* Cabeçalho */}
      <div className="bg-fundo-card border-b border-borda-sutil py-6 sm:py-10 mb-6 sm:mb-8 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="titulo-display text-5xl sm:text-6xl text-texto-principal">
            Termos & <span className="text-ouro">Privacidade</span>
          </h1>
          <p className="text-texto-secundario text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
            Regras de uso da loja oficial, dos sorteios online e da venda de ingressos da Cinética, e como tratamos seus
            dados pessoais conforme a LGPD. Última atualização: {ULTIMA_ATUALIZACAO}.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Abas */}
        <div
          role="tablist"
          aria-label="Documentos legais"
          className="grid grid-cols-3 gap-1 sm:gap-2 p-1 sm:p-1.5 bg-fundo-card border border-borda-sutil rounded-xl sm:rounded-2xl mb-6 sm:mb-8 shadow-sm"
        >
          {ABAS.map(({ id, curto, longo, icone: Icone }) => {
            const ativa = abaAtiva === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`aba-${id}`}
                aria-selected={ativa}
                aria-controls={`painel-${id}`}
                onClick={() => selecionarAba(id)}
                className={`py-2.5 sm:py-3 px-1 sm:px-4 rounded-lg sm:rounded-xl font-extrabold sm:font-black text-[11px] sm:text-xs uppercase tracking-normal sm:tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-1 sm:gap-2 touch-manipulation text-center cursor-pointer ${
                  ativa
                    ? 'bg-gradient-to-r from-ouro to-ouro-classico text-azul-900 shadow-md shadow-ouro/25 font-black'
                    : 'text-texto-secundario hover:text-texto-principal hover:bg-fundo-elevado'
                }`}
              >
                <Icone size={15} className="shrink-0" />
                <span className="whitespace-nowrap">
                  <span className="sm:hidden">{curto}</span>
                  <span className="hidden sm:inline">{longo}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div
          role="tabpanel"
          id={`painel-${abaAtiva}`}
          aria-labelledby={`aba-${abaAtiva}`}
          className="bg-fundo-card border border-borda-sutil rounded-xl sm:rounded-2xl p-4 sm:p-8 space-y-5 sm:space-y-6 leading-relaxed text-texto-secundario text-xs sm:text-sm shadow-sm"
        >
          {/* ============ TERMOS DE USO ============ */}
          {abaAtiva === 'termos' && (
            <div className="space-y-5 sm:space-y-6 animar-entrar-baixo">
              <CabecalhoAba icone={FileText} titulo="Termos Gerais de Uso" subtitulo={`Última atualização: ${ULTIMA_ATUALIZACAO}`} />

              <Secao titulo="1. Quem somos e aceitação">
                <p>
                  A <strong>Cinética</strong> é a plataforma oficial da Atlética Cinética (A.A.A.F.A. Fisioterapia, CNPJ
                  68.627.894/0001-88), com sede em Palmas/TO. Por ela oferecemos, nesta ordem de prioridade: a{' '}
                  <strong>venda de produtos oficiais</strong> (loja), a <strong>participação em sorteios online</strong> e a{' '}
                  <strong>venda de ingressos</strong> para eventos próprios e de atléticas parceiras. Ao navegar, criar conta ou
                  comprar, você declara ter lido e concordado com estes Termos e com a Política de Privacidade.
                </p>
              </Secao>

              <Secao titulo="2. Cadastro e conta">
                <Lista
                  itens={[
                    'Para comprar ou participar de sorteios é preciso ter uma conta com dados verdadeiros, completos e atualizados.',
                    'A conta é pessoal e intransferível. Você é responsável por manter sua senha em sigilo e por toda atividade realizada nela.',
                    'Menores de 18 anos só podem comprar com autorização do responsável legal. A participação em sorteios pagos é restrita a maiores de 18 anos.',
                    'Podemos suspender contas com indícios de fraude, uso de dados de terceiros, criação de múltiplas contas ou violação destes Termos.',
                  ]}
                />
              </Secao>

              <Secao titulo="3. Loja oficial">
                <Lista
                  itens={[
                    'Fotos, descrições e tabelas de tamanho são ilustrativas e buscam representar o produto da forma mais fiel possível. Confira o tamanho antes de finalizar.',
                    'Preços e estoque podem mudar sem aviso, mas o valor confirmado no checkout é o que vale para o seu pedido.',
                    <>
                      Após a aprovação do pagamento, o pedido aparece como <strong>“Pago • Aguardando retirada”</strong> em Meus
                      pedidos. A retirada é feita diretamente com a diretoria da atlética, mediante identificação do titular ou de
                      quem ele autorizar; o pedido é marcado como entregue no ato.
                    </>,
                    'Pedidos não pagos dentro do prazo do Pix são cancelados automaticamente e o estoque é liberado.',
                    'Produtos com defeito podem ser trocados nos prazos do Código de Defesa do Consumidor (30 dias para não duráveis e 90 dias para duráveis, contados da retirada).',
                  ]}
                />
              </Secao>

              <Secao titulo="4. Sorteios online">
                <p>
                  Cada sorteio possui <strong>regulamento próprio</strong>, exibido antes da compra, com prêmio, valor e quantidade de
                  cotas, data e forma de apuração. Em caso de conflito, o regulamento do sorteio prevalece sobre estes Termos.
                </p>
                <Lista
                  itens={[
                    'Os números dos bilhetes são atribuídos automaticamente pelo sistema e só são gerados após a aprovação do pagamento. Pedidos pendentes ou expirados não reservam números.',
                    'Os bilhetes ficam disponíveis em “Meus bilhetes” e são vinculados à conta do comprador.',
                    'Sorteios gratuitos permitem apenas 1 (uma) cota por conta. O uso de múltiplas contas invalida as participações.',
                    'A apuração ocorre na data e pela forma indicadas no regulamento. O resultado é publicado na página do sorteio com o nome do ganhador, o número do bilhete premiado e a cidade.',
                    'O ganhador é contatado pelos dados da conta e deve retirar ou receber o prêmio no prazo e nas condições do regulamento. O prêmio é pessoal e não pode ser trocado por dinheiro, salvo se o regulamento previr.',
                    'Se um sorteio for cancelado ou adiado por motivo da organização, os participantes serão avisados e os valores das cotas serão reembolsados ou a participação mantida para a nova data, conforme escolha do participante.',
                    'A atlética é responsável por realizar os sorteios em conformidade com a legislação aplicável.',
                  ]}
                />
              </Secao>

              <Secao titulo="5. Ingressos para eventos">
                <Lista
                  itens={[
                    'Cada ingresso gera um QR Code único, vinculado à sua conta e validado uma única vez na entrada. Cópias ou tentativas de reutilização são recusadas.',
                    'A organização do evento (atlética própria ou parceira) responde pela programação, estrutura, classificação etária e regras de acesso.',
                    'Lotes e preços são definidos pela organização e podem mudar conforme a disponibilidade.',
                  ]}
                />
              </Secao>

              <Secao titulo="6. Pagamentos">
                <p>
                  Os pagamentos por <strong>Pix</strong> e <strong>cartão de crédito</strong> são processados pelo{' '}
                  <strong>Mercado Pago</strong>. A Cinética não tem acesso nem armazena os dados completos do seu cartão. A compra só é
                  confirmada após a aprovação do pagamento pela instituição.
                </p>
              </Secao>

              <Secao titulo="7. Cancelamentos e reembolsos">
                <Lista
                  itens={[
                    <>
                      <strong>Produtos:</strong> você pode desistir da compra em até 7 dias corridos da confirmação (art. 49 do CDC),
                      desde que o produto não tenha sido retirado ou seja devolvido sem uso e na embalagem original.
                    </>,
                    <>
                      <strong>Ingressos:</strong> cancelamento em até 7 dias corridos da compra, desde que solicitado até 48 horas antes
                      do evento.
                    </>,
                    <>
                      <strong>Cotas de sorteio:</strong> podem ser canceladas em até 7 dias corridos da compra, desde que antes da data
                      de apuração. Após a apuração não há reembolso, exceto no cancelamento do sorteio pela organização.
                    </>,
                    'O reembolso é feito pelo mesmo meio de pagamento utilizado. Para solicitar, fale com a gente pela Central de ajuda informando o e-mail da conta e o código do pedido.',
                  ]}
                />
              </Secao>

              <Secao titulo="8. Condutas proibidas">
                <Lista
                  itens={[
                    'Revender ingressos ou bilhetes sem autorização, ou falsificar QR Codes e comprovantes.',
                    'Usar robôs, scripts ou meios automatizados para comprar, reservar estoque ou cotas.',
                    'Contestar pagamentos legítimos de má-fé (chargeback indevido).',
                    'Tentar acessar áreas restritas, contas de terceiros ou explorar falhas da plataforma.',
                  ]}
                />
              </Secao>

              <Secao titulo="9. Responsabilidades e alterações">
                <p>
                  Trabalhamos para manter a plataforma disponível e segura, mas podem ocorrer interrupções para manutenção ou por
                  falhas de terceiros (internet, meios de pagamento, hospedagem). Estes Termos podem ser atualizados; a versão vigente é
                  sempre a publicada nesta página. Fica eleito o foro da comarca de Palmas/TO, ressalvado o direito do consumidor de
                  ajuizar ação no seu domicílio.
                </p>
              </Secao>
            </div>
          )}

          {/* ============ POLÍTICA DE PRIVACIDADE ============ */}
          {abaAtiva === 'privacidade' && (
            <div className="space-y-5 sm:space-y-6 animar-entrar-baixo">
              <CabecalhoAba
                icone={Lock}
                titulo="Política de Privacidade & Proteção de Dados"
                subtitulo="Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)"
              />

              <Secao icone="shield" titulo="1. Controlador dos dados">
                <p>
                  A Atlética Cinética (A.A.A.F.A. Fisioterapia, CNPJ 68.627.894/0001-88), Palmas/TO, é a controladora dos dados
                  pessoais tratados nesta plataforma. Quando você compra ingresso de um evento de atlética parceira, ela também recebe os
                  dados necessários para a organização e o controle de acesso.
                </p>
              </Secao>

              <Secao icone="shield" titulo="2. Dados que coletamos">
                <Lista
                  itens={[
                    <><strong>Cadastro:</strong> nome completo, e-mail, telefone e CPF (exigido pelo processador de pagamentos e para identificar o titular na retirada e na premiação).</>,
                    <><strong>Pedidos da loja:</strong> produtos, tamanhos, valores, status do pagamento e registro de retirada.</>,
                    <><strong>Sorteios:</strong> cotas adquiridas, números dos bilhetes e, se você ganhar, os dados para entrega do prêmio.</>,
                    <><strong>Ingressos:</strong> eventos, lotes, QR Codes emitidos e registro de validação na entrada.</>,
                    <><strong>Pagamento:</strong> identificador da transação e status informados pelo Mercado Pago. Não armazenamos o número do seu cartão.</>,
                    <><strong>Dados técnicos:</strong> endereço IP, data e hora de acesso e registros de segurança.</>,
                  ]}
                />
              </Secao>

              <Secao icone="shield" titulo="3. Para que usamos e com qual base legal">
                <Lista
                  itens={[
                    <><strong>Execução do contrato</strong> (art. 7º, V): processar pedidos, gerar bilhetes e ingressos, organizar retiradas e entregar prêmios.</>,
                    <><strong>Obrigação legal</strong> (art. 7º, II): manter registros fiscais, de transações e de acesso pelo prazo exigido em lei.</>,
                    <><strong>Legítimo interesse</strong> (art. 7º, IX): prevenir fraudes, garantir a lisura dos sorteios e a segurança da conta.</>,
                    <><strong>Consentimento</strong> (art. 7º, I): cookies não essenciais e comunicações promocionais, que você pode revogar a qualquer momento.</>,
                  ]}
                />
              </Secao>

              <Secao icone="shield" titulo="4. Divulgação de ganhadores">
                <p>
                  Para dar transparência aos sorteios, publicamos na página do sorteio o <strong>nome do ganhador</strong>, o{' '}
                  <strong>número do bilhete premiado</strong> e a <strong>cidade</strong>. Nenhum outro dado (como CPF, e-mail ou
                  telefone) é divulgado.
                </p>
              </Secao>

              <Secao icone="shield" titulo="5. Com quem compartilhamos">
                <Lista
                  itens={[
                    <><strong>Mercado Pago:</strong> processamento de Pix e cartão.</>,
                    <><strong>Supabase:</strong> hospedagem do banco de dados e autenticação.</>,
                    <><strong>Atléticas parceiras:</strong> apenas os dados dos ingressos dos eventos que elas organizam.</>,
                    'Autoridades públicas, quando houver obrigação legal ou ordem judicial.',
                  ]}
                />
                <p>Não vendemos nem alugamos seus dados pessoais.</p>
              </Secao>

              <Secao icone="shield" titulo="6. Armazenamento e segurança">
                <p>
                  Os dados são mantidos enquanto sua conta estiver ativa e, depois, pelo tempo necessário para cumprir obrigações legais
                  (como registros de transações e de acesso). Usamos conexão criptografada (HTTPS), controle de acesso por perfil e
                  regras de segurança no banco para que cada usuário veja apenas os próprios pedidos, bilhetes e ingressos.
                </p>
              </Secao>

              <Secao icone="shield" titulo="7. Seus direitos">
                <p>Conforme o art. 18 da LGPD, você pode solicitar a qualquer momento:</p>
                <Lista
                  itens={[
                    'Confirmação de que tratamos seus dados e acesso a eles;',
                    'Correção de dados incompletos, inexatos ou desatualizados;',
                    'Anonimização, bloqueio ou eliminação de dados desnecessários;',
                    'Portabilidade e informação sobre com quem compartilhamos;',
                    'Revogação do consentimento e exclusão da conta (mantidos os registros que a lei obriga guardar).',
                  ]}
                />
                <p>
                  Para exercer seus direitos, use a <strong>Central de ajuda</strong> no rodapé do site. Responderemos em até 15 dias.
                </p>
              </Secao>
            </div>
          )}

          {/* ============ COOKIES ============ */}
          {abaAtiva === 'cookies' && (
            <div className="space-y-5 sm:space-y-6 animar-entrar-baixo">
              <CabecalhoAba
                icone={Cookie}
                titulo="Política e Preferências de Cookies"
                subtitulo="Veja quais cookies usamos e controle o que você autoriza"
              />

              <p>
                Cookies e armazenamento local são pequenos arquivos guardados no seu navegador. Eles mantêm você conectado, guardam o
                carrinho da loja e lembram suas escolhas de privacidade.
              </p>

              {/* Estado atual + ações */}
              <div className="bg-fundo-elevado/60 p-4 sm:p-6 rounded-xl border border-borda-sutil space-y-4">
                <div>
                  <h4 className="font-bold text-texto-principal text-sm sm:text-base">Suas preferências atuais</h4>
                  <p className="text-xs text-texto-secundario mt-0.5">Você pode mudar quando quiser, aqui ou pelo rodapé do site.</p>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { rotulo: 'Essenciais', ativo: true },
                    { rotulo: 'Analíticos', ativo: preferencias.analiticos },
                    { rotulo: 'Marketing', ativo: preferencias.marketing },
                  ].map(({ rotulo, ativo }) => (
                    <li
                      key={rotulo}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-fundo-card border border-borda-sutil text-xs"
                    >
                      <span className="font-bold text-texto-principal">{rotulo}</span>
                      <span className={`inline-flex items-center gap-1 font-black uppercase text-[10px] ${ativo ? 'text-emerald-400' : 'text-texto-terciario'}`}>
                        {ativo ? <Check size={12} /> : <X size={12} />}
                        {ativo ? 'Ativo' : 'Desativado'}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Botao
                    variante="secundario"
                    tamanho="md"
                    onClick={aceitarApenasEssenciais}
                    className="w-full sm:w-auto min-h-[44px] justify-center text-xs font-black uppercase"
                  >
                    Só essenciais
                  </Botao>
                  <Botao
                    variante="festiva"
                    tamanho="md"
                    onClick={abrirBanner}
                    icone={<Cookie size={16} />}
                    className="w-full sm:w-auto min-h-[44px] justify-center text-xs font-black uppercase"
                  >
                    Personalizar
                  </Botao>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-3.5 sm:p-4 bg-fundo-elevado/60 rounded-xl border border-borda-sutil space-y-1">
                  <h4 className="font-bold text-emerald-400 text-xs uppercase">Essenciais</h4>
                  <p className="text-xs text-texto-secundario leading-relaxed">
                    Login e sessão da conta, carrinho da loja, checkout seguro e registro da sua escolha de cookies. Sem eles o site não
                    funciona, por isso não podem ser desativados.
                  </p>
                </div>
                <div className="p-3.5 sm:p-4 bg-fundo-elevado/60 rounded-xl border border-borda-sutil space-y-1">
                  <h4 className="font-bold text-ouro text-xs uppercase">Analíticos</h4>
                  <p className="text-xs text-texto-secundario leading-relaxed">
                    Estatísticas agregadas de acesso para entender quais produtos e sorteios interessam mais e melhorar o desempenho.
                  </p>
                </div>
                <div className="p-3.5 sm:p-4 bg-fundo-elevado/60 rounded-xl border border-borda-sutil space-y-1">
                  <h4 className="font-bold text-ouro text-xs uppercase">Marketing</h4>
                  <p className="text-xs text-texto-secundario leading-relaxed">
                    Avisos de lançamentos da loja, novos sorteios e eventos de acordo com seu interesse.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-borda-sutil">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Armazenamento essencial usado pela plataforma</caption>
                  <thead className="bg-fundo-elevado/60 text-texto-principal">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-bold">Nome</th>
                      <th scope="col" className="px-3 py-2 font-bold">Finalidade</th>
                      <th scope="col" className="px-3 py-2 font-bold">Duração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borda-sutil">
                    <tr>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">sb-*</td>
                      <td className="px-3 py-2">Sessão de login (Supabase)</td>
                      <td className="px-3 py-2 whitespace-nowrap">Enquanto conectado</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">cinetica_consentimento_cookies</td>
                      <td className="px-3 py-2">Guarda suas preferências de cookies</td>
                      <td className="px-3 py-2 whitespace-nowrap">12 meses</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">Carrinho (armazenamento local)</td>
                      <td className="px-3 py-2">Mantém os produtos escolhidos na loja</td>
                      <td className="px-3 py-2 whitespace-nowrap">Até finalizar ou limpar</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-xs">
                Hoje a Cinética não carrega ferramentas de análise ou publicidade de terceiros. Se passarmos a usar, elas só serão
                ativadas para quem autorizar a categoria correspondente. Você também pode apagar cookies pelas configurações do seu
                navegador — isso desconecta sua conta e esvazia o carrinho.
              </p>
            </div>
          )}
        </div>

        {/* Chamada de suporte */}
        <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-azul-900 rounded-xl sm:rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <HelpCircle size={24} className="text-ouro shrink-0" />
            <div>
              <h4 className="font-bold text-white text-sm">Ficou com alguma dúvida?</h4>
              <p className="text-xs text-slate-300">Fale com a gente pela Central de ajuda no rodapé, ou continue explorando.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link href="/loja" className="w-full sm:w-auto">
              <Botao variante="festiva" tamanho="sm" icone={<ShoppingBag size={14} />} className="w-full sm:w-auto min-h-[44px] justify-center">
                Ver a loja
              </Botao>
            </Link>
            <Link href="/sorteios" className="w-full sm:w-auto">
              <Botao variante="secundario" tamanho="sm" icone={<Gift size={14} />} className="w-full sm:w-auto min-h-[44px] justify-center">
                Ver sorteios
              </Botao>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
