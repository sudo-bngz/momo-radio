import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetType = 'live-broadcast' | 'stats' | 'recent-tracks' | 'endpoints';

// ⚡️ Define the layout shape ourselves to bypass broken third-party types
export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  layout: WidgetLayout;
}

interface DashboardLayoutState {
  isEditMode: boolean;
  widgets: WidgetInstance[];
  setEditMode: (isEdit: boolean) => void;
  updateLayouts: (newLayouts: WidgetLayout[]) => void;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
}

// Default Grafana-style layout
const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: '1', type: 'live-broadcast', layout: { i: '1', x: 0, y: 0, w: 7, h: 4, minW: 4, minH: 3 } },
  { id: '2', type: 'stats', layout: { i: '2', x: 7, y: 0, w: 5, h: 3, minW: 3, minH: 2 } },
  { id: '3', type: 'recent-tracks', layout: { i: '3', x: 0, y: 4, w: 7, h: 5, minW: 4, minH: 4 } },
  { id: '4', type: 'endpoints', layout: { i: '4', x: 7, y: 3, w: 5, h: 3, minW: 4, minH: 2 } },
];

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      isEditMode: false,
      widgets: DEFAULT_WIDGETS,
      setEditMode: (isEdit) => set({ isEditMode: isEdit }),
      
      updateLayouts: (newLayouts) => set((state) => ({
        widgets: state.widgets.map(w => {
          const updatedLayout = newLayouts.find(l => l.i === w.id);
          return updatedLayout ? { ...w, layout: { ...w.layout, ...updatedLayout } } : w;
        })
      })),

      addWidget: (type) => set((state) => {
        const newId = Date.now().toString();
        const newWidget: WidgetInstance = {
          id: newId,
          type,
          layout: { i: newId, x: 0, y: Infinity, w: 4, h: 3 }, 
        };
        return { widgets: [...state.widgets, newWidget] };
      }),

      removeWidget: (id) => set((state) => ({
        widgets: state.widgets.filter(w => w.id !== id)
      })),
    }),
    { name: 'dashboard-layout-storage' } 
  )
);