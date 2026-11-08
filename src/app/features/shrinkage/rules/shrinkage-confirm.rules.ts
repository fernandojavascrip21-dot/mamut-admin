import { unitsLabel } from '@shared/utils/units-label';
import { holderName } from './shrinkage-holder.rules';

// Texto de la confirmación antes de dar de baja: la merma no se puede deshacer, y se dice.
export function shrinkageConfirmMessage(params: {
  qty: number;
  productName: string;
  holder: { fullName: string } | null;
  reasonLabel: string;
}): string {
  return `¿Dar de baja ${unitsLabel(params.qty)} de ${params.productName} de ${holderName(params.holder)} por «${params.reasonLabel}»? No se puede deshacer.`;
}
