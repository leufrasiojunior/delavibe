"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle, QrCode, Send, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { whatsappInstanceDtoSchema } from "@/lib/schemas/whatsapp";
import type { WhatsappInstanceDto } from "@/lib/schemas/whatsapp";
import { useToast } from "@/components/toast";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WhatsappConfigProps = {
  instance: WhatsappInstanceDto | null;
  isEvolutionConfigured: boolean;
};

// ---------------------------------------------------------------------------
// Schemas for apiFetch responses
// ---------------------------------------------------------------------------

const deleteResponseSchema = z.object({ success: z.boolean() });
const createInstanceResponseSchema = z.object({
  instance: whatsappInstanceDtoSchema,
  qrCodeBase64: z.string().nullable(),
});
const setWebhookResponseSchema = z.object({
  instance: whatsappInstanceDtoSchema,
});
const qrResponseSchema = z.object({ base64: z.string() });
const connectedResponseSchema = z.object({
  instance: whatsappInstanceDtoSchema,
});
const testMessageResponseSchema = z.object({ delayMs: z.number() });

// ---------------------------------------------------------------------------
// Validation helpers (client-side, mirrors Zod schemas from lib/schemas)
// ---------------------------------------------------------------------------

function validateWebhookUrl(value: string): string | null {
  if (value.trim() === "") {
    return "URL do Webhook e obrigatoria";
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "URL deve ser http ou https";
    }
  } catch {
    return "URL invalida";
  }
  return null;
}

