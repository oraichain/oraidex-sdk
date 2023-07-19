import { DuckDb } from "./db";

const start = async () => {
  const duckDb = await DuckDb.create("oraidex-sync-data-test");
  await duckDb.queryTotalLpTimeFrame(
    86400,
    new Date("2023-07-06T00:00:00.000Z").toISOString(),
    new Date("2023-07-12T00:00:00.000Z").toISOString()
  );
};

start();
