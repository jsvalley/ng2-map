import {
  Component,
  ElementRef,
  OnInit,
  OnChanges,
  OnDestroy,
  EventEmitter,
  SimpleChange,
} from '@angular/core';

import { OptionBuilder } from '../services/option-builder';
import { Ng2Map } from '../services/ng2-map';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/debounceTime';

const INPUTS = [
  'content', 'disableAutoPan', 'maxWidth', 'pixelOffset', 'position', 'zIndex', 'options'
];
const OUTPUTS = [
  'infoWindowCloseclick', 'infoWindowContentChanged', 'infoWindowDomready',
  'infoWindowPositionChanged', 'infoWindowZindexChanged'
];

@Component({
  selector: 'ng2-map>info-window',
  inputs: INPUTS,
  outputs: OUTPUTS,
  template: `<ng-content></ng-content>`,
})
export class InfoWindow implements OnInit, OnChanges, OnDestroy {
  public el: HTMLElement;
  public infoWindow: google.maps.InfoWindow;
  public objectOptions: google.maps.InfoWindowOptions = {};
  public inputChanges$ = new Subject();

  public template: string;

  constructor(
    private optionBuilder: OptionBuilder,
    private elementRef: ElementRef,
    private ng2Map: Ng2Map
  ) {
    this.elementRef.nativeElement.style.display = 'none';
    // all outputs needs to be initialized,
    // http://stackoverflow.com/questions/37765519/angular2-directive-cannot-read-property-subscribe-of-undefined-with-outputs
    OUTPUTS.forEach(output => this[output] = new EventEmitter());
  }

  ngOnInit() {
    if (this.ng2Map.map) { // map is ready already
      this.initialize(this.ng2Map.map);
    } else {
      this.ng2Map.mapReady$.subscribe((map: google.maps.Map) => this.initialize(map));
    }
  }

  ngOnChanges(changes: {[key: string]: SimpleChange}) {
    this.inputChanges$.next(changes);
  }

  // called when map is ready
  initialize(map: google.maps.Map): void {
    console.log('infowindow is being initialized');
    this.template = this.elementRef.nativeElement.innerHTML;

    this.objectOptions = this.optionBuilder.googlizeAllInputs(INPUTS, this);
    this.infoWindow = new google.maps.InfoWindow(this.objectOptions);
    this.infoWindow['mapObjectName'] = this.constructor['name'];
    console.log('INFOWINDOW objectOptions', this.objectOptions);

    // register infoWindow ids to Ng2Map, so that it can be opened by id
    this.el = this.elementRef.nativeElement;
    if (this.el.id) {
      this.ng2Map.mapComponent.infoWindows[this.el.id] = this;
    } else {
      console.error('An InfoWindow must have an id. e.g. id="detail"');
    }

    // set google events listeners and emits to this outputs listeners
    this.ng2Map.setObjectEvents(OUTPUTS, this, 'infoWindow');

    // update object when input changes
    this.inputChanges$
      .debounceTime(1000)
      .subscribe((changes: SimpleChange) => this.ng2Map.updateGoogleObject(this.infoWindow, changes));
  }

  open(anchor: google.maps.MVCObject, data: any) {
    let html = this.template;

    for (let key in data) {
      this[key] = data[key];
      html = html.replace(`[[${key}]]`, data[key]);
    }

    // set content and open it
    this.infoWindow.setContent(html);
    this.infoWindow.open(this.ng2Map.map, anchor);
  }

  ngOnDestroy() {
    if (this.infoWindow) {
      OUTPUTS.forEach(output => google.maps.event.clearListeners(this.infoWindow, output));
      delete this.infoWindow;
    }
  }
}
