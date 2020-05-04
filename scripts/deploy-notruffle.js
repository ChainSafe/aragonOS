const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const APMRegistry = require('../build/contracts/APMRegistry')
const Repo = require('../build/contracts/Repo')
const ENSSubdomainRegistrar = require('../build/contracts/ENSSubdomainRegistrar')
const DAOFactory = require('../build/contracts/DAOFactory')
const APMRegistryFactory = require('../build/contracts/APMRegistryFactory')
const ENS = require('../build/contracts/ENS')
const ENSFactory = require('../build/contracts/ENSFactory')

const defaultOwner = process.env.OWNER
const defaultDaoFactoryAddress = process.env.DAO_FACTORY
const defaultENSAddress = process.env.ENS

const getAccounts = require('./helpers/get-accounts')

const tldName = 'eth'
const labelName = 'aragonpm'
const tldHash = namehash(tldName)
const labelHash = '0x'+keccak256(labelName)
const apmNode = namehash(`${labelName}.${tldName}`)

// async function getCurrentAccount() {
//   const currentAccounts = await web3.eth.getAccounts();
//   console.log("Unlocked account address: \t", currentAccounts[0]);
//   return currentAccounts[0];
// }

async function deployContract(contractData, sender) {
  const testContract = new web3.eth.Contract(contractData.abi);
  return testContract
    .deploy({
      arguments: ["1.0"],
      data: contractData.bytecode
    })
    .send({
      from: sender,
      gas: 3000000,
      gasPrice: 1
    })
    .then(function(contractInstance) {
      console.log(
        "Deployed contract Address: \t",
        contractInstance.options.address
      );
      return contractInstance;
    })
    .catch(function(err) {
      // Contract failed to deploy
      console.error(err);
      process.exit();
    });
}

async function deploy() {
	console.log('Deploying APM...')

	let ensAddress = defaultENSAddress
	let owner = defaultOwner

	const accounts = await getAccounts(web3)
	if (!owner) {
		owner = accounts[0]
		console.log('OWNER env variable not found, setting APM owner to the provider\'s first account')
	}

	console.log('Owner:', owner)

	if (!ensAddress) {
		console.log('=========')
		console.log('Missing ENS! Deploying a custom ENS...')

		let ensFactory = await deployContract(ENSFactory, owner)
  		let ensInstance = await ensFactory.methods.newENS(owner)

		console.log('====================')
		console.log('Deployed ENS:', ensInstance.address)

		ens = new web3.eth.Contract(ENSFactory.abi, ensInstance.address)
	} else {
		ens = ENS.at(ensAddress)
	}

	console.log('ENS:', ensAddress)
	console.log(`TLD: ${tldName} (${tldHash})`)
	console.log(`Label: ${labelName} (${labelHash})`)


}

deploy()