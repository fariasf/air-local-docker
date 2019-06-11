const chalk = require('chalk')
const commandUtils = require('./command-utils')
const os = require('os')
const fs = require('fs-extra')
const path = require('path')
const inquirer = require('inquirer')
const promptValidators = require('./prompt-validators')

// Tracks current auth config
let authConfig = null

const help = function () {
  let help = `
Usage: airlocal auth

Commands:
  config        Create configuration for AIR cloud account authorization
  check         Check if you are currently logged in with AIR cloud hosting CLI
  run           Authenticate to the AIR cloud hosting CLI
`
  console.log(help)
}

const getAuthConfigDirectory = function () {
  return path.join(os.homedir(), '.airlocal')
}

const getAuthConfigFilePath = function () {
  return path.join(getAuthConfigDirectory(), 'auth.json')
}

const checkIfAuthConfigured = async function () {
  return await fs.exists(getAuthConfigFilePath())
}

const checkIfConfigured = async function () {
  const authConfigured = await checkIfAuthConfigured()

  if (authConfigured === false) {
    return false
  }

  return true
}

const write = async function () {
  // Make sure we have our config directory present
  await fs.ensureDir(getAuthConfigDirectory())
  await fs.writeJson(getAuthConfigFilePath(), authConfig)
}

const read = async function () {
  let readConfig = {}

  if (await fs.exists(getAuthConfigFilePath())) {
    readConfig = await fs.readJson(getAuthConfigFilePath())
  }

  authConfig = Object.assign({}, readConfig)
}

const get = async function (key) {
  let defaults = getAuthDefaults()

  if (authConfig === null) {
    await read()
  }

  return (typeof authConfig[ key ] === 'undefined') ? defaults[ key ] : authConfig[ key ]
}

const set = async function (key, value) {
  if (authConfig === null) {
    await read()
  }

  authConfig[ key ] = value

  await write()
}

const getAuthDefaults = function () {
  return {
    airCustomer: true,
    authType: 'github',
    twoFactor: true,
    user: ''
  }
}

const prompt = async function () {
  let currentUser = await get('user')

  let questions = [
    {
      name: 'airCustomer',
      type: 'confirm',
      message: 'Are you a 45AIR cloud customer?'
    },
    {
      name: 'authType',
      type: 'list',
      message: 'Choose the auth type provisioned for your account:',
      choices: [
        { name: 'Github', value: 'github' }
      ],
      default: 'github',
      when: function (answers) {
        return answers.airCustomer === true
      }
    },
    {
      name: 'twoFactor',
      type: 'confirm',
      message: 'Does your account or org require two-factor auth?',
      when: function (answers) {
        return answers.airCustomer === true
      }
    },
    {
      name: 'user',
      type: 'input',
      message: 'Enter your auth provider login username or email:',
      default: currentUser || '',
      validate: promptValidators.validateNotEmpty,
      when: function (answers) {
        return answers.airCustomer === true
      }
    }
  ]

  let answers = await inquirer.prompt(questions)

  return answers
}

const configure = async function (answers) {
  await set('airCustomer', answers.airCustomer)
  if (answers.airCustomer === true) {
    await set('authType', answers.authType)
    await set('twoFactor', answers.twoFactor)
    await set('user', answers.user)
  }

  console.log(chalk.green('AIR Cloud Auth Configured!'))
  console.log()
}

const checkAuth = async function () {
  if (await checkIfConfigured() === false) {
    console.error(chalk.red('Error: ') + "Auth not configured. Please run 'airlocal auth config' before continuing.")
    console.log()
    process.exit()
  }

  console.log(chalk.yellow('Check auth is WIP'))
  console.log()
}

const runAuth = async function () {
  if (await checkIfConfigured() === false) {
    console.error(chalk.red('Error: ') + "Auth not configured. Please run 'airlocal auth config' before continuing.")
    console.log()
    process.exit()
  }

  console.log(chalk.yellow('Run auth is WIP'))
  console.log()
}

const command = async function () {
  if (commandUtils.subcommand() === 'help' || commandUtils.subcommand() === false) {
    help()
  } else {
    switch (commandUtils.subcommand()) {
      case 'config':
        let answers = await prompt()
        await configure(answers)
        break
      case 'check':
        checkAuth()
        break
      case 'run':
        runAuth()
        break
      default:
        help()
        break
    }
  }
}

module.exports = { command, checkIfAuthConfigured, get, set, getAuthConfigDirectory }
