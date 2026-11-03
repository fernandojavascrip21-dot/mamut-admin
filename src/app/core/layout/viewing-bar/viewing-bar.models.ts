import type { SelectChangeEvent } from 'primeng/types/select';

// Opción del selector: «Yo · bodega» y cada vendedor comparten esta forma.
export interface ViewingOption {
  id: string;
  label: string;
}

export type ViewingSelectChange = SelectChangeEvent;
