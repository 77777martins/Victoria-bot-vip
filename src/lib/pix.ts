/**
 * Gerador de BR Code PIX estático (padrão EMV do Banco Central).
 * Gera o "copia e cola" com valor e identificador (txid) fixos.
 */

/** Campo EMV: ID (2) + tamanho (2) + valor */
const field = (id: string, value: string): string => {
  if (value.length > 99) throw new Error(`Campo ${id} excede 99 caracteres`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
};

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF), exigido pelo BR Code */
export const crc16 = (payload: string): string => {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/** Remove acentos/símbolos: vários bancos rejeitam caracteres fora de ASCII no nome/cidade */
export const sanitizeMerchantText = (text: string, maxLength: number): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);

/** txid: até 25 caracteres alfanuméricos */
export const sanitizeTxid = (txid: string): string => txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

export interface PixPayloadInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
  txid: string;
}

export const buildPixPayload = (input: PixPayloadInput): string => {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('Valor inválido');

  const merchantAccount = field('00', 'br.gov.bcb.pix') + field('01', input.key.trim());
  const payload =
    field('00', '01') + // Payload Format Indicator
    field('26', merchantAccount) +
    field('52', '0000') + // Merchant Category Code
    field('53', '986') + // BRL
    field('54', (input.amountCents / 100).toFixed(2)) +
    field('58', 'BR') +
    field('59', sanitizeMerchantText(input.merchantName, 25) || 'RECEBEDOR') +
    field('60', sanitizeMerchantText(input.merchantCity, 15) || 'BRASIL') +
    field('62', field('05', sanitizeTxid(input.txid))) +
    '6304'; // CRC: ID + tamanho, valor calculado sobre tudo antes dele

  return payload + crc16(payload);
};
