#!/usr/bin/env node

const chalk = require('chalk')
const commandUtils = require('./src/command-utils')
const config = require('./src/configure')

const help = function () {
  let help = `
Usage: airlocal COMMAND

Commands:
  cache         Manages the build cache
  configure     Set up a configuration for Air Local Docker
  create        Create a new docker environment
  delete        Deletes a specific docker environment
  image         Manages docker images used by this environment
  logs          Shows logs from the specified container in your current environment (Defaults to all containers)
  restart       Restarts a specific docker environment
  shell         Opens a shell for a specified container in your current environment (Defaults to the phpfpm container)
  start         Starts a specific docker environment
  stop          Stops a specific docker environment
  wp            Runs a wp-cli command in your current environment
  auth          Set up authentication for snapshots and AIR cloud hosting accounts
  airsnapshots  Runs a air snapshots command

Run 'airlocal COMMAND help' for more information on a command.
`
  console.log(help)
}

const version = function () {
  var pjson = require('./package.json')
  console.log('Air Local Docker')
  console.log(`Version ${pjson.version}`)
}

const init = async function () {
  let command = commandUtils.command()
  let configured = await config.checkIfConfigured()
  let bypassCommands = [ undefined, 'configure', 'help', '--version', '-v' ]
  let isBypass = bypassCommands.indexOf(command) !== -1

  // Configure using defaults if not configured already
  if (configured === false && isBypass === false) {
    await config.configureDefaults()
  }

  // Don't even run the command to check if docker is running if we have one of the commands that don't need it
  if (isBypass === false) {
    let isRunning = commandUtils.checkIfDockerRunning()

    // Show warning if docker isn't running
    if (isRunning === false) {
      console.error(chalk.red("Error: Docker doesn't appear to be running. Please start Docker and try again"))
      process.exit()
    }
  }

  await commandUtils.checkForUpdates()

  switch (command) {
    case 'configure':
      config.command()
      break
    case 'create':
      await require('./src/create').command()
      break
    case 'start':
    case 'stop':
    case 'restart':
    case 'delete':
    case 'remove':
    case 'upgrade':
      await require('./src/environment').command()
      break
    case 'auth':
      await require('./src/auth').command()
      break
    case 'snapshots':
    case 'airsnapshots':
      await require('./src/airsnapshots').command()
      break
    case 'cache':
      await require('./src/cache').command()
      break
    case 'image':
      await require('./src/image').command()
      break
    case 'shell':
      await require('./src/shell').command()
      break
    case 'wp':
      await require('./src/wp').command()
      break
    case 'logs':
      await require('./src/logs').command()
      break
    case '--version':
    case '-v':
      version()
      break
    default:
      help()
      break
  }
}
init()
