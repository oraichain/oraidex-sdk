import { initDb } from "./../src/index";
import request from "supertest";
import app from "../src";

let duckDb;
/* Connecting to the database before each test. */
beforeAll(async () => {
  duckDb = await initDb();
});

/* Closing database connection after each test. */
afterAll(async () => {
  await duckDb?.instance?.closeDb();
});

describe("API Tests", () => {
  it("Get api version", async () => {
    const response = await request(app).get("/version");
    expect(response.text).toEqual("1.0.42");
  });

  it("Get pairs from DB", async () => {
    const response = await request(app).get("/pairs");
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get tickers from DB", async () => {
    const response = await request(app).get("/tickers");
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  }, 10000);

  // it.each([
  //   [28372237, 28377037, 15],
  //   [28372237, undefined, 15],
  //   [undefined, undefined, 15],
  //   [undefined, undefined, undefined]
  // ])("Get historical/chart from DB", async (startTime, endTime, tf) => {
  //   const response = await request(app).get("/volume/v2/historical/chart").query({
  //     startTime,
  //     endTime,
  //     tf
  //   });
  //   expect(response.status).toBe(200);
  // });

  it("Get /v1/candles/ from DB", async () => {
    const response = await request(app).get("/v1/candles/").query({
      pair: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      startTime: 28372237,
      endTime: 28377037,
      tf: 240
    });

    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get /v1/pools/ from DB", async () => {
    const response = await request(app).get("/v1/pools/");

    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get /v1/pool-detail/ from DB", async () => {
    const response = await request(app).get("/v1/pool-detail/").query({
      pairDenoms: "orai_orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
    });
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get /orai-info from DB", async () => {
    const response = await request(app).get("/orai-info");
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get /price from DB", async () => {
    const response = await request(app).get("/price").query({
      base_denom: "orai",
      quote_denom: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      tf: 240
    });
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get /v1/my-staking from DB", async () => {
    const response = await request(app).get("/v1/my-staking").query({
      stakerAddress: "orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz"
    });

    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get /price-by-usdt/ from DB", async () => {
    const response = await request(app).get("/price-by-usdt/").query({
      denom: "orai"
    });
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });
});
