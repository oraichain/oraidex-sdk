// import { createMachine } from "xstate";

// export const createMachines = () => {
//   const evmToEvmMachine = createMachine({
//     initial: "evm",
//     context: {
//       evm: {},
//       oraibridge: {},
//       oraichain: {}
//     },
//     states: {
//       evm: {
//         on: {
//           // listen to event sent elsewhere. Once received 'STORE' type event, then it will move to 'storeDb' state
//           STORE: "storeEvm"
//         }
//       },
//       storeEvm: {
//         invoke: {
//           // function that returns a promise
//           src: async (ctx, event) => {
//             console.log("event: ", event);
//             return new Promise((resolve) => resolve("foobar"));
//           },
//           onDone: "afterDb" // move to 'afterDb' state
//         }
//       },
//       afterDb: {
//         entry: () => {
//           console.log("in after db");
//         }
//       }
//     }
//   });
//   return { evmToEvmMachine };
// };
