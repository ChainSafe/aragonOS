const homedir = require('os').homedir
const path = require('path')

const HDWalletProvider = require('@truffle/hdwallet-provider')

const DEFAULT_MNEMONIC =
    'explain tackle mirror kit van hammer degree position ginger unfair soup bonus'

const defaultRPC = network => `https://${network}.eth.aragon.network`

const configFilePath = filename => path.join(homedir(), `.aragon/${filename}`)

const mnemonic = () => {
    try {
        return require(configFilePath('mnemonic.json')).mnemonic
    } catch (e) {
        return DEFAULT_MNEMONIC
    }
}

const settingsForNetwork = network => {
    try {
        return require(configFilePath(`${network}_key.json`))
    } catch (e) {
        return {}
    }
}

// Lazily loaded provider
const providerForNetwork = network => () => {
    let { rpc, keys } = settingsForNetwork(network)
    rpc = rpc || defaultRPC(network)

    if (!keys || keys.length === 0) {
        return new HDWalletProvider(mnemonic(), rpc)
    }

    return new HDWalletProvider(keys, rpc)
}

const mochaGasSettings = {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
        currency: 'USD',
        gasPrice: 3,
    },
}

const mocha = process.env.GAS_REPORTER ? mochaGasSettings : {}

module.exports = {
    networks: {
        rpc: {
            network_id: 8,
            host: 'localhost',
            port: 8545,
            gas: 6.9e6,
            gasPrice: 15000000001,
        },
        localhost: {
            host: "localhost",     // Localhost (default: none)
            port: 8545,            // Standard Ethereum port (default: none)
            network_id: "8",       // Any network (default: none)
            // gas: 4712387,
            gasPrice: 10000000,  // 20 gwei (in wei) (default: 1 gwei)
            // from: "cosmos1hsfsjd6fgdgd6u4q4r397hmns3xwk5hzvtq233"        // Account to send txs from (default: accounts[0])
        },

        coverage: {
            host: 'localhost',
            network_id: '*',
            port: 8555,
            gas: 0xffffffffff,
            gasPrice: 0x01,
        },
    },
    build: {},
    mocha,
    solc: {
        optimizer: {
            // See the solidity docs for advice about optimization and evmVersion
            // https://solidity.readthedocs.io/en/v0.5.12/using-the-compiler.html#setting-the-evm-version-to-target
            enabled: true,
            runs: 10000,   // Optimize for how many times you intend to run the code
        },
    },
}