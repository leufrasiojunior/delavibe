"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { DeliveryMode } from "@prisma/client";

import { Modal } from "@/components/modal";
import { PrivacyPolicyContent } from "@/components/privacy-policy-content";
import { ProductMedia } from "@/components/product-media";
import { QuantityStepper } from "@/components/quantity-stepper";
import { apiFetch } from "@/lib/api/client";
import { useCart } from "@/lib/hooks/use-cart";
import { type CustomerAddressDto } from "@/lib/schemas/customer-address";
import { type PublicProductDto } from "@/lib/schemas/product";
import { webOrderSchema } from "@/lib/schemas/web-order";
import { formatCurrency } from "@/lib/utils/money";
import { calculatePromotionSavings } from "@/lib/utils/promotion-display";
import { formatPhoneInputBr } from "@/lib/utils/strings";
import { ViaCepError, fetchAddressByCep, normalizeCepDigits } from "@/lib/utils/viacep";

const POLICY_VERSION = "1.0-2026-05";

type CheckoutCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

type PublicCheckoutFormProps = {
  customer: CheckoutCustomer | null;
  addresses: CustomerAddressDto[];
  productsLookup: Record<string, PublicProductDto>;
};

type AddressDraft = {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  reference: string;
};

const emptyAddress: AddressDraft = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: "",
  reference: "",
};

