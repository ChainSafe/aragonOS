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
const EVMScriptRegistryFactory = require('../build/contracts/EVMScriptRegistryFactory')

const ACL = require('../build/contracts/ACL')
const Kernel = require('../build/contracts/Kernel')

const defaultOwner = process.env.OWNER
const defaultDaoFactoryAddress = process.env.DAO_FACTORY
const defaultENSAddress = process.env.ENS

const getAccounts = require('./helpers/get-accounts')

const tldName = 'eth'
const labelName = 'aragonpm'
const tldHash = namehash(tldName)
const labelHash = '0x'+keccak256(labelName)
const apmNode = namehash(`${labelName}.${tldName}`)

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

async function deployContract(contractData, sender, args=[]) {
  const testContract = new web3.eth.Contract(contractData.abi);
  return testContract
    .deploy({
      arguments: args,
      data: contractData.bytecode
    })
    .send({
      from: sender,
      gas: 5000000,
      gasPrice: 1
    })
    .then(function(contractInstance) {
      console.log(
        "Deployed contract " + contractData.contractName + "\t Address: ",
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

async function deployDaoFactory(from) {
	let kernelBase = await deployContract(Kernel, from, [true])
	let aclBase = await deployContract(ACL, from)
	let evmScriptRegistryFactory = await deployContract(EVMScriptRegistryFactory, from)
	let daoFactory = await deployContract(DAOFactory, from,    
		[kernelBase.options.address,
	    aclBase.options.address,
	    evmScriptRegistryFactory ? evmScriptRegistryFactory.options.address : ZERO_ADDR
    ])

    return {
      aclBase,
      daoFactory,
      evmScriptRegistryFactory,
      kernelBase,
    }
}

async function deploy() {
	console.log('Deploying APM...')

	let ensAddress = defaultENSAddress
	let owner = defaultOwner
	let daoFactoryAddress = defaultDaoFactoryAddress

	const accounts = await getAccounts(web3)
	if (!owner) {
		owner = accounts[0]
		console.log('OWNER env variable not found, setting APM owner to the provider\'s first account')
	}

	console.log('Owner:', owner)

	let ensFactory
	if (!ensAddress) {
		console.log('=========')
		console.log('Missing ENS! Deploying a custom ENS...')

		ensFactory = await deployContract(ENSFactory, owner)

  		let receipt = await ensFactory.methods.newENS(owner).send({
  			from: owner,
  			gas: 6000000,
       	 	gasPrice: 1,
  		})

  		ensAddress = receipt.events["DeployENS"].returnValues['ens']

		console.log('Deployed ENS:', ensAddress)
		console.log('====================')
	}

	let ens = new web3.eth.Contract(ENS.abi, ensAddress)

	console.log('ENS:', ensAddress)
	console.log(`TLD: ${tldName} (${tldHash})`)
	console.log(`Label: ${labelName} (${labelHash})`)

	console.log('=========')
	console.log('Deploying APM bases...')

  	let apmRegistryBase = await deployContract(APMRegistry, owner)
  	let apmRepoBase = await deployContract(Repo, owner)
  	let ensSubdomainRegistrarBase = await deployContract(ENSSubdomainRegistrar, owner)

	let daoFactory
	if (daoFactoryAddress) {
		daoFactory = new web3.eth.Contract(DAOFactory.abi, daoFactoryAddress)
		const hasEVMScripts = await daoFactory.regFactory() !== ZERO_ADDR
		console.log(`Using provided DAOFactory (with${hasEVMScripts ? '' : 'out' } EVMScripts):`, daoFactoryAddress)
	} else {
		console.log('Deploying DAOFactory with EVMScripts...')
		daoFactory = (await deployDaoFactory(owner)).daoFactory
	}

	console.log('Deploying APMRegistryFactory...')
	const apmFactory = await deployContract(APMRegistryFactory, owner, 
		[daoFactory.options.address,
		apmRegistryBase.options.address,
		apmRepoBase.options.address,
		ensSubdomainRegistrarBase.options.address,
		ensAddress,
		ensFactory.options.address]
	)

  console.log(`Assigning ENS name (${labelName}.${tldName}) to factory...`)
  let ensAccount = await ens.methods.owner(apmNode).send({
		from: owner,
		gas: 6000000,
	 	gasPrice: 1,
	})

  if (ensAccount === accounts[0]) {
    console.log('Transferring name ownership from deployer to APMRegistryFactory')
    await ens.methods.setOwner(apmNode, apmFactory.options.address).send({
		from: owner,
		gas: 6000000,
	 	gasPrice: 1,
	})
  } else {
    console.log('Creating subdomain and assigning it to APMRegistryFactory')
    try {
      await ens.methods.setSubnodeOwner(tldHash, labelHash, apmFactory.options.address).send({
			from: owner,
			gas: 6000000,
		 	gasPrice: 1,
		})

    } catch (err) {
      console.error(
        `Error: could not set the owner of '${labelName}.${tldName}' on the given ENS instance`,
        `(${ensAddress}). Make sure you have ownership rights over the subdomain.`
      )
      process.exit();
    }
  }

	console.log('Deploying APM...')
	const receipt = await apmFactory.methods.newAPM(tldHash, labelHash, owner).send({
		from: owner,
		gas: 7000000,
	 	gasPrice: 1,
	})

	console.log('=========')
	const apmAddr = receipt.events["DeployAPM"].returnValues['apm']//receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
	console.log('# APM:')
	console.log('Address:', apmAddr)
	console.log('Transaction hash:', receipt.transactionHash)
	console.log('=========')

	console.log("Done!")

    return {
      apmFactory,
      ens,
      apm: new web3.eth.Contract(APMRegistry.abi, apmAddr),
    }
}

deploy()