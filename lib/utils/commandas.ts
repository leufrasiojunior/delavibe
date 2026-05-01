import type { CommandaDto } from "@/lib/schemas/commanda";

export type CommandaBoardStatusTab = "open" | "closed";

type FilterableCommanda = Pick<CommandaDto, "status" | "customerName">;

export function filterCommandasByStatusAndCustomerName<TCommanda extends FilterableCommanda>(
  commandas: readonly TCommanda[],
  status: CommandaBoardStatusTab,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return commandas.filter((commanda) => {
    if (commanda.status !== status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return commanda.customerName?.trim().toLowerCase().includes(normalizedQuery) ?? false;
  });
}
