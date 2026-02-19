import { type ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useResume } from '../context/ResumeContext';

// ── SortableItem ──────────────────────────────────────────────────────────────
function SortableItem({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.45 : 1,
        position: 'relative',
      }}
    >
      {children(
        <span
          {...listeners}
          {...attributes}
          style={{
            cursor: 'grab',
            color: '#b09abf',
            padding: '2px 3px',
            display: 'inline-flex',
            alignItems: 'center',
            touchAction: 'none',
            userSelect: 'none',
            flexShrink: 0,
          }}
          title="Glisser pour réordonner"
        >
          <GripVertical size={13} />
        </span>
      )}
    </div>
  );
}

// ── SortableList ──────────────────────────────────────────────────────────────
interface SortableListProps<T> {
  items: T[];
  getId: (item: T, index: number) => string;
  getKey: (item: T, index: number) => string;
  onReorder: (reordered: T[]) => void;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}

export function SortableList<T>({ items, getId, getKey, onReorder, renderItem }: SortableListProps<T>) {
  const { editMode } = useResume();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (!editMode) {
    return <>{items.map((item, i) => renderItem(item, i, null))}</>;
  }

  const ids = items.map((item, i) => getId(item, i));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx !== -1 && newIdx !== -1) onReorder(arrayMove(items, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableItem key={getKey(item, i)} id={getId(item, i)}>
            {(handle) => renderItem(item, i, handle)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
