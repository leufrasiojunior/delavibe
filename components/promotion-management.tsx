"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Edit3, Plus, Save, Search, X } from "lucide-react";
import { PromotionType } from "@prisma/client";

import { apiFetch } from "@/lib/api/client";
import { type ProductDto } from "@/lib/schemas/product";
import { promotionSchema, type PromotionDto } from "@/lib/schemas/promotion";
import { centsToCurrencyInput, formatCurrency, formatCurrencyInput } from "@/lib/utils/money";
import { normalizeText } from "@/lib/utils/text";
import { useToast } from "@/components/toast";

type PromotionManagementProps = {
  products: ProductDto[];
  promotions: PromotionDto[];
  canManage: boolean;
};

type PromotionFormState = {
  id: string | null;
  productId: string;
  type: PromotionType;
  promotionalPrice: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type PromotionTab = "active" | "scheduled" | "expired" | "all";

const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  [PromotionType.local]: "Somente consumo local",
  [PromotionType.site]: "Somente site",
  [PromotionType.both]: "Ambos",
};

const TAB_LABELS: Record<PromotionTab, string> = {
  active: "Ativas",
  scheduled: "Agendadas",
  expired: "Vencidas",
  all: "Todas",
};

function toDateTimeInputValue(date: Date | string) {
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function buildEmptyForm(products: ProductDto[]): PromotionFormState {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    id: null,
    productId: products[0]?.id ?? "",
    type: PromotionType.site,
    promotionalPrice: "",
    startsAt: toDateTimeInputValue(now),
    endsAt: toDateTimeInputValue(nextWeek),
    isActive: true,
  };
}

function getPromotionStatus(promotion: PromotionDto, now = new Date()) {
  if (!promotion.isActive) {
    return "inactive";
  }

  const startsAt = new Date(promotion.startsAt);
  const endsAt = new Date(promotion.endsAt);

  if (startsAt > now) {
    return "scheduled";
  }

  if (endsAt <= now) {
    return "expired";
  }

  return "active";
}

function formatPromotionDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PromotionManagement({
  products,
  promotions,
  canManage,
}: PromotionManagementProps) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<PromotionFormState>(() => buildEmptyForm(products));
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PromotionTab>("active");
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((product) => product.id === form.productId) ?? null;

  const filteredPromotions = useMemo(() => {
    const term = normalizeText(search.trim());
    const now = new Date();

    return promotions.filter((promotion) => {
      if (activeTab !== "all" && getPromotionStatus(promotion, now) !== activeTab) {
        return false;
      }

      if (!term) {
        return true;
      }

      return normalizeText([
        promotion.product.name,
        promotion.product.sku ?? "",
      ].join(" ")).includes(term);
    });
  }, [activeTab, promotions, search]);

  function resetForm() {
    setForm(buildEmptyForm(products));
  }

  function fillForm(promotion: PromotionDto) {
    setForm({
      id: promotion.id,
      productId: promotion.productId,
      type: promotion.type,
      promotionalPrice: centsToCurrencyInput(promotion.promotionalPriceCents),
      startsAt: toDateTimeInputValue(promotion.startsAt),
      endsAt: toDateTimeInputValue(promotion.endsAt),
      isActive: promotion.isActive,
    });
  }

  function savePromotion(nextForm: PromotionFormState) {
    if (!canManage) {
      return;
    }

    startTransition(() => {
      void apiFetch(
        "/api/promotions",
        {
          method: nextForm.id ? "PATCH" : "POST",
          body: JSON.stringify(nextForm),
        },
        promotionSchema,
      )
        .then(() => {
          toast.success(nextForm.id ? "Promoção atualizada." : "Promoção cadastrada.");
          resetForm();
          router.refresh();
        })
        .catch((caught: unknown) => {
          const message = caught instanceof Error ? caught.message : "Falha ao salvar promoção.";
          toast.error(message);
        });
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    savePromotion(form);
  }

  function deactivatePromotion(promotion: PromotionDto) {
    savePromotion({
      id: promotion.id,
      productId: promotion.productId,
      type: promotion.type,
      promotionalPrice: centsToCurrencyInput(promotion.promotionalPriceCents),
      startsAt: toDateTimeInputValue(promotion.startsAt),
      endsAt: toDateTimeInputValue(promotion.endsAt),
      isActive: false,
    });
  }

  return (
    <div className="promotion-management">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>{form.id ? "Editar promoção" : "Nova promoção"}</h2>
          </div>
          {form.id ? (
            <button type="button" className="button button-secondary compact" onClick={resetForm}>
              <X size={14} aria-hidden />
              Cancelar edição
            </button>
          ) : null}
        </div>

        {!canManage ? (
          <p className="form-error compact">Apenas administradores podem cadastrar promoções.</p>
        ) : null}

        <form className="promotion-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>Produto / SKU</span>
              <select
                value={form.productId}
                onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}
                disabled={!canManage || isPending}
                required
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}{product.sku ? ` · SKU ${product.sku}` : ""} · {formatCurrency(product.priceCents)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tipo</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as PromotionType }))
                }
                disabled={!canManage || isPending}
              >
                {Object.values(PromotionType).map((type) => (
                  <option key={type} value={type}>
                    {PROMOTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Preço promocional</span>
              <input
                value={form.promotionalPrice}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    promotionalPrice: formatCurrencyInput(event.target.value),
                  }))
                }
                placeholder="R$ 0,00"
                inputMode="decimal"
                disabled={!canManage || isPending}
                required
              />
            </label>

            <label className="field">
              <span>Início</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                disabled={!canManage || isPending}
                required
              />
            </label>

            <label className="field">
              <span>Fim</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                disabled={!canManage || isPending}
                required
              />
            </label>

            <label className="checkbox-field promotion-active-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                disabled={!canManage || isPending}
              />
              <span>Promoção ativa</span>
            </label>
          </div>

          {selectedProduct ? (
            <p className="muted">
              Preço atual do produto: <strong>{formatCurrency(selectedProduct.priceCents)}</strong>
            </p>
          ) : null}

          <div className="button-row">
            <button
              type="submit"
              className="button button-primary"
              disabled={!canManage || isPending || products.length === 0}
            >
              {form.id ? <Save size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
              {form.id ? "Salvar promoção" : "Cadastrar promoção"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Listagem</p>
            <h2>Promoções cadastradas</h2>
          </div>
          <label className="field promotion-search">
            <span>Buscar por nome ou SKU</span>
            <div className="input-with-icon">
              <Search size={14} aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome do produto ou SKU"
              />
            </div>
          </label>
        </div>

        <div className="web-orders-tabs promotion-tabs" role="tablist" aria-label="Filtrar promoções">
          {Object.entries(TAB_LABELS).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab as PromotionTab)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Preço</th>
                <th>Validade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPromotions.map((promotion) => {
                const status = getPromotionStatus(promotion);
                return (
                  <tr key={promotion.id}>
                    <td>
                      <strong>{promotion.product.name}</strong>
                      <span className="table-subtitle">
                        {promotion.product.sku ? `SKU ${promotion.product.sku}` : "Sem SKU"}
                      </span>
                    </td>
                    <td>{PROMOTION_TYPE_LABELS[promotion.type]}</td>
                    <td>
                      <span className="promotion-price-cell">
                        <span>{formatCurrency(promotion.product.priceCents)}</span>
                        <strong>{formatCurrency(promotion.promotionalPriceCents)}</strong>
                      </span>
                    </td>
                    <td>
                      <span className="table-subtitle">
                        {formatPromotionDate(promotion.startsAt)}
                      </span>
                      <span className="table-subtitle">
                        até {formatPromotionDate(promotion.endsAt)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${status === "active" ? "success" : status === "expired" ? "danger" : "neutral"}`}>
                        {status === "active"
                          ? "Ativa"
                          : status === "scheduled"
                            ? "Agendada"
                            : status === "expired"
                              ? "Vencida"
                              : "Inativa"}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="button button-secondary compact"
                        onClick={() => fillForm(promotion)}
                        disabled={!canManage || isPending}
                      >
                        <Edit3 size={14} aria-hidden />
                        Editar
                      </button>
                      {promotion.isActive ? (
                        <button
                          type="button"
                          className="button button-secondary compact"
                          onClick={() => deactivatePromotion(promotion)}
                          disabled={!canManage || isPending}
                        >
                          Desativar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhuma promoção encontrada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
