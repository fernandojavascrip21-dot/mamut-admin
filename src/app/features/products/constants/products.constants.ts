// Marca que la falla vino de subir la foto, no del guardado: cualquier error ahí es «sin
// conexión», aunque el backend responda 422 (p. ej. archivo que no es imagen). La usa
// ProductSaveService.
export const UPLOAD_FAILED = Symbol('upload-failed');
