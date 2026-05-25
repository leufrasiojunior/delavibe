"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { apiFetch, apiUpload } from "@/lib/api/client";
import { productSchema, type ProductDto } from "@/lib/schemas/product";
import {
  centsToCurrencyInput,
  formatCurrency,
  formatCurrencyInput,
} from "@/lib/utils/money";
import { useToast } from "@/components/toast";

const placeholderImagePath = "/catalog-placeholder.jpg";
const acceptedImageMime = "image/jpeg,image/png,image/webp";

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

function buildImageUrlWithCacheBust(product: ProductDto) {
  if (!product.imagePath) {
    return placeholderImagePath;
  }

  const version = Date.parse(product.updatedAt);
  return `${product.imagePath}?v=${Number.isFinite(version) ? version : 0}`;
}

export function ProductManagement({ products, canManage }: ProductManagementProps) {
  const categoryListId = useId();
  const fileInputId = useId();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function clearSelectedFile() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSelectedFile(null);
  }

  function fillForm(product: ProductDto) {
    setForm({
      id: product.id,
      name: product.name,
      sku: product.sku ?? "",
      barcode: product.barcode,
      category: product.category ?? "",
      unit: product.unit,
      price: centsToCurrencyInput(product.priceCents),
      cost: centsToCurrencyInput(product.costCents),
      stockQty: String(product.stockQty),
      minimumStock: String(product.minimumStock),
      isActive: product.isActive,
    });
    setEditingProduct(product);
    clearSelectedFile();
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingProduct(null);
    clearSelectedFile();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function uploadImageForProduct(productId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return apiUpload(`/api/products/${productId}/image`, formData, productSchema);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      sku: form.sku,
      barcode: form.barcode,
      category: form.category,
      imagePath: editingProduct?.imagePath ?? null,
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
        .then(async (savedProduct) => {
          if (selectedFile) {
            try {
              await uploadImageForProduct(savedProduct.id, selectedFile);
              toast.success(
                form.id
                  ? "Produto atualizado e imagem enviada com sucesso."
                  : "Produto cadastrado e imagem enviada com sucesso.",
              );
              resetForm();
              router.refresh();
              return;
            } catch (uploadError: unknown) {
              const message =
                uploadError instanceof Error
                  ? uploadError.message
                  : "Falha ao enviar a imagem.";
              toast.error(message);
              toast.info(
                form.id
                  ? "O produto foi atualizado, porém a imagem não foi salva."
                  : "O produto foi cadastrado, porém a imagem não foi salva.",
              );
              router.refresh();
              return;
            }
          }

          toast.success(
            form.id
              ? "Produto atualizado com sucesso."
              : "Produto cadastrado com sucesso.",
          );
          resetForm();
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          const message =
            caughtError instanceof Error && caughtError.message
              ? caughtError.message
              : "Falha ao salvar o produto.";
          toast.error(message);
        });
    });
  }

  function handleRemoveImage() {
    if (!editingProduct || !canManage) {
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja remover a imagem? O produto voltará a usar o placeholder.",
    );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void apiFetch(
        `/api/products/${editingProduct.id}/image`,
        { method: "DELETE" },
        productSchema,
      )
        .then(() => {
          toast.success("Imagem removida.");
          setEditingProduct((current) =>
            current ? { ...current, imagePath: null } : current,
          );
          clearSelectedFile();
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          const message =
            caughtError instanceof Error && caughtError.message
              ? caughtError.message
              : "Falha ao remover a imagem.";
          toast.error(message);
        });
    });
  }

  const hasExistingImage = Boolean(editingProduct?.imagePath);
  const showPreview = Boolean(previewUrl);
  const imagePreviewSrc = previewUrl
    || (editingProduct?.imagePath ? buildImageUrlWithCacheBust(editingProduct) : null);

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

            <div className="product-image-upload">
              <div className="product-image-upload-header">
                <span>Imagem do produto</span>
                <small className="muted">JPG, PNG ou WebP. Máximo 2 MB.</small>
              </div>

              <div className="product-image-upload-body">
                <div className="product-image-upload-preview">
                  {imagePreviewSrc ? (
                    <img
                      src={imagePreviewSrc}
                      alt="Pré-visualização do produto"
                      className="product-image-upload-thumb"
                    />
                  ) : (
                    <div className="product-image-upload-empty">
                      <span>Sem imagem</span>
                      <small className="muted">Placeholder será usado</small>
                    </div>
                  )}
                </div>

                <div className="product-image-upload-controls">
                  <label className="button button-secondary compact" htmlFor={fileInputId}>
                    {hasExistingImage || showPreview ? "Trocar imagem" : "Selecionar imagem"}
                  </label>
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    accept={acceptedImageMime}
                    onChange={handleFileChange}
                    className="visually-hidden"
                  />

                  {showPreview ? (
                    <button
                      className="button button-secondary compact"
                      type="button"
                      onClick={clearSelectedFile}
                    >
                      Cancelar seleção
                    </button>
                  ) : null}

                  {hasExistingImage && !showPreview ? (
                    <button
                      className="button button-secondary compact"
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isPending}
                    >
                      Remover imagem
                    </button>
                  ) : null}
                </div>
              </div>

            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span>Produto ativo</span>
            </label>


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
          <a className="button button-secondary" href="/api/products/export">
            Exportar CSV
          </a>
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
                        src={buildImageUrlWithCacheBust(product)}
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
