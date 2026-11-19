import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { icon as faCoreIcon, IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBox,
  faBoxesStacked,
  faTruck,
  faTruckFast,
  faUsers,
  faUserPlus,
  faUserShield,
  faUserGear,
  faUserCheck,
  faUserXmark,
  faClipboardList,
  faShieldHalved,
  faBan,
  faCircleDot,
  faTowerBroadcast,
  faRightFromBracket,
  faPlus,
  faEye,
  faRotate,
  faLocationDot,
  faLocationCrosshairs,
  faMapLocationDot,
  faFileSignature,
  faPenNib,
  faSignature,
  faCamera,
  faQrcode,
  faCircleCheck,
  faCheck,
  faTriangleExclamation,
  faCircleExclamation,
  faFilter,
  faToggleOn,
  faToggleOff,
  faBars,
  faXmark,
  faMagnifyingGlass,
  faLock,
  faEnvelope,
  faClock,
  faArrowLeft,
  faArrowRight,
  faMobileScreen,
  faMapPin,
  faSatellite,
  faCalendarDays,
  faCheckDouble,
  faCircle,
  faArrowsRotate,
  faFileArrowUp,
  faShield,
} from '@fortawesome/free-solid-svg-icons';

@Injectable({
  providedIn: 'root',
})
export class IconService {
  // Central icon registry
  readonly icons = {
    box: faBox,
    boxes: faBoxesStacked,
    truck: faTruck,
    truckFast: faTruckFast,
    users: faUsers,
    userPlus: faUserPlus,
    userShield: faUserShield,
    userGear: faUserGear,
    userCheck: faUserCheck,
    userXmark: faUserXmark,
    audit: faClipboardList,
    shield: faShield,
    shieldHalved: faShieldHalved,
    ban: faBan,
    live: faCircleDot,
    broadcast: faTowerBroadcast,
    logout: faRightFromBracket,
    plus: faPlus,
    eye: faEye,
    rotate: faRotate,
    refresh: faArrowsRotate,
    location: faLocationDot,
    locationCrosshairs: faLocationCrosshairs,
    mapLocation: faMapLocationDot,
    mapPin: faMapPin,
    signature: faSignature,
    penNib: faPenNib,
    fileSignature: faFileSignature,
    camera: faCamera,
    qrcode: faQrcode,
    check: faCheck,
    circleCheck: faCircleCheck,
    checkDouble: faCheckDouble,
    warning: faTriangleExclamation,
    danger: faCircleExclamation,
    filter: faFilter,
    toggleOn: faToggleOn,
    toggleOff: faToggleOff,
    menu: faBars,
    close: faXmark,
    search: faMagnifyingGlass,
    lock: faLock,
    envelope: faEnvelope,
    clock: faClock,
    calendar: faCalendarDays,
    arrowLeft: faArrowLeft,
    arrowRight: faArrowRight,
    mobile: faMobileScreen,
    satellite: faSatellite,
    circle: faCircle,
    upload: faFileArrowUp,
  };

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Generates inline SVG HTML string for use inside jQWidgets custom cell renderers,
   * modal headers, and dynamic templates where Angular components cannot be instantiated directly.
   */
  getSvgHtml(
    iconDef: IconDefinition,
    options?: { size?: number; color?: string; extraClass?: string; marginRight?: number }
  ): string {
    const size = options?.size || 14;
    const color = options?.color ? `color: ${options.color}; fill: ${options.color};` : '';
    const mr = options?.marginRight !== undefined ? `margin-right: ${options.marginRight}px;` : 'margin-right: 6px;';
    const extraClass = options?.extraClass || '';

    const i = faCoreIcon(iconDef, {
      styles: {
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        'vertical-align': '-0.125em',
      },
      classes: extraClass ? [extraClass] : [],
    });

    if (i && i.html && i.html[0]) {
      // Wrap with custom styling if color or margin is specified
      return `<span style="display:inline-flex; align-items:center; ${color} ${mr}">${i.html[0]}</span>`;
    }

    return '';
  }

  /**
   * Generates a sanitized SafeHtml instance for Angular templates using [innerHTML]
   */
  getSafeSvg(
    iconDef: IconDefinition,
    options?: { size?: number; color?: string; extraClass?: string; marginRight?: number }
  ): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.getSvgHtml(iconDef, options));
  }
}
