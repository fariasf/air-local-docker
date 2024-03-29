const commandUtils = require('./command-utils')
const execSync = require('child_process').execSync

// These have to exist, so we don't bother checking if they exist on the system first
const globalImages = [
  '45air/nginx-proxy:latest',
  'mysql:5',
  'schickling/mailcatcher',
  'phpmyadmin/phpmyadmin'
]
const images = [
  '45air/phpfpm:latest',
  '45air/phpfpm:7.3',
  '45air/phpfpm:7.2',
  '45air/phpfpm:7.1',
  '45air/phpfpm:7.0',
  '45air/phpfpm:5.6',
  '45air/wpsnapshots:dev',
  'memcached:latest',
  'nginx:latest',
  'docker.elastic.co/elasticsearch/elasticsearch:5.6.5',
  'hitwe/phpmemcachedadmin'
]

const help = function () {
  let help = `
Usage: airlocal image update

Updates any docker images used by your environment to the latest versions available for the specified tag
`
  console.log(help)
  process.exit()
}

const update = function (image) {
  try { execSync(`docker pull ${image}`, { stdio: 'inherit' }) } catch (ex) {}
  console.log()
}

const updateIfUsed = function (image) {
  console.log(`Testing ${image}`)
  let result = execSync(`docker image ls ${image}`).toString()
  // All images say how long "ago" they were created.. Use this to determine if the image exists, since `wc -l` doesn't work on windows
  if (result.indexOf('ago') === -1) {
    console.log(`${image} doesn't exist on this system. Skipping update.`)
    return
  }

  update(image)
}

const updateAll = function () {
  globalImages.map(update)
  images.map(updateIfUsed)
}

const command = async function () {
  switch (commandUtils.subcommand()) {
    case 'update':
      updateAll()
      console.log('done')
      break
    default:
      await help()
      break
  }
}

module.exports = { command }
