import { Router } from 'express';
import pool from '../database/connection';

const router = Router();

router.get('/sitemap.xml', async (req, res) => {
  const [products] = await (pool as any).query(
    'SELECT slug FROM products'
  );

  const staticUrls = [
    'https://www.ucpe.flint.ma/',
    'https://www.ucpe.flint.ma/products',
    'https://www.ucpe.flint.ma/inspiration',
    'https://www.ucpe.flint.ma/contact',
    'https://www.ucpe.flint.ma/blog',
    'https://www.ucpe.flint.ma/mentions-legales',
  ];

  const productUrls = products.map((p: { slug: string }) =>
    `https://www.ucpe.flint.ma/produit/${p.slug}`
  );

  const allUrls = [...staticUrls, ...productUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>\n    <loc>${url}</loc>\n  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

export default router;