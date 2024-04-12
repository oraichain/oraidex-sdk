import { expect } from "chai";
import { DatabaseEnum } from "../src/constants";
import { DuckDbNode } from "../src/db";

describe("DuckDB general select, insert, update testing", () => {
  let duckDb: DuckDbNode;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();
  });

  it("Testing general select", () => {
    const defaultOptions = {
      where: {},
      attributes: [],
      pagination: {}
    };
    const selectOne = duckDb.selectClause(DatabaseEnum.Evm);
    expect(selectOne[0]).equal("SELECT * FROM EvmState");

    const selectTwo = duckDb.selectClause(DatabaseEnum.Evm, {
      ...defaultOptions,
      where: {
        userId: 1,
        name: "Dang"
      }
    });
    expect(selectTwo[0]).equal("SELECT * FROM EvmState WHERE userId = ? AND name = ?");
    expect(selectTwo[1]).eql([1, "Dang"]);

    const selectThree = duckDb.selectClause(DatabaseEnum.Evm, {
      ...defaultOptions,
      where: {
        userId: 1,
        name: "Dang",
        age: 32
      },
      attributes: ["userId", "age"],
      pagination: {
        limit: 5,
        offset: 10
      }
    });
    expect(selectThree[0]).equal(
      "SELECT userId, age FROM EvmState WHERE userId = ? AND name = ? AND age = ? LIMIT ? OFFSET ?"
    );
    expect(selectThree[1]).eql([1, "Dang", 32, 5, 10]);
  });

  it("Testing general insert", async () => {
    const insertData = duckDb.insertClause(DatabaseEnum.Oraichain, {
      minh: "Dang",
      github: "perfogic"
    });

    expect(insertData[0]).equal("INSERT OR IGNORE INTO OraichainState (minh, github) VALUES (?, ?)");
    expect(insertData[1]).eql(["Dang", "perfogic"]);
  });

  it("Testing general update", async () => {
    const updateData = duckDb.updateClause(
      DatabaseEnum.OraiBridge,
      {
        minh: "Dang",
        github: "perfogic"
      },
      {
        where: {
          id: 5
        }
      }
    );

    expect(updateData[0]).eq("UPDATE OraiBridgeState SET minh = ?, github = ? WHERE id = ?");
    expect(updateData[1]).eql(["Dang", "perfogic", 5]);
  });
});