export function PublicCheckoutForm({
  customer,
  addresses,
  productsLookup,
}: PublicCheckoutFormProps) {
  const router = useRouter();
  const { items, isHydrated, clear, removeItem, updateQuantity } = useCart();
  const [isPending, startTransition] = useTransition();
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(DeliveryMode.DELIVERY);
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(formatPhoneInputBr(customer?.phone ?? ""));
  const [notes, setNotes] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddress);
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [cepLookupError, setCepLookupError] = useState<string | null>(null);
  const [addressRevealed, setAddressRevealed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);
  const isOrderCompletedRef = useRef(false);

  useEffect(() => {
    if (isOrderCompleted || isOrderCompletedRef.current) return;
    if (isHydrated && items.length === 0) {
      router.replace("/carrinho");
    }
  }, [isHydrated, isOrderCompleted, items.length, router]);

  useEffect(() => {
    if (deliveryMode !== DeliveryMode.DELIVERY) return;
    if (selectedAddressId) return; // usando endereço cadastrado, não busca

    const digits = normalizeCepDigits(addressDraft.zip);
    if (digits.length !== 8) {
      setCepLookupError(null);
      return;
    }

    const controller = new AbortController();
    setIsLookingUpCep(true);
    setCepLookupError(null);

    fetchAddressByCep(digits, { signal: controller.signal })
      .then((result) => {
        setAddressDraft((current) => ({
          ...current,
          street: result.street || current.street,
          neighborhood: result.neighborhood || current.neighborhood,
          city: result.city,
          state: result.state,
          complement: current.complement || result.complement,
        }));
        setAddressRevealed(true);
      })
      .catch((caught: unknown) => {
        if ((caught as { name?: string } | null)?.name === "AbortError") return;
        const message =
          caught instanceof ViaCepError || caught instanceof Error
            ? caught.message
            : "Falha ao buscar CEP.";
        setCepLookupError(message);
      })
      .finally(() => setIsLookingUpCep(false));

    return () => controller.abort();
  }, [addressDraft.zip, deliveryMode, selectedAddressId]);

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const product = productsLookup[item.productId];
        return sum + (product?.effectivePriceCents ?? 0) * item.quantity;
      }, 0),
    [items, productsLookup],
  );

  function buildAddressSnapshot(): AddressDraft | null {
    if (deliveryMode === DeliveryMode.PICKUP) return null;
    if (selectedAddressId && customer) {
      const found = addresses.find((address) => address.id === selectedAddressId);
      if (found) {
        return {
          street: found.street,
          number: found.number,
          complement: found.complement ?? "",
          neighborhood: found.neighborhood,
          city: found.city,
          state: found.state,
          zip: found.zip,
          reference: found.reference ?? "",
        };
      }
    }
    return addressDraft;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!consentData) {
      setError("É necessário aceitar a Política de Privacidade.");
      return;
    }

    const snapshot = buildAddressSnapshot();

    const payload: Record<string, unknown> = {
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      deliveryMode,
      notes: notes.trim() || null,
    };

    if (snapshot) {
      payload.addressSnapshot = snapshot;
    }

    if (!customer) {
      payload.guestCustomer = {
        name,
        email,
        phone,
        consentDataProcessing: true,
        consentMarketing,
        policyVersion: POLICY_VERSION,
      };

      if (createAccount) {
        payload.createAccount = true;
        payload.password = password;
        payload.confirmPassword = confirmPassword;
      }
    }

    startTransition(() => {
      void apiFetch(
        "/api/web-orders",
        { method: "POST", body: JSON.stringify(payload) },
        webOrderSchema,
      )
        .then((order) => {
          isOrderCompletedRef.current = true;
          setIsOrderCompleted(true);
          clear();
          router.replace(`/pedido/${order.id}/confirmacao`);
        })
        .catch((caught: unknown) => {
          const message = caught instanceof Error ? caught.message : "Falha ao finalizar pedido.";
          setError(message);

          // Remove items inválidos do carrinho se backend indicou
          const detailMatch = /productIds?: ?\[?([^\]]+)\]?/.exec(message);
          if (detailMatch) {
            const ids = detailMatch[1].split(",").map((value) => value.trim().replace(/['"]/g, ""));
            for (const id of ids) {
              if (id) removeItem(id);
            }
          }
        });
    });
  }

  if (!isHydrated || items.length === 0) {
    return (
      <section className="public-empty">
        <p className="muted">Carregando seu pedido...</p>
      </section>
    );
  }

  return (
    <form className="public-checkout" onSubmit={handleSubmit}>
      <header>
        <p className="eyebrow">Checkout</p>
        <h1>Finalizar pedido</h1>
      </header>

      <div className="checkout-grid">

      <section className="public-checkout-block checkout-step checkout-step--1">
        <h2>1. Seus dados</h2>

        {customer ? (
          <div className="field-grid">
            <label className="field">
              <span>Nome</span>
              <input value={customer.name} disabled />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input value={customer.email} disabled />
            </label>
            <label className="field">
              <span>Telefone</span>
              <input value={customer.phone} disabled />
              <small className="muted">
                Informe um número com DDD que tenha WhatsApp. Podemos entrar em contato sobre o pedido.
              </small>
            </label>
          </div>
        ) : (
          <div className="field-grid">
            <label className="field">
              <span>Nome completo</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Telefone (com DDD)</span>
              <input
                value={phone}
                onChange={(event) => setPhone(formatPhoneInputBr(event.target.value))}
                placeholder="(11) 91234-5678"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={16}
                required
              />
              <small className="muted">
                Use um número com DDD que tenha WhatsApp. Podemos entrar em contato sobre o pedido.
              </small>
            </label>
          </div>
        )}

        {!customer ? (
          <p className="muted">
            Já tem conta?{" "}
            <Link href={`/entrar?return=${encodeURIComponent("/checkout")}`}>Entrar</Link>
          </p>
        ) : null}
      </section>

      <section className="public-checkout-block checkout-step checkout-step--2">
        <h2>2. Entrega</h2>
        <div className="public-delivery-options">
          <label className="public-delivery-option">
            <input
              type="radio"
              name="deliveryMode"
              value={DeliveryMode.PICKUP}
              checked={deliveryMode === DeliveryMode.PICKUP}
              onChange={() => setDeliveryMode(DeliveryMode.PICKUP)}
            />
            <span>
              <strong>Retirar no local</strong>
              <span className="muted">Você passa para buscar e pagar.</span>
            </span>
          </label>
          <label className="public-delivery-option">
            <input
              type="radio"
              name="deliveryMode"
              value={DeliveryMode.DELIVERY}
              checked={deliveryMode === DeliveryMode.DELIVERY}
              onChange={() => setDeliveryMode(DeliveryMode.DELIVERY)}
            />
            <span>
              <strong>Entregar no meu endereço</strong>
              <span className="public-delivery-fee-alert">
                <AlertTriangle size={14} aria-hidden />
                Combinaremos a entrega após o pagamento. O valor da entrega poderá ser informado pelo WhatsApp.
              </span>
            </span>
          </label>
        </div>

        {deliveryMode === DeliveryMode.DELIVERY ? (
          <div className="stack">
            {customer && addresses.length > 0 ? (
              <label className="field">
                <span>Escolha um endereço cadastrado</span>
                <select
                  value={selectedAddressId ?? ""}
                  onChange={(event) => setSelectedAddressId(event.target.value || null)}
                >
                  <option value="">Informar novo endereço</option>
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.street}, {address.number} — {address.neighborhood}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {(!customer || addresses.length === 0 || !selectedAddressId) ? (
              <div className="stack">
                <label className="field">
                  <span>
                    CEP
                    {isLookingUpCep ? <em className="muted"> · buscando...</em> : null}
                  </span>
                  <input
                    value={addressDraft.zip}
                    onChange={(event) =>
                      setAddressDraft((current) => ({ ...current, zip: event.target.value }))
                    }
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    required
                  />
                  {cepLookupError ? (
                    <small className="form-error compact">
                      {cepLookupError}{" "}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setAddressRevealed(true)}
                      >
                        Não tenho CEP / preencher manualmente
                      </button>
                    </small>
                  ) : null}
                  {!addressRevealed && !cepLookupError ? (
                    <small className="muted">Informe o CEP para continuar.</small>
                  ) : null}
                </label>

                {addressRevealed ? (
                  <div className="field-grid">
                    <label className="field">
                      <span>Rua</span>
                      <input
                        value={addressDraft.street}
                        onChange={(event) =>
                          setAddressDraft((current) => ({ ...current, street: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Número</span>
                      <input
                        value={addressDraft.number}
                        onChange={(event) =>
                          setAddressDraft((current) => ({ ...current, number: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Complemento</span>
                      <input
                        value={addressDraft.complement}
                        onChange={(event) =>
                          setAddressDraft((current) => ({ ...current, complement: event.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Bairro</span>
                      <input
                        value={addressDraft.neighborhood}
                        onChange={(event) =>
                          setAddressDraft((current) => ({ ...current, neighborhood: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Cidade</span>
                      <input value={addressDraft.city} readOnly required tabIndex={-1} />
                    </label>
                    <label className="field">
                      <span>UF</span>
                      <input
                        value={addressDraft.state}
                        readOnly
                        required
                        tabIndex={-1}
                        maxLength={2}
                      />
                    </label>
                    <label className="field">
                      <span>Ponto de referência</span>
                      <input
                        value={addressDraft.reference}
                        onChange={(event) =>
                          setAddressDraft((current) => ({ ...current, reference: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="public-checkout-block checkout-step checkout-step--3">
        <h2>3. Carrinho e pagamento</h2>

        <ul className="public-checkout-summary">
          {items.map((item) => {
            const product = productsLookup[item.productId];
            const lineTotal = (product?.effectivePriceCents ?? 0) * item.quantity;
            const savings = product?.promotion
              ? calculatePromotionSavings(product.priceCents, product.effectivePriceCents)
              : null;
            return (
              <li key={item.productId} className="public-checkout-summary-row">
                {product ? (
                  <ProductMedia product={product} size="sm" />
                ) : (
                  <div className="product-media product-media--sm" aria-hidden />
                )}
                <div className="public-checkout-summary-info">
                  <strong>{product?.name ?? "Produto indisponível"}</strong>
                  {product?.promotion ? (
                    <span className="public-promo-price compact">
                      <span>De: {formatCurrency(product.priceCents)} cada</span>
                      <strong>
                        Por: {formatCurrency(product.effectivePriceCents)} cada
                      </strong>
                      {savings ? <span className="discount-badge">{savings.discountLabel}</span> : null}
                    </span>
                  ) : (
                    <span className="muted">{formatCurrency(product?.priceCents ?? 0)} cada</span>
                  )}
                </div>
                <div className="public-checkout-summary-actions">
                  {product ? (
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      onChange={(next) => updateQuantity(item.productId, next)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="button button-secondary compact"
                      onClick={() => removeItem(item.productId)}
                    >
                      Remover
                    </button>
                  )}
                </div>
                <strong className="public-checkout-summary-total">
                  {formatCurrency(lineTotal)}
                </strong>
              </li>
            );
          })}
          <li className="public-cart-summary">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </li>
        </ul>

        <label className="field">
          <span>Observações (opcional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={240}
            placeholder="Ex.: cerveja bem gelada, troco para R$ 100"
          />
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={consentData}
            onChange={(event) => setConsentData(event.target.checked)}
          />
          <span>
            Aceito a{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => setShowTermsModal(true)}
            >
              Política de Privacidade
            </button>{" "}
            e o processamento dos meus dados.
          </span>
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={consentMarketing}
            onChange={(event) => setConsentMarketing(event.target.checked)}
          />
          <span>Quero receber promoções e novidades (opcional).</span>
        </label>

        {!customer ? (
          <>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(event) => setCreateAccount(event.target.checked)}
              />
              <span>Criar conta com meus dados para próximos pedidos.</span>
            </label>

            {createAccount ? (
              <div className="field-grid">
                <label className="field">
                  <span>Senha (8+ caracteres com letra e número)</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Confirmar senha</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        {error ? <p className="form-error compact">{error}</p> : null}

        <button type="submit" className="button button-primary" disabled={isPending}>
          <CheckCircle2 size={16} aria-hidden />
          {isPending ? "Enviando pedido..." : "Finalizar pedido"}
        </button>
      </section>

      </div>

      <Modal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Política de Privacidade"
        size="lg"
      >
        <PrivacyPolicyContent />
      </Modal>
    </form>
  );
}
