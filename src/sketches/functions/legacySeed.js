// Seeded look selection shared by the imported donuts sketches.
// Priority: ?seed= (number or text) > hl-gen token > fresh random.
// The legacy sketches seeded from fxhash/fxrand; this is the lab equivalent.

export function hashToSeed(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function resolveSeed() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('seed');
  if (fromUrl !== null && fromUrl !== '') {
    const asNumber = Number(fromUrl);
    return Number.isFinite(asNumber) ? Math.abs(Math.trunc(asNumber)) : hashToSeed(fromUrl);
  }

  const hlGlobal = globalThis.hl;
  if (hlGlobal?.tx) return hashToSeed(`${hlGlobal.tx.hash}${hlGlobal.tx.tokenId}`);

  return Math.floor(Math.random() * 1e9);
}
