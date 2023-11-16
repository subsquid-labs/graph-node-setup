import * as fs from 'fs'
import mustache from 'mustache'
import { program } from 'commander'
import select, { Separator } from '@inquirer/select'
import input from '@inquirer/input'
import registry from '@subsquid/archive-registry'

program
	.option('-n, --network <graph_cli_name>', 'Network name according to Graph CLI')
	.option('-r, --rpc <rpc_url>', 'URL of a chain node RPC endpoint')
	.option('--finality-confirmation <num_blocks>', 'Block depth at which to consider the data final')
program.parse()

const userVars = {...program.opts()}

const supportedNetworks = registry.archivesRegistryEVM().archives.map(a => a.network)
const networksLore = new Map(JSON.parse(fs.readFileSync('scripts/networks.json')).map(r => [r.subsquidName, r]))

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
		choices: [
			...graphNetworks,
			new Separator('----- no support by thegraph below this line -----'),
			...nonGraphNetworks
		],
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

if (userVars.rpc==null) {
	userVars.rpc = await input({
		message: 'RPC endpoint'
	})
}

if (userVars.finalityConfirmation==null) {
	userVars.finalityConfirmation = await input({
		message: 'Finality confirmation block depth',
		default: userVars.networkLore.defaultFinalityConfirmations
	})
}

const renderVars = {
	network: userVars.mainAlias,
	rpcUrl: userVars.rpc,
	rpcFlag: `\n      "--rpc", "${userVars.rpc}",`,
	archiveUrl: registry.lookupArchive(userVars.network, {type: 'EVM', release: 'ArrowSquid'}),
	finalityConfirmation: userVars.finalityConfirmation
}

function renderFile(inPath, vars) {
	const outPath = inPath.replaceAll('.template', '')
	const contents = fs.readFileSync(inPath).toString()
	fs.writeFileSync(outPath, mustache.render(contents, vars))
}

renderFile('config.template.toml', renderVars)
renderFile('docker-compose.template.yml', renderVars)
