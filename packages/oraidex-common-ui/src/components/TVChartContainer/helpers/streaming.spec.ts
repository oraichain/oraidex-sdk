import { roundTime } from "./utils";

// test round quarter hour
test("test round down quarter hour", () => {
  const realResult = roundTime(new Date("2023-03-28T15:16:02.777942766Z"), 15);
  const expectResult = 1680016500; //2023-03-28 15:15:00
  expect(realResult).toEqual(expectResult);
});

// test round half hour
test("test round down half hour", () => {
  const realResult = roundTime(new Date("2023-03-28T15:12:16.943634115Z"), 30);
  const expectResult = 1680015600; //2023-03-28 15:00:00
  expect(realResult).toEqual(expectResult);
});

// test round hour
test("test round down hour", () => {
  const realResult = roundTime(new Date("2023-03-28T15:12:16.943634115Z"), 60);
  const expectResult = 1680015600; //2023-03-28 12:00:00
  expect(realResult).toEqual(expectResult);
});

// test round quarter day
test("test round down quarter day", () => {
  const realResult = roundTime(new Date("2023-03-28T15:12:16.943634115Z"), 6 * 60);
  const expectResult = 1680026400; //2023-03-28 18:00:00
  expect(realResult).toEqual(expectResult);
});

// test round half day
test("test round down half day", () => {
  const realResult = roundTime(new Date("2023-03-28T15:12:16.943634115Z"), 12 * 60);
  const expectResult = 1680004800; //2023-03-28 12:00:00PM
  expect(realResult).toEqual(expectResult);
});

// test round day
test("test round down day", () => {
  const realResult = roundTime(new Date("2023-03-28T15:12:16.943634115Z"), 24 * 60);
  const expectResult = 1680048000; //2023-03-28 00:00:00
  expect(realResult).toEqual(expectResult);
});

// test round a week
test("test round a week", () => {
  const realResult = roundTime(new Date("2023-03-28T15:16:02.777942766Z"), 7 * 24 * 60);
  const expectResult = 1680134400; //2023-03-28 00:00:00
  expect(realResult).toEqual(expectResult);
});
