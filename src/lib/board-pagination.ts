export const DEFAULT_BOARD_LIST_PAGE = 1;
export const DEFAULT_BOARD_LIST_PER_PAGE = 20;
export const MAX_BOARD_LIST_PER_PAGE = 50;

export function parsePageParam(rawPage?: string | null): number {
  const page = Number.parseInt(rawPage || `${DEFAULT_BOARD_LIST_PAGE}`, 10);
  return Number.isFinite(page) && page > 0 ? page : DEFAULT_BOARD_LIST_PAGE;
}

export function parsePerPageParam(rawPerPage?: string | null): number {
  const perPage = Number.parseInt(rawPerPage || `${DEFAULT_BOARD_LIST_PER_PAGE}`, 10);

  if (!Number.isFinite(perPage) || perPage < 1) {
    return DEFAULT_BOARD_LIST_PER_PAGE;
  }

  return Math.min(MAX_BOARD_LIST_PER_PAGE, perPage);
}

export function getOffset(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

export function getTotalPages(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
