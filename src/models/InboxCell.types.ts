// Cell contract as it arrives on the wire. The control panel and rpc-v2 names
// never reach a device; messaging rewrites them into these on the way out.

/** Cell layout of an inbox message. */
export type TInboxLayoutClassic = 'classic';
export type TInboxLayoutCaptioned = 'captioned';
export type TInboxLayoutBanner = 'banner';
export type TInboxLayoutCarousel = 'carousel';
export type TInboxLayout =
  | TInboxLayoutClassic
  | TInboxLayoutCaptioned
  | TInboxLayoutBanner
  | TInboxLayoutCarousel;

/** One carousel slide inside `action_params.u`. */
export interface IInboxSlideRaw {
  image?: string;
  title?: string;
  url?: string;
}

/** Cell contract plus the campaign's custom data, merged flat by the pipeline. */
export interface IInboxUserData {
  displayType?: string;
  carousel?: Array<IInboxSlideRaw>;
  image?: string;
  [key: string]: unknown;
}

/** One carousel slide of a public inbox message. */
export interface IInboxMessageSlide {
  imageUrl: string;
  /** Caption overlaid at the bottom of the slide; empty when the slide has none. */
  caption: string;
  /** Where a tap on the slide goes; empty when the slide has none, and the message action applies. */
  link: string;
}
