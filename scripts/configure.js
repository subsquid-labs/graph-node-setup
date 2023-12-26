import * as fs from 'fs'
import mustache from 'mustache'
import { program } from 'commander'
import select, { Separator } from '@inquirer/select'
import input from '@inquirer/input'
import registry from '@subsquid/archive-registry'

program
	.option('-s, --data-source <archives|network>', 'Subsquid data source to use')
	.option('-n, --network <subsquid_name>', 'Network name according to Subsquid. For archives see https://docs.subsquid.io/evm-indexing/supported-networks/; for network it is eth-mainnet | binance | base-mainnet | moonbeam')
	.option('-r, --rpc <rpc_url>', 'URL of a chain node RPC endpoint')
	.option('--finality-confirmation <num_blocks>', 'Block depth at which to consider the data final')
	.option('--disable-rpc-ingestion', 'Do not ingest from RPC near the chain top. Introduces latency in thousands of blocks; useful for testing')
program.parse()

const userVars = {...program.opts()}
const networksLore = new Map(JSON.parse(fs.readFileSync('scripts/networks.json')).map(r => [r.subsquidName, r]))

if (userVars.dataSource==null) {
	userVars.dataSource = await select({
		message: 'Select a data source',
		choices: [
			{name: 'Subsquid open private data lake', value: 'archives'},
			{name: 'Permissionless Subsquid Network', value: 'network'}
		],
		loop: false
	})
}
else if (userVars.dataSource!=='archives' && userVars.dataSource!=='network') {
	throw new Error(`Invalid data source ${userVars.dataSource}`)
}

const supportedNetworks =
	userVars.dataSource==='archives' ?
	registry.archivesRegistryEVM().archives.map(a => a.network) :
	[...networksLore.values()].filter(n => n.network!=null).map(n => n.subsquidName)

if (userVars.network==null) {
	const graphNetworks = []
	const nonGraphNetworks = []
	for (let sn of supportedNetworks) {
		if (networksLore.get(sn)?.graphCliName!=null) {
			graphNetworks.push({value: sn})
		}
		else {
			nonGraphNetworks.push({value: sn})
		}
	}
	userVars.network = await select({
		message: 'Select a network',
		choices: nonGraphNetworks.length===0 ? graphNetworks : [
			...graphNetworks,
			new Separator('----- no support by thegraph below this line -----'),
			...nonGraphNetworks
		],
		default: 'eth-mainnet',
		pageSize: 150,
		loop: false
	})
}
else if (supportedNetworks.find(n => n===userVars.network)==null) {
	throw new Error(`Network ${userVars.network} is unavailable, select from: ${supportedNetworks.join(', ')}`)
}
userVars.networkLore = networksLore.get(userVars.network) ?? {}
if (userVars.networkLore.graphCliName) {
	userVars.mainAlias = userVars.networkLore.graphCliName
	console.log(`Network "${userVars.network}" is known to TheGraph as "${userVars.mainAlias}". Refer to it in subgraph.yaml by that name:\n    network: ${userVars.mainAlias}`)
}
else {
	userVars.mainAlias = userVars.network
	console.log(`WARNING! You chose a network that is not supported by TheGraph. It will be available for use in subgraph.yaml under a non-standard name "${userVars.mainAlias}":\n    network: ${userVars.mainAlias}`)
}

if (userVars.disableRpcIngestion==null) {
	userVars.disableRpcIngestion = false
}
if (!userVars.disableRpcIngestion && userVars.rpc==null) {
	userVars.rpc = await input({
		message: 'RPC endpoint (for real-time updates)',
		validate: r => r.startsWith('http://') || r.startsWith('https://') || r.startsWith('ws://') || r.startsWith('wss://') || r===''
	})
}
if (userVars.rpc==='') {
	userVars.disableRpcIngestion = true
}

if (userVars.finalityConfirmation==null) {
	userVars.finalityConfirmation = await input({
		message: 'Finality confirmation block depth',
		default: userVars.networkLore.defaultFinalityConfirmations
	})
}

const archiveUrl =
	userVars.dataSource==='archives' ?
	registry.lookupArchive(userVars.network, {type: 'EVM', release: 'ArrowSquid'}) :
	`http://query-gateway:8002/network/${userVars.networkLore.network.dataset}`

const renderVars = {
	network: userVars.mainAlias,
	rpcUrl: userVars.rpc,
	rpcFlag: userVars.disableRpcIngestion ? undefined : `\n      "--rpc", "${userVars.rpc}",`,
	archiveUrl,
	finalityConfirmation: userVars.finalityConfirmation,
	queryGateway: userVars.dataSource==='archives' ? false : [{}],
	rpcForGraphNode: userVars.disableRpcIngestion ? false : [{ network: userVars.mainAlias, rpcUrl: userVars.rpc }],
	dataset: userVars.networkLore.network?.dataset,
	base64url: userVars.networkLore.network?.base64url
}

function renderFile(inPath, vars) {
	const outPath = inPath.replaceAll('.template', '')
	const contents = fs.readFileSync(inPath).toString()
	fs.writeFileSync(outPath, mustache.render(contents, vars))
	return outPath
}

const outFiles = []
outFiles.push(renderFile('config.template.toml', renderVars))
outFiles.push(renderFile('docker-compose.template.yml', renderVars))
if (userVars.dataSource==='network') {
	outFiles.push(renderFile('query-gateway/config/gateway-config.template.yml', renderVars))
}

console.log(`Configuration written to: ${outFiles.join(', ')}`)