function validateWebhookUrlOptional(value: string): string | null {
  if (value.trim() === "") return null;
  return validateWebhookUrl(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WhatsappConfig({
  instance,
  isEvolutionConfigured,
}: WhatsappConfigProps) {
  const toast = useToast();

  // ---- State ----
  const [currentInstance, setCurrentInstance] =
    useState<WhatsappInstanceDto | null>(instance);
  const [connectWizardOpen, setConnectWizardOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  // ---- Edit webhook modal state ----
  const [editWebhookOpen, setEditWebhookOpen] = useState(false);
  const [editWebhookUrl, setEditWebhookUrl] = useState("");
  const [editWebhookError, setEditWebhookError] = useState<string | null>(null);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  // ---- QR modal state ----
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isMarkingConnected, setIsMarkingConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrFetchedOnceRef = useRef(false);

  // ---- Test message modal state ----
  const [testDdd, setTestDdd] = useState("");
  const [testNumero, setTestNumero] = useState("");
  const [testDddError, setTestDddError] = useState<string | null>(null);
  const [testNumeroError, setTestNumeroError] = useState<string | null>(null);
  const [testSubmitError, setTestSubmitError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  function resetTestModal() {
    setTestDdd("");
    setTestNumero("");
    setTestDddError(null);
    setTestNumeroError(null);
    setTestSubmitError(null);
    setIsSending(false);
    setTestModalOpen(false);
  }

  function validateDdd(value: string): string | null {
    if (value.length !== 2 || /\D/.test(value)) {
      return "DDD deve ter exatamente 2 digitos";
    }
    return null;
  }

  function validateNumero(value: string): string | null {
    if (value.length < 8 || value.length > 9 || /\D/.test(value)) {
      return "Numero deve ter 8 ou 9 digitos";
    }
    return null;
  }

  function handleTestSubmit() {
    const dddErr = validateDdd(testDdd);
    const numErr = validateNumero(testNumero);
    setTestDddError(dddErr);
    setTestNumeroError(numErr);
    if (dddErr || numErr) return;

    setIsSending(true);
    setTestSubmitError(null);

    void apiFetch(
      "/api/whatsapp/test-message",
      {
        method: "POST",
        body: JSON.stringify({ ddd: testDdd, numero: testNumero }),
      },
      testMessageResponseSchema,
    )
      .then((data) => {
        const delaySegundos = Math.round(data.delayMs / 1000);
        resetTestModal();
        toast.success(
          `Mensagem de teste enviada! Vai chegar com delay de ${delaySegundos}s.`,
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Falha ao enviar mensagem de teste.";
        setTestSubmitError(message);
      })
      .finally(() => {
        setIsSending(false);
      });
  }

  // ---- Wizard state (local) ----
  const [wizardWebhookUrl, setWizardWebhookUrl] = useState("");
  const [wizardWebhookUrlError, setWizardWebhookUrlError] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetWizard() {
    setWizardWebhookUrl("");
    setWizardWebhookUrlError(null);
    setIsSubmitting(false);
    setConnectWizardOpen(false);
  }

  function handleWizardSubmit() {
    const error = validateWebhookUrlOptional(wizardWebhookUrl);
    setWizardWebhookUrlError(error);
    if (error) return;

    setIsSubmitting(true);

    void apiFetch(
      "/api/whatsapp/instance",
      {
        method: "POST",
        body: JSON.stringify({
          webhookUrl: wizardWebhookUrl.trim() || undefined,
        }),
      },
      createInstanceResponseSchema,
    )
      .then((data) => {
        setCurrentInstance(data.instance);
        resetWizard();

        // The create response already includes the QR code (Evolution starts
        // the session immediately when `qrcode: true`). Pre-populate the QR
        // state and mark as fetched so the modal's auto-fetch effect skips
        // the extra GET /api/whatsapp/qr call.
        if (data.qrCodeBase64) {
          const raw = data.qrCodeBase64;
          const prefixed = raw.startsWith("data:image/")
            ? raw
            : `data:image/png;base64,${raw}`;
          setQrBase64(prefixed);
          setSecondsLeft(60);
          qrFetchedOnceRef.current = true;
        }

        setQrModalOpen(true);
        toast.success("Instancia criada! Escaneie o QR Code com o WhatsApp.");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Falha ao criar a instancia.";
        toast.error(message);
        setIsSubmitting(false);
      });
  }

  // ---- Disconnect handler ----
  function handleDisconnectConfirm() {
    startDeleteTransition(() => {
      void apiFetch(
        "/api/whatsapp/instance",
        { method: "DELETE" },
        deleteResponseSchema,
      )
        .then(() => {
          setCurrentInstance(null);
          setConfirmDeleteOpen(false);
          toast.success("WhatsApp desconectado.");
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Falha ao desconectar o WhatsApp.";
          toast.error(message);
        });
    });
  }

  // ---- Edit webhook handlers ----
  function openEditWebhook() {
    setEditWebhookUrl(currentInstance?.webhookUrl ?? "");
    setEditWebhookError(null);
    setEditWebhookOpen(true);
  }

  function resetEditWebhook() {
    setEditWebhookOpen(false);
    setEditWebhookUrl("");
    setEditWebhookError(null);
    setIsSavingWebhook(false);
  }

  function handleEditWebhookSubmit() {
    const error = validateWebhookUrl(editWebhookUrl);
    setEditWebhookError(error);
    if (error) return;

    setIsSavingWebhook(true);

    void apiFetch(
      "/api/whatsapp/webhook",
      {
        method: "POST",
        body: JSON.stringify({ webhookUrl: editWebhookUrl.trim() }),
      },
      setWebhookResponseSchema,
    )
      .then((data) => {
        setCurrentInstance(data.instance);
        resetEditWebhook();
        toast.success("Webhook atualizado.");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Falha ao atualizar o webhook.";
        toast.error(message);
        setIsSavingWebhook(false);
      });
  }

  // ---- QR modal helpers ----
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchQr = useCallback(() => {
    qrFetchedOnceRef.current = true;
    setIsFetchingQr(true);
    setQrError(null);

    void apiFetch("/api/whatsapp/qr", { method: "GET" }, qrResponseSchema)
      .then((data) => {
        const raw = data.base64;
        const prefixed = raw.startsWith("data:image/")
          ? raw
          : `data:image/png;base64,${raw}`;
        setQrBase64(prefixed);
        setSecondsLeft(60);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Nao foi possivel gerar o QR Code.";
        setQrError(message);
        setQrBase64(null);
        toast.error(message);
      })
      .finally(() => {
        setIsFetchingQr(false);
      });
  }, [toast]);

  function closeQrModal() {
    setQrModalOpen(false);
    setQrBase64(null);
    setSecondsLeft(0);
    setQrError(null);
    qrFetchedOnceRef.current = false;
    clearTimer();
  }

  function handleRenewQr() {
    clearTimer();
    fetchQr();
  }

  function handleMarkConnected() {
    setIsMarkingConnected(true);

    void apiFetch(
      "/api/whatsapp/connected",
      { method: "POST" },
      connectedResponseSchema,
    )
      .then((data) => {
        setCurrentInstance(data.instance);
        closeQrModal();
        toast.success("WhatsApp conectado!");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Falha ao confirmar conexao.";
        toast.error(message);
      })
      .finally(() => {
        setIsMarkingConnected(false);
      });
  }

  // ---- QR timer effect ----
  useEffect(() => {
    if (!qrModalOpen || !qrBase64) {
      return;
    }

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          timerRef.current = null;
          setQrBase64(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = id;

    return () => {
      clearInterval(id);
      timerRef.current = null;
    };
  }, [qrModalOpen, qrBase64]);

  // ---- Auto-fetch QR when modal opens ----
  useEffect(() => {
    if (qrModalOpen && !qrFetchedOnceRef.current) {
      fetchQr();
    }
  }, [qrModalOpen, fetchQr]);

  // ---- Render: no instance ----
  if (!currentInstance) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Configuracao</p>
            <h2>Instancia WhatsApp</h2>
          </div>
        </div>

        <div className="stack">
          <p>
            Conecte uma instancia WhatsApp para enviar notificacoes via
            Evolution API.
          </p>

          {!isEvolutionConfigured ? (
            <div className="alert alert-warning" role="alert">
              <p>
                A Evolution API nao esta configurada. Defina as variaveis de
                ambiente <code>EVOLUTION_API_BASE_URL</code>,{" "}
                <code>EVOLUTION_API_GLOBAL_APIKEY</code> e{" "}
                <code>APP_ENCRYPTION_KEY</code>.
              </p>
            </div>
          ) : null}

          <button
            className="button button-primary"
            type="button"
            disabled={!isEvolutionConfigured}
            onClick={() => setConnectWizardOpen(true)}
          >
            <MessageCircle size={16} aria-hidden />
            Conectar WhatsApp
          </button>
        </div>

        {/* ---- Connect wizard modal ---- */}
        {connectWizardOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header">
                <h3>Conectar WhatsApp</h3>
              </div>
              <div className="modal-body">
                <div className="stack">
                  <label
                    className="field-label"
                    htmlFor="wizard-webhook-url"
                  >
                    URL do Webhook (opcional)
                  </label>
                  <input
                    id="wizard-webhook-url"
                    type="text"
                    className="input"
                    placeholder="https://n8n.example.com/webhook/whatsapp"
                    value={wizardWebhookUrl}
                    onChange={(e) => {
                      setWizardWebhookUrl(e.target.value);
                      if (wizardWebhookUrlError) {
                        setWizardWebhookUrlError(
                          validateWebhookUrlOptional(e.target.value),
                        );
                      }
                    }}
                    onBlur={() =>
                      setWizardWebhookUrlError(
                        validateWebhookUrlOptional(wizardWebhookUrl),
                      )
                    }
                  />
                  <p className="text-hint">
                    Se deixar vazio, a instancia sera criada sem webhook --
                    voce pode configurar depois. Aceita HTTP ou HTTPS. O token
                    da instancia sera gerado automaticamente.
                  </p>
                  {wizardWebhookUrlError ? (
                    <p className="text-error">{wizardWebhookUrlError}</p>
                  ) : null}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={resetWizard}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={handleWizardSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Conectando..." : "Conectar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // ---- Render: with instance ----
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Instancia ativa</p>
            <h2>{currentInstance.instanceName}</h2>
          </div>
        </div>

        <div className="stack">
          <div className="field-grid">
            <div className="field">
              <span className="field-label">Nome</span>
              <span>{currentInstance.instanceName}</span>
            </div>
            <div className="field">
              <span className="field-label">ID</span>
              <span className="table-subtitle">{currentInstance.instanceId}</span>
            </div>
            <div className="field">
              <span className="field-label">Webhook</span>
              <div className="whatsapp-field-row">
                <span className="table-subtitle" style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>
                  {currentInstance.webhookUrl ?? "Nao configurado"}
                </span>
                <button
                  className="button button-secondary compact"
                  type="button"
                  onClick={openEditWebhook}
                >
                  {currentInstance.webhookUrl ? "Editar" : "Configurar"}
                </button>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Criada em</span>
              <span>
                {new Date(currentInstance.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="field">
              <span className="field-label">Ultima conexao</span>
              <span>
                {currentInstance.lastConnectedAt
                  ? new Date(currentInstance.lastConnectedAt).toLocaleString(
                      "pt-BR",
                    )
                  : "Ainda nao confirmada"}
              </span>
            </div>
          </div>

          <div className="button-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setQrModalOpen(true)}
            >
              <QrCode size={16} aria-hidden />
              Mostrar QR Code
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setTestModalOpen(true)}
            >
              <Send size={16} aria-hidden />
              Enviar Mensagem de Teste
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 size={16} aria-hidden />
              Desconectar
            </button>
          </div>
        </div>

        {/* ---- QR code modal ---- */}
        {qrModalOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header">
                <h3>Conectar WhatsApp</h3>
              </div>
              <div className="modal-body">
                <div className="stack">
                  {/* Sub-state: loading */}
                  {isFetchingQr && !qrBase64 ? (
                    <div className="flex-center" style={{ padding: "2rem 0" }}>
                      <Loader2 size={32} className="spinner" aria-hidden />
                      <p>Gerando QR Code...</p>
                    </div>
                  ) : null}

                  {/* Sub-state: QR image visible */}
                  {qrBase64 ? (
                    <div className="stack" style={{ alignItems: "center" }}>
                      <img
                        src={qrBase64}
                        alt="QR Code WhatsApp"
                        style={{ maxWidth: "280px", width: "100%" }}
                      />
                      <p>Escaneie com o WhatsApp do seu celular.</p>
                      <p>
                        Expira em <strong>{secondsLeft}</strong>s
                      </p>
                    </div>
                  ) : null}

                  {/* Sub-state: expired */}
                  {!qrBase64 && !isFetchingQr && secondsLeft === 0 && !qrError && qrFetchedOnceRef.current ? (
                    <p>
                      QR Code expirado. Clique em &quot;Renovar QR&quot; para
                      gerar um novo.
                    </p>
                  ) : null}

                  {/* Sub-state: error */}
                  {qrError ? (
                    <div className="alert alert-warning" role="alert">
                      <p>{qrError}</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={closeQrModal}
                  disabled={isMarkingConnected}
                >
                  Fechar
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={handleRenewQr}
                  disabled={isFetchingQr || isMarkingConnected}
                >
                  <RefreshCw size={16} aria-hidden />
                  Renovar QR
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={handleMarkConnected}
                  disabled={isMarkingConnected || isFetchingQr}
                >
                  {isMarkingConnected ? "Confirmando..." : "Ja escaneei"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ---- Test message modal ---- */}
        {testModalOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header">
                <h3>Enviar Mensagem de Teste</h3>
              </div>
              <div className="modal-body">
                <div className="stack">
                  <p>
                    Informe o numero para enviar uma mensagem de teste via
                    WhatsApp.
                  </p>

                  <label className="field" htmlFor="test-ddd">
                    <span>Numero para teste</span>
                    <div className="whatsapp-phone-input">
                      <span className="whatsapp-phone-prefix" aria-hidden>
                        +55
                      </span>
                      <input
                        id="test-ddd"
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        pattern="\d{2}"
                        className="whatsapp-phone-ddd"
                        placeholder="DDD"
                        aria-label="DDD"
                        value={testDdd}
                        aria-invalid={testDddError ? "true" : undefined}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          setTestDdd(v);
                          if (testDddError) {
                            setTestDddError(validateDdd(v));
                          }
                        }}
                        onBlur={() => {
                          if (testDdd) {
                            setTestDddError(validateDdd(testDdd));
                          }
                        }}
                      />
                      <input
                        id="test-numero"
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        pattern="\d{8,9}"
                        className="whatsapp-phone-number"
                        placeholder="999887766"
                        aria-label="Numero"
                        value={testNumero}
                        aria-invalid={testNumeroError ? "true" : undefined}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          setTestNumero(v);
                          if (testNumeroError) {
                            setTestNumeroError(validateNumero(v));
                          }
                        }}
                        onBlur={() => {
                          if (testNumero) {
                            setTestNumeroError(validateNumero(testNumero));
                          }
                        }}
                      />
                    </div>
                    <small>
                      DDD com 2 digitos e numero com 8 ou 9 digitos.
                    </small>
                    {testDddError ? (
                      <p className="text-error">{testDddError}</p>
                    ) : null}
                    {testNumeroError ? (
                      <p className="text-error">{testNumeroError}</p>
                    ) : null}
                  </label>

                  {testSubmitError ? (
                    <div className="alert alert-warning" role="alert">
                      <p>{testSubmitError}</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={resetTestModal}
                  disabled={isSending}
                >
                  Cancelar
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={handleTestSubmit}
                  disabled={
                    !!testDddError ||
                    !!testNumeroError ||
                    !testDdd ||
                    !testNumero ||
                    isSending
                  }
                >
                  {isSending ? (
                    <>
                      <Loader2 size={16} className="spinner" aria-hidden />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={16} aria-hidden />
                      Enviar Teste
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---- Confirm disconnect modal ---- */}
      {confirmDeleteOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Desconectar WhatsApp</h3>
            </div>
            <div className="modal-body">
              <p>
                Tem certeza que deseja desconectar o WhatsApp? A instancia atual
                sera deletada e voce precisara configurar novamente.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={handleDisconnectConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Desconectando..." : "Sim, desconectar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- Edit webhook modal ---- */}
      {editWebhookOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {currentInstance?.webhookUrl
                  ? "Editar Webhook"
                  : "Configurar Webhook"}
              </h3>
            </div>
            <div className="modal-body">
              <div className="stack">
                <label className="field" htmlFor="edit-webhook-url">
                  <span>URL do Webhook</span>
                  <input
                    id="edit-webhook-url"
                    type="text"
                    placeholder="https://n8n.example.com/webhook/whatsapp"
                    value={editWebhookUrl}
                    aria-invalid={editWebhookError ? "true" : undefined}
                    onChange={(e) => {
                      setEditWebhookUrl(e.target.value);
                      if (editWebhookError) {
                        setEditWebhookError(validateWebhookUrl(e.target.value));
                      }
                    }}
                    onBlur={() =>
                      setEditWebhookError(validateWebhookUrl(editWebhookUrl))
                    }
                  />
                  <small>
                    URL HTTP ou HTTPS que recebera os eventos MESSAGES_UPSERT
                    da instancia.
                  </small>
                  {editWebhookError ? (
                    <p className="text-error">{editWebhookError}</p>
                  ) : null}
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="button button-secondary"
                type="button"
                onClick={resetEditWebhook}
                disabled={isSavingWebhook}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={handleEditWebhookSubmit}
                disabled={
                  isSavingWebhook ||
                  !editWebhookUrl.trim() ||
                  !!editWebhookError
                }
              >
                {isSavingWebhook ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
