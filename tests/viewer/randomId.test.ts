import { describe, expect, test } from 'vitest';
import { randomId } from '../../src/viewer/randomId';

describe('randomId',()=>{
 test('uses randomUUID when available',()=>expect(randomId({randomUUID:()=> 'native-id'} as unknown as Crypto)).toBe('native-id'));
 test('creates UUID-compatible IDs when Safari omits randomUUID',()=>{const api={getRandomValues:<T extends ArrayBufferView|null>(array:T)=>{const bytes=array as Uint8Array;for(let i=0;i<bytes.length;i++)bytes[i]=i;return array;}} as unknown as Crypto;expect(randomId(api)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);});
 test('still creates distinct local IDs without Web Crypto',()=>expect(randomId(undefined)).not.toBe(randomId(undefined)));
});
