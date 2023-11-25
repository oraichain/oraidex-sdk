# Oraidex Common UI

## Installation

You can install this demo UI library using yarn:

```
yarn add @oraichain/oraidex-common-ui
```

## Usage

To use this UI library in your project, import the components you need from the library and use them in your React components.

```jsx
import React from "react";
import { TVCharContainer } from "@oraichain/oraidex-common-ui";

function App() {
  return (
    <div>
      <TVChartContainer
        theme="light"
        currentPair={{
            symbol: 'ORAI/USDT',
            info: 'orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh'
        }}
      />
    </div>
  );
}

export default App;
```

### Steps

- Fork the repository.
- Clone the repository to your local machine.
- Install the dependencies using `yarn`.
- View the components in the browser using `yarn storybook`.
- Make your changes.
- Build the library using `yarn build`.
- Commit the changes and push them to your forked repository.
- Publish the package on [npm](https://www.npmjs.com/).
- Install and use the package in your project.