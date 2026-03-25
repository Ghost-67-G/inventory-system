import type { FilterQuery, Model, SortOrder } from 'mongoose';

interface PaginationOptions {
  cursor?: string;
  limit?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export const paginate = async <T extends { _id: unknown }>(
  model: Model<T>,
  filter: FilterQuery<T>,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> => {
  const limit = Math.min(options.limit ?? 20, 100);
  const sortField = options.sortField ?? '_id';
  const sortOrder: SortOrder = options.sortOrder === 'asc' ? 1 : -1;

  const queryFilter: FilterQuery<T> = { ...filter };
  if (options.cursor) {
    const comparator = sortOrder === 1 ? '$gt' : '$lt';
    queryFilter._id = { [comparator]: options.cursor } as unknown as T['_id'];
  }

  const sortSpec: Record<string, SortOrder> = { [sortField]: sortOrder };
  const [rows, total] = await Promise.all([
    model.find(queryFilter).sort(sortSpec).limit(limit + 1).lean<T[]>(),
    model.countDocuments(filter)
  ]);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  return {
    data,
    nextCursor: hasMore && last ? String(last._id) : null,
    hasMore,
    total
  };
};
