export function formatBalance(valueStr) {
  const [intPart, decPart] = valueStr.split(" ")[0].split("."); // pisah angka dan token
  if (!decPart) return intPart; // kalau tidak ada desimal

  // untuk angka normal, ambil maksimal 6 desimal
  let formatted = decPart.slice(0, 6);

  // kalau angka sangat kecil, tetap ambil digit signifikan pertama
  // cari posisi digit non-zero pertama
  const firstNonZero = decPart.search(/[1-9]/);
  if (firstNonZero >= 6) {
    formatted = decPart.slice(0, firstNonZero + 1);
  }

  return `${intPart}.${formatted}`;
}