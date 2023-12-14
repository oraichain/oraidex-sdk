// api.test.js
import request from "supertest";
import app from "../src";
import { DuckDb } from "@oraichain/oraidex-sync";

describe("API Tests", () => {
  let duckDb;
  beforeAll(async () => {
    duckDb = await DuckDb.create(process.env.DUCKDB_PROD_FILENAME || "");
    duckDb.conn.exec("SET memory_limit='1000MB'");
  });

  it("should respond with a greeting message", async () => {
    const response = await request(app).get("/pairs");
    expect(response.status).toBe(200);
  });
});
