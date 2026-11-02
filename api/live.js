// Live numbers for the site: the donation wallet's SOL balance (Solana RPC) and, once the CA is set, the coin's market (Dexscreener).
const RPCS = [process.env.RPC_URL, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
async function rpc(method, params) {
  let last;
  for (const u of RPCS) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
    } catch (e) { last = e; }
  }
  throw last;
}
const b58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
module.exports = async (req, res) => {
  const wallet = String(req.query.wallet || ''), ca = String(req.query.ca || '');
  const out = { at: Date.now() };
  try {
    const [bal, px, dx] = await Promise.all([
      b58.test(wallet) ? rpc('getBalance', [wallet, { commitment: 'confirmed' }]).then((r) => r.value / 1e9) : null,
      fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112').then((r) => r.json()).then((j) => Number(j.So11111111111111111111111111111111111111112.usdPrice)).catch(() => 0),
      b58.test(ca) ? fetch('https://api.dexscreener.com/latest/dex/tokens/' + ca).then((r) => r.json()).catch(() => null) : null,
    ]);
    if (bal !== null) out.wallet = { sol: bal, usd: bal * (px || 0) };
    out.solUsd = px || 0;
    if (dx && dx.pairs && dx.pairs.length) {
      const p = dx.pairs.filter((x) => x.chainId === 'solana').sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
      if (p) out.coin = { mcap: Number(p.marketCap || p.fdv || 0), vol: Number((p.volume && p.volume.h24) || 0), chg: Number((p.priceChange && p.priceChange.h24) || 0) };
    }
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'Solana is not answering right now.' });
  }
};
