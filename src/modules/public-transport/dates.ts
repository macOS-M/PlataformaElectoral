// PostgreSQL ::text uses a space and offsets such as +00; normalize to ISO for browsers.
export function transportTimestamp(value:string){return Date.parse(value.replace(" ","T").replace(/([+-]\d{2})$/,"$1:00").replace(/(\.\d{3})\d+/,"$1"));}
export function transportDate(value:string){return new Intl.DateTimeFormat("es-CR",{timeZone:"America/Costa_Rica",dateStyle:"medium",timeStyle:"short"}).format(new Date(transportTimestamp(value)));}
