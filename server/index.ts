import path from 'node:path';
import { createApp } from './app';
import { createContext } from './db';
import { seedSampleDataIfEmpty } from './sampleData';
import { ensureSearchIndex } from './services/searchIndex';

const port = Number(process.env.PORT ?? 3001);
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');

const context = createContext(dataDir);
ensureSearchIndex(context.db);
await seedSampleDataIfEmpty(context.db);

createApp(context).listen(port, () => {
  console.log(`LEGO library API running at http://localhost:${port}`);
});
