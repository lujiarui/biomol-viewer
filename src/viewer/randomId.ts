let fallbackSerial=0;

/** UUID-compatible IDs on local-network HTTP, where Safari omits crypto.randomUUID. */
export function randomId(cryptoApi:Crypto|undefined=globalThis.crypto){
 if(typeof cryptoApi?.randomUUID==='function')return cryptoApi.randomUUID();
 if(typeof cryptoApi?.getRandomValues==='function'){
  const bytes=cryptoApi.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 }
 fallbackSerial++;return`local-${Date.now().toString(36)}-${fallbackSerial.toString(36)}`;
}
