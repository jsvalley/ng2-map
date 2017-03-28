import {
  Component,
  ElementRef,
  ViewEncapsulation,
  EventEmitter,
  SimpleChanges,
  Output,
  AfterViewInit, OnChanges, OnDestroy
} from '@angular/core';

import { OptionBuilder } from '../services/option-builder';
import { NavigatorGeolocation } from '../services/navigator-geolocation';
import { GeoCoder } from '../services/geo-coder';
import { Ng2Map } from '../services/ng2-map';
import { NgMapApiLoader } from '../services/api-loader';


import { Subject } from 'rxjs/Subject';
import { debounceTime } from 'rxjs/operator/debounceTime';
import { IJson, toCamelCase } from '../services/util';

const INPUTS = [
  'backgroundColor', 'center', 'disableDefaultUI', 'disableDoubleClickZoom', 'draggable', 'draggableCursor',
  'draggingCursor', 'heading', 'keyboardShortcuts', 'mapMaker', 'mapTypeControl', 'mapTypeId', 'maxZoom', 'minZoom',
  'noClear', 'overviewMapControl', 'panControl', 'panControlOptions', 'rotateControl', 'scaleControl', 'scrollwheel',
  'streetView', 'styles', 'tilt', 'zoom', 'streetViewControl', 'zoomControl', 'zoomControlOptions', 'mapTypeControlOptions',
  'overviewMapControlOptions', 'rotateControlOptions', 'scaleControlOptions', 'streetViewControlOptions', 'fullscreenControl',
  'options',
  // ng2-map-specific inputs
  'geoFallbackCenter'
];

const OUTPUTS = [
  'bounds_changed', 'center_changed', 'click', 'dblclick', 'drag', 'dragend', 'dragstart', 'heading_changed', 'idle',
  'typeid_changed', 'mousemove', 'mouseout', 'mouseover', 'projection_changed', 'resize', 'rightclick',
  'tilesloaded', 'tile_changed', 'zoom_changed',
  // to avoid DOM event conflicts
  'mapClick', 'mapMouseover', 'mapMouseout', 'mapMousemove', 'mapDrag', 'mapDragend', 'mapDragstart'
];

@Component({
  selector: 'ng2-map',
  providers: [Ng2Map, OptionBuilder, GeoCoder, NavigatorGeolocation],
  styles: [`
    ng2-map {display: block; height: 300px;}
    .google-map {width: 100%; height: 100%}
  `],
  inputs: INPUTS,
  outputs: OUTPUTS,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="google-map"></div>
    <ng-content></ng-content>
  `,
})
export class Ng2MapComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Output() public mapReady$: EventEmitter<any> = new EventEmitter();

  public el: HTMLElement;
  public map: google.maps.Map;
  public mapOptions: google.maps.MapOptions = {};

  public inputChanges$ = new Subject();

  // map objects by group
  public infoWindows: any = {};

  // map has been fully initialized
  public mapIdledOnce: boolean = false;

  constructor(
    public optionBuilder: OptionBuilder,
    public elementRef: ElementRef,
    public geolocation: NavigatorGeolocation,
    public geoCoder: GeoCoder,
    public ng2Map: Ng2Map,
    public apiLoader: NgMapApiLoader,
  ) {
    apiLoader.load();

    // all outputs needs to be initialized,
    // http://stackoverflow.com/questions/37765519/angular2-directive-cannot-read-property-subscribe-of-undefined-with-outputs
    OUTPUTS.forEach(output => this[output] = new EventEmitter());
  }

  ngAfterViewInit() {
    this.apiLoader.api$.subscribe(() => this.initializeMap());
  }

  ngOnChanges(changes: SimpleChanges) {
    this.inputChanges$.next(changes);
  }

  initializeMap(): void {
    this.el = this.elementRef.nativeElement.querySelector('.google-map');
    this.mapOptions = this.optionBuilder.googlizeAllInputs(INPUTS, this);
    console.log('ng2-map mapOptions', this.mapOptions);

    this.mapOptions.zoom = this.mapOptions.zoom || 15;
    typeof this.mapOptions.center === 'string' && (delete this.mapOptions.center);

    this.map = new google.maps.Map(this.el, this.mapOptions);
    this.map['mapObjectName'] = 'Ng2MapComponent';

    if (!this.mapOptions.center) { // if center is not given as lat/lng
      this.setCenter();
    }

    // set google events listeners and emits to this outputs listeners
    this.ng2Map.setObjectEvents(OUTPUTS, this, 'map');

    this.map.addListener('idle', () => {
      if (!this.mapIdledOnce) {
        this.mapIdledOnce = true;
        setTimeout(() => { // Why????, subsribe and emit must not be in the same cycle???
          this.mapReady$.emit(this.map);
        });
      }
    });

    // update map when input changes
    debounceTime.call(this.inputChanges$, 1000)
      .subscribe((changes: SimpleChanges) => this.ng2Map.updateGoogleObject(this.map, changes));

    if (typeof window !== 'undefined' && (<any>window)['ng2MapRef']) {
      // expose map object for test and debugging on (<any>window)
      (<any>window)['ng2MapRef'].map = this.map;
    }
  }

  setCenter(): void {
    if (!this['center']) { // center is not from user. Thus, we set the current location
      this.geolocation.getCurrentPosition().subscribe(
        position => {
          console.log('setting map center from current location');
          let latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
          this.map.setCenter(latLng);
        },
        error => {
          console.error('ng2-map: Error finding the current position');
          this.map.setCenter(this.mapOptions['geoFallbackCenter'] || new google.maps.LatLng(0, 0));
        }
      );
    }
    else if (typeof this['center'] === 'string') {
      this.geoCoder.geocode({address: this['center']}).subscribe(
        results => {
          console.log('setting map center from address', this['center']);
          this.map.setCenter(results[0].geometry.location);
        },
        error => {
          this.map.setCenter(this.mapOptions['geoFallbackCenter'] || new google.maps.LatLng(0, 0));
        });
    }
  }

  openInfoWindow(id: string, anchor: google.maps.MVCObject, data: IJson) {
    this.infoWindows[id].open(anchor, data);
  }

  ngOnDestroy() {
    if (this.el) {
      OUTPUTS.forEach(output => google.maps.event.clearListeners(this.map, output));
    }
  }

  // map.markers, map.circles, map.heatmapLayers.. etc
  addToMapObjectGroup(mapObjectName: string, mapObject: any) {
    let groupName = toCamelCase(mapObjectName.toLowerCase()) + 's'; // e.g. markers
    this.map[groupName] = this.map[groupName] || [];
    this.map[groupName].push(mapObject);
  }

  removeFromMapObjectGroup(mapObjectName: string, mapObject: any) {
    let groupName = toCamelCase(mapObjectName.toLowerCase()) + 's'; // e.g. markers
    if (this.map && this.map[groupName]) {
      let index = this.map[groupName].indexOf(mapObject);
      console.log('index', mapObject, index);
      (index > -1) && this.map[groupName].splice(index, 1);
    }
  }
}
