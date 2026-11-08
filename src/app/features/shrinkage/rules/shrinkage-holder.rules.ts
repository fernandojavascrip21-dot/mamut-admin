import { WAREHOUSE_HOLDER_NAME } from '../constants/shrinkage.constants';

// Cómo se nombra al titular en el pop-up, la confirmación y el resultado: el vendedor, o «la bodega».
export function holderName(holder: { fullName: string } | null): string {
  return holder?.fullName ?? WAREHOUSE_HOLDER_NAME;
}
