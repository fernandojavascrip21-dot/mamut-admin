import { FormControl } from '@angular/forms';
import { notBlank } from './validators';

describe('notBlank', () => {
  it('acepta texto y rechaza vacío, solo espacios o null', () => {
    expect(notBlank()(new FormControl('Creatina'))).toBeNull();
    expect(notBlank()(new FormControl(' secreta '))).toBeNull();
    expect(notBlank()(new FormControl(''))).toEqual({ notBlank: true });
    expect(notBlank()(new FormControl('   '))).toEqual({ notBlank: true });
    expect(notBlank()(new FormControl(null))).toEqual({ notBlank: true });
  });
});
