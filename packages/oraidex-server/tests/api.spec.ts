import { duckDb as duckDbTest } from "./../src/index";
// api.test.js
import request from "supertest";
import app from "../src";
import { DuckDb } from "@oraichain/oraidex-sync";

describe("API Tests", () => {
  beforeAll(() => {
    //   duckDb = await DuckDb.create(process.env.DUCKDB_PROD_FILENAME || "");
  });

  afterAll(async () => {
    //   await duckDb?.closeDb();
  });

  it("Get version from DB", (done) => {
    request(app)
      .get("/version")
      .expect(200)
      .end((err, res) => {
        expect(res.text).toEqual("1.0.38");
        done(); // Call done when your asynchronous operations are complete
      });
  });

  it("Get pairs from DB", async () => {
    const response = await request(app).get("/pairs");

    console.log("response.body", response.body);
    // expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

  it("Get tickers from DB", async () => {
    const response = await request(app).get("/tickers");
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  }, 10000);

  it("Get historical/chart from DB", async () => {
    const response = await request(app).get("/volume/v2/historical/chart").query({
      startTime: 28372237,
      endTime: 28377037,
      tf: 15
    });
    expect(response.status).toBe(200);
    // expect(response.body).toMatchSnapshot();
  });

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
    const response = await request(app).get("/v1/my-staking");
    // expect(response.status).toBe(200);
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
