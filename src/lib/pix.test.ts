import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPixPayload, crc16, sanitizeMerchantText } from './pix';

test('crc16 bate com o vetor de referência CCITT-FALSE', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('crc16 bate com o exemplo do manual do BR Code', () => {
  const sample =
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(crc16(sample), '1D3D');
});

test('payload contém valor, nome e cidade normalizados e CRC válido', () => {
  const p = buildPixPayload({
    key: 'cliente@email.com',
    merchantName: 'Vitória Sílva',
    merchantCity: 'São Paulo',
    amountCents: 999,
    txid: 'VIP-abc123',
  });
  assert.ok(p.includes('54049.99'));
  assert.ok(p.includes('5913VITORIA SILVA'));
  assert.ok(p.includes('6009SAO PAULO'));
  assert.ok(p.includes('0509VIPabc123'));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test('rejeita valor inválido', () => {
  assert.throws(() => buildPixPayload({ key: 'k@x.com', merchantName: 'A', merchantCity: 'B', amountCents: 0, txid: 'x' }));
});

test('nome é limitado a 25 caracteres', () => {
  assert.equal(sanitizeMerchantText('a'.repeat(40), 25).length, 25);
});
