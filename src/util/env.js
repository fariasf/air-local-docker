const path = require('path')
const async = require('asyncro')
const fs = require('fs-extra')
const inquirer = require('inquirer')
const chalk = require('chalk')
const helper = require('./helpers')
const utils = require('./utilities')

const parseEnvFromCWD = async function () {
  // Compare both of these as all lowercase to account for any misconfigurations
  let cwd = process.cwd().toLowerCase()
  let sitesPathValue = await utils.sitesPath()
  sitesPathValue = sitesPathValue.toLowerCase()

  if (cwd.indexOf(sitesPathValue) === -1) {
    return false
  }

  if (cwd === sitesPathValue) {
    return false
  }

  // Strip the base sitepath from the path
  cwd = cwd.replace(sitesPathValue, '').replace(/^\//i, '')

  // First segment is now the envSlug, get rid of the rest
  cwd = cwd.split('/')[0]

  // Make sure that a .config.json file exists here
  let configFile = path.join(sitesPathValue, cwd, '.config.json')
  if (!await fs.exists(configFile)) {
    return false
  }

  return cwd
}

const getAllEnvironments = async function () {
  let sitePath = await utils.sitesPath()
  let dirContent = await fs.readdir(sitePath)

  // Make into full path
  dirContent = await async.map(dirContent, async item => {
    return path.join(sitePath, item)
  })

  // Filter any that aren't directories
  dirContent = await async.filter(dirContent, async item => {
    let stat = await fs.stat(item)
    return stat.isDirectory()
  })

  // Filter any that don't have the .config.json file (which indicates its probably not a Air Local Docker Environment)
  dirContent = await async.filter(dirContent, async item => {
    let configFile = path.join(item, '.config.json')

    const config = await fs.exists(configFile)
    return config
  })

  // Back to just the basename
  dirContent = await async.map(dirContent, async item => {
    return path.basename(item)
  })

  return dirContent
}

const promptEnv = async function () {
  let environments = await getAllEnvironments()

  let questions = [
    {
      name: 'envSlug',
      type: 'list',
      message: 'What environment would you like to use?',
      choices: environments
    }
  ]

  console.log(chalk.bold.white('Unable to determine environment from current directory'))
  let answers = await inquirer.prompt(questions)

  return answers.envSlug
}

const parseOrPromptEnv = async function () {
  let envSlug = await parseEnvFromCWD()

  if (envSlug === false) {
    envSlug = await promptEnv()
  }

  return envSlug
}

const getEnvHosts = async function (envPath) {
  try {
    let envConfig = await fs.readJson(path.join(envPath, '.config.json'))

    return (typeof envConfig === 'object' && undefined !== envConfig.envHosts) ? envConfig.envHosts : []
  } catch (ex) {
    return []
  }
}

const getPathOrError = async function (env) {
  if (env === false || undefined === env || env.trim().length === 0) {
    env = await promptEnv()
  }

  console.log(`Locating project files for ${env}`)

  let _envPath = await utils.envPath(env)
  if (!await fs.pathExists(_envPath)) {
    console.error(`ERROR: Cannot find ${env} environment!`)
    process.exit(1)
  }

  return _envPath
}

/**
 * Format the default Proxy URL based on entered hostname
 *
 * @param  {string} value The user entered hostname
 * @return {string} The formatted default proxy URL
 */
const createDefaultProxy = function (value) {
  let proxyUrl = 'http://' + helper.removeEndSlashes(value)
  let proxyUrlTLD = proxyUrl.lastIndexOf('.')

  if (proxyUrlTLD === -1) {
    proxyUrl = proxyUrl + '.com'
  } else {
    proxyUrl = proxyUrl.substring(0, proxyUrlTLD + 1) + 'com'
  }

  return proxyUrl
}

module.exports = { parseEnvFromCWD, getAllEnvironments, promptEnv, parseOrPromptEnv, getEnvHosts, getPathOrError, createDefaultProxy }
