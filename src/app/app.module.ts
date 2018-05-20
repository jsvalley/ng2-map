import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';

import {HashLocationStrategy, LocationStrategy} from '@angular/common';
import {NguiUtilsModule} from '@ngui/utils';
import {NguiMapModule} from '@ngui/map';
import {SourceCodeService} from './services/source-code.service';
import {HttpClientModule} from '@angular/common/http';

import {AppComponent} from './app.component';

import {APP_ROUTER_COMPONENTS, APP_ROUTER_PROVIDERS} from './app.route';
import {MapListenerService} from './services/map-listener.service';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    APP_ROUTER_PROVIDERS,
    // NguiMapModule,
    NguiMapModule.forRoot({
      apiUrl: 'https://maps.google.com/maps/api/js?key=AIzaSyCbMGRUwcqKjlYX4h4-P6t-xcDryRYLmCM' +
      '&libraries=visualization,places,drawing',
    }),
    NguiUtilsModule
  ],
  declarations: [AppComponent, APP_ROUTER_COMPONENTS],
  providers: [
    SourceCodeService,
    MapListenerService,
    {provide: LocationStrategy, useClass: HashLocationStrategy},
  ],
  bootstrap: [AppComponent],
})

export class AppModule {
}