const PALAVRAS_FAIXA = Array.from({ length: 7 }, () => 'Cinética');

/** Faixa amarela inclinada e rolante exibida logo abaixo do hero da página inicial. */
export default function FaixaCinetica() {
  return (
    <div className="relative -rotate-2 scale-105 bg-ouro text-azul-950 py-4 border-y-4 border-azul-950 select-none" aria-hidden="true">
      <div className="faixa-rolante">
        {[0, 1].map((bloco) => (
          <div key={bloco} className="flex items-center shrink-0">
            {PALAVRAS_FAIXA.concat(PALAVRAS_FAIXA).map((p, i) => (
              <span key={`${bloco}-${i}`} className="flex items-center gap-6 pr-6 font-titulo font-extrabold text-2xl sm:text-3xl uppercase tracking-tight">
                {p}
                <span className="text-azul-950/40">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
