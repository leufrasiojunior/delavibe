"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Edit3, Plus, Save, Search, X } from "lucide-react";
import { PromotionType } from "@prisma/client";

import { apiFetch } from "@/lib/api/client";
import { type ProductDto } from "@/lib/schemas/product";
import { promotionSchema, type PromotionDto } from "@/lib/schemas/promotion";
import {
  centsToCurrencyInput,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInputToCents,
} from "@/lib/utils/money";
import {
  filterPromotionsForAdmin,
  findPromotionConflict,
  getAdminPromotionStatus,
  type PromotionTypeFilter,
} from "@/lib/utils/promotion-admin";
import {
  calculatePromotionSavings,
  formatPromotionSavingsLine,
} from "@/lib/utils/promotion-display";
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

const TYPE_FILTER_LABELS: Record<PromotionTypeFilter, string> = {
  all: "Todos",
  [PromotionType.local]: "Local",
  [PromotionType.site]: "Site",
  [PromotionType.both]: "Ambos",
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
  const [productSearch, setProductSearch] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PromotionTab>("active");
  const [typeFilter, setTypeFilter] = useState<PromotionTypeFilter>("all");
  const [isPending, startTransition] = useTransition();
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((product) => product.id === form.productId) ?? null;
  const promotionalPriceCents = useMemo(
    () => parseCurrencyInputToCents(form.promotionalPrice),
    [form.promotionalPrice],
  );
  const savingsPreview = selectedProduct && promotionalPriceCents !== null
    ? calculatePromotionSavings(selectedProduct.priceCents, promotionalPriceCents)
    : null;
  const savingsLine = selectedProduct && promotionalPriceCents !== null
    ? formatPromotionSavingsLine(selectedProduct.priceCents, promotionalPriceCents)
    : null;
  const promotionConflict = useMemo(
    () => findPromotionConflict(promotions, form),
    [form, promotions],
  );

  const filteredProductOptions = useMemo(() => {
    const term = normalizeText(productSearch.trim());

    if (!term) {
      return products;
    }

    return products.filter((product) =>
      normalizeText([
        product.name,
        product.sku ?? "",
        product.barcode,
        product.category ?? "",
      ].join(" ")).includes(term),
    );
  }, [productSearch, products]);

  const filteredPromotions = useMemo(() => {
    return filterPromotionsForAdmin(promotions, {
      status: activeTab,
      type: typeFilter,
      search,
    });
  }, [activeTab, promotions, search, typeFilter]);

  useEffect(() => {
    if (!isProductDropdownOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!productDropdownRef.current?.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isProductDropdownOpen]);

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
    setProductSearch("");
    setIsProductDropdownOpen(false);
  }

  function selectProduct(productId: string) {
    setForm((current) => ({ ...current, productId }));
    setProductSearch("");
    setIsProductDropdownOpen(false);
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
    if (promotionConflict) {
      toast.error("Resolva o conflito antes de salvar a promoção.");
      return;
    }
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
            <div className="field">
              <span>Produto / SKU</span>
              <div className="promotion-product-combobox" ref={productDropdownRef}>
                <button
                  type="button"
                  className="promotion-product-trigger"
                  onClick={() => setIsProductDropdownOpen((current) => !current)}
                  disabled={!canManage || isPending || products.length === 0}
                  aria-haspopup="listbox"
                  aria-expanded={isProductDropdownOpen}
                >
                  <span>
                    <strong>{selectedProduct?.name ?? "Selecione um produto"}</strong>
                    {selectedProduct ? (
                      <small>
                        {selectedProduct.sku ? `SKU ${selectedProduct.sku}` : "Sem SKU"} ·{" "}
                        {formatCurrency(selectedProduct.priceCents)}
                      </small>
                    ) : null}
                  </span>
                </button>

                {isProductDropdownOpen ? (
                  <div className="promotion-product-menu">
                    <div className="input-with-icon promotion-product-search">
                      <Search size={14} aria-hidden />
                      <input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Buscar por nome, SKU, código ou categoria"
                        autoFocus
                      />
                    </div>

                    <div className="promotion-product-options" role="listbox">
                      {filteredProductOptions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className={
                            product.id === form.productId
                              ? "promotion-product-option selected"
                              : "promotion-product-option"
                          }
                          onClick={() => selectProduct(product.id)}
                          role="option"
                          aria-selected={product.id === form.productId}
                        >
                          <strong>{product.name}</strong>
                          <span>
                            {product.sku ? `SKU ${product.sku}` : "Sem SKU"} ·{" "}
                            {product.category ?? "Sem categoria"} · {formatCurrency(product.priceCents)}
                          </span>
                        </button>
                      ))}
                      {filteredProductOptions.length === 0 ? (
                        <p className="promotion-product-empty">Nenhum produto encontrado.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

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
            <div className="promotion-form-feedback">
              <p className="muted">
                Preço atual do produto: <strong>{formatCurrency(selectedProduct.priceCents)}</strong>
              </p>
              {savingsPreview && savingsLine ? (
                <p className="promotion-savings-preview">
                  <span>Economia</span>
                  <strong>{savingsLine}</strong>
                </p>
              ) : form.promotionalPrice && promotionalPriceCents !== null ? (
                <p className="form-error compact">
                  O preço promocional precisa ser menor que o preço atual do produto.
                </p>
              ) : null}
            </div>
          ) : null}

          {promotionConflict ? (
            <div className="promotion-conflict-alert" role="alert">
              <AlertTriangle size={18} aria-hidden />
              <div>
                <strong>Esta promoção conflita com outra já cadastrada.</strong>
                <span>
                  {PROMOTION_TYPE_LABELS[promotionConflict.type]} de{" "}
                  {formatPromotionDate(promotionConflict.startsAt)} até{" "}
                  {formatPromotionDate(promotionConflict.endsAt)}.
                </span>
                <button
                  type="button"
                  className="button button-secondary compact"
                  onClick={() => fillForm(promotionConflict)}
                  disabled={!canManage || isPending}
                >
                  <Edit3 size={14} aria-hidden />
                  Editar promoção conflitante
                </button>
              </div>
            </div>
          ) : null}

          <div className="button-row">
            <button
              type="submit"
              className="button button-primary"
              disabled={!canManage || isPending || products.length === 0 || Boolean(promotionConflict)}
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

        <div className="promotion-filter-row">
          <div className="web-orders-tabs promotion-tabs" role="tablist" aria-label="Filtrar promoções por status">
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

          <div className="web-orders-tabs promotion-tabs" role="tablist" aria-label="Filtrar promoções por tipo">
            {Object.entries(TYPE_FILTER_LABELS).map(([type, label]) => (
              <button
                key={type}
                type="button"
                className={typeFilter === type ? "tab active" : "tab"}
                onClick={() => setTypeFilter(type as PromotionTypeFilter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper promotion-table-wrapper">
          <table className="data-table promotion-table">
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
                const status = getAdminPromotionStatus(promotion);
                const savings = calculatePromotionSavings(
                  promotion.product.priceCents,
                  promotion.promotionalPriceCents,
                );
                return (
                  <tr key={promotion.id}>
                    <td>
                      <div className="promotion-product-cell">
                        <strong>{promotion.product.name}</strong>
                        <span>
                          {promotion.product.sku ? `SKU ${promotion.product.sku}` : "Sem SKU"}
                          {promotion.product.category ? ` · ${promotion.product.category}` : ""}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge promotion-type-badge promotion-type-${promotion.type}`}>
                        {PROMOTION_TYPE_LABELS[promotion.type]}
                      </span>
                    </td>
                    <td>
                      <span className="promotion-price-cell">
                        <span>De {formatCurrency(promotion.product.priceCents)}</span>
                        <strong>
                          Por {formatCurrency(promotion.promotionalPriceCents)}
                        </strong>
                        {savings ? <span className="discount-badge">{savings.discountLabel}</span> : null}
                      </span>
                    </td>
                    <td>
                      <span className="promotion-date-cell">
                        <strong>{formatPromotionDate(promotion.startsAt)}</strong>
                        até {formatPromotionDate(promotion.endsAt)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge promotion-status-badge ${status === "active" ? "success" : status === "expired" ? "danger" : "neutral"}`}>
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
                      <div className="promotion-table-actions">
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
                      </div>
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
