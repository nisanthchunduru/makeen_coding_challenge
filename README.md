# makeen_coding_challenge

## Installation

Install npm packages

```
npm install
```

Start Postgres

```
docker compose up
```

Create a Postgres database

```
npm run db:create
```

Start the message fragment receiver

```
node receiver.js
```

Run the message fragment emitter

```
node emitter.js
```

Please note that the receiver currently takes 5 - 10 seconds to save a message's fragments in Postgres and print the message's SHA to STDOUT

## Testing

Unit tests are available in the tests/ directory

Use VSCode's "Jest Runner" extension to run any test you like https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner

## TODOs

- Modify receiver to buffer and batch insert message fragments to see if doing so improves performance
- Print a message's holes if all of its fragments aren't received within 30 seconds
