import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import { ConfirmDeleteCategoryDialog } from '@/components/categories/ConfirmDeleteCategoryDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { useCategories } from '@/hooks/useCategories';
import { usePermission } from '@/hooks/usePermission';
import type { ICategory } from '@/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CategoriesPage() {
  const { canDo } = usePermission();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ICategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ICategory | null>(null);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const { data, isLoading } = useCategories(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );

  const categories = data?.categories ?? [];
  const hasAnyCategories = !isLoading && !debouncedSearch && categories.length === 0;
  const hasSearchNoResults = !isLoading && debouncedSearch && categories.length === 0;

  return (
    <div className="p-6">
      <PageHeader title="Categories" subtitle="Organise your products into groups">
        <PermissionGuard permission="category.manage">
          <Button onClick={() => setIsCreateModalOpen(true)}>Add category</Button>
        </PermissionGuard>
      </PageHeader>

      {/* Search */}
      <div className="mb-4">
        <input
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading categories…</div>
      ) : hasAnyCategories ? (
        /* Empty state — no categories at all */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mb-4 text-slate-300"
          >
            <rect x="4" y="14" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M4 22h48" stroke="currentColor" strokeWidth="2" />
            <circle cx="40" cy="40" r="10" fill="white" stroke="currentColor" strokeWidth="2" />
            <path d="M40 36v8M36 40h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-base font-medium text-slate-700">No categories yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create your first category to start organising products
          </p>
          {canDo('category.manage') ? (
            <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
              Add category
            </Button>
          ) : null}
        </div>
      ) : hasSearchNoResults ? (
        /* Empty state — search no results */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-base font-medium text-slate-700">
            No categories match &ldquo;{searchTerm}&rdquo;
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => setSearchTerm('')}
          >
            Clear search
          </Button>
        </div>
      ) : (
        /* Category grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16
          }}
        >
          {categories.map((category) => (
            <CategoryCard
              key={category._id}
              category={category}
              canManage={canDo('category.manage')}
              onEdit={() => setEditingCategory(category)}
              onDelete={() => setDeletingCategory(category)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CategoryFormModal
        mode="create"
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {editingCategory ? (
        <CategoryFormModal
          mode="edit"
          category={editingCategory}
          open={Boolean(editingCategory)}
          onClose={() => setEditingCategory(null)}
        />
      ) : null}

      {deletingCategory ? (
        <ConfirmDeleteCategoryDialog
          category={deletingCategory}
          open={Boolean(deletingCategory)}
          onClose={() => setDeletingCategory(null)}
        />
      ) : null}
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

interface CategoryCardProps {
  category: ICategory;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryCard({ category, canManage, onEdit, onDelete }: CategoryCardProps) {
  const hasProducts = category.productCount > 0;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
        !category.isActive ? 'opacity-50' : ''
      }`}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 rounded-full"
            style={{ width: 16, height: 16, backgroundColor: category.color, display: 'inline-block' }}
          />
          <span className="truncate font-medium text-slate-900 text-sm">{category.name}</span>
        </div>
        {!category.isActive ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            Inactive
          </span>
        ) : null}
      </div>

      {/* Description */}
      {category.description ? (
        <p
          className="mt-2 text-xs text-slate-500"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {category.description}
        </p>
      ) : null}

      {/* Bottom row */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {category.productCount} product{category.productCount !== 1 ? 's' : ''}
        </span>

        {canManage ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Edit category"
            >
              <Pencil size={14} />
            </button>

            {hasProducts ? (
              <span title="Has active products — reassign first">
                <button
                  type="button"
                  disabled
                  className="rounded p-1 text-slate-300 cursor-not-allowed"
                  aria-label="Cannot delete — category has products"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={onDelete}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Delete category"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
