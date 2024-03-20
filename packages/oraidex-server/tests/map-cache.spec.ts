import { updateInterval, registerListener } from "../src/map-cache";
import * as cacheMap from "../src/map-cache";
import fs from "fs";
import fsPromise from "fs/promises";

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn()
  }
}));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn()
}));

describe("Cache Module", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("updateInterval", () => {
    it("should update cache data and file on interval", async () => {
      // Mock readFileSync
      jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({}));
      jest.spyOn(cacheMap, "readCacheData").mockReturnValue({});

      const listenerMock = jest.fn().mockResolvedValue("test_value");
      registerListener("TEST_KEY", listenerMock);

      // Mock setTimeout
      jest.useFakeTimers();

      // Invoke updateInterval
      await updateInterval(1000);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      expect(listenerMock).toHaveBeenCalled();
      expect(fsPromise.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ TEST_KEY: "test_value" }, null, 2),
        "utf8"
      );
    });

    it("should handle listener function failure", async () => {
      // Mock readFileSync
      jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({}));
      jest.spyOn(cacheMap, "readCacheData").mockReturnValue({});

      // Mock a listener function that fails
      const errorMessage = "Error updating cache:";
      const listenerMock = jest.fn().mockRejectedValue(new Error(errorMessage));

      registerListener("TEST_KEY", listenerMock);

      // Mock console.error to prevent errors during testing
      console.error = jest.fn();

      // Mock setTimeout
      jest.useFakeTimers();

      // Invoke updateInterval
      await updateInterval(1000);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Ensure that the listener function is called
      expect(listenerMock).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
