const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Dela's Vibe";
const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || "(00) 00000-0000";

export const dynamic = "force-dynamic";

export default function PoliticaDePrivacidadePage() {
  return (
    <article className="public-article">
      <header>
        <p className="eyebrow">LGPD</p>
        <h1>Política de privacidade</h1>
        <p className="muted">Versão 1.0 — vigente desde maio de 2026.</p>
      </header>

      <section>
        <h2>1. Dados que coletamos</h2>
        <p>
          Para atender seus pedidos, coletamos nome, e-mail, telefone, endereço de entrega
          (quando aplicável) e o histórico dos pedidos realizados em nossa loja.
        </p>
      </section>

      <section>
        <h2>2. Finalidade do tratamento</h2>
        <p>
          Usamos esses dados exclusivamente para processar e entregar seus pedidos, comunicar
          mudanças de status quando necessário e cumprir obrigações legais.
        </p>
      </section>

      <section>
        <h2>3. Compartilhamento com terceiros</h2>
        <p>
          {storeName} não compartilha seus dados pessoais com terceiros para fins comerciais.
          Eventuais compartilhamentos são limitados a parceiros operacionais necessários à
          entrega do seu pedido.
        </p>
      </section>

      <section>
        <h2>4. Base legal</h2>
        <p>
          O tratamento dos seus dados acontece com base no seu consentimento explícito ao criar
          conta ou finalizar pedido, e na execução do contrato de compra e venda.
        </p>
      </section>

      <section>
        <h2>5. Direitos do titular</h2>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento.
          Enquanto a área do cliente para autoatendimento ainda não está disponível, faça a
          solicitação pelo telefone {storePhone}.
        </p>
      </section>

      <section>
        <h2>6. Contato</h2>
        <p>
          Dúvidas sobre privacidade: {storePhone}.
        </p>
      </section>
    </article>
  );
}
