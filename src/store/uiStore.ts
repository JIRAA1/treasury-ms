'use client'

import { create } from 'zustand'

interface UIState {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false, // Default closed on mobile
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
}))
