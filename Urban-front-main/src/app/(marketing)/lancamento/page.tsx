import { ArrowRight, Zap, Target, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { WaitlistForm } from "../../componentes/WaitlistForm";

export default function LançamentoUrbanAIPage() {
  return (
    <main className="flex flex-col min-h-screen bg-[#070B14] text-slate-50 items-center justify-start overflow-x-hidden">
      {/* Hero Section */}
      <section className="w-full max-w-5xl text-center pt-32 pb-24 px-6 flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 text-blue-400 font-semibold mb-8 border border-blue-800/50">
          <Zap size={16} /> Lançamento Oficial Urban AI
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          A Nova Inteligência Que Blinda O Seu Calendário Contra A <br className="hidden md:block"/> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-400">
            "Síndrome Da Casa Barata".
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-300 max-w-3xl leading-relaxed mb-12">
          Comemorar que seus finais de semana e feriados esgotaram rapidamente não é um troféu — na grande maioria das vezes, significa que você fixou os preços cedo demais. Nossa automação protege suas margens enquanto você dorme.
        </p>
        
        <button 
          id="cta-piloto-automatico-hero" 
          className="bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold text-lg md:text-xl py-5 px-10 rounded-full inline-flex gap-3 items-center transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:-translate-y-1"
        >
          Experimentar O Piloto Automático <ArrowRight size={24}/>
        </button>
      </section>

      {/* Features Section */}
      <section className="w-full bg-[#0A0F1D] py-24 px-6 flex flex-col items-center border-t border-slate-800/50">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16 text-center max-w-2xl">
          Chega de perder 30% da sua receita por não <span className="text-blue-400">antecipar o mercado.</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          <div className="bg-[#070B14] border border-slate-800 p-8 rounded-2xl flex flex-col gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl w-fit text-blue-400">
              <Target size={32} />
            </div>
            <h3 className="text-xl font-bold">Vasculhamento Massivo de Eventos Locais</h3>
            <p className="text-slate-400 leading-relaxed">
              A inteligência artificial detecta quando eventos, shows e feriados aquecem silenciosamente seu bairro e calibra antes das vagas esgotarem.
            </p>
          </div>

          <div className="bg-[#070B14] border border-slate-800 p-8 rounded-2xl flex flex-col gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl w-fit text-emerald-400">
              <Zap size={32} />
            </div>
            <h3 className="text-xl font-bold">Micro-Ajustes na Base de Preço</h3>
            <p className="text-slate-400 leading-relaxed">
              A tarifa reage cirurgicamente quando a demanda oculta na vizinhança começa a esmagar a oferta existente. Reajustes automáticos impossíveis para a mente humana.
            </p>
          </div>

          <div className="bg-[#070B14] border border-slate-800 p-8 rounded-2xl flex flex-col gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl w-fit text-blue-400">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold">Blindagem do seu RevPAR</h3>
            <p className="text-slate-400 leading-relaxed">
              Sem planilhas manuais. Uma ferramenta criada de anfitriões profissionais para anfitriões exigentes. Proteja sua rentabilidade diária automatizada.
            </p>
          </div>
        </div>

        <div className="mt-16">
          <button
            id="cta-iniciar-blindagem"
            className="bg-transparent border border-blue-500 text-blue-400 hover:bg-blue-500/10 font-semibold py-4 px-8 rounded-full inline-flex gap-2 items-center transition-all duration-300"
          >
            Começar Blindagem do Calendário
          </button>
        </div>
      </section>

      {/* Waitlist Section */}
      <section
        id="waitlist"
        className="w-full py-24 px-6 flex flex-col items-center border-t border-slate-800/50"
      >
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-center max-w-2xl">
          Entre na <span className="text-emerald-400">lista de interesse</span>.
        </h2>
        <p className="text-slate-400 max-w-xl text-center mb-10">
          Estamos abrindo vagas em lotes pequenos para anfitriões profissionais em São Paulo. Deixe seu e-mail para receber acesso antecipado.
        </p>
        <WaitlistForm buttonLabel="Quero acesso antecipado" source="lancamento" />
      </section>
    </main>
  );
}
