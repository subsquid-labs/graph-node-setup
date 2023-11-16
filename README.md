## Running a Graph node

This is a repository for setting up a local [Graph](https://thegraph.com) node powered by [Subsquid](https://subsquid.io) data.

**Disclaimer: This is alpha quality software. If you encouter any issues while using it please let us know at the [SquidDevs Telegram chat](https://t.me/HydraDevs).**

**Dependencies**: NodeJS, Git, Docker and Yarn (for managing dependencies of a test subgraph)

Basic environment includes:

 * PostgreSQL
 * IPFS
 * `firehose-grpc`, a Firehose implementation that uses Subsquid data
 * Graph node

To get it, first clone the repo and install the dependencies:
```bash
git clone https://github.com/subsquid-labs/graph-node-setup
cd graph-node-setup
npm ci
```
Then configure the environment with
```bash
npm run configure
```
You will be prompted to select the network and provide an RPC endpoint for it. Most of the data will be coming from Subsquid, so you can expect that the endpoint will not be used heavily. In fact, a public endpoint from [Ankr](https://www.ankr.com/rpc/) or [BlastAPI](https://blastapi.io/public-api) should suffice.

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
npm run codegen

# create and deploy the subgraph
npm run create-local
npm run deploy-local

```
GraphiQL playground will be available at [http://127.0.0.1:8000/subgraphs/name/example/graphql](http://127.0.0.1:8000/subgraphs/name/example/graphql).
