import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AddCustomFieldModal } from '@/components/settings/AddCustomFieldModal';
import { DeleteCustomFieldDialog } from '@/components/settings/DeleteCustomFieldDialog';
import { EditCustomFieldModal } from '@/components/settings/EditCustomFieldModal';
import { useDeleteCustomField, useReorderCustomFields } from '@/hooks/useSettings';
import { useTenantStore } from '@/store/tenantStore';
import type { ICustomField } from '@/types';

const TYPE_BADGE_CLASS: Record<ICustomField['type'], string> = {
  text: 'bg-muted text-muted-foreground',
  number: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  boolean: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  date: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

function SortableRow({
  field,
  canManage,
  onEdit,
  onDelete,
}: {
  field: ICustomField;
  canManage: boolean;
  onEdit: (field: ICustomField) => void;
  onDelete: (field: ICustomField) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        disabled={!canManage}
        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{field.name}</div>
        <code className="text-xs text-muted-foreground">{field.key}</code>
      </div>

      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE_CLASS[field.type]}`}>
        {field.type}
      </span>

      {field.required ? (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
          Required
        </span>
      ) : null}

      {canManage ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(field)}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(field)}>
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface CustomFieldsTabProps {
  canManage: boolean;
}

export function CustomFieldsTab({ canManage }: CustomFieldsTabProps) {
  const tenant = useTenantStore((s) => s.tenant);
  const updateCustomFields = useTenantStore((s) => s.updateCustomFields);
  const { mutateAsync: reorderMutateAsync } = useReorderCustomFields();
  const { mutateAsync: deleteMutateAsync, isPending: isDeleting } = useDeleteCustomField();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<ICustomField | null>(null);
  const [deletingField, setDeletingField] = useState<ICustomField | null>(null);

  const fields = useMemo(
    () => [...(tenant?.customFields ?? [])].sort((a, b) => a.order - b.order),
    [tenant?.customFields]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    if (!canManage) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f._id === active.id);
    const newIndex = fields.findIndex((f) => f._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(fields, oldIndex, newIndex).map((field, index) => ({
      ...field,
      order: index,
    }));

    // Optimistic update
    updateCustomFields(reordered);

    void reorderMutateAsync(reordered.map((f) => ({ fieldId: f._id, order: f.order }))).catch(() => {
      // Revert to original order on error
      updateCustomFields(fields);
      toast.error('Failed to reorder fields');
    });
  }

  function confirmDelete() {
    if (!deletingField) return;
    void deleteMutateAsync(deletingField._id).then(() => {
      setDeletingField(null);
    });
  }

  const isAtLimit = fields.length >= 20;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Custom fields</h3>
          <p className="text-sm text-muted-foreground">
            Add extra fields to your product records. Changes apply to all products.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {fields.length} / 20 fields used
          </span>
          {canManage ? (
            <Button onClick={() => setIsAddOpen(true)} disabled={isAtLimit}>
              Add field
            </Button>
          ) : null}
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex w-28 flex-col gap-2">
            <div className="h-2 rounded bg-muted" />
            <div className="h-2 rounded bg-muted" />
            <div className="h-2 rounded bg-muted" />
          </div>
          <h4 className="text-base font-semibold text-foreground">No custom fields yet</h4>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Add custom fields to capture extra information on your products, like batch numbers,
            expiry dates, or supplier codes.
          </p>
          {canManage ? (
            <div className="mt-5">
              <Button onClick={() => setIsAddOpen(true)} disabled={isAtLimit}>
                Add your first field
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map((field) => (
                <SortableRow
                  key={field._id}
                  field={field}
                  canManage={canManage}
                  onEdit={setEditingField}
                  onDelete={setDeletingField}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddCustomFieldModal open={isAddOpen} onOpenChange={setIsAddOpen} />
      <EditCustomFieldModal
        open={Boolean(editingField)}
        onOpenChange={(open) => {
          if (!open) setEditingField(null);
        }}
        field={editingField}
      />
      <DeleteCustomFieldDialog
        open={Boolean(deletingField)}
        onOpenChange={(open) => {
          if (!open) setDeletingField(null);
        }}
        fieldName={deletingField?.name ?? ''}
        onConfirm={confirmDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
