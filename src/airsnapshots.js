const chalk = require('chalk')
const commandUtils = require('./command-utils')
const fs = require('fs-extra')
const configure = require('./configure')
const auth = require('./auth')

const help = function () {
  let help = `
Usage: airlocal airsnapshots

Commands:
  create        Create a new DB snapshot
`
  console.log(help)
}

const getSnapshotsDir = async function () {
  return await configure.get('snapshotsPath')
}

const checkIfConfigured = async function () {
  const authConfigured = await auth.checkIfAuthConfigured()

  if (authConfigured === false) {
    return false
  }

  return true
}

const createSnapshot = function () {
  console.log(chalk.yellow('Snapshots still WIP'))
}

const command = async function () {
  // Ensure that the snapshots folder is created and owned by the current user versus letting docker create it so we can enforce proper ownership later
  let airSnapshotsDir = await getSnapshotsDir()
  await fs.ensureDir(airSnapshotsDir)

  // Verify we have a configuration
  if (await checkIfConfigured() === false) {
    console.error(chalk.red('Error: ') + "AIRSnapshots does not have auth configured. Please run 'airlocal auth config' before continuing.")
    process.exit()
  }

  if (commandUtils.subcommand() === 'help' || commandUtils.subcommand() === false) {
    help()
  } else {
    switch (commandUtils.subcommand()) {
      case 'create':
        createSnapshot()
        break
      default:
        help()
        break
    }
  }
}

module.exports = { command, checkIfConfigured, configure }
