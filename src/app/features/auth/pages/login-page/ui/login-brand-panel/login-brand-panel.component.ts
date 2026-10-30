import { Component } from '@angular/core';
import { LoginBackgroundComponent } from '../login-background/login-background.component';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  HEADLINE_WORDS,
  LOGO_ALT,
  LOGO_DELAY_SECONDS,
  TAGLINE_DELAY_SECONDS,
} from './login-brand-panel.constants';

// Panel oscuro del login (la mitad izquierda en escritorio, la cabecera en el celular): logo,
// titular y subtítulo con un revelado en secuencia sobre el fondo de columnas de stock. Solo
// presenta; el formulario y su lógica son de la página.
@Component({
  imports: [LoginBackgroundComponent],
  selector: 'app-login-brand-panel',
  templateUrl: './login-brand-panel.component.html',
})
export class LoginBrandPanelComponent {
  readonly brandName = BRAND_NAME;
  readonly logoAlt = LOGO_ALT;
  readonly tagline = BRAND_TAGLINE;
  readonly headline = HEADLINE_WORDS;
  readonly logoDelay = LOGO_DELAY_SECONDS;
  readonly taglineDelay = TAGLINE_DELAY_SECONDS;
}
