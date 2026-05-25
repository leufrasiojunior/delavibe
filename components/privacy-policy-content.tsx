const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Dela's Vibe";
const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || "(00) 00000-0000";

export const PRIVACY_POLICY_VERSION_LABEL = "Versão 1.0 — vigente desde maio de 2026.";

export function PrivacyPolicyContent() {
  return (
    <div className="privacy-policy">
      <p className="muted">{PRIVACY_POLICY_VERSION_LABEL}</p>

      <section>
        <h3>1. Dados que coletamos</h3>
        <p>
          Para atender seus pedidos, coletamos nome, e-mail, telefone, endereço de entrega
          (quando aplicável) e o histórico dos pedidos realizados em nossa loja.
        </p>
      </section>

      <section>
        <h3>2. Finalidade do tratamento</h3>
        <p>
          Usamos esses dados exclusivamente para processar e entregar seus pedidos, comunicar
          mudanças de status quando necessário e cumprir obrigações legais.
        </p>
      </section>

      <section>
        <h3>3. Compartilhamento com terceiros</h3>
        <p>
          {storeName} não compartilha seus dados pessoais com terceiros para fins comerciais.
          Eventuais compartilhamentos são limitados a parceiros operacionais necessários à
          entrega do seu pedido.
        </p>
      </section>

      <section>
        <h3>4. Base legal</h3>
        <p>
          O tratamento dos seus dados acontece com base no seu consentimento explícito ao criar
          conta ou finalizar pedido, e na execução do contrato de compra e venda.
        </p>
      </section>

      <section>
        <h3>5. Direitos do titular</h3>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento.
          Enquanto a área do cliente para autoatendimento ainda não está disponível, faça a
          solicitação pelo telefone {storePhone}.
        </p>
      </section>

      <section>
        <h3>6. Contato</h3>
        <p>Dúvidas sobre privacidade: {storePhone}.</p>
      </section>
    </div>
  );
}
