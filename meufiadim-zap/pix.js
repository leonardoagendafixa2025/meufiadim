function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function formatField(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function cleanText(str, max) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();
}

function generatePixCopiaECola({ pixKey, merchantName, merchantCity, amount, txid = "***" }) {
  const gui = formatField("00", "br.gov.bcb.pix");
  const key = formatField("01", pixKey.trim());
  const merchantAccount = formatField("26", gui + key);

  const payload = [
    formatField("00", "01"),
    merchantAccount,
    formatField("52", "0000"),
    formatField("53", "986"),
    amount > 0 ? formatField("54", Number(amount).toFixed(2)) : "",
    formatField("58", "BR"),
    formatField("59", cleanText(merchantName || "MEUFIADIM", 25)),
    formatField("60", cleanText(merchantCity || "BRASIL", 15)),
    formatField("62", formatField("05", txid.slice(0, 25))),
    "6304",
  ].join("");

  return payload + crc16(payload);
}

module.exports = { generatePixCopiaECola };
