"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { apiFetch } from "@/lib/api/client";
import { productSchema, type ProductDto } from "@/lib/schemas/product";
import {
  centsToCurrencyInput,
  formatCurrency,
  formatCurrencyInput,
} from "@/lib/utils/money";

type ProductManagementProps = {
  products: ProductDto[];
  canManage: boolean;
};

type ProductFormState = {
  id: string | null;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  imagePath: string;
  unit: string;
  price: string;
  cost: string;
  stockQty: string;
  minimumStock: string;
  isActive: boolean;
};

const emptyForm: ProductFormState = {
  id: null,
  name: "",
  sku: "",
  barcode: "",
  category: "",
  imagePath: "",
  unit: "un",
  price: "",
  cost: "",
  stockQty: "0",
  minimumStock: "0",
  isActive: true,
};

function buildProductDetails(product: ProductDto) {
  const parts = [];

  if (product.sku) {
    parts.push(`SKU ${product.sku}`);
  }

  parts.push(`CB ${product.barcode}`);

  if (product.category) {
    parts.push(product.category);
  }

  return parts.join(" · ");
}

export function ProductManagement({ products, canManage }: ProductManagementProps) {
  const categoryListId = useId();
  const router = useRouter();
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [products],
  );

  function fillForm(product: ProductDto) {
    setForm({
      id: product.id,
      name: product.name,
      sku: product.sku ?? "",
      barcode: product.barcode,
      category: product.category ?? "",
      imagePath: product.imagePath ?? "",
      unit: product.unit,
      price: centsToCurrencyInput(product.priceCents),
      cost: centsToCurrencyInput(product.costCents),
      stockQty: String(product.stockQty),
      minimumStock: String(product.minimumStock),
      isActive: product.isActive,
    });
    setFeedback(null);
    setError(null);
  }

  function resetForm() {
    setForm(emptyForm);
    setFeedback(null);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    setFeedback(null);
    setError(null);

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      sku: form.sku,
      barcode: form.barcode,
      category: form.category,
      imagePath: form.imagePath || null,
      unit: form.unit,
      price: form.price,
      cost: form.cost,
      stockQty: form.stockQty,
      minimumStock: form.minimumStock,
      isActive: form.isActive,
    };

    startTransition(() => {
      void apiFetch(
        "/api/products",
        {
          method: form.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
        productSchema,
      )
        .then(() => {
          setFeedback(form.id ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
          resetForm();
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          setError(caughtError instanceof Error ? caughtError.message : "Falha ao salvar o produto.");
        });
    });
  }

  return (
    <div className="page-grid two-columns">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h2>{canManage ? "Cadastro e edição de produtos" : "Consulta de produtos"}</h2>
          </div>
          {form.id ? (
            <button className="button button-secondary" type="button" onClick={resetForm}>
              Novo produto
            </button>
          ) : null}
        </div>

        {canManage ? (
          <form className="stack" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label className="field">
                <span>Nome</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>SKU opcional</span>
                <input
                  value={form.sku}
                  onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                  placeholder="Ex.: CERVEJA-001"
                />
              </label>
              <label className="field">
                <span>Código de barras</span>
                <input
                  value={form.barcode}
                  onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
                  placeholder="Obrigatório"
                  required
                />
              </label>
              <label className="field">
                <span>Categoria</span>
                <input
                  list={categoryListId}
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Escolha existente ou digite nova"
                />
                <datalist id={categoryListId}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Imagem</span>
                <input
                  value={form.imagePath}
                  onChange={(event) => setForm((current) => ({ ...current, imagePath: event.target.value }))}
                  placeholder="/catalog-placeholder.jpg"
                />
              </label>
              <label className="field">
                <span>Unidade</span>
                <input
                  value={form.unit}
                  onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>Preço de venda</span>
                <input
                  value={form.price}
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, price: formatCurrencyInput(event.target.value) }))
                  }
                  placeholder="R$ 0,00"
                  required
                />
              </label>
              <label className="field">
                <span>Custo</span>
                <input
                  value={form.cost}
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, cost: formatCurrencyInput(event.target.value) }))
                  }
                  placeholder="R$ 0,00"
                />
              </label>
              <label className="field">
                <span>Estoque atual</span>
                <input
                  value={form.stockQty}
                  type="number"
                  step="1"
                  onChange={(event) => setForm((current) => ({ ...current, stockQty: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>Estoque mínimo</span>
                <input
                  value={form.minimumStock}
                  type="number"
                  step="1"
                  min="0"
                  onChange={(event) => setForm((current) => ({ ...current, minimumStock: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span>Produto ativo</span>
            </label>

            {feedback ? <p className="form-success">{feedback}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}

            <button className="button button-primary" type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </form>
        ) : (
          <p className="muted">
            Seu perfil pode consultar o catálogo, mas apenas administradores alteram produtos.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Produtos cadastrados</p>
            <h2>{products.length} itens disponíveis</h2>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th>Status</th>
                {canManage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-row-main">
                      <img
                        src={product.imagePath || "/catalog-placeholder.jpg"}
                        alt={product.name}
                        className="product-row-thumb"
                        width={56}
                        height={56}
                        loading="lazy"
                      />
                      <div>
                        <strong>{product.name}</strong>
                        <span className="table-subtitle">{buildProductDetails(product)}</span>
                      </div>
                    </div>
                  </td>
                  <td>{formatCurrency(product.priceCents)}</td>
                  <td>
                    <span className={product.stockQty <= product.minimumStock ? "badge warning" : "badge neutral"}>
                      {product.stockQty} {product.unit}
                    </span>
                  </td>
                  <td>{product.isActive ? "Ativo" : "Inativo"}</td>
                  {canManage ? (
                    <td className="table-actions">
                      <button
                        className="button button-secondary compact"
                        type="button"
                        onClick={() => fillForm(product)}
                      >
                        Editar
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
