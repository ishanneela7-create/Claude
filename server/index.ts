import path from 'node:path';
import { createApp } from './app';
import { createContext, refreshStatistics } from './db';
import { seedSampleDataIfEmpty } from './sampleData';
import { downloadRebrickableColors } from './services/colorDownload';
import { seedColors } from './services/colorSeed';
import { ensureSearchIndex } from './services/searchIndex';

const port = Number(process.env.PORT ?? 3001);
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');

const context = createContext(dataDir);
ensureSearchIndex(context.db);
refreshStatistics(context.db);
await seedSampleDataIfEmpty(context.db);

createApp(context).listen(port, () => {
  console.log(`LEGO library API running at http://localhost:${port}`);
});

/* Only the small starter colors are installed? Try to fetch the full Rebrickable list in the background. */
const official = context.db.prepare('SELECT COUNT(*) AS n FROM colors WHERE is_custom = 0').get() as { n: number };
if (official.n < 60 && process.env.SKIP_COLOR_DOWNLOAD !== '1') {
  downloadRebrickableColors(8000)
    .then((colors) => console.log(`Installed ${seedColors(context.db, colors)} Rebrickable colors.`))
    .catch((error: unknown) =>
      console.log(`Using the starter colors (could not download Rebrickable's list: ${String(error)}). Run "npm run seed" when online.`),
    );
}
