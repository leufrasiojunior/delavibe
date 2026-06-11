"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Save } from "lucide-react";

import { apiFetch } from "@/lib/api/client";
import {
  appSettingsSchema,
  type AppSettingsDto,
} from "@/lib/schemas/app-settings";
import { formatPhoneInputBr, normalizePhone } from "@/lib/utils/strings";
import { useToast } from "@/components/toast";

type AppSettingsManagementProps = {
  initialSettings: AppSettingsDto;
};

function formatWhatsappPhoneForInput(value: string | null) {
  const digits = normalizePhone(value ?? "");
  const nationalDigits = digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;

  return formatPhoneInputBr(nationalDigits);
}

export function AppSettingsManagement({ initialSettings }: AppSettingsManagementProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [whatsappContactPhone, setWhatsappContactPhone] = useState(
    formatWhatsappPhoneForInput(initialSettings.whatsappContactPhone),
  );
  const [webOrderWhatsappMessage, setWebOrderWhatsappMessage] = useState(
    initialSettings.webOrderWhatsappMessage ?? "",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      void apiFetch(
        "/api/admin/settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            whatsappContactPhone,
            webOrderWhatsappMessage,
          }),
        },
        appSettingsSchema,
      )
        .then((settings) => {
          setWhatsappContactPhone(formatWhatsappPhoneForInput(settings.whatsappContactPhone));
          setWebOrderWhatsappMessage(settings.webOrderWhatsappMessage ?? "");
          toast.success("Configurações salvas.");
        })
        .catch((caught: unknown) => {
          const message = caught instanceof Error ? caught.message : "Falha ao salvar configurações.";
          toast.error(message);
        });
    });
  }

  return (
    <section className="panel app-settings-panel">
      <div className="settings-tabs" role="tablist" aria-label="Configurações">
        <button type="button" className="tab active" role="tab" aria-selected="true">
          <MessageCircle size={16} aria-hidden />
          Whatsapp
        </button>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>WhatsApp público</span>
          <input
            value={whatsappContactPhone}
            onChange={(event) => setWhatsappContactPhone(formatPhoneInputBr(event.target.value))}
            inputMode="numeric"
            placeholder="(11) 91234-5678"
            maxLength={16}
          />
          <small className="muted">
            Usado no botão flutuante do site público. Deixe em branco para ocultar.
          </small>
        </label>

        <label className="field">
          <span>Mensagem para pedido web</span>
          <textarea
            value={webOrderWhatsappMessage}
            onChange={(event) => setWebOrderWhatsappMessage(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Mensagem opcional enviada no link do WhatsApp do pedido web"
          />
          <small className="muted">
            Se preenchida, será anexada ao link do WhatsApp nos detalhes do pedido web.
          </small>
        </label>

        <div className="button-row">
          <button type="submit" className="button button-primary" disabled={isPending}>
            <Save size={16} aria-hidden />
            {isPending ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </section>
  );
}
