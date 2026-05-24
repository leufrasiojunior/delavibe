export type ViaCepResult = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | "true";
};

export class ViaCepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViaCepError";
  }
}

export function normalizeCepDigits(value: string): string {
  return (value || "").replace(/\D+/g, "");
}

export async function fetchAddressByCep(
  rawCep: string,
  options: { signal?: AbortSignal } = {},
): Promise<ViaCepResult> {
  const digits = normalizeCepDigits(rawCep);

  if (digits.length !== 8) {
    throw new ViaCepError("CEP precisa ter 8 dígitos.");
  }

  let response: Response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: options.signal,
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") {
      throw error;
    }
    throw new ViaCepError("Não foi possível consultar o CEP. Verifique sua conexão.");
  }

  if (!response.ok) {
    throw new ViaCepError("Falha ao buscar o CEP.");
  }

  const data: ViaCepResponse = await response.json().catch(() => ({}));

  if (data.erro === true || data.erro === "true") {
    throw new ViaCepError("CEP não encontrado.");
  }

  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
    complement: data.complemento ?? "",
  };
}
