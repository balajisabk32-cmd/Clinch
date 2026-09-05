declare module '../admin/App' {
  import type { ComponentType } from 'react'
  export const App: ComponentType<any>
}

declare module '../admin/context/ThemeContext' {
  import type { ComponentType, ReactNode } from 'react'
  export const ThemeProvider: ComponentType<{ children?: ReactNode }>
  export const useTheme: () => { theme: string; toggleTheme: () => void }
}

declare module '../admin/context/ClinchStoreContext' {
  import type { ComponentType, ReactNode } from 'react'
  export const ClinchStoreProvider: ComponentType<{ children?: ReactNode }>
  export const useClinchStore: () => any
}
