// Contrato entre unsavedChangesGuard y las pantallas con formulario: la pantalla dice si hay
// cambios sin guardar y decide cómo pedir confirmación para salir.
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  confirmDiscard(): Promise<boolean>;
}
