## Running a Graph node

This is a repository for setting up a local [Graph](https://thegraph.com) node powered by [Subsquid](https://subsquid.io) data.

**Disclaimer: This is alpha quality software. If you encouter any issues while using it please let us know at the [SquidDevs Telegram chat](https://t.me/HydraDevs).**

**Dependencies**: NodeJS, Git, Docker and Yarn (for managing dependencies of a test subgraph)

Basic environment includes:

 * PostgreSQL
 * IPFS
 * `firehose-grpc`, a Firehose implementation that uses Subsquid data
 * Graph node
 * (If you choose Subsquid Network as a data source) A query gateway Subsquid Network node

To get the environment, first clone the repo and install the dependencies:
```bash
git clone https://github.com/subsquid-labs/graph-node-setup
cd graph-node-setup
npm ci
```
Then configure the environment with
```bash
npm run configure
```
You will be prompted to select the network. Providing an RPC endpoint is optional; if you do provide it, it will only be used to sync the few thousands of blocks at the chain head. You can expect that the total number of requests will not be high, but they will be sent in quick succession and may send public RPC endpoints into a cooldown. Free private endpoints should perform well.

Running the setup without an RPC endpoint introduces a delay of several thousands of blocks between the highest block available to the subgraph and the actual block head.

![Environment configuration](/configuration.gif)

Once you're done with the configuration launch the containers:
```bash
docker compose up -d
```

# Deploying a test Ethereum subraph

Let us deploy the well known Gravatar subgraph as an example. Since it runs on Ethereum we have to reconfigure the environment to use `eth-mainnet`:
```bash
docker compose down
npm run configure -- --network eth-mainnet
docker compose up -d
```
Then we can deploy the subgraph as usual:
```bash
git clone https://github.com/graphprotocol/example-subgraph
cd example-subgraph

# the repo is a bit outdated, giving it a deps update
rm yarn.lock
npx --yes npm-check-updates --upgrade
yarn install

# generate classes for the smart contract and events used in the subgraph
yarn run codegen

# create and deploy the subgraph
yarn run create-local
yarn run deploy-local

```
If all is well, the deploy command will output an endpoint URL that you can follow to a [GraphiQL](https://www.npmjs.com/package/graphiql) playground.

## Troubleshooting

Do not hesitate to let us know about any issues (whether listed here or not) at the [SquidDevs Telegram chat](https://t.me/HydraDevs).

* If your subgraph is not syncing and you're getting
  ```
  thread 'tokio-runtime-worker' panicked at 'called `Option::unwrap()` on a `None` value', src/ds_rpc.rs:556:80
  ```
  errors in the `graph-node-setup-firehose` container logs, that likely means that the chain RPC is not fully Ethereum-compatible and a workaround is not yet implemented in `firehose-grpc`. You can still sync your subgraph with RPC ingestion disabled.
